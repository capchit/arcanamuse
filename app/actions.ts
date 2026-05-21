// app/actions.ts
'use server'
import { aiClient, modelName } from '@/lib/ai/client'
import { isUnexpected } from '@azure-rest/ai-inference'
import { supabase } from '@/lib/db'
import { generatePath, generateInspiration } from '@/lib/ai/generate'
import { revalidatePath } from 'next/cache'

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

async function recalculateUserStats(userId: string) {
  const { data: quests, error } = await supabase
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (error) { console.error('❌ Ошибка получения квестов:', error); return }

  const totals: Record<string, number> = {}
  for (const q of quests || []) {
    try {
      const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
      for (const [stat, val] of Object.entries(bonuses || {})) {
        if (typeof val === 'number' && val > 0) {
          totals[stat] = (totals[stat] || 0) + val
        }
      }
    } catch (e) { console.warn('⚠️ Ошибка парсинга статов:', e) }
  }

  await supabase.from('user_stats').delete().eq('user_id', userId)
  
  if (Object.keys(totals).length > 0) {
    const statsToInsert = Object.entries(totals).map(([stat_name, value]) => ({ user_id: userId, stat_name, value }))
    await supabase.from('user_stats').insert(statsToInsert)
  }
}

// === АВТОРИЗАЦИЯ ===

export async function handleRegister(email: string, password: string) {
  'use server'
  
  console.log('🔐 [SERVER] handleRegister called for:', email)
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      }
    })
    
    if (authError) {
      console.error('❌ [SERVER] Supabase signUp error:', authError)
      
      if (authError.message?.includes('User already registered')) {
        return { success: false, error: 'Этот email уже занят' }
      }
      return { success: false, error: authError.message }
    }
    
    if (!authData?.user) {
      console.error('❌ [SERVER] No user created in signUp')
      return { success: false, error: 'Пользователь не создан' }
    }

    // Создаём профиль вручную (на случай, если триггер не сработал)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ 
        id: authData.user.id, 
        email: authData.user.email 
      })
    
    if (profileError) {
      console.warn('⚠️ [SERVER] Profile creation warning:', profileError)
      // Не блокируем регистрацию — триггер может создать профиль позже
    }

    console.log('✅ [SERVER] Registration successful:', authData.user.email)
    
    return { 
      success: true, 
      user: { id: authData.user.id, email: authData.user.email } 
    }
  } catch (e: any) {
    console.error('💥 [SERVER] Exception in handleRegister:', e)
    return { success: false, error: e.message || 'Ошибка регистрации' }
  }
}


export async function handleLogin(email: string, password: string) {
  'use server'
  
  const { data, error } = await supabase.auth.signInWithPassword({ 
    email, 
    password 
  })
  
  if (error) {
    console.error('❌ [SERVER] Login error:', error.message)
    return { success: false, error: error.message }
  }
  
  if (!data?.user) {
    console.error('❌ [SERVER] No user in response')
    return { success: false, error: 'Authentication failed' }
  }
  
  console.log('✅ [SERVER] Login successful for:', data.user.email)
  console.log('🔑 [SERVER] Session created, has session:', !!data.session)
  
  return { 
    success: true, 
    user: { 
      id: data.user.id, 
      email: data.user.email 
    } 
  }
}

export async function handleLogout() {
  await supabase.auth.signOut()
  revalidatePath('/')
}

export async function getCurrentUserAction() {
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email } : null
}

// === ПУТИ И КВЕСТЫ ===

export async function createNewPath(userId: string, goal: string) {
  try {
    const aiData = await generatePath(goal)
    
    const { data: path, error: pathError } = await supabase
      .from('paths')
      .insert({ user_id: userId, title: goal, archetype: aiData.archetype, archetype_meaning: aiData.archetype_meaning })
      .select()
      .single()
    
    if (pathError) throw pathError

    const questsToInsert = (aiData.stages || []).map((s: any, i: number) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabase.from('quests').insert(questsToInsert)
      if (questsError) throw questsError
    }

    revalidatePath('/my-path')
    return { success: true, pathId: path.id }
  } catch (error: any) {
    console.error('❌ Ошибка создания пути:', error)
    return { success: false, error: error.message || 'Не удалось создать путь' }
  }
}

export async function createManualPath(userId: string, title: string, archetype: string, archetype_meaning: string, stages: any[]) {
  try {
    const { data: path, error: pathError } = await supabase
      .from('paths')
      .insert({ user_id: userId, title, archetype, archetype_meaning })
      .select()
      .single()
    
    if (pathError) throw pathError

    const questsToInsert = stages.map((s: any, i: number) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabase.from('quests').insert(questsToInsert)
      if (questsError) throw questsError
    }

    revalidatePath('/my-path')
    return { success: true, pathId: path.id }
  } catch (error: any) {
    return { success: false, error: error.message || 'Не удалось создать путь' }
  }
}

export async function finishQuest(questId: string) {
  try {
    const { data: quest, error: questError } = await supabase
      .from('quests')
      .select('*, paths(user_id)')
      .eq('id', questId)
      .single()
    
    if (questError || !quest) throw new Error('Квест не найден')

    const { error: updateError } = await supabase
      .from('quests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', questId)
    
    if (updateError) throw updateError

    const bonuses = typeof quest.stat_bonus === 'string' ? JSON.parse(quest.stat_bonus) : quest.stat_bonus
    const statsToUpsert = Object.entries(bonuses || {}).map(([stat, val]: [string, any]) => ({
      user_id: quest.paths.user_id,
      stat_name: stat,
      value: typeof val === 'number' ? val : 0
    })).filter(s => s.value > 0)

    if (statsToUpsert.length > 0) {
      for (const stat of statsToUpsert) {
        await supabase.from('user_stats').upsert(stat, { onConflict: 'user_id,stat_name' })
      }
    }

    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Не удалось завершить квест' }
  }
}

export async function uncompleteQuest(questId: string) {
  try {
    const { data: quest, error: questError } = await supabase
      .from('quests')
      .select('*, paths(user_id)')
      .eq('id', questId)
      .single()
    
    if (questError || !quest || quest.status !== 'completed') return { success: true }

    await supabase.from('quests').update({ status: 'pending', completed_at: null }).eq('id', questId)
    await recalculateUserStats(quest.paths.user_id)

    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Не удалось отменить квест' }
  }
}

export async function deleteQuest(questId: string) {
  try {
    const { data: quest, error } = await supabase.from('quests').select('*, paths(user_id)').eq('id', questId).single()
    if (error || !quest) return { success: false, error: 'Квест не найден' }

    if (quest.status === 'completed') {
      await supabase.from('quests').delete().eq('id', questId)
      await recalculateUserStats(quest.paths.user_id)
    } else {
      await supabase.from('quests').delete().eq('id', questId)
    }

    revalidatePath('/profile')
    revalidatePath('/my-path')
    return { success: true }
  } catch (error: any) {
    console.error('Ошибка удаления квеста:', error)
    return { success: false, error: 'Не удалось удалить' }
  }
}

export async function getUserActivePath(userId: string, pathId?: string) {
  let query = supabase.from('paths').select('*').eq('user_id', userId)
  
  if (pathId) {
    query = query.eq('id', pathId)
  } else {
    query = query.order('created_at', { ascending: false }).limit(1)
  }
  
  const { data: path, error } = await query.single()
  if (error || !path) return null
  
  const { data: quests } = await supabase
    .from('quests')
    .select('*')
    .eq('path_id', path.id)
    .order('order_idx', { ascending: true })
  
  return { ...path, quests: quests || [] }
}

// === ПРОФИЛЬ ===

export async function getUserStats(userId: string) {
  const { data: stats } = await supabase
    .from('user_stats')
    .select('stat_name, value')
    .eq('user_id', userId)
    .gt('value', 0)

  const typedStats = (stats || []) as Array<{ stat_name: string; value: number }>
  const statsObj = Object.fromEntries(typedStats.map(s => [s.stat_name, s.value]))
  const totalPoints = Object.values(statsObj).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)
  const level = Math.floor(totalPoints / 10) + 1
  const progress = totalPoints % 10
  
  const titles = ['Новичок', 'Ученик', 'Мастер', 'Эксперт', 'Легенда', 'Архимаг']
  const title = titles[Math.min(level - 1, titles.length - 1)]
  
  return { stats: statsObj, level, progress, nextLevelAt: 10, title, totalPoints }
}

export async function getUserQuestHistory(userId: string) {
  const { data } = await supabase
    .from('quests')
    .select('title, description, completed_at, stat_bonus, paths!inner(title)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)
  
  return (data || []).map(q => ({
    title: q.title,
    description: q.description,
    completed_at: q.completed_at,
    stat_bonus: q.stat_bonus,
    path_title: (q.paths as any)?.title
  }))
}

// === ВДОХНОВЕНИЕ ===

export async function generateInspirationAction(userId: string) {
  try {
    const card = await generateInspiration()
    if (!card) return { success: false, error: 'Карта не сгенерировалась' }
    return { success: true, card }
  } catch (e: any) {
    console.error('❌ Ошибка генерации:', e)
    return { success: false, error: e.message || 'Неизвестная ошибка' }
  }
}

export async function saveInspirationToHistory(userId: string, card: any) {
  try {
    const { error } = await supabase.from('inspiration_history').insert({
      user_id: userId,
      archetype: card.archetype,
      quote: card.quote,
      action: card.action,
      data: card
    })
    if (error) throw error
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Ошибка сохранения' }
  }
}

export async function getInspirationHistory(userId: string) {
  const { data } = await supabase
    .from('inspiration_history')
    .select('id, archetype, quote, action, data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

export async function getInspirationById(id: string) {
  const { data } = await supabase.from('inspiration_history').select('*').eq('id', id).single()
  if (!data) return null
  try {
    return typeof data.data === 'string' ? JSON.parse(data.data) : data.data
  } catch {
    return { archetype: data.archetype, quote: data.quote, action: data.action }
  }
}

// === УПРАВЛЕНИЕ ПУТЯМИ ===

export async function getUserPaths(userId: string) {
  const { data } = await supabase
    .from('paths')
    .select(`id, title, archetype, status, created_at, quests!left(status)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (data || []).map(p => ({
    ...p,
    completed_count: (p.quests || []).filter((q: any) => q.status === 'completed').length,
    total_count: (p.quests || []).length
  }))
}

export async function togglePathStatus(pathId: string, newStatus: 'active' | 'paused') {
  try {
    const { error } = await supabase.from('paths').update({ status: newStatus }).eq('id', pathId)
    if (error) throw error
    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Ошибка обновления' }
  }
}

export async function finishPath(pathId: string) {
  try {
    const { data: path } = await supabase.from('paths').select('user_id').eq('id', pathId).single()
    if (!path) return { success: false, error: 'Путь не найден' }

    await supabase.from('quests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('path_id', pathId)
      .neq('status', 'completed')

    await supabase.from('paths').update({ status: 'completed' }).eq('id', pathId)
    await recalculateUserStats(path.user_id)

    revalidatePath('/paths')
    revalidatePath('/my-path')
    revalidatePath('/profile')
    return { success: true }
  } catch (e: any) {
    console.error('❌ Ошибка завершения пути:', e)
    return { success: false, error: e.message || 'Не удалось завершить' }
  }
}

export async function restorePath(pathId: string) {
  try {
    const { error } = await supabase.from('paths').update({ status: 'active' }).eq('id', pathId)
    if (error) throw error
    revalidatePath('/paths')
    revalidatePath('/my-path')
    return { success: true }
  } catch (e: any) {
    console.error('❌ Ошибка восстановления пути:', e)
    return { success: false, error: e.message || 'Не удалось восстановить' }
  }
}

export async function deletePath(pathId: string) {
  try {
    const { data: path } = await supabase.from('paths').select('user_id').eq('id', pathId).single()
    if (!path) return { success: false, error: 'Путь не найден' }

    await supabase.from('quests').delete().eq('path_id', pathId)
    await supabase.from('paths').delete().eq('id', pathId)
    await recalculateUserStats(path.user_id)

    revalidatePath('/profile')
    revalidatePath('/my-path')
    return { success: true }
  } catch (e: any) {
    console.error('❌ Ошибка удаления пути:', e)
    return { success: false, error: e.message || 'Не удалось удалить' }
  }
}

// === ИИ-ФУНКЦИИ ===

export async function enhanceQuestWithAI(title: string) {
  try {
    const prompt = `Для квеста "${title}" придумай:
1. Короткое описание (1-2 предложения)
2. Бонусы к статам (1-2 очка между: vision, craft, focus, voice, resilience, insight)
Верни ТОЛЬКО JSON: {"description": "...", "stat_bonus": {"vision":0,"craft":0,"focus":0,"voice":0,"resilience":0,"insight":0}}`

    const response = await aiClient.path("/chat/completions").post({
      body: { messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 300, model: modelName }
    })
    if (isUnexpected(response)) throw response.body.error
    const text = response.body.choices?.[0]?.message?.content
    const match = text?.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { description: "Выполните задание.", stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:0 } }
  } catch (e) {
    console.error(e)
    return { description: "Выполните это задание.", stat_bonus: { vision:1, craft:0, focus:0, voice:0, resilience:0, insight:1 } }
  }
}

export async function updatePathFull(pathId: string, title: string, quests: any[]) {
  try {
    await supabase.from('paths').update({ title }).eq('id', pathId)
    await supabase.from('quests').delete().eq('path_id', pathId)
    
    if (quests.length > 0) {
      const questsToInsert = quests.map((q, i) => ({
        path_id: pathId,
        title: q.title,
        description: q.description || "",
        order_idx: i,
        stat_bonus: q.stat_bonus || {}
      }))
      await supabase.from('quests').insert(questsToInsert)
    }
    
    revalidatePath('/profile')
    revalidatePath('/my-path')
    return { success: true }
  } catch (e) {
    return { success: false, error: 'Ошибка сохранения' }
  }
}

export async function getPathById(pathId: string) {
  const { data: path } = await supabase.from('paths').select('*').eq('id', pathId).single()
  if (!path) return null
  
  const { data: quests } = await supabase
    .from('quests')
    .select('*')
    .eq('path_id', pathId)
    .order('order_idx', { ascending: true })
  
  return { ...path, quests: quests || [] }
}

export async function resetUserProgress(userId: string) {
  try {
    await supabase.from('quests').delete().match({ user_id: userId })
    await supabase.from('paths').delete().eq('user_id', userId)
    await supabase.from('inspiration_history').delete().eq('user_id', userId)
    await supabase.from('user_stats').delete().eq('user_id', userId)
    
    revalidatePath('/profile')
    revalidatePath('/my-path')
    return { success: true }
  } catch (e: any) {
    console.error('❌ Ошибка сброса:', e)
    return { success: false, error: e.message }
  }
}

export async function validateUser(userId: string) {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).single()
  return !!data
}

export async function deleteInspiration(id: string) {
  try {
    const { data } = await supabase.from('inspiration_history').select('user_id').eq('id', id).single()
    if (!data) return { success: false, error: 'Карта не найдена' }

    await supabase.from('inspiration_history').delete().eq('id', id)
    await recalculateUserStats(data.user_id)

    revalidatePath('/profile')
    return { success: true }
  } catch (e: any) {
    console.error('❌ Ошибка удаления вдохновения:', e)
    return { success: false, error: e.message || 'Не удалось удалить' }
  }
}

// === УМНОЕ СОЗДАНИЕ ВРУЧНУЮ ===
export async function createSmartManualPath(userId: string, title: string, quests: any[]) {
  try {
    const prompt = `Путь: "${title}". Квесты: ${quests.map((q:any) => q.title).join(', ')}. Придумай архетип (1-2 слова) и значение (1 предложение). Верни ТОЛЬКО JSON: {"archetype": "...", "meaning": "..."}`
    
    let archetype = "Созидатель", meaning = "Твой уникальный путь к цели."
    try {
      const res = await aiClient.path("/chat/completions").post({
        body: { messages: [{ role: "user", content: prompt }], temperature: 0.8, max_tokens: 150, model: modelName }
      })
      if (!isUnexpected(res)) {
        const text = res.body.choices?.[0]?.message?.content
        const match = text?.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          archetype = parsed.archetype || archetype
          meaning = parsed.meaning || meaning
        }
      }
    } catch (e) { console.warn('⚠️ ИИ для архетипа не ответил') }

    const { data: path, error: pathError } = await supabase
      .from('paths')
      .insert({ user_id: userId, title, archetype, archetype_meaning: meaning })
      .select()
      .single()
    if (pathError) throw pathError

    const questsToInsert = quests.map((q: any, i: number) => ({
      path_id: path.id,
      title: q.title,
      description: q.description || `Шаг ${i+1}: ${q.title}`,
      order_idx: i,
      stat_bonus: q.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))
    if (questsToInsert.length > 0) {
      const { error: qError } = await supabase.from('quests').insert(questsToInsert)
      if (qError) throw qError
    }

    revalidatePath('/my-path')
    return { success: true, pathId: path.id }
  } catch (e: any) {
    console.error('❌ Ошибка умного создания:', e)
    return { success: false, error: e.message || 'Не удалось создать путь' }
  }
}