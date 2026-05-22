// app/api/paths/create-manual/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(request) {
  try {
    const { userId, title, quests } = await request.json()
    
    if (!userId || userId === 'undefined') {
      return NextResponse.json({ error: 'Неверный userId' }, { status: 400 })
    }

    // Создаём путь
    const { data: path, error: pathError } = await supabaseAdmin
      .from('paths')
      .insert({
        user_id: userId,
        title: title,
        archetype: 'Самостоятельный путь',
        archetype_meaning: 'Путь создан вручную'
      })
      .select()
      .single()

    if (pathError) {
      console.error('[Manual Create] Path error:', pathError)
      return NextResponse.json({ error: pathError.message }, { status: 500 })
    }

    // Создаём квесты
    const questsToInsert = quests.map((q, i) => ({
      path_id: path.id,
      title: q.title,
      description: q.description || '',
      order_idx: i,
      stat_bonus: q.stat_bonus || {}
    }))

    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabaseAdmin.from('quests').insert(questsToInsert)
      if (questsError) {
        console.error('[Manual Create] Quests error:', questsError)
        await supabaseAdmin.from('paths').delete().eq('id', path.id)
        return NextResponse.json({ error: questsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, pathId: path.id })
  } catch (error) {
    console.error('[Manual Create] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}