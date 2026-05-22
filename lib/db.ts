// lib/db.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!

// 👇 Создаём клиент с ПРАВИЛЬНЫМИ настройками аутентификации
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,        // Автообновление токена
    persistSession: true,          // Сохранять сессию в localStorage
    detectSessionInUrl: true,      // Detect session from URL (OAuth)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined, // Явное хранилище
    storageKey: 'supabase.auth.token', // Ключ для localStorage
  },
})

// 🔐 Авторизация
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { success: false, error: error.message }
  return { success: true, user: data.user }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: error.message }
  return { success: true, user: data.user }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// 🗄️ База данных (эмуляция better-sqlite3 API)
export const db = {
  prepare: (query: string) => {
    const match = query.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i)
    const table = match ? match[1] : 'unknown'
    
    return {
      run: async (...params: any[]) => {
        if (query.trim().toUpperCase().startsWith('INSERT')) {
          const { data, error } = await supabase.from(table).insert(params[0]).select()
          if (error) throw error
          return { lastInsertRowid: data?.[0]?.id }
        }
        if (query.trim().toUpperCase().startsWith('UPDATE')) {
          const setMatch = query.match(/SET\s+(.+?)\s+WHERE/i)
          if (setMatch) {
            const updates = params.reduce((acc, val, idx) => {
              const key = setMatch[1].split('=')[0].trim()
              return { ...acc, [key]: val }
            }, {})
            const { data, error } = await supabase.from(table).update(updates).eq('id', params[params.length - 1]).select()
            if (error) throw error
            return { lastInsertRowid: data?.[0]?.id }
          }
        }
        return { lastInsertRowid: null }
      },
      get: async (...params: any[]) => {
        const { data, error } = await supabase.from(table).select('*').eq('id', params[0]).single()
        if (error) return null
        return data
      },
      all: async (...params: any[]) => {
        const { data, error } = await supabase.from(table).select('*')
        if (error) return []
        return data
      },
    }
  },
  exec: async (script: string) => {
    console.log('Tables should be created in Supabase Dashboard')
  },
  transaction: (cb: Function) => cb,
}