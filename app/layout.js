// app/layout.js
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import BottomNav from '@/components/BottomNav'  // 👈 Или '@/app/components/BottomNav'

export default function RootLayout({ children }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Ждём инициализацию Supabase
    const init = async () => {
      await supabase.auth.getSession()
      setIsReady(true)
    }
    init()
  }, [])

  if (!isReady) {
    return (
      <html lang="ru">
        <body className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
        </body>
      </html>
    )
  }

  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-white pb-20">
        {/* 👇 Отступ снизу чтобы контент не перекрывался навигацией */}
        <main className="pb-20">{children}</main>
        
        {/* 👇 Навигация */}
        <BottomNav />
      </body>
    </html>
  )
}