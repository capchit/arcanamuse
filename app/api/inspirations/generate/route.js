// app/api/inspirations/generate/route.js
import { NextResponse } from 'next/server'
import { generateInspiration } from '@/lib/ai/generate'

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
    console.log('🤖 [API] Generating inspiration (session:', Date.now(), ')')

    let result
    try {
      result = await withTimeout(generateInspiration(), 8000)
      console.log('✅ [API] AI responded')
    } catch (aiErr) {
      console.warn('⚠️ [API] AI timeout, using fallback')
      // Фолбэк уже встроен в generateInspiration()
      result = { success: false, error: 'Generation failed' }
    }

    if (!result?.archetype) {
      return NextResponse.json({ success: false, error: 'Не удалось сгенерировать' }, { status: 500 })
    }

    // 👇 Отключаем кэширование на всех уровнях
    return NextResponse.json(
      { success: true, card: result },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate, private, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  } catch (error) {
    console.error('💥 [API] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}