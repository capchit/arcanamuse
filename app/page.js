// app/page.js
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Compass, Sparkles } from 'lucide-react'
import { useTheme } from '@/lib/useTheme'
import { supabase } from '@/lib/db'

export default function HomePage() {
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.replace('/login')
          return
        }
      } catch (err) {
        console.error('Auth error:', err)
        router.replace('/login')
        return
      } finally {
        setCheckingAuth(false)
      }
    }
    
    checkAuth()
  }, [router])

  if (checkingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'
      }`}>
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    )
  }

  const bgClass = isDark 
    ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' 
    : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center px-6 py-12 transition-colors duration-300 ${bgClass}`}>
      <div className="w-full max-w-md space-y-6">
        {/* Заголовок */}
        <div className="text-center space-y-2">
          <h1 className={`text-4xl font-black transition-colors ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            ArcanaMuse
          </h1>
          <p className={`text-center transition-colors ${
            isDark ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Твой проводник к целям через архетипы и квесты
          </p>
        </div>

        {/* Кнопки */}
        <div className="space-y-4">
          {/* Start a Path */}
          <button
            onClick={() => router.push('/path')}
            className={`w-full group relative overflow-hidden rounded-2xl border p-6 transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isDark 
                ? 'bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-blue-500/30 hover:border-blue-400/50 hover:from-blue-600/30 hover:to-cyan-600/30' 
                : 'bg-gradient-to-br from-blue-500 to-cyan-500 border-blue-400 shadow-lg shadow-blue-500/30'
            }`}
          >
            <div className="relative flex flex-col items-center gap-3">
              <div className={`p-3 rounded-xl transition-transform group-hover:rotate-12 ${
                isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-white/20 text-white'
              }`}>
                <Compass size={28} />
              </div>
              <div className="text-center">
                <h2 className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-white'
                }`}>
                  Start a Path
                </h2>
                <p className={`text-xs mt-1 ${
                  isDark ? 'text-blue-200/80' : 'text-white/90'
                }`}>
                  Создай маршрут к цели с помощью ИИ
                </p>
              </div>
            </div>
          </button>

          {/* Get Inspiration */}
          <button
            onClick={() => router.push('/inspiration/generate')}
            className={`w-full group relative overflow-hidden rounded-2xl border p-6 transition-all hover:scale-[1.02] active:scale-[0.98] ${
              isDark 
                ? 'bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30 hover:border-purple-400/50 hover:from-purple-600/30 hover:to-pink-600/30' 
                : 'bg-gradient-to-br from-purple-500 to-pink-500 border-purple-400 shadow-lg shadow-purple-500/30'
            }`}
          >
            <div className="relative flex flex-col items-center gap-3">
              <div className={`p-3 rounded-xl transition-transform group-hover:rotate-12 ${
                isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-white/20 text-white'
              }`}>
                <Sparkles size={28} />
              </div>
              <div className="text-center">
                <h2 className={`text-lg font-bold ${
                  isDark ? 'text-white' : 'text-white'
                }`}>
                  Get Inspiration
                </h2>
                <p className={`text-xs mt-1 ${
                  isDark ? 'text-purple-200/80' : 'text-white/90'
                }`}>
                  Карта дня, вопрос и микро-действие
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'