// app/layout.js
'use client'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/app/components/BottomNav'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'ArcanaMuse',
  description: 'Твой проводник к целям',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        {/* Отступ снизу, чтобы контент не перекрывался панелью */}
        <main className="pb-20 min-h-screen">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
export const dynamic = 'force-dynamic'