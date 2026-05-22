// app/api/paths/create-manual/route.js
import { supabase } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // Получаем данные из запроса
    const { userId, title, quests } = await request.json()

    // 1. Создаем сам Путь (Path)
    const { data: path, error: pathError } = await supabase
      .from('paths')
      .insert({
        user_id: userId,
        title: title,
        archetype: 'Самостоятельный путь', 
        archetype_meaning: 'Путь создан вручную пользователем'
      })
      .select()
      .single()

    if (pathError) {
      console.error('Ошибка создания пути:', pathError)
      return NextResponse.json({ success: false, error: pathError.message }, { status: 500 })
    }

    // 2. Подготавливаем квесты для вставки
    const questsToInsert = quests.map((q, i) => ({
      path_id: path.id,
      title: q.title,
      description: q.description || '',
      order_idx: i, // Порядок квестов (0, 1, 2...)
      stat_bonus: q.stat_bonus || { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 }
    }))

    // 3. Вставляем квесты, если они есть
    if (questsToInsert.length > 0) {
      const { error: questsError } = await supabase.from('quests').insert(questsToInsert)
      if (questsError) {
        console.error('Ошибка создания квестов:', questsError)
        // Если квесты не создались, удаляем созданный путь (откат транзакции вручную)
        await supabase.from('paths').delete().eq('id', path.id)
        return NextResponse.json({ success: false, error: questsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, pathId: path.id })

  } catch (error) {
    console.error('Критическая ошибка в API:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}