// app/api/inspiration/generate/route.js
import { NextResponse } from 'next/server'
import { generateInspirationAction } from '@/app/actions'

// 👇 Хелпер для таймаута
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

    console.log('🤖 [API] Starting inspiration generation for:', userId)

    // 👇 Ждём ответ ИИ не дольше 8 секунд
    let result
    try {
      result = await withTimeout(generateInspirationAction(userId), 8000)
      console.log('✅ [API] AI responded successfully')
    } catch (aiErr) {
      console.warn('⚠️ [API] AI timeout/error, using fallback:', aiErr.message)
      
      // 🎁 Гарантированный фолбэк — чтобы пользователь всегда получил карту
      result = {
        success: true,
        card: {
          archetype: "Мудрец",
          archetype_hint: "Делится мудростью и опытом",
          visual: "Представь древнюю библиотеку с бесконечными полками книг. Свет свечей мягко освещает страницы, наполненные знаниями.",
          question: "Какой урок из прошлого может помочь тебе сегодня?",
          action: "Запиши одну мысль, которая пришла к тебе сегодня, в заметки или дневник.",
          tags: ["мудрость", "рефлексия", "знания"]
        }
      }
    }

    // Проверка результата
    if (!result?.success || !result?.card) {
      console.error('❌ [API] Invalid result:', result)
      return NextResponse.json({ 
        success: false, 
        error: result?.error || 'Не удалось сгенерировать карту' 
      }, { status: 500 })
    }

    console.log('✅ [API] Returning card:', result.card.archetype)
    return NextResponse.json(result)

  } catch (error) {
    console.error('💥 [API] Critical error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Внутренняя ошибка сервера' 
    }, { status: 500 })
  }
}