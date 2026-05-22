// app/api/paths/finish/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// 👇 ВСТАВЬ ТУ ЖЕ ФУНКЦИЮ СЮДА (копируй из шага 1)
async function recalculateUserStats(userId) {
  console.log('🔁 [RECALC] Start for:', userId)
  
  // 1. Получаем все выполненные квесты
  const { data: quests, error } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (error) { console.error('[RECALC] Error:', error); return }

  // 2. Суммируем очки
  const totals = { vision: 0, craft: 0, focus: 0, voice: 0, resilience: 0, insight: 0 }
  
  if (quests) {
    for (const q of quests) {
      try {
        const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
        if (bonuses) {
          for (const [key, val] of Object.entries(bonuses)) {
            if (totals.hasOwnProperty(key)) {
              totals[key] += (typeof val === 'number' ? val : 0)
            }
          }
        }
      } catch (e) { console.warn('[RECALC] Parse error', e) }
    }
  }

  console.log('🔁 [RECALC] Totals:', totals)

  // 3. Обновляем таблицу статов
  await supabaseAdmin.from('user_stats').delete().eq('user_id', userId)
  
  const toInsert = Object.entries(totals)
    .filter(([_, val]) => val > 0)
    .map(([stat_name, value]) => ({ user_id: userId, stat_name, value }))

  if (toInsert.length > 0) {
    await supabaseAdmin.from('user_stats').insert(toInsert)
  }
}

export async function POST(request) {
  try {
    const { pathId } = await request.json()
    const { data: path } = await supabaseAdmin.from('paths').select('user_id').eq('id', pathId).single()
    if (!path) return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })

    const userId = path.user_id

    await supabaseAdmin.from('paths').update({ status: 'completed' }).eq('id', pathId)
    await supabaseAdmin.from('quests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('path_id', pathId).neq('status', 'completed')

    await recalculateUserStats(userId) // 👈 Вызываем функцию

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}