// app/api/quests/toggle/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function recalculateStats(userId) {
  console.log('[Recalculate] Starting for user:', userId)
  
  const { data: quests, error: questsError } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (questsError) {
    console.error('[Recalculate] Error fetching quests:', questsError)
    return
  }

  const totals = {}
  for (const q of quests || []) {
    try {
      const bonuses = typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus) : q.stat_bonus
      if (bonuses) {
        for (const [key, val] of Object.entries(bonuses)) {
          totals[key] = (totals[key] || 0) + (typeof val === 'number' ? val : 0)
        }
      }
    } catch (e) {
      console.warn('[Recalculate] Parse error:', e)
    }
  }

  console.log('[Recalculate] Totals:', totals)

  await supabaseAdmin.from('user_stats').delete().eq('user_id', userId)
  
  const statsToInsert = Object.entries(totals).map(([stat_name, value]) => ({
    user_id: userId,
    stat_name,
    value
  }))

  if (statsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('user_stats').insert(statsToInsert)
    if (insertError) {
      console.error('[Recalculate] Error inserting stats:', insertError)
    }
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { questId, isCompleted } = body
    
    console.log('[API Toggle] Received:', { questId, isCompleted })
    
    if (!questId) {
      return NextResponse.json({ error: 'questId required' }, { status: 400 })
    }

    // Получаем информацию о квесте
    const { data: questData, error: questError } = await supabaseAdmin
      .from('quests')
      .select('path_id, paths(user_id)')
      .eq('id', questId)
      .single()
      
    if (questError || !questData) {
      console.error('[API Toggle] Quest not found:', questError)
      return NextResponse.json({ error: 'Квест не найден' }, { status: 404 })
    }

    const userId = questData.paths.user_id
    console.log('[API Toggle] User ID:', userId)

    // Обновляем статус
    const { error: updateError } = await supabaseAdmin
      .from('quests')
      .update({ 
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', questId)

    if (updateError) {
      console.error('[API Toggle] Update error:', updateError)
      throw updateError
    }

    console.log('[API Toggle] Quest updated, recalculating stats...')
    
    // Пересчитываем статы
    await recalculateStats(userId)

    console.log('[API Toggle] Success')
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[API Toggle] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}