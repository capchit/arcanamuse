// app/api/paths/[pathId]/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
      // Загружаем конкретный путь
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
      // Загружаем активный путь (последний созданный)
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
    
    // Загружаем квесты
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
    console.error('[API] Load path error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}