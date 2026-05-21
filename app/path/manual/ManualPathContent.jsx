// app/path/manual/ManualPathContent.jsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createManualPath, updatePathFull, enhanceQuestWithAI, getPathById } from '@/app/actions'
import { ArrowLeft, Plus, Trash2, Sparkles, Save } from 'lucide-react'
import { useTheme } from '@/lib/useTheme'
import { supabase } from '@/lib/db'  // 👈 Добавь этот импорт

export default function ManualPathContent({ pathId }) {
  const router = useRouter()
  const isEditing = !!pathId
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const [title, setTitle] = useState('')
  const [quests, setQuests] = useState([{ title: '', description: '', stat_bonus: { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 } }])
  const [loading, setLoading] = useState(false)
  const [enhancing, setEnhancing] = useState(null)

  // 👇 Вспомогательная функция для получения userId
  const getUserId = async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      router.push('/login')
      return null
    }
    return user.id  // UUID строка
  }

  useEffect(() => {
    if (isEditing && pathId) {
      loadPath(pathId)  // 👈 Передаём pathId как строку (UUID)
    }
  }, [isEditing, pathId])

  const loadPath = async (pid) => {
    try {
      // pid — это UUID строка, не нужно parseInt!
      const data = await getPathById(pid)
      if (data) {
        setTitle(data.title)
        setQuests(data.quests.map(q => ({
          id: q.id,
          title: q.title,
          description: q.description,
          stat_bonus: typeof q.stat_bonus === 'string' ? JSON.parse(q.stat_bonus || '{}') : q.stat_bonus || {}
        })))
      }
    } catch (e) {
      console.error('❌ Ошибка загрузки пути:', e)
    }
  }

  const addQuest = () => setQuests([...quests, { title: '', description: '', stat_bonus: { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 } }])
  const removeQuest = (idx) => { if (quests.length > 1) setQuests(quests.filter((_, i) => i !== idx)) }
  const updateQuestField = (idx, field, value) => { const newQ = [...quests]; newQ[idx][field] = value; setQuests(newQ) }
  
  const enhanceQuest = async (idx) => {
    if (!quests[idx].title.trim()) return
    setEnhancing(idx)
    try {
      const aiData = await enhanceQuestWithAI(quests[idx].title)
      const newQ = [...quests]
      newQ[idx].description = aiData.description
      newQ[idx].stat_bonus = aiData.stat_bonus || {}
      setQuests(newQ)
    } finally { setEnhancing(null) }
  }

  const handleSave = async () => {
    if (!title.trim() || quests.some(q => !q.title.trim())) return
    
    setLoading(true)
    try {
      // 👇 Получаем userId из Supabase Auth
      const userId = await getUserId()
      if (!userId) { setLoading(false); return }
      
      const result = isEditing 
        ? await updatePathFull(pathId, title, quests)  // 👈 pathId — строка (UUID)
        : await createManualPath(userId, title, 'Самостоятельный путь', 'Путь создан вручную', quests)
      
      if (result.success) {
        router.push(isEditing ? `/my-path?pathId=${pathId}` : '/my-path')
        router.refresh()
      } else {
        alert('Ошибка: ' + result.error)
      }
    } catch (e) {
      console.error('❌ Ошибка сохранения:', e)
      alert('Ошибка: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gray-50'} p-4 pb-24 transition-colors`}>
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push(isEditing ? `/my-path?pathId=${pathId}` : '/profile')} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{isEditing ? '✏️ Редактирование' : '📝 Ручной путь'}</h1>
          <button onClick={toggleTheme} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-yellow-400' : 'bg-white text-orange-500 shadow'}`}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="space-y-4">
          <input type="text" placeholder="Название пути (цель)" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full p-4 rounded-2xl font-bold ${isDark ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900'} border focus:ring-2 focus:ring-purple-500 outline-none`} />

          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Квесты</span>
              <button onClick={addQuest} className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"><Plus size={14} /> Добавить</button>
            </div>

            {quests.map((q, idx) => (
              <div key={idx} className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'} border space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>#{idx + 1}</span>
                  {quests.length > 1 && <button onClick={() => removeQuest(idx)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>}
                </div>
                <input type="text" placeholder="Название квеста" value={q.title} onChange={(e) => updateQuestField(idx, 'title', e.target.value)} className={`w-full p-3 rounded-xl ${isDark ? 'bg-black/20 text-white' : 'bg-gray-50 text-gray-900'} border border-transparent focus:border-purple-500 outline-none`} />
                <div className="flex gap-2">
                  <textarea placeholder="Описание" value={q.description} onChange={(e) => updateQuestField(idx, 'description', e.target.value)} className={`flex-1 p-3 rounded-xl text-sm h-20 ${isDark ? 'bg-black/20 text-gray-300' : 'bg-gray-50 text-gray-700'} border border-transparent focus:border-purple-500 outline-none resize-none`} />
                  <button onClick={() => enhanceQuest(idx)} disabled={enhancing === idx || !q.title.trim()} className={`self-start p-3 rounded-xl ${enhancing === idx ? 'bg-purple-500/20 text-purple-300 animate-pulse' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'} transition-all`}><Sparkles size={20} /></button>
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

          <button onClick={handleSave} disabled={loading || !title.trim()} className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:from-blue-600 hover:to-purple-700 transition-all">
            {loading ? 'Сохранение...' : (isEditing ? '💾 Сохранить' : '🚀 Создать')}
          </button>
        </div>
      </div>
    </div>
  )
}