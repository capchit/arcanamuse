// app/my-path/page.js
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getUserActivePath, finishQuest, uncompleteQuest, finishPath, restorePath } from '@/app/actions'
import { useTheme } from '@/lib/useTheme'
import { ArrowLeft, Trophy, CheckCircle2, Circle, Flame, Pencil, RotateCcw } from 'lucide-react'

export default function MyPathPage() {
  const searchParams = useSearchParams()
  const pathId = searchParams.get('pathId')
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [path, setPath] = useState(null) // 👈 Здесь хранятся данные пути
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userId = parseInt(localStorage.getItem('userId'))
    if (userId && pathId) {
      loadPath(userId, pathId)
    }
  }, [pathId])

  const loadPath = async (uid, pid) => {
    setLoading(true)
    try {
      const data = await getUserActivePath(uid, pid)
      setPath(data)
    } catch (e) {
      console.error('Ошибка загрузки пути:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleQuest = async (questId, isCompleted) => {
    try {
      if (isCompleted) {
        await uncompleteQuest(questId)
      } else {
        await finishQuest(questId)
      }
      // Перезагружаем данные пути
      const userId = parseInt(localStorage.getItem('userId'))
      loadPath(userId, pathId)
    } catch (e) {
      console.error(e)
    }
  }

  const handleFinishPath = async () => {
    if (!confirm('🏁 Завершить этот путь? Он переместится в историю подвигов.')) return
    
    try {
      await finishPath(path.id)
      router.push('/paths') // Возвращаемся к списку
    } catch (e) {
      alert('Ошибка завершения пути')
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка пути...</div>
  if (!path) return <div className="min-h-screen flex items-center justify-center text-gray-500">Путь не найден</div>

  // Подсчет прогресса
  const total = path.quests.length
  const completed = path.quests.filter(q => q.status === 'completed').length
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'} pb-24`}>
      <div className="max-w-md mx-auto px-4 pt-6">
        
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Мой Путь</h1>
          <div className="w-10" />
          {/* 👇 Кнопка редактирования */}
          <button 
            onClick={() => router.push(`/path/edit?pathId=${path.id}`)}
            className={`p-2 rounded-xl ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}
            title="Редактировать путь"
          >
            <Pencil size={20} />
          </button>
        </div>

        {/* Карточка пути */}
        <div className={`p-6 rounded-3xl border mb-8 text-center ${isDark ? 'bg-white/5 border-purple-500/30' : 'bg-white border-purple-200 shadow-lg'}`}>
          <h2 className={`text-2xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{path.title}</h2>
          <p className={`text-sm mb-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{path.archetype}</p>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-gray-500 font-bold uppercase">
              <span>Прогресс</span> <span>{completed}/{total} ({progress}%)</span>
            </div>
            <div className={`h-3 ${isDark ? 'bg-slate-800' : 'bg-gray-200'} rounded-full overflow-hidden`}>
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Кнопка завершения пути (появляется только после загрузки данных) */}
          {path && path.status !== 'completed' && (
            <button
              onClick={handleFinishPath}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2 ${
                isDark
                  ? 'bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/30 text-green-400 hover:from-green-600/30 hover:to-emerald-600/30'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 border border-green-400 text-white shadow-lg shadow-green-500/30'
              }`}
            >
              🏁 Завершить путь
            </button>
          )}
        </div>

        {/* Список квестов */}
        <h3 className={`text-lg font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Flame size={20} className="text-orange-500" /> Квесты
        </h3>

        <div className="space-y-4">
          {path.quests.map((quest, idx) => {
            const isDone = quest.status === 'completed'
            return (
              <div 
                key={quest.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isDone 
                    ? (isDark ? 'bg-green-900/10 border-green-500/30' : 'bg-green-50 border-green-200') 
                    : (isDark ? 'bg-slate-900/50 border-white/10' : 'bg-white border-gray-200 shadow-sm')
                }`}
              >
                <div className="flex items-start gap-3">
                  <button 
                    onClick={() => handleToggleQuest(quest.id, isDone)}
                    className={`mt-1 flex-shrink-0 transition-colors ${isDone ? 'text-green-500' : (isDark ? 'text-gray-500' : 'text-gray-400')}`}
                  >
                    {isDone ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Квест #{idx + 1}
                      </span>
                      {/* Статы квеста */}
                      <div className="flex gap-1.5">
                        {Object.entries(JSON.parse(quest.stat_bonus || '{}')).map(([stat, val]) => 
                          val > 0 ? (
                            <span key={stat} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                              +{val} {stat.slice(0,3)}
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                    
                    <h4 className={`font-bold mb-1 ${isDone ? (isDark ? 'text-green-300 line-through' : 'text-green-700 line-through') : (isDark ? 'text-white' : 'text-gray-900')}`}>
                      {quest.title}
                    </h4>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {quest.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}