// app/path/edit/page.js
'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPathById, updatePathFull, enhanceQuestWithAI } from '@/app/actions'
import { useTheme } from '@/lib/useTheme'
import { ArrowLeft, Loader2, Plus, Trash2, Wand2, Save } from 'lucide-react'

export default function EditPathPage() {
  const searchParams = useSearchParams()
  const pathId = searchParams.get('pathId')
  const router = useRouter()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [quests, setQuests] = useState([])
  const [enhancingIdx, setEnhancingIdx] = useState(null)

  useEffect(() => {
    const uid = parseInt(localStorage.getItem('userId'))
    if (uid && pathId) loadPath(uid, pathId)
  }, [pathId])

  const loadPath = async (uid, pid) => {
    setLoading(true)
    try {
      const data = await getPathById(pid)
      if (data) {
        setTitle(data.title)
        setQuests(data.quests.map(q => ({
          id: q.id,
          title: q.title,
          description: q.description,
          stat_bonus: JSON.parse(q.stat_bonus || '{}')
        })))
      }
    } finally { setLoading(false) }
  }

  const enhanceQuest = async (idx) => {
    if (!quests[idx].title.trim()) return
    setEnhancingIdx(idx)
    try {
      const res = await enhanceQuestWithAI(quests[idx].title)
      const newQuests = [...quests]
      newQuests[idx].description = res.description
      newQuests[idx].stat_bonus = res.stat_bonus
      setQuests(newQuests)
    } finally { setEnhancingIdx(null) }
  }

  const handleSave = async () => {
    if (!title.trim()) return alert('Введите название пути')
    if (quests.some(q => !q.title.trim())) return alert('Все квесты должны иметь название')
    
    setSaving(true)
    try {
      const res = await updatePathFull(pathId, title, quests)
      if (res.success) router.push(`/my-path?pathId=${pathId}`)
      else alert('Ошибка сохранения: ' + res.error)
    } finally { setSaving(false) }
  }

  const addQuest = () => setQuests([...quests, { title: '', description: '', stat_bonus: { vision:0, craft:0, focus:0, voice:0, resilience:0, insight:0 } }])
  const removeQuest = (idx) => setQuests(quests.filter((_, i) => i !== idx))
  const updateQuest = (idx, field, value) => {
    const newQuests = [...quests]
    newQuests[idx] = { ...newQuests[idx], [field]: value }
    setQuests(newQuests)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка...</div>

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900' : 'bg-gradient-to-br from-gray-100 via-white to-gray-200'} p-4`}>
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6 pt-2">
          <button onClick={() => router.back()} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-600 shadow'}`}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Редактирование пути</h1>
          <button onClick={handleSave} disabled={saving} className={`p-2 rounded-xl ${saving ? 'bg-gray-600' : 'bg-green-500'} text-white`}>
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          </button>
        </div>

        <div className={`${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'} backdrop-blur-xl border rounded-3xl p-6 space-y-5`}>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название пути" className={`w-full p-3 rounded-xl ${isDark ? 'bg-slate-900/50 border-purple-500/30 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border-2 outline-none focus:border-blue-400`} />

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Квесты ({quests.length}/8)</span>
              {quests.length < 8 && <button onClick={addQuest} className="text-blue-400 text-sm flex items-center gap-1"><Plus size={14} /> Добавить</button>}
            </div>

            {quests.map((q, idx) => (
              <div key={idx} className={`p-4 rounded-2xl ${isDark ? 'bg-slate-900/50' : 'bg-gray-50'} space-y-3`}>
                <div className="flex justify-between items-start">
                  <span className={`text-xs font-bold ${isDark ? 'text-purple-400' : 'text-blue-600'}`}>#{idx + 1}</span>
                  <div className="flex gap-2">
                    <button onClick={() => enhanceQuest(idx)} disabled={enhancingIdx === idx || !q.title.trim()} className={`p-1 rounded ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'} hover:opacity-80 disabled:opacity-30`}>
                      {enhancingIdx === idx ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    </button>
                    {quests.length > 1 && <button onClick={() => removeQuest(idx)} className="text-red-400"><Trash2 size={14} /></button>}
                  </div>
                </div>
                <input type="text" value={q.title} onChange={(e) => updateQuest(idx, 'title', e.target.value)} placeholder="Название квеста" className={`w-full p-2 rounded-lg text-sm ${isDark ? 'bg-slate-800 border-purple-500/30 text-white' : 'bg-white border-gray-300 text-gray-900'} border outline-none`} />
                <textarea value={q.description} onChange={(e) => updateQuest(idx, 'description', e.target.value)} placeholder="Описание" className={`w-full p-2 rounded-lg text-sm resize-none h-16 ${isDark ? 'bg-slate-800 border-purple-500/30 text-white' : 'bg-white border-gray-300 text-gray-900'} border outline-none`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}