// app/api/paths/create/route.js
import { createClient } from '@supabase/supabase-js'
import { generatePath } from '@/lib/ai/generate'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// 👇 Хелпер для таймаута (не даёт функции зависнуть)
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
    const { userId, goal } = await request.json()
    console.log('🛤️ [CREATE] Start | userId:', userId, '| goal:', goal)

    if (!userId || userId === 'undefined' || userId === 'null') {
      return NextResponse.json({ success: false, error: 'Неверный userId' }, { status: 400 })
    }

    let aiData
    try {
      console.log('🤖 [CREATE] Вызов ИИ (таймаут 6с)...')
      // Ждём ответ ИИ не дольше 6 секунд
      aiData = await withTimeout(generatePath(goal), 6000)
      console.log('✅ [CREATE] ИИ ответил успешно')
    } catch (aiErr) {
      console.warn('⚠️ [CREATE] ИИ не ответил/завис, используем шаблон:', aiErr.message)
      // Гарантированный фолбэк, чтобы API всегда возвращал результат
      aiData = {
        archetype: "Созидатель",
        archetype_meaning: "Твой уникальный путь к цели через последовательные шаги",
        stages: [
          { week: 1, title: "Подготовка", description: `Сформулируй первые 3 шага к цели: "${goal}"`, stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:0 } },
          { week: 2, title: "Первый шаг", description: "Выполни самое простое действие из списка (15-30 мин)", stat_bonus: { vision:0, craft:1, focus:1, voice:0, resilience:1, insight:0 } },
          { week: 3, title: "Корректировка", description: "Оцени прогресс. Что мешало? Измени план.", stat_bonus: { vision:1, craft:0, focus:0, voice:0, resilience:0, insight:1 } },
          { week: 4, title: "Завершение", description: "Доведи начатое до конца и зафиксируй результат", stat_bonus: { vision:0, craft:1, focus:0, voice:1, resilience:1, insight:0 } }
        ]
      }
    }

    if (!aiData?.stages?.length) {
      return NextResponse.json({ success: false, error: 'Нет данных для генерации пути' }, { status: 400 })
    }

    console.log('📝 [CREATE] Вставка пути в БД...')
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
      console.error('❌ [CREATE] Ошибка пути:', pathError)
      return NextResponse.json({ success: false, error: pathError.message }, { status: 500 })
    }

    const questsToInsert = aiData.stages.map((s, i) => ({
      path_id: path.id,
      title: s.title,
      description: s.description,
      order_idx: s.week - 1,
      stat_bonus: s.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    console.log('📋 [CREATE] Вставка квестов:', questsToInsert.length, 'шт.')
    const { error: questsError } = await supabaseAdmin.from('quests').insert(questsToInsert)

    if (questsError) {
      console.error('❌ [CREATE] Ошибка квестов:', questsError)
      // Откат: удаляем путь, если квесты не встали
      await supabaseAdmin.from('paths').delete().eq('id', path.id)
      return NextResponse.json({ success: false, error: questsError.message }, { status: 500 })
    }

    console.log('🎉 [CREATE] Успех! pathId:', path.id)
    return NextResponse.json({ success: true, pathId: path.id })

  } catch (error) {
    console.error('💥 [CREATE] Критическая ошибка:', error)
    return NextResponse.json({ success: false, error: error.message || 'Внутренняя ошибка' }, { status: 500 })
  }
}