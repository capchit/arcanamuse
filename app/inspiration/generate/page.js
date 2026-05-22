// app/inspiration/generate/page.js
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/useTheme'
import { Sparkles, ArrowLeft, Download } from 'lucide-react'
import { toPng } from 'html-to-image'
import { supabase } from '@/lib/db'

export default function GenerateInspirationPage() {
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState(null)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Функция сохранения
  const saveInspiration = async (userId, cardData) => {
    try {
      console.log('💾 [SAVE] Saving...')
      
      const response = await fetch('/api/inspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          archetype: cardData.archetype || 'Новое вдохновение',
          quote: cardData.question || cardData.quote || '',
          archetype_meaning: cardData.archetype_hint,
          visual: cardData.visual,
          action: cardData.action,
          tags: cardData.tags || []
        })
      })

      const result = await response.json()
      console.log('💾 [SAVE] Result:', result)
      
      if (result.success) {
        console.log('✅ [SAVE] Saved!')
        return true
      }
      return false
    } catch (e) {
      console.error('❌ [SAVE] Exception:', e)
      return false
    }
  }

  // Генерация карты
  const handleGenerate = async () => {
    setLoading(true)
    
    try {
      // 👇 ПОЛУЧАЕМ userId
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('❌ Сначала войдите в систему!')
        router.push('/login')
        setLoading(false)
        return
      }
      
      const userId = user.id  // 👇 ОБЪЯВЛЯЕМ userId
      console.log('🎴 Generating for userId:', userId)
      
      // Вызов API
      const response = await fetch('/api/inspirations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const result = await response.json()
      console.log('📥 API response:', result)
      
      if (!result.success) {
        throw new Error(result.error || 'Generation failed')
      }
      
      console.log('✅ Card generated:', result.card.archetype)
      setCard(result.card)
      
      // Авто-сохранение
      console.log('💾 [AUTO] Starting save...')
      saveInspiration(userId, result.card).catch(err => {
        console.warn('⚠️ [AUTO] Save failed:', err)
      })
      
    } catch (err) {
      console.error('💥 Generation error:', err)
      alert('Не удалось сгенерировать карту: ' + err.message)
    } finally {
      console.log('🔄 Reset loading')
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    const node = document.getElementById('inspiration-card')
    if (!node) return
    try {
      const dataUrl = await toPng(node, { backgroundColor: isDark ? '#0f172a' : '#ffffff', quality: 1, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `Card_${card?.archetype}.png`
      link.href = dataUrl
      link.click()
    } catch (e) { console.error(e) }
  }

  if (typeof window === 'undefined') return null

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-gray-50'} flex flex-col p-4`}>
      <div className="w-full max-w-md mx-auto space-y-6 flex-1">
        
        {/* Шапка */}
        <div className="flex items-center justify-between pt-4">
          <button onClick={() => router.push('/inspiration')} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Карта дня</h1>
          <div className="w-10" />
        </div>

        {!card ? (
          // Экран генерации
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className={`w-32 h-32 mb-8 rounded-full flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-100'}`}>
              <Sparkles size={64} className="text-purple-500 animate-pulse" />
            </div>
            
            <h2 className={`text-2xl font-bold text-center mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Готов получить вдохновение?
            </h2>
            <p className={`text-center mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Вытяни карту архетипа и получи совет на сегодня
            </p>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg disabled:opacity-50 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Генерация...
                </span>
              ) : (
                '✨ Вытянуть карту'
              )}
            </button>
          </div>
        ) : (
          // Показ карты (твой существующий код...)
          <div id="inspiration-card" className="...">
            {/* Твой код отображения карты */}
            <p className="text-white">Карта: {card?.archetype}</p>
            <button onClick={() => setCard(null)}>Ещё раз</button>
          </div>
        )}
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'