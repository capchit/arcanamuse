// app/components/BottomNav.jsx
'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Home, ScrollText, Sparkles, User } from 'lucide-react'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  // Скрываем на странице входа
  if (pathname === '/login') return null

  const navItems = [
    { path: '/', icon: Home, label: 'Главная' },
    { path: '/paths', icon: ScrollText, label: 'Пути' },
    { path: '/inspiration', icon: Sparkles, label: 'Вдохновение' },
    { path: '/profile', icon: User, label: 'Профиль' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/85 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-lg mx-auto flex justify-around items-center h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          const Icon = item.icon
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`relative flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-200 ${
                isActive ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {/* Подсветка активного раздела */}
              {isActive && (
                <span className="absolute inset-0 bg-purple-500/10 rounded-xl scale-90 transition-transform" />
              )}
              
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
              <span className={`relative z-10 text-[10px] font-medium ${isActive ? 'text-purple-400' : 'text-slate-500'}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}