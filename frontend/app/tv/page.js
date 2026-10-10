'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ShindoraApp from '@/app/ShindoraApp'
import { setTVModeActive } from '@/lib/utils/tvMode'

export default function TVPage() {
  const router = useRouter()

  useEffect(() => {
    setTVModeActive(true)
  }, [])

  return <ShindoraApp initialTVMode={true} />
}
