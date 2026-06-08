'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Captcha mathématique ──────────────────────────────────────────────────────

function genererCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1
  const b = Math.floor(Math.random() * 9) + 1
  const ops = [
    { question: `${a} + ${b}`, reponse: a + b },
    { question: `${a + b} − ${b}`, reponse: a },
    { question: `${a} × ${b > 5 ? 2 : b}`, reponse: a * (b > 5 ? 2 : b) },
  ]
  return ops[Math.floor(Math.random() * ops.length)]
}

// ─── Indicateur de force mot de passe ─────────────────────────────────────────

function forceMdp(mdp: string): { score: number; label: string; color: string } {
  let score = 0
  if (mdp.length >= 8) score++
  if (/[A-Z]/.test(mdp)) score++
  if (/[0-9]/.test(mdp)) score++
  if (/[^A-Za-z0-9]/.test(mdp)) score++
  const niveaux = [
    { label: '', color: '#e5e7eb' },
    { label: 'Faible', color: '#ef4444' },
    { label: 'Moyen', color: '#f59e0b' },
    { label: 'Bon', color: '#3b82f6' },
    { label: 'Fort', color: '#22c55e' },
  ]
  return { score, ...niveaux[score] }
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ConnexionPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>Chargement…</div>}>
      <ConnexionContenu />
    </Suspense>
  )
}

function ConnexionContenu() {
  const [onglet, setOnglet]               = useState<'connexion' | 'inscription'>('connexion')

  // Connexion
  const [emailCo, setEmailCo]             = useState('')
  const [mdpCo, setMdpCo]                 = useState('')
  const [loadingCo, setLoadingCo]         = useState(false)
  const [erreurCo, setErreurCo]           = useState('')
  const [mdpVisible, setMdpVisible]       = useState(false)

  // Inscription
  const [prenom, setPrenom]               = useState('')
  const [nom, setNom]                     = useState('')
  const [emailIn, setEmailIn]             = useState('')
  const [telephone, setTelephone]         = useState('')
  const [mdpIn, setMdpIn]                 = useState('')
  const [mdpConfirm, setMdpConfirm]       = useState('')
  const [captcha, setCaptcha]             = useState(genererCaptcha)
  const [reponseCaptcha, setReponseCaptcha] = useState('')
  const [loadingIn, setLoadingIn]         = useState(false)
  const [erreurIn, setErreurIn]           = useState('')
  const [succes, setSucces]               = useState(false)

  const supabase    = createClient()
  const router      = useRouter()
  const searchParams = useSearchParams()
  const redirect    = searchParams.get('redirect') || '/client/compte'

  useEffect(() => {
    if (searchParams.get('mode') === 'inscription') setOnglet('inscription')
  }, [])

  // ── Connexion ────────────────────────────────────────────────────────────────

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault()
    setLoadingCo(true)
    setErreurCo('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailCo, password: mdpCo })
    if (error) {
      setErreurCo('Email ou mot de passe incorrect.')
      setLoadingCo(false)
      return
    }
    if (data.user) window.location.href = redirect
  }

  async function motDePasseOublie() {
    if (!emailCo) { setErreurCo('Entrez votre email d\'abord.'); return }
    await supabase.auth.resetPasswordForEmail(emailCo, { redirectTo: `${window.location.origin}/client/auth/nouveau-mdp` })
    setErreurCo('')
    alert('Lien de réinitialisation envoyé à ' + emailCo)
  }

  // ── Inscription ──────────────────────────────────────────────────────────────

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault()
    setErreurIn('')

    // Validations
    if (mdpIn.length < 8) { setErreurIn('Le mot de passe doit contenir au moins 8 caractères.'); return }
    if (mdpIn !== mdpConfirm) { setErreurIn('Les mots de passe ne correspondent pas.'); return }
    if (parseInt(reponseCaptcha) !== captcha.reponse) {
      setErreurIn('Réponse au captcha incorrecte.')
      setCaptcha(genererCaptcha())
      setReponseCaptcha('')
      return
    }

    setLoadingIn(true)

    // Vérifier si email déjà utilisé
    const { data: existant } = await supabase.from('clients').select('id').eq('email', emailIn).single()
    if (existant) {
      setErreurIn('Un compte existe déjà avec cet email. Connectez-vous.')
      setLoadingIn(false)
      return
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: emailIn,
      password: mdpIn,
      options: { data: { prenom, nom, telephone } },
    })

    if (authError) {
      setErreurIn(authError.message.includes('already') ? 'Un compte existe déjà avec cet email.' : authError.message)
      setLoadingIn(false)
      return
    }

    if (authData.user) {
      await supabase.from('clients').insert({
        user_id: authData.user.id,
        nom, prenom, email: emailIn, telephone,
        statut: 'nouveau', actif: true,
      })
    }

    setSucces(true)
    setLoadingIn(false)
  }

  // ── Écran succès inscription ──────────────────────────────────────────────────

  if (succes) {
    return (
      <div style={{ maxWidth: '420px', margin: '48px auto', padding: '0 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>📧</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: '#1C2B1A', marginBottom: '8px' }}>
          Vérifiez votre email !
        </h2>
        <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: '8px' }}>
          Un lien de confirmation a été envoyé à <strong>{emailIn}</strong>.
        </p>
        <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '28px' }}>
          Cliquez sur le lien dans l'email pour activer votre compte, puis revenez vous connecter.
        </p>
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '14px', marginBottom: '24px', fontSize: '13px', color: '#166534' }}>
          💡 L'email peut mettre quelques minutes à arriver. Vérifiez aussi vos spams.
        </div>
        <button onClick={() => { setSucces(false); setOnglet('connexion') }}
          style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '12px 28px', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
          Se connecter
        </button>
      </div>
    )
  }

  const force = forceMdp(mdpIn)

  return (
    <div style={{ maxWidth: '420px', margin: '0 auto', padding: '32px 16px' }}>

      {/* Logo / titre */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '26px', color: '#1C2B1A', lineHeight: 1.1 }}>Au Vieux Moulin</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '3px' }}>Espace client</div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
        {(['connexion', 'inscription'] as const).map(o => (
          <button key={o} onClick={() => { setOnglet(o); setErreurCo(''); setErreurIn('') }}
            style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: onglet === o ? 700 : 400, background: onglet === o ? 'white' : 'transparent', color: onglet === o ? '#1C2B1A' : '#9ca3af', boxShadow: onglet === o ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {o === 'connexion' ? '🔑 Se connecter' : '✨ Créer un compte'}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>

        {/* ── Onglet Connexion ── */}
        {onglet === 'connexion' && (
          <form onSubmit={handleConnexion}>
            {erreurCo && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {erreurCo}
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Adresse email</label>
              <input type="email" value={emailCo} onChange={e => setEmailCo(e.target.value)} required placeholder="marie@exemple.be" autoComplete="email"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input type={mdpVisible ? 'text' : 'password'} value={mdpCo} onChange={e => setMdpCo(e.target.value)} required placeholder="••••••••" autoComplete="current-password"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 40px 10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setMdpVisible(!mdpVisible)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}>
                  {mdpVisible ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '20px' }}>
              <button type="button" onClick={motDePasseOublie}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#3B6D11', textDecoration: 'underline' }}>
                Mot de passe oublié ?
              </button>
            </div>

            <button type="submit" disabled={loadingCo}
              style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: 'bold', cursor: loadingCo ? 'not-allowed' : 'pointer' }}>
              {loadingCo ? 'Connexion…' : 'Se connecter →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '16px', marginBottom: 0 }}>
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => setOnglet('inscription')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B6D11', fontWeight: 600, fontSize: '12px', textDecoration: 'underline' }}>
                Créer un compte gratuitement
              </button>
            </p>
          </form>
        )}

        {/* ── Onglet Inscription ── */}
        {onglet === 'inscription' && (
          <form onSubmit={handleInscription}>
            {erreurIn && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {erreurIn}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Prénom *</label>
                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required placeholder="Marie" autoComplete="given-name"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Nom *</label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} required placeholder="Dubois" autoComplete="family-name"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Adresse email *</label>
              <input type="email" value={emailIn} onChange={e => setEmailIn(e.target.value)} required placeholder="marie@exemple.be" autoComplete="email"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '4px 0 0' }}>Un lien de confirmation vous sera envoyé par email.</p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Téléphone *</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} required placeholder="0471 12 34 56" autoComplete="tel"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: '4px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input type={mdpVisible ? 'text' : 'password'} value={mdpIn} onChange={e => setMdpIn(e.target.value)} required placeholder="Min. 8 caractères" autoComplete="new-password"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 40px 10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
                <button type="button" onClick={() => setMdpVisible(!mdpVisible)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px' }}>
                  {mdpVisible ? '🙈' : '👁'}
                </button>
              </div>
              {/* Barre de force */}
              {mdpIn.length > 0 && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '3px' }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= force.score ? force.color : '#e5e7eb', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  {force.label && <p style={{ fontSize: '11px', color: force.color, margin: 0 }}>Force : {force.label}</p>}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>Confirmer le mot de passe *</label>
              <input type="password" value={mdpConfirm} onChange={e => setMdpConfirm(e.target.value)} required placeholder="••••••••"
                style={{ width: '100%', border: `1px solid ${mdpConfirm && mdpConfirm !== mdpIn ? '#fca5a5' : '#d1d5db'}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              {mdpConfirm && mdpConfirm !== mdpIn && (
                <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0' }}>Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Captcha */}
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>🤖 Vérification anti-robot</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1C2B1A', background: 'white', padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'monospace' }}>
                  {captcha.question} = ?
                </span>
                <input type="number" value={reponseCaptcha} onChange={e => setReponseCaptcha(e.target.value)} placeholder="Réponse" required
                  style={{ width: '80px', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px', fontSize: '14px', textAlign: 'center' }} />
                <button type="button" onClick={() => { setCaptcha(genererCaptcha()); setReponseCaptcha('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#9ca3af' }} title="Nouvelle question">
                  🔄
                </button>
              </div>
            </div>

            <button type="submit" disabled={loadingIn}
              style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: 'bold', cursor: loadingIn ? 'not-allowed' : 'pointer' }}>
              {loadingIn ? 'Création du compte…' : '✨ Créer mon compte'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', margin: '12px 0 0', lineHeight: 1.5 }}>
              En créant un compte, vous acceptez que vos informations soient utilisées pour la gestion de vos commandes.
            </p>
          </form>
        )}
      </div>

      {/* Lien catalogue */}
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link href="/client/catalogue" style={{ fontSize: '13px', color: '#6b7280', textDecoration: 'none' }}>
          ← Continuer sans compte
        </Link>
      </div>
    </div>
  )
}
