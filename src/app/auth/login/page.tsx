'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Identifiants incorrects')
      setLoading(false)
    } else {
      router.push('/admin/dashboard')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F0E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '360px', border: '1px solid #e5e7eb' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🥖</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '20px', color: '#1C2B1A', margin: '0 0 4px' }}>
            Espace administration
          </h1>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
            Au Vieux Moulin
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', fontSize: '14px', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@auvieuxmoulin.be"
              required
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}