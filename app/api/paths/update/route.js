// app/api/paths/update/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request) {
  try {
    const { pathId, title, quests } = await request.json()

    if (!pathId) return NextResponse.json({ error: 'pathId required' }, { status: 400 })

    // 1. Обновляем название пути
    await supabaseAdmin.from('paths').update({ title }).eq('id', pathId)

    // 2. Удаляем старые квесты
    await supabaseAdmin.from('quests').delete().eq('path_id', pathId)

    // 3. Вставляем новые
    if (quests && quests.length > 0) {
      const formatted = quests.map((q, i) => ({
        path_id: pathId,
        title: q.title,
        description: q.description || '',
        order_idx: i,
        stat_bonus: q.stat_bonus || {}
      }))
      await supabaseAdmin.from('quests').insert(formatted)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Update] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}