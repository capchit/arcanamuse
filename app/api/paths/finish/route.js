// app/api/paths/finish/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

async function recalculateStats(userId) {
  const { data: quests } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (!quests) return
  
  const totals = {}
  for (const q of quests) {
    const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
    if (bonuses) {
      for (const [key, val] of Object.entries(bonuses)) {
        totals[key] = (totals[key] || 0) + val
      }
    }
  }
  
  await supabaseAdmin.from('user_stats').delete().eq('user_id', userId)
  const statsToInsert = Object.entries(totals).map(([stat_name, value]) => ({ 
    user_id: userId, stat_name, value 
  }))
  if (statsToInsert.length > 0) {
    await supabaseAdmin.from('user_stats').insert(statsToInsert)
  }
}

export async function POST(request) {
  try {
    const { pathId } = await request.json()
    console.log('[API Finish] Path ID:', pathId)

    if (!pathId) {
      return NextResponse.json({ error: 'pathId required' }, { status: 400 })
    }

    // Получаем user_id
    const { data: pathData } = await supabaseAdmin
      .from('paths')
      .select('user_id')
      .eq('id', pathId)
      .single()

    if (!pathData) {
      return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })
    }

    const userId = pathData.user_id

    // Обновляем путь
    await supabaseAdmin
      .from('paths')
      .update({ status: 'completed' })
      .eq('id', pathId)

    // Отмечаем все квесты
    await supabaseAdmin
      .from('quests')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('path_id', pathId)

    // Пересчитываем статы
    await recalculateStats(userId)

    console.log('[API Finish] Success')
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[API Finish] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}