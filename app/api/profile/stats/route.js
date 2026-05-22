// app/api/profile/stats/route.js
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    console.log('📊 [PROFILE API] Request for userId:', userId)

    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('📊 [PROFILE API] Invalid userId:', userId)
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    // Загружаем статы из БД
    const { data: stats, error } = await supabaseAdmin
      .from('user_stats')
      .select('stat_name, value')
      .eq('user_id', userId)
      .gt('value', 0)

    if (error) {
      console.error('📊 [PROFILE API] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('📊 [PROFILE API] Raw stats from DB:', stats)

    // Преобразуем массив в объект
    const statsObj = {}
    if (stats && stats.length > 0) {
      for (const s of stats) {
        statsObj[s.stat_name] = typeof s.value === 'number' ? s.value : 0
      }
    }

    // Считаем уровень
    const totalPoints = Object.values(statsObj).reduce((sum, val) => sum + val, 0)
    const level = Math.floor(totalPoints / 10) + 1
    const progress = totalPoints % 10
    
    const titles = ['Новичок', 'Ученик', 'Мастер', 'Эксперт', 'Легенда', 'Архимаг']
    const title = titles[Math.min(level - 1, titles.length - 1)]

    const response = {
      stats: statsObj,
      level,
      progress,
      nextLevelAt: 10,
      title,
      totalPoints
    }

    console.log('📊 [PROFILE API] Sending response:', response)
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('📊 [PROFILE API] Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}