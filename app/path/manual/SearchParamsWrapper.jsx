// app/path/manual/SearchParamsWrapper.jsx
'use client'
import { useSearchParams } from 'next/navigation'
import ManualPathContent from './ManualPathContent'

export default function SearchParamsWrapper() {
  const searchParams = useSearchParams()
  const pathId = searchParams.get('pathId')
  return <ManualPathContent pathId={pathId} />
}