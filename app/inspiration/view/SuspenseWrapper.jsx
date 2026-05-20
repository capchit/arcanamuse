// app/inspiration/view/SuspenseWrapper.jsx
'use client'

import { useSearchParams } from 'next/navigation'
import InspirationViewContent from './InspirationViewContent'

export default function SuspenseWrapper() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  
  return <InspirationViewContent id={id} />
}