// app/layout.js
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/db'
import BottomNav from '@/components/BottomNav'
import './globals.css'  // 👈 Убедись, что CSS импортируется!

export default function RootLayout({ children }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
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
      <body className="min-h-screen bg-slate-950 text-white">
        {/* 👇 Добавь pb-20 ТОЛЬКО если есть навигация */}
        <div className="pb-20">
          {children}
        </div>
        
        <BottomNav />
      </body>
    </html>
  )
}