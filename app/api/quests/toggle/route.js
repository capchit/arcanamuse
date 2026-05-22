// app/api/quests/toggle/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function recalculateUserStats(userId) {
  console.log('🔁 [RECALC] Start for userId:', userId)
  
  // 1. Получаем выполненные квесты
  const { data: quests, error: questsError } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (questsError) {
    console.error('[RECALC] Error fetching quests:', questsError)
    return { success: false, error: questsError.message }
  }

  console.log('[RECALC] Found completed quests:', quests?.length || 0)

  // 2. Суммируем бонусы
  const totals = { vision: 0, craft: 0, focus: 0, voice: 0, resilience: 0, insight: 0 }
  
  if (quests && quests.length > 0) {
    for (const q of quests) {
      try {
        const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
        if (bonuses && typeof bonuses === 'object') {
          for (const [key, val] of Object.entries(bonuses)) {
            if (totals.hasOwnProperty(key) && typeof val === 'number') {
              totals[key] += val
              console.log(`  [RECALC] +${val} to ${key} = ${totals[key]}`)
            }
          }
        }
      } catch (e) {
        console.warn('[RECALC] Parse error for quest:', q.id, e)
      }
    }
  }

  console.log('[RECALC] Final totals:', totals)

  // 3. Удаляем старые статы
  const { error: deleteError } = await supabaseAdmin
    .from('user_stats')
    .delete()
    .eq('user_id', userId)
  
  if (deleteError) {
    console.error('[RECALC] Delete error:', deleteError)
  } else {
    console.log('[RECALC] Old stats deleted')
  }

  // 4. Вставляем новые (только если > 0)
  const toInsert = Object.entries(totals)
    .filter(([_, val]) => val > 0)
    .map(([stat_name, value]) => ({
      user_id: userId,
      stat_name,
      value
    }))

  console.log('[RECALC] To insert:', toInsert)

  if (toInsert.length > 0) {
    const { error: insertError, data: inserted } = await supabaseAdmin
      .from('user_stats')
      .insert(toInsert)
      .select()  // 👈 Важно: возвращаем вставленные данные
    
    if (insertError) {
      console.error('❌ [RECALC] INSERT FAILED:', insertError)
      return { success: false, error: insertError.message }
    }
    
    console.log('✅ [RECALC] Inserted stats:', inserted)
  } else {
    console.log('[RECALC] No stats to insert (all values are 0)')
  }

  return { success: true, stats: totals }
}

export async function POST(request) {
  try {
    const { questId, isCompleted } = await request.json()
    
    console.log('[Toggle] Quest:', questId, '→', isCompleted ? 'completed' : 'pending')
    
    // Находим квест и владельца
    const { data: quest, error: questError } = await supabaseAdmin
      .from('quests')
      .select('path_id, paths(user_id)')
      .eq('id', questId)
      .single()

    if (questError || !quest) {
      console.error('[Toggle] Quest not found:', questError)
      return NextResponse.json({ error: 'Квест не найден' }, { status: 404 })
    }

    const userId = quest.paths.user_id
    console.log('[Toggle] User ID:', userId)

    // Обновляем статус квеста
    const { error: updateError } = await supabaseAdmin
      .from('quests')
      .update({ 
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', questId)

    if (updateError) {
      console.error('[Toggle] Update error:', updateError)
      throw updateError
    }

    console.log('[Toggle] Quest updated, recalculating stats...')
    
    // Пересчитываем статы
    const recalcResult = await recalculateUserStats(userId)
    
    if (!recalcResult?.success) {
      console.warn('[Toggle] Recalc warning:', recalcResult?.error)
    }

    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[Toggle] Critical error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}