// lib/recalculateStats.js
import { createClient } from '@supabase/supabase-js'

export async function recalculateUserStats(userId) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  console.log('🔁 [RECALC] Start for userId:', userId)

  // 1. Получаем квесты
  const { data: quests, error: questsError } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  console.log('🔁 [RECALC] Quests found:', quests?.length || 0)
  if (questsError) console.error('🔁 [RECALC] Quests error:', questsError)

  // 2. Считаем тоталы
  const totals = { vision: 0, craft: 0, focus: 0, voice: 0, resilience: 0, insight: 0 }
  
  if (quests) {
    for (const q of quests) {
      try {
        const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
        console.log('🔁 [RECALC] Quest bonuses:', bonuses)
        
        for (const [key, val] of Object.entries(bonuses || {})) {
          if (totals.hasOwnProperty(key) && typeof val === 'number' && val > 0) {
            totals[key] += val
            console.log(`🔁 [RECALC] +${val} to ${key} = ${totals[key]}`)
          }
        }
      } catch (e) {
        console.warn('🔁 [RECALC] Parse error:', e)
      }
    }
  }

  console.log('🔁 [RECALC] Final totals:', totals)

  // 3. Удаляем старые
  const { error: deleteError } = await supabaseAdmin
    .from('user_stats')
    .delete()
    .eq('user_id', userId)
  console.log('🔁 [RECALC] Delete result:', deleteError || 'OK')

  // 4. Вставляем новые
  const toInsert = Object.entries(totals)
    .filter(([_, v]) => v > 0)
    .map(([stat_name, value]) => ({ user_id: userId, stat_name, value }))

  console.log('🔁 [RECALC] To insert:', toInsert)

  if (toInsert.length > 0) {
    const { error: insertError, data: inserted } = await supabaseAdmin
      .from('user_stats')
      .insert(toInsert)
      .select()
    
    console.log('🔁 [RECALC] Insert result:', { error: insertError, data: inserted })
  }

  return { success: true, stats: totals }
}