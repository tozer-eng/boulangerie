'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function ClientHeader() {
  const [connecte, setConnecte] = useState(false)
  const [prenom, setPrenom] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Vérifier l'état initial
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setConnecte(true)
        const { data } = await supabase
          .from('clients')
          .select('prenom')
          .eq('user_id', user.id)
          .single()
        if (data) setPrenom(data.prenom)
      } else {
        setConnecte(false)
        setPrenom('')
      }
    })

    // Écouter les changements de connexion
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setConnecte(true)
        const { data } = await supabase
          .from('clients')
          .select('prenom')
          .eq('user_id', session.user.id)
          .single()
        if (data) setPrenom(data.prenom)
      } else {
        setConnecte(false)
        setPrenom('')
      }
      // Forcer le rechargement de la page
      router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [pathname])

  return (
    <header style={{ backgroundColor: '#7CBF3A', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Link href="/client/catalogue" style={{ textDecoration: 'none' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#1C2B1A', fontSize: '18px', lineHeight: 1.2 }}>
          Au Vieux Moulin
        </div>
        <div style={{ fontSize: '10px', color: '#1C2B1A', letterSpacing: '1px', textTransform: 'uppercase' }}>
          Pierre Chantraine
        </div>
      </Link>
      <Link
        href={connecte ? '/client/compte' : '/client/auth/connexion'}
        style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '6px 14px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
      >
        {connecte ? `👤 ${prenom || 'Mon compte'}` : 'Se connecter'}
      </Link>
    </header>
  )
}