// app/api/paths/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// 👇 ФУНКЦИЯ ПЕРЕСЧЁТА ВНУТРИ ФАЙЛА (чтобы избежать ошибок импорта)
async function recalculateUserStats(userId) {
  console.log('🔁 [RECALC] Start for:', userId)
  
  const { data: quests, error: qErr } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (qErr) { console.error('[RECALC] Quests fetch error:', qErr); return }

  const totals = { vision: 0, craft: 0, focus: 0, voice: 0, resilience: 0, insight: 0 }
  
  if (quests) {
    for (const q of quests) {
      try {
        const b = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
        if (b) {
          for (const [k, v] of Object.entries(b)) {
            if (totals.hasOwnProperty(k)) totals[k] += (typeof v === 'number' ? v : 0)
          }
        }
      } catch (e) { console.warn('[RECALC] Parse err:', e) }
    }
  }
  console.log('[RECALC] Totals:', totals)

  await supabaseAdmin.from('user_stats').delete().eq('user_id', userId)
  
  const toInsert = Object.entries(totals).filter(([_, v]) => v > 0)
    .map(([stat_name, value]) => ({ user_id: userId, stat_name, value }))

  if (toInsert.length > 0) {
    const { error: iErr } = await supabaseAdmin.from('user_stats').insert(toInsert)
    if (iErr) console.error('[RECALC] Insert error:', iErr)
    else console.log('[RECALC] ✅ Inserted:', toInsert.length, 'stats')
  }
}

// === GET: Список путей ===
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  if (!userId) return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })

  const { data: paths, error } = await supabaseAdmin
    .from('paths')
    .select('id, title, archetype, status, created_at, quests(status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const pathsWithCounts = paths.map(p => ({
    ...p,
    completed_count: (p.quests || []).filter(q => q.status === 'completed').length,
    total_count: (p.quests || []).length
  }))

  return NextResponse.json({ success: true, paths: pathsWithCounts })
}

// === DELETE: Удаление пути ===
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const pathId = searchParams.get('pathId')
    if (!pathId) return NextResponse.json({ error: 'pathId required' }, { status: 400 })

    // 1. Узнаём владельца перед удалением
    const { data: pathData } = await supabaseAdmin
      .from('paths')
      .select('user_id')
      .eq('id', pathId)
      .single()

    if (!pathData) return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })

    const userId = pathData.user_id

    // 2. Удаляем квесты и путь
    await supabaseAdmin.from('quests').delete().eq('path_id', pathId)
    await supabaseAdmin.from('paths').delete().eq('id', pathId)

    // 3. Пересчитываем статы после удаления
    await recalculateUserStats(userId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API DELETE] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}