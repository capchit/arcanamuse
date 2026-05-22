// lib/recalculateStats.js
import { createClient } from '@supabase/supabase-js'

export async function recalculateUserStats(userId) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  console.log('[Recalculate] Starting for user:', userId)

  // Получаем все выполненные квесты
  const { data: quests, error: questsError } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (questsError) {
    console.error('[Recalculate] Error fetching quests:', questsError)
    return { success: false, error: questsError.message }
  }

  console.log('[Recalculate] Found completed quests:', quests?.length || 0)

  // Инициализируем статы
  const totals = {
    vision: 0, craft: 0, focus: 0, voice: 0, resilience: 0, insight: 0
  }

  // Суммируем бонусы
  if (quests && quests.length > 0) {
    for (const q of quests) {
      try {
        const bonuses = typeof q.stat_bonus === 'string' 
          ? JSON.parse(q.stat_bonus) 
          : q.stat_bonus
        
        if (bonuses && typeof bonuses === 'object') {
          for (const [key, val] of Object.entries(bonuses)) {
            if (totals.hasOwnProperty(key) && typeof val === 'number') {
              totals[key] += val
            }
          }
        }
      } catch (e) {
        console.warn('[Recalculate] Parse error for quest:', q.id, e)
      }
    }
  }

  console.log('[Recalculate] Calculated totals:', totals)

  // Удаляем старые статы
  await supabaseAdmin.from('user_stats').delete().eq('user_id', userId)

  // Вставляем новые (только если значение > 0)
  const statsToInsert = Object.entries(totals)
    .filter(([_, value]) => value > 0)
    .map(([stat_name, value]) => ({
      user_id: userId,
      stat_name,
      value
    }))

  if (statsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('user_stats')
      .insert(statsToInsert)

    if (insertError) {
      console.error('[Recalculate] Error inserting stats:', insertError)
      return { success: false, error: insertError.message }
    }
    console.log('[Recalculate] Inserted stats:', statsToInsert.length)
  }

  return { success: true, stats: totals }
}