'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types & constantes ───────────────────────────────────────────────────────

const STATUTS_PROGRESSION = ['en_attente', 'confirmee', 'preparee', 'recuperee'] as const
const STATUT_META: Record<string, { bg: string; color: string; border: string; label: string; emoji: string }> = {
  en_attente: { bg: '#fef9c3', color: '#854d0e', border: '#fde68a', label: 'En attente',  emoji: '⏳' },
  confirmee:  { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe', label: 'Confirmée',    emoji: '✅' },
  preparee:   { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', label: 'Prête',         emoji: '📦' },
  recuperee:  { bg: '#dcfce7', color: '#166534', border: '#86efac', label: 'Récupérée',    emoji: '✓'  },
  annulee:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', label: 'Annulée',       emoji: '✕'  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateFr(str: string) {
  const d = new Date(str)
  return d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDateHeure(str: string | null | undefined) {
  if (!str) return null
  const d = new Date(str)
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' à '
    + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function estAujourdHui(str: string) {
  return new Date(str).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
}
function estPasseOuAujourdhui(str: string) {
  return new Date(str).toISOString().split('T')[0] <= new Date().toISOString().split('T')[0]
}

// ─── Modal de confirmation ────────────────────────────────────────────────────

function ModalConfirm({ texte, onOui, onNon }: { texte: string; onOui: () => void; onNon: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px 24px', maxWidth: '340px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>⚠️</div>
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#374151', lineHeight: 1.6, marginBottom: '20px', whiteSpace: 'pre-line' }}>{texte}</p>
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

// ─── Carte commande ───────────────────────────────────────────────────────────

function CarteCommande({ c, ouvert, onToggle, onChangerStatut, onActiverRecurrence, enCours, effectuerChangement }: {
  c: any
  ouvert: boolean
  onToggle: () => void
  onChangerStatut: (id: string, statut: string) => void
  onActiverRecurrence: (id: string) => void
  enCours: boolean
  effectuerChangement: (id: string, statut: string) => void
}) {
  const meta  = STATUT_META[c.statut] ?? STATUT_META['en_attente']
  const auj   = c.date_retrait && estAujourdHui(c.date_retrait)
  const passe = c.date_retrait && !auj && estPasseOuAujourdhui(c.date_retrait) && c.statut !== 'recuperee' && c.statut !== 'annulee'

  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: `1px solid ${auj ? '#fde68a' : passe ? '#fca5a5' : '#e5e7eb'}`,
      overflow: 'hidden', opacity: enCours ? 0.7 : 1, transition: 'opacity 0.2s',
      boxShadow: auj ? '0 0 0 2px #fde68a' : passe ? '0 0 0 2px #fca5a5' : 'none',
    }}>

      {/* Ligne principale */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
          {/* Dates création + récupération */}
          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>📝 {formatDateHeure(c.created_at)}</span>
            {c.recuperee_at && (
              <span style={{ color: '#166534' }}>✓ {formatDateHeure(c.recuperee_at)}</span>
            )}
          </div>
        </div>

        {/* Date retrait */}
        <div style={{ textAlign: 'center', minWidth: '80px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: auj ? '#854d0e' : passe ? '#dc2626' : '#374151', background: auj ? '#fef9c3' : passe ? '#fee2e2' : '#f3f4f6', borderRadius: '6px', padding: '3px 8px', display: 'inline-block', whiteSpace: 'nowrap' }}>
            {!c.date_retrait ? '—' : auj ? '📅 Aujourd\'hui' : passe ? '⚠ ' + formatDateFr(c.date_retrait) : formatDateFr(c.date_retrait)}
          </div>
        </div>

        {/* Montant */}
        <div style={{ fontWeight: 700, fontSize: '15px', color: '#1C2B1A', minWidth: '65px', textAlign: 'right' }}>
          {Number(c.montant_total).toFixed(2)} €
        </div>

        {/* Badge statut */}
        <div style={{ padding: '3px 10px', borderRadius: '999px', background: meta.bg, color: meta.color, fontSize: '12px', fontWeight: 600, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
          {meta.emoji} {meta.label}
        </div>

        {/* Actions rapides */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
          {c.type === 'recurrente' && !c.recurence_validee && c.statut !== 'annulee' && (
            <button onClick={e => { e.stopPropagation(); onActiverRecurrence(c.id) }}
              style={{ background: '#0369a1', color: 'white', border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔄 Activer
            </button>
          )}
          {c.type === 'recurrente' && c.recurence_validee && c.statut !== 'recuperee' && c.statut !== 'annulee' && (
            <span style={{ fontSize: '10px', padding: '3px 7px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontWeight: 600, whiteSpace: 'nowrap' }}>
              🔄 Actif
            </span>
          )}
          {c.statut !== 'recuperee' && c.statut !== 'annulee' && (
            <button onClick={e => { e.stopPropagation(); onChangerStatut(c.id, 'recuperee') }}
              style={{ background: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ✓ Récupérée
            </button>
          )}
          <button onClick={onToggle}
            style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '7px', padding: '6px 9px', fontSize: '12px', cursor: 'pointer' }}>
            {ouvert ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Produits toujours visibles */}
      <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 16px', background: '#fafafa', display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
        {c.lignes?.map((l: any) => (
          <span key={l.id} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', background: 'white', border: '1px solid #e5e7eb', color: '#374151' }}>
            {l.produit?.nom} <strong>×{l.quantite}</strong>
          </span>
        ))}
        {c.notes && (
          <span style={{ fontSize: '11px', color: '#854d0e', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '999px', padding: '2px 8px' }}>
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
                <p style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '13px', margin: '0 0 2px' }}>🔄 Abonnement en attente d'activation</p>
                <p style={{ fontSize: '12px', color: '#3b82f6', margin: 0 }}>Le client attend votre validation pour démarrer.</p>
              </div>
              <button onClick={() => onActiverRecurrence(c.id)}
                style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                ✓ Activer l'abonnement
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>

            {/* Détail produits + dates */}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Détail commande</p>
              {c.lignes?.map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>{l.produit?.nom} <span style={{ color: '#9ca3af' }}>×{l.quantite}</span></span>
                  <span style={{ fontWeight: 600 }}>{(l.quantite * Number(l.prix_unitaire)).toFixed(2)} €</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, marginTop: '8px', paddingTop: '8px', borderTop: '2px solid #e5e7eb' }}>
                <span>Total</span><span>{Number(c.montant_total).toFixed(2)} €</span>
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {c.created_at && (
                  <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span>📝</span>
                    <span>Commandée le <strong style={{ color: '#6b7280' }}>{formatDateHeure(c.created_at)}</strong></span>
                  </div>
                )}
                {c.recuperee_at && (
                  <div style={{ fontSize: '11px', color: '#166534', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span>✓</span>
                    <span>Récupérée le <strong>{formatDateHeure(c.recuperee_at)}</strong></span>
                  </div>
                )}
              </div>

              {c.client?.telephone && (
                <a href={`tel:${c.client.telephone}`}
                  style={{ display: 'inline-block', marginTop: '10px', padding: '6px 12px', background: '#f0fdf4', borderRadius: '6px', textDecoration: 'none', color: '#166534', fontSize: '12px', fontWeight: 600 }}>
                  📞 {c.client.telephone}
                </a>
              )}
            </div>

            {/* Changement de statut */}
            {c.statut !== 'annulee' && (
              <div style={{ minWidth: '200px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modifier le statut</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {STATUTS_PROGRESSION.map(s => {
                    const sm     = STATUT_META[s]
                    const courant = c.statut === s
                    const aVenir  = STATUTS_PROGRESSION.indexOf(s) > STATUTS_PROGRESSION.indexOf(c.statut as any)
                    return (
                      <button key={s}
                        onClick={() => !courant && onChangerStatut(c.id, s)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 10px', borderRadius: '8px',
                          border: `1px solid ${courant ? sm.border : '#e5e7eb'}`,
                          background: courant ? sm.bg : 'white',
                          color: courant ? sm.color : aVenir ? '#374151' : '#9ca3af',
                          fontSize: '12px', fontWeight: courant ? 700 : 400,
                          cursor: courant ? 'default' : 'pointer', textAlign: 'left',
                        }}>
                        <span>{courant ? sm.emoji : aVenir ? '○' : '↩'}</span>
                        {sm.label}
                        {!courant && !aVenir && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9ca3af' }}>revenir</span>}
                        {s === 'recuperee' && !courant && aVenir && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6b7280' }}>confirmation</span>}
                      </button>
                    )
                  })}
                  <button onClick={() => onChangerStatut(c.id, 'annulee')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: '12px', cursor: 'pointer', marginTop: '4px' }}>
                    <span>✕</span> Annuler la commande
                  </button>
                </div>
              </div>
            )}

            {/* Commande annulée */}
            {c.statut === 'annulee' && (
              <div style={{ minWidth: '200px', background: '#fef2f2', borderRadius: '10px', padding: '14px', border: '1px solid #fca5a5' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', margin: '0 0 6px' }}>✕ Commande annulée</p>
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
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CommandesPage() {
  const [commandes, setCommandes]             = useState<any[]>([])
  const [loading, setLoading]                 = useState(true)
  const [filtre, setFiltre]                   = useState<string>('actif')
  const [recherche, setRecherche]             = useState('')
  const [confirming, setConfirming]           = useState<{ id: string; action: 'recuperee' | 'annulee' } | null>(null)
  const [detailOuvert, setDetailOuvert]       = useState<string | null>(null)
  const [changementStatut, setChangementStatut] = useState<string | null>(null)
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

  async function activerRecurrence(commandeId: string) {
    await supabase.from('commandes').update({ recurence_validee: true, statut: 'confirmee' }).eq('id', commandeId)
    chargerCommandes()
  }

  async function changerStatut(commandeId: string, nouveauStatut: string) {
    if (nouveauStatut === 'recuperee') { setConfirming({ id: commandeId, action: 'recuperee' }); return }
    if (nouveauStatut === 'annulee')   { setConfirming({ id: commandeId, action: 'annulee' }); return }
    await effectuerChangement(commandeId, nouveauStatut)
  }

  async function effectuerChangement(commandeId: string, nouveauStatut: string) {
    const commande = commandes.find(c => c.id === commandeId)
    setChangementStatut(commandeId)

    const updateData: any = { statut: nouveauStatut }
    // Enregistrer l'heure exacte de récupération
    if (nouveauStatut === 'recuperee') updateData.recuperee_at = new Date().toISOString()
    // Effacer recuperee_at si on revient en arrière
    if (nouveauStatut !== 'recuperee') updateData.recuperee_at = null

    await supabase.from('commandes').update(updateData).eq('id', commandeId)

    if (nouveauStatut === 'recuperee' && commande?.client?.id) {
      if (commande.client.statut !== 'vip') {
        await supabase.from('clients').update({ statut: 'verifie' }).eq('id', commande.client.id)
      }
    }

    await chargerCommandes()
    setChangementStatut(null)
    setConfirming(null)
  }

  // ── Calculs ──────────────────────────────────────────────────────────────────
  const aujourd_hui = new Date().toISOString().split('T')[0]

  // Commandes actives = ni récupérées ni annulées, date de retrait aujourd'hui ou futur
  const actives = commandes.filter(c => c.statut !== 'annulee' && c.statut !== 'recuperee')

  // Non récupérées = date passée ou aujourd'hui, pas encore récupérées, pas annulées
  const nonRecuperees = commandes.filter(c =>
    c.statut !== 'recuperee' && c.statut !== 'annulee' &&
    c.date_retrait && c.date_retrait <= aujourd_hui
  )

  // Grouper les non récupérées par statut
  const nonRecupereesParStatut: Record<string, any[]> = {}
  nonRecuperees.forEach(c => {
    if (!nonRecupereesParStatut[c.statut]) nonRecupereesParStatut[c.statut] = []
    nonRecupereesParStatut[c.statut].push(c)
  })

  const commandesFiltrees = (() => {
    let liste = commandes
    if (filtre === 'actif')       liste = commandes.filter(c => c.statut !== 'annulee' && c.statut !== 'recuperee' && (!c.date_retrait || c.date_retrait >= aujourd_hui || estAujourdHui(c.date_retrait)))
    else if (filtre === 'aujourd_hui') liste = commandes.filter(c => c.date_retrait === aujourd_hui && c.statut !== 'annulee')
    else if (filtre === 'non_recuperee') liste = nonRecuperees
    else if (filtre === 'recuperee')  liste = commandes.filter(c => c.statut === 'recuperee')
    else if (filtre === 'annulee')    liste = commandes.filter(c => c.statut === 'annulee')

    if (recherche) {
      const q = recherche.toLowerCase()
      liste = liste.filter(c =>
        c.client?.nom?.toLowerCase().includes(q) ||
        c.client?.prenom?.toLowerCase().includes(q) ||
        c.client?.telephone?.includes(q)
      )
    }
    return liste
  })()

  const nb = {
    actif:           actives.filter(c => !c.date_retrait || c.date_retrait >= aujourd_hui || estAujourdHui(c.date_retrait)).length,
    aujourd_hui:     commandes.filter(c => c.date_retrait === aujourd_hui && c.statut !== 'annulee').length,
    non_recuperee:   nonRecuperees.length,
    recuperee:       commandes.filter(c => c.statut === 'recuperee').length,
    annulee:         commandes.filter(c => c.statut === 'annulee').length,
  }

  if (loading) return <div style={{ color: '#6b7280', padding: '40px' }}>Chargement…</div>

  const onglets = [
    { id: 'actif',         label: 'En cours',       nb: nb.actif },
    { id: 'aujourd_hui',   label: "Aujourd'hui",    nb: nb.aujourd_hui },
    { id: 'non_recuperee', label: 'Non récupérées', nb: nb.non_recuperee, alerte: nb.non_recuperee > 0 },
    { id: 'recuperee',     label: 'Récupérées',     nb: nb.recuperee },
    { id: 'annulee',       label: 'Annulées',       nb: nb.annulee },
  ] as const

  return (
    <div style={{ maxWidth: '980px' }}>

      {confirming && (
        <ModalConfirm
          texte={confirming.action === 'recuperee'
            ? 'Confirmer que cette commande a été récupérée ?\nLe client passera en "vérifié". Vous pourrez revenir en arrière si besoin.'
            : 'Confirmer l\'annulation ? Vous pourrez la remettre en attente si c\'est une erreur.'}
          onNon={() => setConfirming(null)}
          onOui={() => effectuerChangement(confirming.id, confirming.action)}
        />
      )}

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#1C2B1A' }}>Commandes</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {nb.non_recuperee > 0 && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>
              ⚠️ {nb.non_recuperee} non récupérée{nb.non_recuperee > 1 ? 's' : ''}
            </div>
          )}
          {nb.aujourd_hui > 0 && (
            <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#854d0e', fontWeight: 600 }}>
              📅 {nb.aujourd_hui} aujourd'hui
            </div>
          )}
          <input type="text" placeholder="🔍 Rechercher…" value={recherche} onChange={e => setRecherche(e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', width: '170px' }} />
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '16px', background: '#f3f4f6', borderRadius: '10px', padding: '4px', overflowX: 'auto' }}>
        {onglets.map(tab => (
          <button key={tab.id} onClick={() => setFiltre(tab.id)}
            style={{ flex: 1, minWidth: 'fit-content', padding: '7px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: filtre === tab.id ? 700 : 400, background: filtre === tab.id ? 'white' : 'transparent', color: filtre === tab.id ? (tab.id === 'non_recuperee' ? '#991b1b' : '#1C2B1A') : '#9ca3af', boxShadow: filtre === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', whiteSpace: 'nowrap' }}>
            {tab.label}
            {tab.nb > 0 && (
              <span style={{ marginLeft: '5px', background: filtre === tab.id ? (tab.id === 'non_recuperee' ? '#991b1b' : '#1C2B1A') : '#d1d5db', color: filtre === tab.id ? (tab.id === 'non_recuperee' ? 'white' : '#7CBF3A') : '#6b7280', borderRadius: '999px', padding: '1px 6px', fontSize: '10px' }}>
                {tab.nb}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Vue "Non récupérées" : groupement par statut */}
      {filtre === 'non_recuperee' && !recherche ? (
        <div>
          {Object.keys(nonRecupereesParStatut).length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
              <p style={{ margin: 0 }}>Toutes les commandes ont été récupérées !</p>
            </div>
          ) : (
            Object.entries(nonRecupereesParStatut).map(([statut, liste]) => {
              const sm = STATUT_META[statut]
              return (
                <div key={statut} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ padding: '4px 12px', borderRadius: '999px', background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`, fontSize: '13px', fontWeight: 700 }}>
                      {sm.emoji} {sm.label}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{liste.length} commande{liste.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {liste.map(c => (
                      <CarteCommande key={c.id} c={c}
                        ouvert={detailOuvert === c.id}
                        onToggle={() => setDetailOuvert(detailOuvert === c.id ? null : c.id)}
                        onChangerStatut={changerStatut}
                        onActiverRecurrence={activerRecurrence}
                        enCours={changementStatut === c.id}
                        effectuerChangement={effectuerChangement}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Vue normale : liste plate */
        <div>
          {commandesFiltrees.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
              <p style={{ margin: 0 }}>Aucune commande dans cette catégorie</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {commandesFiltrees.map(c => (
                <CarteCommande key={c.id} c={c}
                  ouvert={detailOuvert === c.id}
                  onToggle={() => setDetailOuvert(detailOuvert === c.id ? null : c.id)}
                  onChangerStatut={changerStatut}
                  onActiverRecurrence={activerRecurrence}
                  enCours={changementStatut === c.id}
                  effectuerChangement={effectuerChangement}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
