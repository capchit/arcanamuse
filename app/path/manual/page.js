// app/path/manual/page.js
import { Suspense } from 'react'
import ManualPathContent from './ManualPathContent'

// 👇 Этот компонент НЕ 'use client' — он серверный, просто оборачивает в Suspense
export default function ManualPathPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Загрузка редактора...
      </div>
    }>
      <ManualPathContentWrapper />
    </Suspense>
  )
}

// 👇 Вспомогательный клиентский компонент для получения searchParams
'use client'
import { useSearchParams } from 'next/navigation'

function ManualPathContentWrapper() {
  const searchParams = useSearchParams()
  const pathId = searchParams.get('pathId')
  
  return <ManualPathContent pathId={pathId} />
}

// 👈 ОБЯЗАТЕЛЬНО: последняя строка!
export const dynamic = 'force-dynamic'