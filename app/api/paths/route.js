// app/api/paths/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET - загрузка списка путей
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })
    }
    
    const { data: paths, error } = await supabaseAdmin
      .from('paths')
      .select(`
        id, title, archetype, status, created_at,
        quests (status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    const pathsWithCounts = paths.map(p => ({
      ...p,
      completed_count: (p.quests || []).filter(q => q.status === 'completed').length,
      total_count: (p.quests || []).length
    }))
    
    return NextResponse.json({ success: true, paths: pathsWithCounts })
  } catch (error) {
    console.error('[API GET paths] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE - удаление пути
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const pathId = searchParams.get('pathId')
    
    if (!pathId) return NextResponse.json({ error: 'pathId required' }, { status: 400 })

    const { data: pathData } = await supabaseAdmin
      .from('paths')
      .select('user_id')
      .eq('id', pathId)
      .single()

    if (!pathData) return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })

    const userId = pathData.user_id

    // Удаляем квесты и путь
    await supabaseAdmin.from('quests').delete().eq('path_id', pathId)
    await supabaseAdmin.from('paths').delete().eq('id', pathId)
    
    // 👇 Пересчитываем статы после удаления
    await recalculateUserStats(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API DELETE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function recalculateStats(userId) {
  const { data: quests } = await supabaseAdmin
    .from('quests')
    .select('stat_bonus, paths!inner(user_id)')
    .eq('paths.user_id', userId)
    .eq('status', 'completed')

  if (!quests) return
  
  const totals = {}
  for (const q of quests || []) {
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