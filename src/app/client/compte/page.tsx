'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_CLIENT: Record<string, { label: string; bg: string; color: string; desc: string }> = {
  nouveau:  { label: 'Nouveau',  bg: '#f3f4f6', color: '#6b7280', desc: 'Bienvenue ! Passez votre première commande.' },
  verifie:  { label: 'Vérifié', bg: '#dcfce7', color: '#166534', desc: 'Compte vérifié. Commandes récurrentes disponibles.' },
  vip:      { label: '⭐ VIP',   bg: '#fef9c3', color: '#854d0e', desc: 'Client fidèle — merci pour votre confiance !' },
  inactif:  { label: 'Inactif',  bg: '#fef2f2', color: '#991b1b', desc: 'Compte inactif.' },
}

const STATUT_COMMANDE: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  en_attente: { label: 'En attente',  bg: '#fef9c3', color: '#854d0e', emoji: '⏳' },
  confirmee:  { label: 'Confirmée',  bg: '#dbeafe', color: '#1e40af', emoji: '✅' },
  preparee:   { label: 'Prête',       bg: '#fef3c7', color: '#92400e', emoji: '📦' },
  recuperee:  { label: 'Récupérée',  bg: '#dcfce7', color: '#166534', emoji: '✓' },
  annulee:    { label: 'Annulée',     bg: '#fee2e2', color: '#991b1b', emoji: '✕' },
}

function formatDateLong(str: string) {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function semaineProchaineLabel(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset * 7)
  const debut = new Date(d)
  debut.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const fin = new Date(debut)
  fin.setDate(debut.getDate() + 6)
  const cle = `${debut.getFullYear()}-S${String(Math.ceil((debut.getDate() + ((debut.getDay() + 6) % 7)) / 7)).padStart(2,'0')}`
  const label = offset === 1 ? 'Semaine prochaine' : offset === 0 ? 'Cette semaine' : `${debut.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} – ${fin.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}`
  return { cle, label }
}

// ─── Composant édition profil ─────────────────────────────────────────────────

function FormulaireInfos({ client, supabase, onSave }: any) {
  const [prenom, setPrenom]     = useState(client.prenom ?? '')
  const [nom, setNom]           = useState(client.nom ?? '')
  const [telephone, setTelephone] = useState(client.telephone ?? '')
  const [saving, setSaving]     = useState(false)
  const [ok, setOk]             = useState(false)

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('clients').update({ prenom, nom, telephone }).eq('id', client.id)
    setSaving(false)
    setOk(true)
    setTimeout(() => setOk(false), 3000)
    onSave()
  }

  return (
    <form onSubmit={sauvegarder}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Prénom</label>
          <input value={prenom} onChange={e => setPrenom(e.target.value)} required
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Nom</label>
          <input value={nom} onChange={e => setNom(e.target.value)} required
            style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Téléphone</label>
        <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>
          Adresse email <span style={{ color: '#9ca3af', fontWeight: 400 }}>(non modifiable)</span>
        </label>
        <input value={client.email} disabled
          style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box', background: '#f9fafb', color: '#9ca3af' }} />
      </div>
      <button type="submit" disabled={saving}
        style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Sauvegarde…' : ok ? '✓ Sauvegardé !' : 'Sauvegarder les modifications'}
      </button>
    </form>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ComptePage() {
  const [client, setClient]         = useState<any>(null)
  const [commandes, setCommandes]   = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [onglet, setOnglet]         = useState<'commandes' | 'profil'>('commandes')
  const [commandeOuverte, setCommandeOuverte] = useState<string | null>(null)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { chargerCompte() }, [])

  async function chargerCompte() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.push('/client/auth/connexion'); return }

      // Chercher / lier la fiche client
      let { data: clientData } = await supabase
        .from('clients').select('*').eq('user_id', user.id).maybeSingle()

      if (!clientData) {
        const { data: parEmail } = await supabase
          .from('clients').select('*').eq('email', user.email!).maybeSingle()
        if (parEmail) {
          await supabase.from('clients').update({ user_id: user.id }).eq('id', parEmail.id)
          clientData = { ...parEmail, user_id: user.id }
        } else {
          const { data: nouveau } = await supabase.from('clients').insert({
            user_id: user.id,
            nom: user.user_metadata?.nom ?? '',
            prenom: user.user_metadata?.prenom ?? '',
            email: user.email!,
            telephone: user.user_metadata?.telephone ?? '',
            statut: 'nouveau', actif: true,
          }).select('*').single()
          clientData = nouveau
        }
      }

      if (!clientData) { router.push('/client/auth/connexion'); return }

      const { data: commandesData } = await supabase
        .from('commandes')
        .select('*, lignes:lignes_commande(*, produit:produits(nom, prix))')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false })

      setClient(clientData)
      setCommandes(commandesData ?? [])
    } catch (err) {
      console.error('Erreur chargement compte:', err)
      router.push('/client/auth/connexion')
    } finally {
      setLoading(false)
    }
  }

  async function seDeconnecter() {
    await supabase.auth.signOut()
    window.location.href = '/client/catalogue'
  }

  async function suspendreCommande(commandeId: string, semaineCle: string) {
    const commande = commandes.find(c => c.id === commandeId)
    const semaines = commande?.semaines_suspendues ?? []
    const nouvelles = semaines.includes(semaineCle)
      ? semaines.filter((s: string) => s !== semaineCle)
      : [...semaines, semaineCle]
    await supabase.from('commandes').update({ semaines_suspendues: nouvelles }).eq('id', commandeId)
    chargerCompte()
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 16px', color: '#9ca3af' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }}>🥖</div>
        <p style={{ margin: 0 }}>Chargement de votre espace…</p>
      </div>
    )
  }

  // Non connecté — la redirection est en cours
  if (!client) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 16px' }}>
        <p style={{ color: '#9ca3af', marginBottom: '16px' }}>Vous devez être connecté pour accéder à votre espace.</p>
        <a href="/client/auth/connexion"
          style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '10px 24px', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
          Se connecter
        </a>
      </div>
    )
  }

  const statutInfo     = STATUT_CLIENT[client.statut] ?? STATUT_CLIENT['nouveau']
  const recurrentes    = commandes.filter(c => c.type === 'recurrente' && c.statut !== 'annulee')
  const historique     = commandes.filter(c => c.type === 'ponctuelle' || c.statut === 'annulee')
  const prochains      = commandes.filter(c => c.type === 'ponctuelle' && ['en_attente','confirmee','preparee'].includes(c.statut))
  const semaines       = Array.from({ length: 4 }, (_, i) => semaineProchaineLabel(i))

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px 16px 48px' }}>

      {/* ── En-tête profil ── */}
      <div style={{ background: '#1C2B1A', borderRadius: '16px', padding: '20px', marginBottom: '20px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '22px', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '4px' }}>
              Bonjour {client.prenom || 'vous'} 👋
            </div>
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>{client.email}</div>
          </div>
          <button onClick={seDeconnecter}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ padding: '4px 10px', borderRadius: '999px', background: statutInfo.bg, color: statutInfo.color, fontSize: '12px', fontWeight: 700 }}>
            {statutInfo.label}
          </span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{statutInfo.desc}</span>
        </div>

        {/* Stats rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '16px' }}>
          {[
            { label: 'Commandes', valeur: commandes.filter(c => c.statut !== 'annulee').length },
            { label: 'Récupérées', valeur: commandes.filter(c => c.statut === 'recuperee').length },
            { label: 'Abonnements', valeur: recurrentes.filter(c => c.recurence_validee).length },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#7CBF3A' }}>{s.valeur}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerte : profil incomplet ── */}
      {(!client.prenom || !client.telephone) && (
        <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#854d0e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Votre profil est incomplet</span>
          <button onClick={() => setOnglet('profil')}
            style={{ background: '#fbbf24', border: 'none', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#78350f' }}>
            Compléter →
          </button>
        </div>
      )}

      {/* ── Prochains retraits ── */}
      {prochains.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#166534', margin: '0 0 10px' }}>📅 Prochains retraits</p>
          {prochains.map(c => {
            const sm = STATUT_COMMANDE[c.statut]
            return (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #d1fae5' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C2B1A' }}>{formatDateLong(c.date_retrait)}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {c.lignes?.map((l: any) => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
                  </div>
                </div>
                <span style={{ padding: '3px 9px', borderRadius: '999px', background: sm.bg, color: sm.color, fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {sm.emoji} {sm.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '10px', padding: '4px', marginBottom: '16px' }}>
        {([
          { id: 'commandes', label: `🛒 Mes commandes${commandes.length > 0 ? ` (${commandes.length})` : ''}` },
          { id: 'profil', label: '👤 Mon profil' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)}
            style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: onglet === t.id ? 700 : 400, background: onglet === t.id ? 'white' : 'transparent', color: onglet === t.id ? '#1C2B1A' : '#9ca3af', boxShadow: onglet === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ Onglet Commandes ══ */}
      {onglet === 'commandes' && (
        <div>

          {/* Abonnements récurrents */}
          {recurrentes.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>🔄 Mes abonnements hebdomadaires</h2>
              {recurrentes.map(c => {
                const valide = c.recurence_validee
                return (
                  <div key={c.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${valide ? '#86efac' : '#fde68a'}`, padding: '16px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2B1A', marginBottom: '6px' }}>
                          {c.lignes?.map((l: any) => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#3B6D11' }}>
                          {Number(c.montant_total).toFixed(2)} € / semaine
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '999px', background: valide ? '#dcfce7' : '#fef9c3', color: valide ? '#166534' : '#854d0e', fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                          {valide ? '✓ Actif' : '⏳ En attente'}
                        </span>
                        {!valide && <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Activation sous 24h</p>}
                      </div>
                    </div>

                    {valide && (
                      <div>
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }}>Suspendre une semaine :</p>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {semaines.map(s => {
                            const suspendue = c.semaines_suspendues?.includes(s.cle)
                            return (
                              <button key={s.cle} onClick={() => suspendreCommande(c.id, s.cle)}
                                style={{ padding: '5px 12px', borderRadius: '999px', fontSize: '12px', border: '1px solid', cursor: 'pointer', background: suspendue ? '#fee2e2' : 'white', borderColor: suspendue ? '#fca5a5' : '#d1d5db', color: suspendue ? '#991b1b' : '#374151', fontWeight: suspendue ? 700 : 400 }}>
                                {suspendue ? '✕ ' : ''}{s.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Historique ponctuelles */}
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>
            📋 Historique des commandes
          </h2>

          {historique.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛒</div>
              <p style={{ margin: '0 0 16px' }}>Vous n'avez pas encore passé de commande</p>
              <Link href="/client/catalogue"
                style={{ background: '#7CBF3A', color: '#1C2B1A', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                Voir le catalogue
              </Link>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {historique.map((c, i) => {
                const sm    = STATUT_COMMANDE[c.statut] ?? STATUT_COMMANDE['en_attente']
                const ouvert = commandeOuverte === c.id
                return (
                  <div key={c.id} style={{ borderBottom: i < historique.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    {/* Ligne résumé */}
                    <div
                      onClick={() => setCommandeOuverte(ouvert ? null : c.id)}
                      style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: ouvert ? '#fafafa' : 'white' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C2B1A', marginBottom: '3px' }}>
                          {c.date_retrait ? formatDateLong(c.date_retrait) : '—'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {c.lignes?.map((l: any) => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', background: sm.bg, color: sm.color, fontSize: '11px', fontWeight: 600 }}>
                          {sm.emoji} {sm.label}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1C2B1A' }}>{Number(c.montant_total).toFixed(2)} €</span>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>{ouvert ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Détail étendu */}
                    {ouvert && (
                      <div style={{ padding: '12px 16px 16px', background: '#fafafa', borderTop: '1px solid #f3f4f6' }}>
                        <div style={{ marginBottom: '10px' }}>
                          {c.lignes?.map((l: any) => (
                            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                              <span style={{ color: '#374151' }}>{l.produit?.nom} <span style={{ color: '#9ca3af' }}>×{l.quantite}</span></span>
                              <span style={{ fontWeight: 600 }}>{(l.quantite * Number(l.prix_unitaire)).toFixed(2)} €</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px', paddingTop: '8px' }}>
                            <span>Total</span>
                            <span>{Number(c.montant_total).toFixed(2)} €</span>
                          </div>
                        </div>
                        {c.notes && (
                          <div style={{ background: '#fef9c3', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#854d0e' }}>
                            📝 {c.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ Onglet Profil ══ */}
      {onglet === 'profil' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1C2B1A', margin: '0 0 16px' }}>
            Mes informations personnelles
          </h2>
          <FormulaireInfos client={client} supabase={supabase} onSave={chargerCompte} />
        </div>
      )}

      {/* CTA commander */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Link href="/client/catalogue"
          style={{ display: 'inline-block', background: '#1C2B1A', color: '#7CBF3A', padding: '13px 32px', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
          🥖 Passer une commande
        </Link>
      </div>
    </div>
  )
}
