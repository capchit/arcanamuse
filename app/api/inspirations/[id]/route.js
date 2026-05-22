// app/api/inspirations/[id]/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET: получить одно вдохновение
export async function GET(request, { params }) {
  try {
    const { id } = params
    
    const { data, error } = await supabaseAdmin
      .from('inspiration_history')  // 👈 Правильное имя
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Вдохновение не найдено' }, { status: 404 })
    }

    return NextResponse.json({ success: true, inspiration: data })
  } catch (error) {
    console.error('[API GET inspiration] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: удалить вдохновение
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin
      .from('inspiration_history')  // 👈 Правильное имя
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API DELETE inspiration] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}