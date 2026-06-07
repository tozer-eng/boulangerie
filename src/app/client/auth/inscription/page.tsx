'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function InscriptionPage() {
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErreur('')

    // Créer le compte auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { prenom, nom, telephone }
      }
    })

    if (authError) {
      setErreur(authError.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email.'
        : 'Erreur : ' + authError.message)
      setLoading(false)
      return
    }

    // Créer la fiche client
    if (authData.user) {
      await supabase.from('clients').insert({
        user_id: authData.user.id,
        nom,
        prenom,
        email,
        telephone,
        statut: 'nouveau',
        actif: true,
      })
    }

    setMessage('Compte créé ! Vérifiez votre email pour confirmer votre inscription.')
    setLoading(false)
  }

  if (message) {
    return (
      <div style={{ maxWidth: '400px', margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '50px', marginBottom: '16px' }}>📧</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#1C2B1A', marginBottom: '8px' }}>
          Vérifiez votre email !
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '24px' }}>{message}</p>
        <Link href="/client/auth/connexion"
          style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '12px 24px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: '#1C2B1A', margin: '0 0 4px' }}>
          Créer mon compte
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Déjà inscrit ? <Link href="/client/auth/connexion" style={{ color: '#3B6D11', fontWeight: '600' }}>Se connecter</Link>
        </p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
        {erreur && (
          <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {erreur}
          </div>
        )}

        <form onSubmit={handleInscription}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Prénom *</label>
              <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required placeholder="Marie"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Nom *</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)} required placeholder="Dubois"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="marie@exemple.be"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Téléphone *</label>
            <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} required placeholder="0471 12 34 56"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Mot de passe *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 6 caractères"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}