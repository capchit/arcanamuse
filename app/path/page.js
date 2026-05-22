// app/path/page.js
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
// 👇 Убрали лишние импорты Server Actions, оставили только enhanceQuestWithAI (он работает)
import { enhanceQuestWithAI } from '@/app/actions'
import { useTheme } from '@/lib/useTheme'
import { ArrowLeft, Sparkles, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/db'

export default function CreatePathPage() {
  const [mode, setMode] = useState('ai')
  const [goal, setGoal] = useState('')
  const [title, setTitle] = useState('')
  const [quests, setQuests] = useState([{ title: '', description: '', stat_bonus: { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 } }])
  const [enhancing, setEnhancing] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

 // app/path/page.js - замени getUserId на эту версию

  const getUserId = async () => {
    console.log('🔐 [GET USER ID] === START ===')
    
    try {
      // 👇 Принудительно получаем СВЕЖУЮ сессию (не из кэша)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ [GET USER ID] getSession error:', sessionError)
        router.push('/login')
        return null
      }
      
      if (!session?.user) {
        console.warn('⚠️ [GET USER ID] No session user, trying getUser()...')
        
        // Пробуем альтернативный метод
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          console.error('❌ [GET USER ID] getUser also failed:', userError)
          router.push('/login')
          return null
        }
        
        console.log('✅ [GET USER ID] Got user via getUser():', user.id)
        return user.id
      }
      
      console.log('✅ [GET USER ID] Got user via getSession():', {
        id: session.user.id,
        email: session.user.email,
        aud: session.user.aud
      })
      
      return session.user.id
      
    } catch (e) {
      console.error('💥 [GET USER ID] Exception:', e)
      router.push('/login')
      return null
    }
  }

  const addQuest = () => setQuests([...quests, { title: '', description: '', stat_bonus: { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 } }])
  const removeQuest = (idx) => setQuests(quests.filter((_, i) => i !== idx))
  const updateQuestField = (idx, field, value) => {
    const newQuests = [...quests]
    newQuests[idx][field] = value
    setQuests(newQuests)
  }

  const enhanceQuest = async (idx) => {
    if (!quests[idx].title.trim()) return
    setEnhancing(idx)
    try {
      const res = await enhanceQuestWithAI(quests[idx].title)
      const newQuests = [...quests]
      newQuests[idx].description = res.description
      newQuests[idx].stat_bonus = res.stat_bonus
      setQuests(newQuests)
    } finally { setEnhancing(null) }
  }

const handleCreateAI = async () => {
  if (!goal.trim() || loading) return
  setLoading(true)
  
  try {
    const userId = await getUserId()
    if (!userId) { 
      console.error('❌ [CREATE] userId is null!')
      setLoading(false)
      return 
    }
    
    console.log('📡 [CREATE] Creating path with userId:', userId)
    console.log('📡 [CREATE] Goal:', goal)
    
    const response = await fetch('/api/paths/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, goal: goal.trim() })
    })
    
    const result = await response.json()
    console.log('📥 [CREATE] API response:', result)
    
    if (result.success && result.pathId) {
      console.log('✅ [CREATE] Path created! Redirecting...')
      router.push(`/my-path?pathId=${result.pathId}`)
    } else {
      console.error('❌ [CREATE] Error:', result.error)
      alert('Ошибка: ' + result.error)
    }
  } catch (e) {
    console.error('💥 [CREATE] Exception:', e)
    alert('Ошибка: ' + e.message)
  } finally {
    setLoading(false)
  }
}

  // ✅ ИСПРАВЛЕНО: Используем API вместо Server Action
  const handleCreateManual = async () => {
    if (!title.trim() || quests.some(q => !q.title.trim()) || loading) return
    setLoading(true)
    
    try {
      const userId = await getUserId()
      if (!userId) { setLoading(false); return }
      
      console.log('📡 [CLIENT] Вызов API /api/paths/create-manual...')
      
      const response = await fetch('/api/paths/create-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title: title.trim(), quests })
      })
      
      const result = await response.json()
      console.log('📥 [CLIENT] Ответ от API (manual):', result)
      
      if (result.success && result.pathId) {
        console.log('✅ [CLIENT] Путь создан вручную! Переход...')
        router.push(`/my-path?pathId=${result.pathId}`)
      } else {
        alert('Ошибка: ' + (result.error || 'Не удалось создать путь'))
      }
    } catch (e) {
      console.error('💥 [CLIENT] Исключение:', e)
      alert('Ошибка сети: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (typeof window === 'undefined') return null
  
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
      </div>
    )
  }
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'} p-4`}>
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Шапка */}
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Новый путь</h1>
        </div>

        {/* Переключатель режимов */}
        <div className={`flex rounded-2xl p-1 ${isDark ? 'bg-white/5' : 'bg-gray-200'}`}>
          <button onClick={() => setMode('ai')} className={`flex-1 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${mode === 'ai' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow' : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
            <Sparkles size={16} /> С ИИ
          </button>
          <button onClick={() => setMode('manual')} className={`flex-1 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${mode === 'manual' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow' : (isDark ? 'text-gray-400' : 'text-gray-600')}`}>
            <Pencil size={16} /> Вручную
          </button>
        </div>

        {/* === РЕЖИМ С ИИ === */}
        {mode === 'ai' && (
          <div className="space-y-4">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Опиши свою цель (например: выучить английский, запустить проект...)"
              className={`w-full p-4 rounded-2xl resize-none h-32 ${isDark ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900'} border focus:ring-2 focus:ring-purple-500 outline-none`}
            />
            <button 
              onClick={handleCreateAI} 
              disabled={loading || !goal.trim()} 
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold disabled:opacity-50 hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Генерация...
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Создать путь с ИИ
                </>
              )}
            </button>
          </div>
        )}

        {/* === РЕЖИМ ВРУЧНУЮ === */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Название пути (цель)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full p-4 rounded-2xl font-bold ${isDark ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900'} border focus:ring-2 focus:ring-purple-500 outline-none`}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Квесты</span>
                <button onClick={addQuest} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300">
                  <Plus size={14} /> Добавить
                </button>
              </div>

              {quests.map((q, idx) => (
                <div key={idx} className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'} border space-y-3 relative`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>#{idx + 1}</span>
                    {quests.length > 1 && (
                      <button onClick={() => removeQuest(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Название квеста"
                    value={q.title}
                    onChange={(e) => updateQuestField(idx, 'title', e.target.value)}
                    className={`w-full p-3 rounded-xl ${isDark ? 'bg-black/20 text-white' : 'bg-gray-50 text-gray-900'} border border-transparent focus:border-purple-500 outline-none`}
                  />
                  
                  <div className="flex gap-2">
                    <textarea
                      placeholder="Описание"
                      value={q.description}
                      onChange={(e) => updateQuestField(idx, 'description', e.target.value)}
                      className={`flex-1 p-3 rounded-xl text-sm h-20 ${isDark ? 'bg-black/20 text-gray-300' : 'bg-gray-50 text-gray-700'} border border-transparent focus:border-purple-500 outline-none resize-none`}
                    />
                    <button 
                      onClick={() => enhanceQuest(idx)} 
                      disabled={enhancing === idx || !q.title.trim()}
                      className={`self-start p-3 rounded-xl ${enhancing === idx ? 'bg-purple-500/20 text-purple-300 animate-pulse' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'} transition-all`}
                    >
                      <Sparkles size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-6 gap-1">
                    {['vision', 'craft', 'focus', 'voice', 'resilience', 'insight'].map(stat => (
                      <div key={stat} className="flex flex-col items-center">
                        <span className={`text-[8px] uppercase ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{stat.slice(0,3)}</span>
                        <span className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{q.stat_bonus[stat] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleCreateManual}
              disabled={loading || !title.trim() || quests.some(q => !q.title.trim())}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:from-blue-600 hover:to-purple-700 transition-all"
            >
              {loading ? 'Создание...' : '🚀 Создать путь'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'