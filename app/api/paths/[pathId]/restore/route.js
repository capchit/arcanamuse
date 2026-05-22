// app/api/paths/[pathId]/restore/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request, { params }) {
  try {
    const { pathId } = params
    console.log('[API Restore] Path ID:', pathId)

    if (!pathId) {
      return NextResponse.json({ error: 'pathId required' }, { status: 400 })
    }

    // Обновляем статус на active
    const { error } = await supabaseAdmin
      .from('paths')
      .update({ status: 'active' })
      .eq('id', pathId)

    if (error) {
      console.error('[API Restore] Error:', error)
      throw error
    }

    console.log('[API Restore] Success')
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('[API Restore] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}