'use client'
import { useSearchParams } from 'next/navigation'
import MyPathContent from './MyPathContent'
export default function SuspenseWrapper() {
  const searchParams = useSearchParams()
  const pathId = searchParams.get('pathId')
  return <MyPathContent pathId={pathId} />
}