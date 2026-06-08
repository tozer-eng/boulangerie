'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NouveauMdpPage() {
  const [mdp, setMdp]           = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [erreur, setErreur]     = useState('')
  const [succes, setSucces]     = useState(false)
  const [pret, setPret]         = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    // Vérifier qu'on a bien un token de reset dans l'URL (Supabase le gère via hash)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPret(true)
      else setErreur('Lien invalide ou expiré. Demandez un nouveau lien de réinitialisation.')
    })
  }, [])

  async function handleSoumission(e: React.FormEvent) {
    e.preventDefault()
    if (mdp.length < 8) { setErreur('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (mdp !== confirm) { setErreur('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    setErreur('')

    const { error } = await supabase.auth.updateUser({ password: mdp })
    if (error) {
      setErreur('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    setSucces(true)
    setLoading(false)
    setTimeout(() => router.push('/client/compte'), 2500)
  }

  if (succes) {
    return (
      <div style={{ maxWidth: '400px', margin: '60px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#1C2B1A', marginBottom: '8px' }}>
          Mot de passe mis à jour !
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Redirection vers votre espace client…</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: '#1C2B1A', margin: '0 0 4px' }}>
          Nouveau mot de passe
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Choisissez un nouveau mot de passe pour votre compte.
        </p>
      </div>

      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '24px' }}>
        {erreur && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
            {erreur}
          </div>
        )}

        {pret ? (
          <form onSubmit={handleSoumission}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                Nouveau mot de passe
              </label>
              <input type="password" value={mdp} onChange={e => setMdp(e.target.value)} required placeholder="Min. 8 caractères"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                Confirmer le mot de passe
              </label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••"
                style={{ width: '100%', border: `1px solid ${confirm && confirm !== mdp ? '#fca5a5' : '#d1d5db'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              {confirm && confirm !== mdp && (
                <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0' }}>Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Mise à jour…' : '✓ Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        ) : !erreur ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>Vérification du lien…</p>
        ) : null}
      </div>
    </div>
  )
}
