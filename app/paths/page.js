// app/paths/page.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/useTheme'
import { getUserPaths, deletePath, togglePathStatus, restorePath } from '@/app/actions'
import { Compass, Trophy, Trash2, Play, Pause, CheckCircle, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/db'  // 👈 Добавь этот импорт

export default function PathsPage() {
  const [paths, setPaths] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => { 
    loadPaths() 
  }, [])

  const loadPaths = async () => {
    try {
      // 👇 ПОЛУЧАЕМ USER ID ИЗ SUPABASE AUTH
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn('⚠️ Пользователь не авторизован')
        router.push('/login')
        return
      }
      
      const userId = user.id  // 👈 UUID строка
      console.log('🗺️ Загрузка путей для userId:', userId)
      
      const data = await getUserPaths(userId)
      setPaths(data || [])
    } catch (err) {
      console.error('❌ Ошибка загрузки путей:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePath = async (e, pathId) => {
    e.stopPropagation()
    if (confirm('Удалить этот путь и всю его историю? Очки будут откатываться.')) {
      try {
        await deletePath(pathId)
        loadPaths()  // Перезагружаем список
      } catch (err) {
        console.error('❌ Ошибка удаления пути:', err)
        alert('Не удалось удалить путь')
      }
    }
  }
  
  const handleRestorePath = async (e, pathId) => {
    e.stopPropagation()
    if (confirm('♻️ Вернуть этот путь в активные?\nКвесты останутся выполненными, но путь снова станет доступным.')) {
      try {
        await restorePath(pathId)
        loadPaths()
      } catch (err) {
        console.error('❌ Ошибка восстановления пути:', err)
        alert('Не удалось восстановить путь')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    )
  }

  const activePaths = paths.filter(p => p.status !== 'completed')
  const completedPaths = paths.filter(p => p.status === 'completed')

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          🗺️ Мои Пути
        </h1>

        {/* Активные пути */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 text-purple-400">Активные</h2>
          {activePaths.length === 0 ? (
            <div className={`p-6 rounded-2xl border border-dashed text-center ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-400'}`}>
              <Compass size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="mb-3">Нет активных путей</p>
              <button onClick={() => router.push('/path')} 
              className="px-6 py-2 rounded-full bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
              >
              Создать новый путь</button>
            </div>
          ) : (
            <div className="space-y-4">
              {activePaths.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => router.push(`/my-path?pathId=${p.id}`)}
                  className={`group relative p-5 rounded-2xl border transition-all hover:scale-[1.02] cursor-pointer ${
                    isDark ? 'bg-slate-900/50 border-purple-500/20 hover:border-purple-500/40' : 'bg-white border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{p.title}</h3>
                      <p className={`text-sm ${isDark ? 'text-purple-400' : 'text-blue-600'}`}>{p.archetype}</p>
                    </div>
                    <div className="flex gap-2">
                      {/* Кнопка статуса */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); togglePathStatus(p.id, p.status === 'active' ? 'paused' : 'active').then(loadPaths) }}
                        className={`p-2 rounded-full ${p.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
                      >
                        {p.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      {/* Кнопка удаления */}
                      <button 
                        onClick={(e) => handleDeletePath(e, p.id)}
                        className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Удалить путь"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Прогресс</span>
                      <span>{p.completed_count || 0}/{p.total_count || 0} ({p.total_count > 0 ? Math.round((p.completed_count/p.total_count)*100) : 0}%)</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`}>
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${p.total_count > 0 ? (p.completed_count/p.total_count)*100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* История (Завершенные) */}
        {completedPaths.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 text-yellow-500 flex items-center gap-2">
              <Trophy size={16} /> История подвигов
            </h2>
            <div className="space-y-4">
              {completedPaths.map(p => (
                <div 
                  key={p.id} 
                  className={`relative p-5 rounded-2xl border ${isDark ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className={`font-bold ${isDark ? 'text-yellow-100' : 'text-gray-900'}`}>{p.title}</h3>
                      <p className={`text-sm ${isDark ? 'text-yellow-500/70' : 'text-yellow-700'}`}>{p.archetype}</p>
                    </div>
                    
                    <div className="flex gap-2">
                      {/* ♻️ Кнопка восстановления */}
                      <button 
                        onClick={(e) => handleRestorePath(e, p.id)}
                        className="p-2 rounded-full bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        title="Вернуть в активные"
                      >
                        <RotateCcw size={16} />
                      </button>
                      
                      {/* 🗑️ Кнопка удаления */}
                      <button 
                        onClick={(e) => handleDeletePath(e, p.id)}
                        className="p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        title="Удалить навсегда"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'