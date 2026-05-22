// app/api/inspirations/generate/route.js
import { NextResponse } from 'next/server'
import { generateInspiration } from '@/lib/ai/generate'  // 👈 Прямой импорт из lib

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
    // userId нам не нужен для генерации, но можем прочитать для логов
    const { userId } = await request.json()
    console.log('🤖 [API] Generating inspiration (userId:', userId, ')')

    let result
    try {
      // 👇 Вызываем generateInspiration() БЕЗ userId
      result = await withTimeout(generateInspiration(), 8000)
      console.log('✅ [API] AI responded')
    } catch (aiErr) {
      console.warn('⚠️ [API] AI timeout, using fallback')
      // Фолбэк уже встроен в generateInspiration(), но на всякий случай:
      result = {
        archetype: "Мудрец",
        archetype_hint: "Делится мудростью",
        visual: "Древняя библиотека",
        question: "Какой урок поможет тебе?",
        action: "Запиши мысль в дневник",
        stat_bonus: { vision:1, craft:0, focus:1, voice:0, resilience:0, insight:1 }
      }
    }

    if (!result?.archetype) {
      return NextResponse.json({ success: false, error: 'Не удалось сгенерировать' }, { status: 500 })
    }

    return NextResponse.json({ success: true, card: result })
  } catch (error) {
    console.error('💥 [API] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}