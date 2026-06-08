'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types & constantes ───────────────────────────────────────────────────────

const STATUTS_PROGRESSION = ['en_attente', 'confirmee', 'preparee', 'recuperee'] as const
const STATUT_META: Record<string, { bg: string; color: string; border: string; label: string; emoji: string }> = {
  en_attente: { bg: '#fef9c3', color: '#854d0e', border: '#fde68a', label: 'En attente',   emoji: '⏳' },
  confirmee:  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', label: 'Confirmée',     emoji: '✅' },
  preparee:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Prête',          emoji: '📦' },
  recuperee:  { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Récupérée',     emoji: '✓' },
  annulee:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Annulée',        emoji: '✕' },
}

function formatDateFr(str: string) {
  const d = new Date(str)
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}
function estAujourdHui(str: string) {
  return new Date(str).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
}
function estPasse(str: string) {
  return new Date(str).toISOString().split('T')[0] < new Date().toISOString().split('T')[0]
}

// ─── Modal de confirmation ────────────────────────────────────────────────────

function ModalConfirm({ texte, onOui, onNon }: { texte: string; onOui: () => void; onNon: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px 24px', maxWidth: '340px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#374151', lineHeight: 1.5, marginBottom: '20px' }}>{texte}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onNon} style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
            Annuler
          </button>
          <button onClick={onOui} style={{ flex: 1, padding: '10px', background: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: 'white' }}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CommandesPage() {
  const [commandes, setCommandes]               = useState<any[]>([])
  const [loading, setLoading]                   = useState(true)
  const [filtre, setFiltre]                     = useState<string>('actif')
  const [recherche, setRecherche]               = useState('')
  const [confirming, setConfirming]             = useState<{ id: string; action: 'recuperee' | 'annulee' } | null>(null)
  const [detailOuvert, setDetailOuvert]         = useState<string | null>(null)
  const [changementStatut, setChangementStatut] = useState<string | null>(null) // id en cours d'update
  const supabase = createClient()

  useEffect(() => { chargerCommandes() }, [])

  async function chargerCommandes() {
    const { data } = await supabase
      .from('commandes')
      .select('*, client:clients(id, nom, prenom, telephone, email, statut), lignes:lignes_commande(*, produit:produits(nom, prix))')
      .order('date_retrait', { ascending: true })
    setCommandes(data ?? [])
    setLoading(false)
  }

  // ── Changer statut avec logique métier ───────────────────────────────────────
  async function activerRecurrence(commandeId: string) {
    await supabase.from('commandes').update({ recurence_validee: true, statut: 'confirmee' }).eq('id', commandeId)
    chargerCommandes()
  }

  async function changerStatut(commandeId: string, nouveauStatut: string) {
    // Confirmation requise uniquement pour "récupérée" et "annulée"
    if (nouveauStatut === 'recuperee') {
      setConfirming({ id: commandeId, action: 'recuperee' })
      return
    }
    if (nouveauStatut === 'annulee') {
      setConfirming({ id: commandeId, action: 'annulee' })
      return
    }
    // Tous les autres changements (y compris revenir en arrière depuis récupérée) : direct
    await effectuerChangement(commandeId, nouveauStatut)
  }

  async function effectuerChangement(commandeId: string, nouveauStatut: string) {
    const commande = commandes.find(c => c.id === commandeId)
    setChangementStatut(commandeId)

    await supabase.from('commandes').update({ statut: nouveauStatut }).eq('id', commandeId)

    // 🌟 Si récupérée → passer le client en "vérifié"
    if (nouveauStatut === 'recuperee' && commande?.client?.id) {
      const statutActuel = commande.client.statut
      if (statutActuel !== 'vip') {
        await supabase.from('clients').update({ statut: 'verifie' }).eq('id', commande.client.id)
      }
    }

    await chargerCommandes()
    setChangementStatut(null)
    setConfirming(null)
  }

  // ── Filtres ──────────────────────────────────────────────────────────────────
  const aujourd_hui = new Date().toISOString().split('T')[0]

  const commandesFiltrees = commandes.filter(c => {
    // Filtres statut/période
    if (filtre === 'actif') {
      if (c.statut === 'annulee' || c.statut === 'recuperee') return false
    } else if (filtre === 'aujourd_hui') {
      if (c.date_retrait !== aujourd_hui) return false
      if (c.statut === 'annulee') return false
    } else if (filtre === 'recuperee') {
      if (c.statut !== 'recuperee') return false
    } else if (filtre === 'annulee') {
      if (c.statut !== 'annulee') return false
    }
    // Recherche texte
    if (recherche) {
      const q = recherche.toLowerCase()
      return (
        c.client?.nom?.toLowerCase().includes(q) ||
        c.client?.prenom?.toLowerCase().includes(q) ||
        c.client?.telephone?.includes(q)
      )
    }
    return true
  })

  const nb = {
    actif:        commandes.filter(c => c.statut !== 'annulee' && c.statut !== 'recuperee').length,
    aujourd_hui:  commandes.filter(c => c.date_retrait === aujourd_hui && c.statut !== 'annulee').length,
    recuperee:    commandes.filter(c => c.statut === 'recuperee').length,
    annulee:      commandes.filter(c => c.statut === 'annulee').length,
  }

  if (loading) return <div style={{ color: '#6b7280', padding: '40px' }}>Chargement…</div>

  return (
    <div style={{ maxWidth: '960px' }}>

      {/* Modal confirmation */}
      {confirming && (
        <ModalConfirm
          texte={
            confirming.action === 'recuperee'
              ? 'Confirmer que cette commande a été récupérée ?\nLe client passera automatiquement en "vérifié". Vous pourrez revenir en arrière si besoin.'
              : 'Confirmer l\'annulation de cette commande ? Vous pourrez la remettre en attente si c\'est une erreur.'
          }
          onNon={() => setConfirming(null)}
          onOui={() => effectuerChangement(confirming.id, confirming.action)}
        />
      )}

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#1C2B1A' }}>
          Commandes
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {nb.aujourd_hui > 0 && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#854d0e', fontWeight: 600 }}>
              📅 {nb.aujourd_hui} retrait{nb.aujourd_hui > 1 ? 's' : ''} aujourd'hui
            </div>
          )}
          <input
            type="text" placeholder="🔍 Rechercher…" value={recherche} onChange={e => setRecherche(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', width: '180px' }}
          />
        </div>
      </div>

      {/* Onglets filtres */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#f3f4f6', borderRadius: '10px', padding: '4px' }}>
        {([
          { id: 'actif', label: 'En cours', nb: nb.actif },
          { id: 'aujourd_hui', label: "Aujourd'hui", nb: nb.aujourd_hui },
          { id: 'recuperee', label: 'Récupérées', nb: nb.recuperee },
          { id: 'annulee', label: 'Annulées', nb: nb.annulee },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setFiltre(tab.id)}
            style={{ flex: 1, padding: '7px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: filtre === tab.id ? 700 : 400, background: filtre === tab.id ? 'white' : 'transparent', color: filtre === tab.id ? '#1C2B1A' : '#6b7280', boxShadow: filtre === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {tab.label} {tab.nb > 0 && <span style={{ background: filtre === tab.id ? '#1C2B1A' : '#d1d5db', color: filtre === tab.id ? '#7CBF3A' : '#6b7280', borderRadius: '999px', padding: '1px 6px', fontSize: '11px', marginLeft: '4px' }}>{tab.nb}</span>}
          </button>
        ))}
      </div>

      {/* Liste cartes */}
      {commandesFiltrees.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
          <p style={{ margin: 0 }}>Aucune commande dans cette catégorie</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {commandesFiltrees.map(c => {
            const meta       = STATUT_META[c.statut] ?? STATUT_META['en_attente']
            const ouvert     = detailOuvert === c.id
            // verrouillee supprimé : retour en arrière toujours possible
            const enCours    = changementStatut === c.id
            const auj        = estAujourdHui(c.date_retrait)
            const passe      = estPasse(c.date_retrait) && c.statut !== 'recuperee'

            return (
              <div key={c.id} style={{
                background: 'white', borderRadius: '12px',
                border: `1px solid ${auj ? '#fde68a' : '#e5e7eb'}`,
                overflow: 'hidden',
                opacity: enCours ? 0.7 : 1,
                transition: 'opacity 0.2s',
                boxShadow: auj ? '0 0 0 2px #fde68a' : 'none',
              }}>

                {/* Ligne principale */}
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>

                  {/* Badge statut */}
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />

                  {/* Client */}
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#1C2B1A' }}>
                        {c.client?.prenom} {c.client?.nom}
                      </span>
                      {c.type === 'recurrente' && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>🔄 Réc.</span>
                      )}
                      {c.client?.statut === 'vip' && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '999px', background: '#fef9c3', color: '#854d0e', fontWeight: 600 }}>⭐ VIP</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>
                      {c.client?.telephone && (
                        <a href={`tel:${c.client.telephone}`} style={{ color: '#6b7280', textDecoration: 'none' }}>
                          📞 {c.client.telephone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div style={{ textAlign: 'center', minWidth: '80px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: auj ? '#854d0e' : passe ? '#dc2626' : '#374151', background: auj ? '#fef9c3' : passe ? '#fee2e2' : '#f3f4f6', borderRadius: '6px', padding: '3px 8px', display: 'inline-block' }}>
                      {auj ? '📅 Aujourd\'hui' : passe ? '⚠ ' + formatDateFr(c.date_retrait) : formatDateFr(c.date_retrait)}
                    </div>
                  </div>

                  {/* Montant */}
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#1C2B1A', minWidth: '70px', textAlign: 'right' }}>
                    {Number(c.montant_total).toFixed(2)} €
                  </div>

                  {/* Statut badge */}
                  <div style={{ padding: '3px 10px', borderRadius: '999px', background: meta.bg, color: meta.color, fontSize: '12px', fontWeight: 600, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                    {meta.emoji} {meta.label}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    {/* Bouton activer récurrence */}
                    {c.type === 'recurrente' && !c.recurence_validee && c.statut !== 'annulee' && (
                      <button
                        onClick={e => { e.stopPropagation(); activerRecurrence(c.id) }}
                        style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🔄 Activer récurrence
                      </button>
                    )}
                    {c.type === 'recurrente' && c.recurence_validee && (
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        🔄 Récurrence active
                      </span>
                    )}
                    {/* Bouton récupérée (raccourci direct) */}
                    {c.statut !== 'recuperee' && c.statut !== 'annulee' && (
                      <button
                        onClick={e => { e.stopPropagation(); changerStatut(c.id, 'recuperee') }}
                        style={{ background: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✓ Récupérée
                      </button>
                    )}
                    {/* Détail toggle */}
                    <button
                      onClick={() => setDetailOuvert(ouvert ? null : c.id)}
                      style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', cursor: 'pointer' }}>
                      {ouvert ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                {/* Détail produits (toujours visible en résumé) */}
                <div style={{ borderTop: '1px solid #f3f4f6', padding: '10px 16px', background: '#fafafa', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {c.lignes?.map((l: any) => (
                    <span key={l.id} style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '999px', background: 'white', border: '1px solid #e5e7eb', color: '#374151' }}>
                      {l.produit?.nom} <strong>×{l.quantite}</strong>
                    </span>
                  ))}
                  {c.notes && (
                    <span style={{ fontSize: '11px', color: '#854d0e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '999px', padding: '3px 9px' }}>
                      📝 {c.notes}
                    </span>
                  )}
                </div>

                {/* Panneau détail étendu */}
                {ouvert && (
                  <div style={{ borderTop: '1px solid #e5e7eb', padding: '16px', background: 'white' }}>
                    {/* Alerte récurrence en attente */}
                    {c.type === 'recurrente' && !c.recurence_validee && c.statut !== 'annulee' && (
                      <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', padding: '12px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '13px', margin: '0 0 2px' }}>🔄 Abonnement hebdomadaire en attente d'activation</p>
                          <p style={{ fontSize: '12px', color: '#3b82f6', margin: 0 }}>Le client attend votre validation pour que sa commande récurrente démarre.</p>
                        </div>
                        <button onClick={() => activerRecurrence(c.id)}
                          style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          ✓ Activer l'abonnement
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

                      {/* Détail produits + total */}
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détail commande</p>
                        {c.lignes?.map((l: any) => (
                          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                            <span style={{ color: '#374151' }}>{l.produit?.nom} <span style={{ color: '#9ca3af' }}>×{l.quantite}</span></span>
                            <span style={{ fontWeight: 600 }}>{(l.quantite * Number(l.prix_unitaire)).toFixed(2)} €</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, marginTop: '8px', paddingTop: '8px', borderTop: '2px solid #e5e7eb' }}>
                          <span>Total</span>
                          <span>{Number(c.montant_total).toFixed(2)} €</span>
                        </div>
                      </div>

                      {/* Progression statut */}
                      {c.statut !== 'annulee' && (
                        <div style={{ minWidth: '200px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modifier le statut</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {STATUTS_PROGRESSION.map((s) => {
                              const sm      = STATUT_META[s]
                              const courant = c.statut === s
                              const aVenir  = STATUTS_PROGRESSION.indexOf(s) > STATUTS_PROGRESSION.indexOf(c.statut as any)
                              const estRecup = s === 'recuperee'
                              return (
                                <button key={s}
                                  onClick={() => !courant && changerStatut(c.id, s)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '7px 10px', borderRadius: '8px',
                                    border: `1px solid ${courant ? sm.border : '#e5e7eb'}`,
                                    background: courant ? sm.bg : 'white',
                                    color: courant ? sm.color : aVenir ? '#374151' : '#9ca3af',
                                    fontSize: '12px', fontWeight: courant ? 700 : 400,
                                    cursor: courant ? 'default' : 'pointer',
                                    textAlign: 'left',
                                  }}>
                                  <span style={{ fontSize: '14px' }}>{courant ? sm.emoji : aVenir ? '○' : '↩'}</span>
                                  {sm.label}
                                  {!courant && !aVenir && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af' }}>revenir</span>}
                                  {estRecup && !courant && aVenir && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6b7280' }}>confirmation</span>}
                                </button>
                              )
                            })}
                            {/* Annuler */}
                            <button
                              onClick={() => changerStatut(c.id, 'annulee')}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                              <span>✕</span> Annuler la commande
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Commande annulée — remettre en attente possible */}
                      {c.statut === 'annulee' && (
                        <div style={{ minWidth: '200px', background: '#fef2f2', borderRadius: '10px', padding: '14px', border: '1px solid #fca5a5' }}>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', margin: '0 0 6px' }}>✕ Commande annulée</p>
                          <p style={{ fontSize: '12px', color: '#f87171', margin: '0 0 10px' }}>Annulée par erreur ?</p>
                          <button onClick={() => effectuerChangement(c.id, 'en_attente')}
                            style={{ width: '100%', padding: '7px', background: 'white', border: '1px solid #fbbf24', borderRadius: '7px', color: '#854d0e', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                            ↩ Remettre en attente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
