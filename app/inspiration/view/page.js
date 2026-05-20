// app/inspiration/view/page.js
import { Suspense } from 'react'
import SuspenseWrapper from './SuspenseWrapper'

export default function Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Загрузка карты...
      </div>
    }>
      <SuspenseWrapper />
    </Suspense>
  )
}