// app/layout.js
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import BottomNav from '@/components/BottomNav'
import './globals.css'

export default function RootLayout({ children }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // 👇 СРАЗУ помечаем что приложение готово
    setIsReady(true)
    
    // Слушатель изменений аутентификации (для логов)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 [AUTH] State changed:', event, session?.user?.id)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Если не готов — показываем спиннер
  if (!isReady) {
    return (
      <html lang="ru">
        <body className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
        </body>
      </html>
    )
  }

  // 👇 Приложение готово — рендерим контент
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-white">
        <div className="pb-20">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}