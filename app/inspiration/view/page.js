// app/inspiration/view/page.js
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getInspirationById } from '@/app/actions'
import { ArrowLeft, Download, Sparkles, Eye, Zap, Target, Mic, Shield, Lightbulb } from 'lucide-react'
import { toPng } from 'html-to-image'
import { useTheme } from '@/lib/useTheme'

const STAT_ICONS = { vision: Eye, craft: Zap, focus: Target, voice: Mic, resilience: Shield, insight: Lightbulb }
const STAT_NAMES = { vision: 'Видение', craft: 'Мастерство', focus: 'Фокус', voice: 'Голос', resilience: 'Стойкость', insight: 'Озарение' }
const STAT_COLORS = { 
  vision: 'text-blue-400 bg-blue-500/20', 
  craft: 'text-amber-400 bg-amber-500/20', 
  focus: 'text-purple-400 bg-purple-500/20', 
  voice: 'text-pink-400 bg-pink-500/20', 
  resilience: 'text-emerald-400 bg-emerald-500/20', 
  insight: 'text-orange-400 bg-orange-500/20' 
}

export default function InspirationViewPage() {
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (id) {
      getInspirationById(parseInt(id)).then(data => {
        setCard(data)
        setLoading(false)
      })
    }
  }, [id])

  const handleDownload = async () => {
    const node = document.getElementById('inspiration-card-view')
    if (!node) return
    try {
      const dataUrl = await toPng(node, { backgroundColor: isDark ? '#0f172a' : '#ffffff', quality: 1, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `ArcanaMuse_${card.archetype}.png`
      link.href = dataUrl
      link.click()
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent"></div></div>
  if (!card) return <div className="min-h-screen flex items-center justify-center text-white">Карта не найдена</div>

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gray-50'} flex flex-col p-4 transition-colors`}>
      <div className="w-full max-w-md mx-auto space-y-6 flex-1">
        {/* Шапка */}
        <div className="flex items-center justify-between pt-4">
          
          <button onClick={() => router.back()} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Карта вдохновения</h1>
          <button onClick={handleDownload} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-purple-400' : 'bg-white text-purple-600 shadow'}`}>
            <Download size={20} />
          </button>
        </div>

        {/* Карта */}
        <div id="inspiration-card-view" className={`relative ${isDark ? 'bg-gradient-to-br from-slate-900 to-purple-950 border-purple-500/30' : 'bg-white border-purple-200'} border rounded-3xl p-6 shadow-2xl overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          
          <div className="text-center mb-6 pt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
              Архетип
            </span>
            <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'} mt-3`}>
              {card.archetype}
            </h2>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
              {card.archetype_hint || 'Послание дня'}
            </p>
          </div>

          {card.visual && (
            <div className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-xs font-bold uppercase mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>🎨 Образ</p>
              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{card.visual}</p>
            </div>
          )}

          <div className={`p-5 rounded-2xl mb-4 text-center ${isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
            <p className="text-xs uppercase tracking-widest mb-2 text-indigo-400">Вопрос</p>
            <p className={`text-lg font-serif italic ${isDark ? 'text-white' : 'text-gray-900'}`}>
              "{card.question || card.quote}"
            </p>
          </div>

          {card.action && (
            <div className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'}`}>
              <p className="text-xs font-bold uppercase mb-1 text-emerald-400">🎯 Микро-действие</p>
              <p className={`text-base font-medium ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
                {card.action}
              </p>
            </div>
          )}

          {card.stat_bonus && Object.entries(card.stat_bonus).filter(([_, v]) => v > 0).length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {Object.entries(card.stat_bonus).filter(([_, v]) => v > 0).map(([stat, val]) => {
                const Icon = STAT_ICONS[stat]
                return (
                  <div key={stat} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${STAT_COLORS[stat] || 'bg-gray-500/20 text-gray-300'}`}>
                    {Icon && <Icon size={14} />}
                    <span className="text-xs font-bold">+{val} {STAT_NAMES[stat] || stat}</span>
                  </div>
                )
              })}
            </div>
          )}

          <button 
             onClick={() => router.push('/inspiration/generate')} 
            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            <Sparkles size={16} /> 
            Вытянуть новую карту
          </button>
        </div>
      </div>
    </div>
  )
}