// app/profile/page.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUserStats, resetUserProgress, handleLogout } from '@/app/actions'
import { ArrowLeft, Settings, LogOut, Moon, Sun, Download, ImagePlus, Trash2, MessageSquare } from 'lucide-react'
import { toPng } from 'html-to-image'
import { useTheme } from '@/lib/useTheme'
import { supabase } from '@/lib/db'  // 👈 Добавь этот импорт

const STAT_NAMES = { vision: 'Видение', craft: 'Мастерство', focus: 'Фокус', voice: 'Голос', resilience: 'Стойкость', insight: 'Озарение' }

function CircularStat({ label, value, maxValue = 10, color = '#60a5fa', isDark = true }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / maxValue, 1)
  const offset = circumference - progress * circumference
  const labels = { vision: 'Видение', craft: 'Мастерство', focus: 'Фокус', voice: 'Голос', resilience: 'Стойкость', insight: 'Озарение' }
  
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const labelColor = isDark ? 'text-gray-300' : 'text-gray-700'
  const circleBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'
  
  return (
    <div className="flex flex-col items-center gap-1 p-1">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke={circleBg} strokeWidth="8" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[15px] font-black ${textColor}`}>{value}</span>
        </div>
      </div>
      <span className={`text-[11px] font-bold ${labelColor}`}>{labels[label]}</span>
    </div>
  )
}

const STATS_CONFIG = {
  vision: { color: '#60a5fa' }, craft: { color: '#fbbf24' },
  focus: { color: '#a78bfa' }, voice: { color: '#f472b6' },
  resilience: { color: '#34d399' }, insight: { color: '#fb923c' }
}

const EMOJI_AVATARS = ['🧙‍♂️', '🧝‍♀️', '🧛', '🧟', '🐉', '🦄', '', '🦊']

export default function ProfilePage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  
  const [avatar, setAvatar] = useState(EMOJI_AVATARS[0])
  const [isCustomAvatar, setIsCustomAvatar] = useState(false)

  useEffect(() => {
    // 👇 Аватар можно хранить в lS (это предпочтение пользователя)
    const savedAvatar = localStorage.getItem('avatar')
    if (savedAvatar) {
      if (savedAvatar.startsWith('data:')) {
        setAvatar(savedAvatar)
        setIsCustomAvatar(true)
      } else {
        setAvatar(savedAvatar)
        setIsCustomAvatar(false)
      }
    }
    
    // 👇 Но userId получаем из Supabase Auth!
    loadProfile()
  }, [router])

  const loadProfile = async () => {
    try {
      // 👇 Получаем текущего пользователя из Supabase
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        console.warn('⚠️ Пользователь не авторизован')
        router.push('/login')
        return
      }
      
      const userId = user.id  // 👈 UUID строка
      const statsData = await getUserStats(userId)
      setStats(statsData)
    } catch (e) {
      console.error('❌ Ошибка загрузки профиля:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    // 👇 Используем Supabase signOut (не lS!)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDownloadCard = async () => {
    const node = document.getElementById('hero-card-node')
    if (!node) return
    try {
      const dataUrl = await toPng(node, { backgroundColor: isDark ? '#0f172a' : '#ffffff', quality: 1.0, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `ArcanaMuse_Hero_Lvl${stats?.level}.png`
      link.href = dataUrl
      link.click()
    } catch (err) { console.error(err) }
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result
        setAvatar(base64)
        setIsCustomAvatar(true)
        localStorage.setItem('avatar', base64)  // 👈 Аватар можно хранить в localStorage
      }
      reader.readAsDataURL(file)
    }
  }

  const handleResetProgress = async () => {
    if (!confirm('⚠️ Удалить ВСЕ данные? Это необратимо.')) return
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      await resetUserProgress(user.id)  // 👈 Передаём UUID
      loadProfile()  // Перезагружаем профиль
      alert('Прогресс сброшен! 🚀')
    } catch (e) {
      console.error('❌ Ошибка сброса:', e)
      alert('Не удалось сбросить прогресс')
    }
  }

  // Защита: рендерим только в браузере
  if (typeof window === 'undefined') {
    return null
  }
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent"></div>
      </div>
    )
  }
  
  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Ошибка загрузки
      </div>
    )
  }

  const progressPercent = (stats.progress / stats.nextLevelAt) * 100
  const bgClass = isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'
  const cardClass = isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600'

  return (
    <div className={`min-h-screen ${bgClass} p-4 pb-24 transition-colors duration-300`}>
      <div className="max-w-md mx-auto space-y-6">
        
        {/* Шапка */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => router.push('/')} className={`p-2 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-200 border-gray-300 text-gray-600'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold ${textPrimary}`}>Профиль</h1>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-xl border ${showSettings ? 'bg-purple-500/20 border-purple-500 text-purple-400' : (isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-200 border-gray-300 text-gray-600')}`}>
            <Settings size={20} />
          </button>
        </div>

        {/* === НАСТРОЙКИ (выпадающие) === */}
        {showSettings && (
          <div className={`${cardClass} backdrop-blur-xl border rounded-3xl p-6 space-y-5 animate-in fade-in slide-in-from-top-4`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-bold ${textPrimary}`}>⚙️ Настройки</h2>
              <button onClick={toggleTheme} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-yellow-400' : 'bg-gray-200 text-orange-500'}`}>
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            
            {/* Аватар */}
            <div>
              <label className={`text-sm font-medium ${textSecondary} mb-2 block`}>Фото профиля</label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30">
                  <ImagePlus size={18} /> Загрузить
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
                <button onClick={() => { setAvatar(EMOJI_AVATARS[0]); setIsCustomAvatar(false); localStorage.setItem('avatar', EMOJI_AVATARS[0]) }} className="text-xs text-gray-500 underline">Сбросить</button>
              </div>
            </div>
            {!isCustomAvatar && (
              <div className="flex gap-2 flex-wrap">
                {EMOJI_AVATARS.map(a => (
                  <button key={a} onClick={() => { setAvatar(a); localStorage.setItem('avatar', a) }} className={`text-2xl p-1 rounded ${avatar === a ? 'bg-purple-500/30 border border-purple-500' : ''}`}>
                    {a}
                  </button>
                ))}
              </div>
            )}

            {/* Сброс прогресса */}
            <button 
              onClick={handleResetProgress} 
              className="w-full py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all"
            >
              🔄 Сбросить весь прогресс
            </button>

            {/* ✅ КНОПКА ОБРАТНОЙ СВЯЗИ */}
            <a 
              href="https://docs.google.com/forms/d/1yPF9GihuJg-YcUAOMh7DB2WLWqdN4PxUX1cla1iZc0I/viewform" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium transition-all ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
              }`}
            >
              <MessageSquare size={16} /> Обратная связь
            </a>

            {/* Выход */}
            <div className="pt-2 border-t border-white/10">
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                <LogOut size={16} /> Выйти
              </button>
            </div>
          </div>
        )}

        {/* === КАРТА ГЕРОЯ === */}
        <div id="hero-card-node" className={`${cardClass} backdrop-blur-xl border rounded-3xl p-6 text-center relative overflow-hidden`}>
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isDark ? 'from-blue-500 via-purple-500 to-pink-500' : 'from-blue-400 via-purple-400 to-pink-400'}`} />
          
          <button onClick={handleDownloadCard} className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 transition-all">
            <Download size={18} />
          </button>
          
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 text-5xl overflow-hidden bg-gradient-to-br from-purple-500/30 to-blue-500/30 border-2 border-purple-400/50">
            {isCustomAvatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : avatar}
          </div>
          
          <h2 className={`text-2xl font-black ${textPrimary} mb-1 uppercase`}>{stats.title}</h2>
          <p className={`${textSecondary} text-sm mb-6`}>Уровень {stats.level} • {stats.totalPoints} XP</p>
          
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs text-gray-400 font-bold uppercase">
              <span>Прогресс</span> <span>{stats.progress}/{stats.nextLevelAt}</span>
            </div>
            <div className={`h-3 ${isDark ? 'bg-black/30' : 'bg-gray-200'} rounded-full overflow-hidden`}>
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className={`pt-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <h3 className={`text-sm font-semibold ${textSecondary} mb-4`}>✨ Характеристики</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATS_CONFIG).map(([key, { color }]) => (
                <CircularStat key={key} label={key} value={stats.stats[key] || 0} color={color} isDark={isDark} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'