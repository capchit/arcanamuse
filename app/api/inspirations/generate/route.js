// app/api/inspiration/generate/route.js
import { NextResponse } from 'next/server'
import { generateInspirationAction } from '@/app/actions'

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
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    console.log('🤖 [API] Generating inspiration for:', userId)

    let result
    try {
      result = await withTimeout(generateInspirationAction(userId), 8000)
      console.log('✅ [API] AI responded')
    } catch (aiErr) {
      console.warn('⚠️ [API] AI timeout, using fallback')
      result = {
        success: true,
        card: {
          archetype: "Мудрец",
          archetype_hint: "Делится мудростью и опытом",
          visual: "Древняя библиотека, свет свечей, открытые книги.",
          question: "Какой урок из прошлого поможет тебе сегодня?",
          action: "Запиши одну важную мысль в дневник.",
          tags: ["мудрость", "рефлексия"]
        }
      }
    }

    if (!result?.success || !result?.card) {
      return NextResponse.json({ success: false, error: 'Не удалось сгенерировать карту' }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('💥 [API] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}