// app/api/paths/create/route.js
// app/api/paths/route.js
import { supabase } from '@/lib/db'
import { generatePath } from '@/lib/ai/generate'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { userId, goal } = await request.json()
    
    console.log('[API] Создание пути для:', userId)
    
    // 1. Генерация (с встроенным фолбэком, если нет токена)
    const aiData = await generatePath(goal)
    
    if (!aiData?.stages?.length) {
      return NextResponse.json(
        { success: false, error: 'ИИ не сгенерировал квесты' },
        { status: 400 }
      )
    }
    
    // 2. Создание пути
    const { data: path, error: pathError } = await supabase
      .from('paths')
      .insert({
        user_id: userId,
        title: goal,
        archetype: aiData.archetype,
        archetype_meaning: aiData.archetype_meaning
      })
      .select()
      .single()
    
    if (pathError) {
      console.error('[API] Ошибка создания пути:', pathError)
      return NextResponse.json(
        { success: false, error: pathError.message },
        { status: 400 }
      )
    }
    
    // 3. Создание квестов
    const questsToInsert = (aiData.stages || []).map((s, i) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabase.from('quests').insert(questsToInsert)
      if (questsError) {
        console.error('[API] Ошибка квестов:', questsError)
        // Откат: удаляем путь, если квесты не встали
        await supabase.from('paths').delete().eq('id', path.id)
        return NextResponse.json(
          { success: false, error: questsError.message },
          { status: 400 }
        )
      }
    }
    
    console.log('[API] Путь создан успешно:', path.id)
    return NextResponse.json({ success: true, pathId: path.id })
    
  } catch (error) {
    console.error('[API] Критическая ошибка:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}