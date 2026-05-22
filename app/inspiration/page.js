// app/inspiration/page.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/useTheme'
import { ArrowLeft, Trash2, Eye, Sparkles, Calendar, Copy } from 'lucide-react'
import { supabase } from '@/lib/db'

export default function InspirationsPage() {
  const [inspirations, setInspirations] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    loadInspirations()
  }, [])

  const loadInspirations = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      console.log('📚 Loading inspirations for user:', user.id)
      
      const response = await fetch(`/api/inspirations?userId=${user.id}`)
      const data = await response.json()
      
      console.log('📚 API response:', data)
      
      if (data.success) {
        setInspirations(data.inspirations || [])
      } else {
        console.error('❌ Error loading inspirations:', data.error)
      }
    } catch (e) {
      console.error('❌ Error loading inspirations:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить это вдохновение?')) return
    
    try {
      const response = await fetch(`/api/inspirations/${id}`, { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        setInspirations(prev => prev.filter(i => i.id !== id))
        alert('🗑️ Вдохновение удалено')
      } else {
        alert('Ошибка: ' + result.error)
      }
    } catch (e) {
      alert('Не удалось удалить')
    }
  }

  const handleView = (id) => {
    router.push(`/inspiration/view?id=${id}`)
  }

  const handleCopy = async (quote) => {
    if (quote) {
      await navigator.clipboard.writeText(quote)
      alert('📋 Скопировано!')
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
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'} pb-24`}>
      <div className="max-w-md mx-auto px-4 pt-6">
        
        {/* Шапка */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>✨ Архив вдохновений</h1>
          <button 
            onClick={() => router.push('/inspiration/generate')}
            className="px-4 py-2 rounded-xl bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition-all"
          >
            + Создать
          </button>
        </div>

        {/* Список */}
        {inspirations.length === 0 ? (
          <div className={`p-6 rounded-2xl border-2 border-dashed text-center ${isDark ? 'border-purple-500/30 text-gray-400' : 'border-purple-300 text-gray-500'}`}>
            <Sparkles size={48} className="mx-auto mb-4 text-purple-400" />
            <h3 className="text-lg font-bold mb-2">Пока нет сохранённых вдохновений</h3>
            <p className="mb-4 text-sm">Создай своё первое вдохновение с помощью ИИ</p>
            <button 
              onClick={() => router.push('/inspiration/generate')}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              ✨ Сгенерировать вдохновение
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Найдено: {inspirations.length}
            </p>
            
            {inspirations.map(insp => (
              <div 
                key={insp.id}
                className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    {insp.archetype && (
                      <span className={`inline-block text-xs px-2 py-1 rounded-full mb-2 ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                        ✨ {insp.archetype}
                      </span>
                    )}
                    <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {insp.archetype || 'Вдохновение'}
                    </h3>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleView(insp.id)}
                      className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} text-purple-400`}
                      title="Просмотр"
                    >
                      <Eye size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(insp.id)}
                      className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'} text-red-400`}
                      title="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {insp.quote && (
                  <p className={`text-sm mb-3 line-clamp-3 italic ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    "{insp.quote.substring(0, 150)}..."
                  </p>
                )}
                
                {insp.action && (
                  <div className={`text-xs p-2 rounded-lg mb-3 ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                    🎯 {insp.action}
                  </div>
                )}
                
                <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  <Calendar size={12} />
                  {new Date(insp.created_at).toLocaleDateString('ru-RU')}
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