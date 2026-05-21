// app/layout.js
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '@/app/components/BottomNav'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export const metadata = {
  title: 'ArcanaMuse',
  description: 'Твой проводник к целям',
}

// app/layout.js
export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-950 text-white">
        {children}
      </body>
    </html>
  )
}