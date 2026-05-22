// app/api/paths/finish/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { recalculateUserStats } from '@/lib/recalculateStats'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request) {
  try {
    const { pathId } = await request.json()
    console.log('[Finish] Path:', pathId)

    const { data: path } = await supabaseAdmin
      .from('paths')
      .select('user_id')
      .eq('id', pathId)
      .single()

    if (!path) return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })

    const userId = path.user_id

    // Завершаем путь
    await supabaseAdmin.from('paths').update({ status: 'completed' }).eq('id', pathId)

    // Отмечаем все квесты пути
    await supabaseAdmin
      .from('quests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('path_id', pathId)
      .neq('status', 'completed')

    // 👇 Пересчитываем статы
    await recalculateUserStats(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Finish] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}