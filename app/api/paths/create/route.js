// app/api/paths/create/route.js
import { createClient } from '@supabase/supabase-js'
import { generatePath } from '@/lib/ai/generate'
import { NextResponse } from 'next/server'

// 👇 Создаём клиент с SERVICE ROLE ключом (обходит RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request) {
  try {
    const { userId, goal } = await request.json()
    
    console.log('[API] Создание пути для:', userId)
    
    // Проверка: userId должен быть валидным UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!userId || !uuidRegex.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Неверный userId' },
        { status: 400 }
      )
    }
    
    // Генерация пути
    const aiData = await generatePath(goal)
    
    if (!aiData?.stages?.length) {
      return NextResponse.json(
        { success: false, error: 'ИИ не сгенерировал квесты' },
        { status: 400 }
      )
    }
    
    // Создание пути (RLS bypassed)
    const { data: path, error: pathError } = await supabaseAdmin
      .from('paths')
      .insert({
        user_id: userId,
        title: goal,
        archetype: aiData.archetype,
        archetype_meaning: aiData.archetype_meaning
      })
      .select()
      .single()
    
    if (pathError) {
      console.error('[API] Ошибка пути:', pathError)
      return NextResponse.json(
        { success: false, error: pathError.message },
        { status: 400 }
      )
    }
    
    // Создание квестов
    const questsToInsert = (aiData.stages || []).map((s, i) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabaseAdmin.from('quests').insert(questsToInsert)
      if (questsError) {
        console.error('[API] Ошибка квестов:', questsError)
        await supabaseAdmin.from('paths').delete().eq('id', path.id)
        return NextResponse.json(
          { success: false, error: questsError.message },
          { status: 400 }
        )
      }
    }
    
    console.log('[API] Путь создан:', path.id)
    return NextResponse.json({ success: true, pathId: path.id })
    
  } catch (error) {
    console.error('[API] Ошибка:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}