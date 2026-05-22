// app/inspiration/view/page.js
'use client'
import { useSearchParams } from 'next/navigation'
import InspirationViewContent from './InspirationViewContent'

export default function InspirationViewPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  
  return <InspirationViewContent id={id} />
}
export const dynamic = 'force-dynamic'