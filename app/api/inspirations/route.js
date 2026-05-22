// app/api/inspirations/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET: список вдохновений
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('inspiration_history')  // 👈 Твоя таблица
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, inspirations: data || [] })
  } catch (error) {
    console.error('[API GET] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: сохранение нового
export async function POST(request) {
  try {
    const { userId, title, quote, content, archetype, archetype_meaning, visual, action, tags } = await request.json()

    console.log('📥 [API POST] Received:', { userId, title, archetype })

    if (!userId || !title) {
      return NextResponse.json({ error: 'userId и title обязательны' }, { status: 400 })
    }

    // 👇 Используем ПРАВИЛЬНЫЕ имена колонок из твоей БД
    const { data, error } = await supabaseAdmin
      .from('inspiration_history')
      .insert({
        user_id: userId,
        title: title,
        quote: quote || content || '',  // ← Колонка называется 'quote'!
        archetype: archetype || null,
        archetype_meaning: archetype_meaning || null,
        visual: visual || null,
        action: action || null,
        // data: tags || [],  // ← Если нужно сохранить теги в поле 'data'
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [API POST] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [API POST] Created:', data.id)
    return NextResponse.json({ success: true, inspiration: data })
  } catch (error) {
    console.error('💥 [API POST] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}