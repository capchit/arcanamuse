// app/inspiration/page.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getInspirationHistory, deleteInspiration } from '@/app/actions'
import { useTheme } from '@/lib/useTheme'
import { Sparkles, Eye, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/db'  // 👈 Добавь этот импорт

export default function InspirationPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => { 
    loadHistory() 
  }, [])

  const loadHistory = async () => {
    try {
      // 👇 ПОЛУЧАЕМ USER ID ИЗ SUPABASE AUTH (не из localStorage!)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn('⚠️ Пользователь не авторизован, перенаправляем на вход')
        router.push('/login')
        return
      }
      
      const userId = user.id  // 👈 UUID строка: "a1b2c3d4-..."
      console.log('📚 Загрузка истории для userId:', userId)
      
      const data = await getInspirationHistory(userId)
      setCards(data || [])
    } catch (err) {
      console.error('❌ Ошибка загрузки истории:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (confirm('Удалить эту карту?')) {
      try {
        await deleteInspiration(id)
        loadHistory()  // Перезагружаем список
      } catch (err) {
        console.error('❌ Ошибка удаления:', err)
        alert('Не удалось удалить карту')
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

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          <Sparkles className="text-purple-500" size={24} /> Вдохновение
        </h1>

        {cards.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-100'}`}>
              <Sparkles size={40} className="text-purple-500" />
            </div>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} mb-4`}>Пока нет сохранённых карт</p>
            <button 
              onClick={() => router.push('/inspiration/generate')} 
              className="px-6 py-2 rounded-full bg-purple-500 text-white font-medium hover:bg-purple-600 transition-all"
            >
              Вытянуть карту
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map(c => (
              <div 
                key={c.id}
                onClick={() => router.push(`/inspiration/view?id=${c.id}`)}
                className={`group relative p-5 rounded-2xl border transition-all hover:scale-[1.01] cursor-pointer ${
                  isDark 
                    ? 'bg-gradient-to-br from-purple-900/20 to-slate-900/40 border-purple-500/20 hover:border-purple-400/40' 
                    : 'bg-gradient-to-br from-purple-50 to-white border-purple-200'
                }`}
              >
                {/* Кнопка удаления */}
                <button
                  onClick={(e) => handleDelete(e, c.id)} 
                  className="absolute top-3 right-3 p-2 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 z-10"
                >
                  <Trash2 size={16} />
                </button>

                <div className="flex items-start gap-4">
                  {/* Иконка карты */}
                  <div className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    isDark ? 'bg-purple-500/20' : 'bg-purple-200'
                  }`}>
                    <Sparkles size={24} className="text-purple-500" />
                  </div>

                  {/* Контент */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-lg truncate ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                      {c.archetype}
                    </h3>
                    <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </p>
                    
                    {/* Цитата с безопасным парсингом */}
                    <p className={`text-sm italic line-clamp-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      "{c.quote || (c.data && typeof c.data === 'string' ? JSON.parse(c.data).quote : null) || 'Нет цитаты'}"
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'