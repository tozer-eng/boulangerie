'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ConnexionPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    if (data.user) {
      window.location.href = '/client/compte'
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: '#1C2B1A', margin: '0 0 4px' }}>
          Mon compte
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Pas encore de compte ?{' '}
          <Link href="/client/auth/inscription" style={{ color: '#3B6D11', fontWeight: '600' }}>
            S'inscrire
          </Link>
        </p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
        {erreur && (
          <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {erreur}
          </div>
        )}

        <form onSubmit={handleConnexion}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="marie@exemple.be"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Mot de passe</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}