// app/api/paths/create/route.js
import { createClient } from '@supabase/supabase-js'
import { generatePath } from '@/lib/ai/generate'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Хелпер для таймаута ИИ
const withTimeout = (promise, ms) => {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms)
    })
  ]).finally(() => clearTimeout(timer))
}

export async function POST(request) {
  try {
    // 👇 Читаем тело запроса ОДИН РАЗ
    const { userId, goal } = await request.json()
    
    console.log('🛤️ [API CREATE] Received:', { userId, goal })
    console.log('🛤️ [API CREATE] userId type:', typeof userId)
    
    // Проверка userId
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('❌ [API CREATE] Invalid userId:', userId)
      return NextResponse.json({ 
        success: false, 
        error: 'Неверный userId' 
      }, { status: 400 })
    }

    // Проверка формата UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      console.error('❌ [API CREATE] Invalid UUID format:', userId)
      return NextResponse.json({ 
        success: false, 
        error: 'Неверный формат userId' 
      }, { status: 400 })
    }

    // Генерация пути через ИИ (с таймаутом)
    let aiData
    try {
      console.log('🤖 [CREATE] Вызов ИИ (таймаут 6с)...')
      aiData = await withTimeout(generatePath(goal), 6000)
      console.log('✅ [CREATE] ИИ ответил')
    } catch (aiErr) {
      console.warn('⚠️ [CREATE] ИИ не ответил, используем шаблон:', aiErr.message)
      aiData = {
        archetype: "Созидатель",
        archetype_meaning: "Твой уникальный путь к цели",
        stages: [
          { week: 1, title: "Подготовка", description: `Определи первые шаги к: "${goal}"`, stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:0 } },
          { week: 2, title: "Первые действия", description: "Начни выполнять план", stat_bonus: { vision:0, craft:1, focus:1, voice:0, resilience:1, insight:0 } },
          { week: 3, title: "Преодоление", description: "Работай над сложностями", stat_bonus: { vision:0, craft:0, focus:1, voice:0, resilience:2, insight:0 } },
          { week: 4, title: "Завершение", description: "Доведи дело до конца", stat_bonus: { vision:1, craft:1, focus:0, voice:0, resilience:0, insight:1 } }
        ]
      }
    }

    if (!aiData?.stages?.length) {
      return NextResponse.json({ success: false, error: 'Нет данных для генерации' }, { status: 400 })
    }

    // Создание пути в БД
    console.log('📝 [CREATE] Вставка пути...')
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
      console.error('❌ [CREATE] Path error:', pathError)
      return NextResponse.json({ success: false, error: pathError.message }, { status: 500 })
    }

    // Создание квестов
    const questsToInsert = aiData.stages.map((s, i) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    console.log('📋 [CREATE] Вставка квестов:', questsToInsert.length)
    const { error: questsError } = await supabaseAdmin.from('quests').insert(questsToInsert)

    if (questsError) {
      console.error('❌ [CREATE] Quests error:', questsError)
      await supabaseAdmin.from('paths').delete().eq('id', path.id) // Откат
      return NextResponse.json({ success: false, error: questsError.message }, { status: 500 })
    }

    console.log('🎉 [CREATE] Success! pathId:', path.id)
    return NextResponse.json({ success: true, pathId: path.id })

  } catch (error) {
    console.error('💥 [API CREATE] Critical error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Внутренняя ошибка' }, { status: 500 })
  }
}