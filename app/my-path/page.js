import { Suspense } from 'react'
import SuspenseWrapper from './SuspenseWrapper'
export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">Загрузка пути...</div>}>
      <SuspenseWrapper />
    </Suspense>
  )
}