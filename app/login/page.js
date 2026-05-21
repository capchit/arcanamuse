// app/login/page.js
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { handleRegister, handleLogin } from '@/app/actions'
import { supabase } from '@/lib/db'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = isSignUp
        ? await handleRegister(email, password)
        : await handleLogin(email, password)

      if (result.success) {
        if (isSignUp) {
          alert('✅ Регистрация успешна! Теперь войдите.')
          setIsSignUp(false)
        } else {
          console.log('⏳ Waiting for session sync...')
          
          // Ждём чтобы куки записались
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Принудительно читаем сессию
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('❌ Session error:', sessionError)
          }
          
          if (session) {
            console.log('✅ Session found:', session.user.email)
            console.log('🔑 Access token:', session.access_token.substring(0, 20) + '...')
            
            // Обновляем состояние клиента
            await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            })
            
            // Редирект
            router.push('/')
            router.refresh()
          } else {
            console.error('❌ No session after login!')
            setError('Не удалось создать сессию. Попробуйте ещё раз.')
          }
        }
      } else {
        setError(result.error || 'Неверный email или пароль')
      }
    } catch (err) {
      console.error('💥 Auth exception:', err)
      setError('Произошла ошибка: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 w-full max-w-md border border-white/20 shadow-2xl">
        <h1 className="text-4xl font-bold text-white text-center mb-2">ArcanaMuse</h1>
        <p className="text-gray-300 text-center mb-8 text-sm">Твой проводник к целям</p>

        <form onSubmit={handleAuth} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
          <input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500" required />
          {error && <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-red-300 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50">
            {loading ? 'Загрузка...' : (isSignUp ? 'Зарегистрироваться' : 'Войти')}
          </button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-gray-300 text-sm hover:text-white transition-colors w-full text-center">
          {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  )
}
export const dynamic = 'force-dynamic'