// app/inspiration/generate/page.js
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
// ✅ ИСПРАВЛЕНО: Используем правильное имя из actions.ts
import { generateInspirationAction, saveInspirationToHistory } from '@/app/actions'
import { useTheme } from '@/lib/useTheme'
import { Sparkles, ArrowLeft, Download } from 'lucide-react'
import { toPng } from 'html-to-image'

export default function GenerateInspirationPage() {
  const [loading, setLoading] = useState(false)
  const [card, setCard] = useState(null)
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const handleGenerate = async () => {
    setLoading(true)
    const userId = parseInt(localStorage.getItem('userId'))
    if (!userId) { router.push('/login'); return }

    // ✅ ИСПРАВЛЕНО: Вызываем generateInspirationAction
    const result = await generateInspirationAction(userId)
    
    if (result.success) {
      setCard(result.card)
      // Сохраняем в историю (убедись, что эта функция есть в actions.ts)
      await saveInspirationToHistory(userId, result.card)
    } else {
      alert('Ошибка генерации: ' + result.error)
    }
    setLoading(false)
  }

  const handleDownload = async () => {
    const node = document.getElementById('inspiration-card')
    if (!node) return
    try {
      const dataUrl = await toPng(node, { backgroundColor: isDark ? '#0f172a' : '#ffffff', quality: 1, pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `Card_${card.archetype}.png`
      link.href = dataUrl
      link.click()
    } catch (e) { console.error(e) }
  }

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
          // Показ карты
            <div 
            id="inspiration-card" 
            className={`relative rounded-3xl p-6 shadow-2xl border overflow-hidden ${
                isDark 
                ? 'bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 border-purple-500/30' 
                : 'bg-gradient-to-br from-purple-50 via-white to-pink-50 border-purple-200'
            }`}
            >
            {/* Верхняя полоса */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            
            {/* Архетип */}
            <div className="text-center mb-6 pt-2">
                <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-200 text-purple-800'
                }`}>
                Архетип
                </span>
                <h2 className={`text-2xl font-black mt-3 mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {card.archetype}
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {card.archetype_hint || 'Делится мудростью и опытом'}
                </p>
            </div>

            {/* Образ */}
            {card.visual && (
                <div className={`p-4 rounded-2xl mb-4 ${isDark ? 'bg-white/5' : 'bg-white/70'}`}>
                <p className={`text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1.5 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                    <span></span> Образ
                </p>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    {card.visual}
                </p>
                </div>
            )}

            {/* Вопрос */}
            <div className={`p-6 rounded-2xl mb-4 text-center ${
                isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'
            }`}>
                <p className="text-[10px] uppercase tracking-[0.2em] mb-3 text-indigo-400 font-semibold">
                Вопрос
                </p>
                <p className={`text-base leading-relaxed font-medium italic ${
                isDark ? 'text-white' : 'text-gray-900'
                }`}>
                "{card.question || card.quote}"
                </p>
            </div>

            {/* Микро-действие */}
            {card.action && (
                <div className={`p-4 rounded-2xl mb-6 ${
                isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200'
                }`}>
                <p className={`text-[10px] font-bold uppercase mb-1.5 flex items-center gap-1.5 ${
                    isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                    <span>🎯</span> Микро-действие
                </p>
                <p className={`text-base font-medium leading-relaxed ${
                    isDark ? 'text-emerald-200' : 'text-emerald-800'
                }`}>
                    {card.action}
                </p>
                </div>
            )}

            {/* Кнопки */}
            <div className="flex gap-3 mb-3">
                <button
                onClick={handleDownload}
                className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
                    isDark 
                    ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
                >
                <Download size={18} /> 
                <span>Сохранить</span>
                </button>
                <button
                onClick={() => setCard(null)}
                className="flex-1 py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/30"
                >
                Ещё раз
                </button>
            </div>

            {/* Ссылка на архив */}
            <button
                onClick={() => router.push('/inspiration')}
                className={`w-full py-2 text-sm text-center transition-colors ${
                isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
                Перейти к архиву
            </button>
            </div>
        )}
      </div>
    </div>
  )
}