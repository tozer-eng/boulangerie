'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Redirige vers la page unifiée connexion/inscription
export default function InscriptionPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/client/auth/connexion?mode=inscription') }, [])
  return null
}
