// app/api/quests/toggle/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { recalculateUserStats } from '@/lib/recalculateStats'  // 👈 Импортируем утилиту

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request) {
  try {
    const { questId, isCompleted } = await request.json()
    
    console.log('[Toggle] Quest:', questId, '→', isCompleted ? 'completed' : 'pending')
    
    // Получаем информацию о квесте
    const { data: quest, error: questError } = await supabaseAdmin
      .from('quests')
      .select('path_id, paths(user_id)')
      .eq('id', questId)
      .single()
      
    if (questError || !quest) {
      console.error('[Toggle] Quest not found:', questError)
      return NextResponse.json({ error: 'Квест не найден' }, { status: 404 })
    }

    const userId = quest.paths.user_id

    // Обновляем статус квеста
    const { error: updateError } = await supabaseAdmin
      .from('quests')
      .update({ 
        status: isCompleted ? 'completed' : 'pending',
        completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq('id', questId)

    if (updateError) throw updateError

    // 👇 Пересчитываем статы пользователя
    await recalculateUserStats(userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Toggle] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}