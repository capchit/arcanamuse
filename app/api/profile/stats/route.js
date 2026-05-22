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
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const { data: stats } = await supabaseAdmin
      .from('user_stats')
      .select('stat_name, value')
      .eq('user_id', userId)
      .gt('value', 0)

    const statsObj = {}
    if (stats) {
      for (const s of stats) {
        statsObj[s.stat_name] = s.value
      }
    }

    const totalPoints = Object.values(statsObj).reduce((sum, val) => sum + val, 0)
    const level = Math.floor(totalPoints / 10) + 1
    const progress = totalPoints % 10
    
    const titles = ['Новичок', 'Ученик', 'Мастер', 'Эксперт', 'Легенда', 'Архимаг']
    const title = titles[Math.min(level - 1, titles.length - 1)]

    return NextResponse.json({
      stats: statsObj,
      level,
      progress,
      nextLevelAt: 10,
      title,
      totalPoints
    })
    
  } catch (error) {
    console.error('[API Profile] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}