// app/api/paths/[pathId]/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET - загрузка пути
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const { pathId } = params
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId required' }, { status: 400 })
    }
    
    let path
    if (pathId && pathId !== 'active') {
      const { data, error } = await supabaseAdmin
        .from('paths')
        .select('*')
        .eq('id', pathId)
        .eq('user_id', userId)
        .single()
      
      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Путь не найден' }, { status: 404 })
      }
      path = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('paths')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error || !data) {
        return NextResponse.json({ success: false, error: 'Активный путь не найден' }, { status: 404 })
      }
      path = data
    }
    
    const { data: quests } = await supabaseAdmin
      .from('quests')
      .select('*')
      .eq('path_id', path.id)
      .order('order_idx', { ascending: true })
    
    return NextResponse.json({ 
      success: true, 
      path: { ...path, quests: quests || [] } 
    })
    
  } catch (error) {
    console.error('[API GET] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// 👇 DELETE - удаление пути
export async function DELETE(request, { params }) {
  try {
    const { pathId } = params
    console.log('[API DELETE] Path ID:', pathId)

    if (!pathId) {
      return NextResponse.json({ error: 'pathId required' }, { status: 400 })
    }

    // Получаем user_id для пересчета статов
    const { data: pathData } = await supabaseAdmin
      .from('paths')
      .select('user_id')
      .eq('id', pathId)
      .single()

    if (!pathData) {
      return NextResponse.json({ error: 'Путь не найден' }, { status: 404 })
    }

    const userId = pathData.user_id

    // 1. Удаляем квесты
    await supabaseAdmin
      .from('quests')
      .delete()
      .eq('path_id', pathId)

    // 2. Удаляем путь
    await supabaseAdmin
      .from('paths')
      .delete()
      .eq('id', pathId)

    // 3. Пересчитываем статы
    await recalculateStats(userId)

    console.log('[API DELETE] Success')
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[API DELETE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Вспомогательная функция пересчета статов
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