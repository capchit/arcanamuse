// app/path/manual/page.js
// ❌ НЕ добавляй 'use client' сюда — это серверный компонент!
import { Suspense } from 'react'
import SearchParamsWrapper from './SearchParamsWrapper'

export default function ManualPathPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    }>
      <SearchParamsWrapper />
    </Suspense>
  )
}

export const dynamic = 'force-dynamic'