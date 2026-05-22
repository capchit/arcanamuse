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
    // 👇 ВАЖНО: в Next.js 14+ params — это Promise!
    const { id } = await params
    
    console.log('📖 [API GET by ID] Fetching inspiration:', id)
    
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }
    
    const { data, error } = await supabaseAdmin
      .from('inspiration_history')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('❌ [API GET by ID] Not found:', error)
      return NextResponse.json({ error: 'Вдохновение не найдено' }, { status: 404 })
    }

    console.log('✅ [API GET by ID] Found:', data.id)
    return NextResponse.json({ success: true, inspiration: data })
  } catch (error) {
    console.error('💥 [API GET by ID] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: удалить вдохновение
export async function DELETE(request, { params }) {
  try {
    // 👇 ВАЖНО: в Next.js 14+ params — это Promise!
    const { id } = await params
    
    console.log('🗑️ [API DELETE] Deleting inspiration:', id)

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('inspiration_history')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('❌ [API DELETE] Error:', error)
      throw error
    }

    console.log('✅ [API DELETE] Deleted:', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('💥 [API DELETE] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}