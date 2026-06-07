'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ChevronLeft, ChevronRight, X, Lock, Unlock, AlertTriangle, Phone, Mail } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Constantes ───────────────────────────────────────────────────────────────

const JOURS_SEMAINE_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_SEMAINE_LONGS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
               'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const STATUT_LABELS: Record<string, string> = {
  en_attente: 'En attente', confirmee: 'Confirmée',
  preparee: 'Préparée', recuperee: 'Récupérée', annulee: 'Annulée',
}
const STATUT_COULEURS: Record<string, { bg: string; color: string }> = {
  en_attente: { bg: '#fef9c3', color: '#854d0e' },
  confirmee:  { bg: '#dbeafe', color: '#1e40af' },
  preparee:   { bg: '#f0fdf4', color: '#166534' },
  recuperee:  { bg: '#dcfce7', color: '#166534' },
  annulee:    { bg: '#fee2e2', color: '#991b1b' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Commande {
  id: string
  statut: string
  montant_total: number
  type: string
  notes?: string
  client: { nom: string; prenom: string; telephone?: string; email?: string } | null
  lignes: { quantite: number; produit: { nom: string } | null }[]
}

interface Fermeture {
  id: string
  date: string | null
  jour_semaine: number | null
  // type 'recurrente' = toujours fermé ce jour de semaine
  // type 'manuelle'   = fermeture ponctuelle sur une date
  // type 'exceptionnelle' = OUVERTURE sur un jour normalement fermé (override)
  type: 'recurrente' | 'manuelle' | 'exceptionnelle'
  motif: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Supabase jour_semaine : 0=Lundi … 6=Dimanche → JS getDay() : 0=Dimanche … 6=Samedi */
function supaToJS(jourSemaine: number): number { return (jourSemaine + 1) % 7 }

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CalendrierPage() {
  const today = new Date()

  const [mois, setMois] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [fermetures, setFermetures] = useState<Fermeture[]>([])
  // Toutes les commandes du mois (date + statut + client info pour alertes)
  const [commandesMois, setCommandesMois] = useState<{ date: string; statut: string; client_nom: string; client_tel?: string; client_email?: string }[]>([])
  // Jour sélectionné
  const [jourSel, setJourSel] = useState<Date | null>(null)
  const [commandesDuJour, setCommandesDuJour] = useState<Commande[]>([])
  const [chargementJour, setChargementJour] = useState(false)
  // Formulaire fermeture/ouverture
  const [motif, setMotif] = useState('')
  const [panneauAction, setPanneauAction] = useState<'fermer' | 'ouvrir' | null>(null)
  // Alerte clients impactés
  const [alerteClientsVisible, setAlerteClientsVisible] = useState(false)
  const [clientsImpactes, setClientsImpactes] = useState<{ nom: string; tel?: string; email?: string }[]>([])

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  const showToast = (type: 'ok' | 'err', texte: string) => {
    setToast({ type, texte })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── Chargement données ──────────────────────────────────────────────────────

  const chargerFermetures = useCallback(async () => {
    const { data } = await supabase.from('fermetures').select('*').order('created_at')
    setFermetures((data ?? []) as Fermeture[])
  }, [])

  const chargerCommandesMois = useCallback(async () => {
    const debut = formatDate(new Date(mois.getFullYear(), mois.getMonth(), 1))
    const fin   = formatDate(new Date(mois.getFullYear(), mois.getMonth() + 1, 0))
    const { data } = await supabase
      .from('commandes')
      .select('date_retrait, statut, client:clients(nom, prenom, telephone, email)')
      .gte('date_retrait', debut)
      .lte('date_retrait', fin)
      .neq('statut', 'annulee')
    setCommandesMois(
      (data ?? []).map((c: { date_retrait: string; statut: string; client: { nom: string; prenom: string; telephone?: string; email?: string } | null }) => ({
        date: c.date_retrait,
        statut: c.statut,
        client_nom: c.client ? `${c.client.prenom} ${c.client.nom}` : 'Client inconnu',
        client_tel: c.client?.telephone,
        client_email: c.client?.email,
      }))
    )
  }, [mois])

  const chargerCommandesDuJour = useCallback(async (date: Date) => {
    setChargementJour(true)
    const { data } = await supabase
      .from('commandes')
      .select('id, statut, montant_total, type, notes, client:clients(nom, prenom, telephone, email), lignes:lignes_commande(quantite, produit:produits(nom))')
      .eq('date_retrait', formatDate(date))
      .order('created_at')
    setCommandesDuJour((data as unknown as Commande[]) ?? [])
    setChargementJour(false)
  }, [])

  useEffect(() => { chargerFermetures() }, [chargerFermetures])
  useEffect(() => { chargerCommandesMois() }, [chargerCommandesMois])

  // ─── Logique fermetures ───────────────────────────────────────────────────────

  /**
   * Un jour est fermé si :
   * - son jour_semaine est en fermeture récurrente ET pas de record 'exceptionnelle' sur cette date (ouverture override)
   * - OU il a un record 'manuelle' sur cette date
   */
  function estFerme(date: Date): boolean {
    const dateStr = formatDate(date)
    const jsDay = date.getDay()
    const recurrente = fermetures.find(f => f.type === 'recurrente' && f.jour_semaine !== null && supaToJS(f.jour_semaine) === jsDay)
    const ouvertureException = fermetures.find(f => f.type === 'exceptionnelle' && f.date === dateStr)
    if (recurrente && !ouvertureException) return true
    return fermetures.some(f => f.type === 'manuelle' && f.date === dateStr)
  }

  function estRecurrentFerme(date: Date): boolean {
    const jsDay = date.getDay()
    return fermetures.some(f => f.type === 'recurrente' && f.jour_semaine !== null && supaToJS(f.jour_semaine) === jsDay)
  }

  function ouvertureExceptionnellePour(date: Date): Fermeture | undefined {
    const dateStr = formatDate(date)
    return fermetures.find(f => f.type === 'exceptionnelle' && f.date === dateStr)
  }

  function fermetureManuelleFor(date: Date): Fermeture | undefined {
    const dateStr = formatDate(date)
    return fermetures.find(f => f.type === 'manuelle' && f.date === dateStr)
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  const selectionnerJour = (date: Date) => {
    setJourSel(date)
    setPanneauAction(null)
    setMotif('')
    setAlerteClientsVisible(false)
    chargerCommandesDuJour(date)
  }

  /** Fermer un jour ponctuel : vérifie d'abord les commandes existantes */
  const demanderFermeture = () => {
    if (!jourSel) return
    const dateStr = formatDate(jourSel)
    const impactes = commandesMois
      .filter(c => c.date === dateStr)
      .map(c => ({ nom: c.client_nom, tel: c.client_tel, email: c.client_email }))
    if (impactes.length > 0) {
      setClientsImpactes(impactes)
      setAlerteClientsVisible(true)
    }
    setPanneauAction('fermer')
  }

  const confirmerFermeture = async () => {
    if (!jourSel) return
    const { error } = await supabase.from('fermetures').insert({
      date: formatDate(jourSel),
      type: 'manuelle',
      motif: motif || 'Fermeture ponctuelle',
    })
    if (error) showToast('err', 'Erreur lors de l\'ajout.')
    else {
      showToast('ok', 'Jour fermé.')
      chargerFermetures()
      chargerCommandesMois()
      setPanneauAction(null)
      setAlerteClientsVisible(false)
      setMotif('')
    }
  }

  /** Supprimer fermeture manuelle (rouvrir un jour ponctuel) */
  const supprimerFermetureManuelle = async () => {
    if (!jourSel) return
    const f = fermetureManuelleFor(jourSel)
    if (!f) return
    await supabase.from('fermetures').delete().eq('id', f.id)
    showToast('ok', 'Jour rouvert.')
    chargerFermetures()
  }

  /** Ouverture exceptionnelle : override un jour récurrent fermé */
  const confirmerOuvertureExceptionnelle = async () => {
    if (!jourSel) return
    const { error } = await supabase.from('fermetures').insert({
      date: formatDate(jourSel),
      type: 'exceptionnelle',
      motif: motif || 'Ouverture exceptionnelle',
    })
    if (error) showToast('err', 'Erreur.')
    else {
      showToast('ok', 'Ouverture exceptionnelle enregistrée.')
      chargerFermetures()
      setPanneauAction(null)
      setMotif('')
    }
  }

  /** Annuler ouverture exceptionnelle (refermer un jour récurrent) */
  const annulerOuvertureExceptionnelle = async () => {
    if (!jourSel) return
    const f = ouvertureExceptionnellePour(jourSel)
    if (!f) return
    await supabase.from('fermetures').delete().eq('id', f.id)
    showToast('ok', 'Le jour est à nouveau fermé.')
    chargerFermetures()
  }

  const changerStatutCommande = async (id: string, statut: string) => {
    await supabase.from('commandes').update({ statut }).eq('id', id)
    if (jourSel) chargerCommandesDuJour(jourSel)
    chargerCommandesMois()
  }

  // ─── Construction grille ──────────────────────────────────────────────────────

  const premierJourMois = new Date(mois.getFullYear(), mois.getMonth(), 1)
  const offsetLundi = (premierJourMois.getDay() + 6) % 7
  const debutGrille = new Date(premierJourMois)
  debutGrille.setDate(premierJourMois.getDate() - offsetLundi)

  const jours: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille)
    d.setDate(debutGrille.getDate() + i)
    return d
  })
  // Couper à 35 si la 6e ligne est entièrement hors du mois
  const joursAffiches = jours[35] && jours[35].getMonth() !== mois.getMonth() &&
                        jours[28] && jours[28].getMonth() !== mois.getMonth()
    ? jours.slice(0, 35)
    : jours.slice(0, 42).filter((_, i) => i < 35 || jours[35].getMonth() === mois.getMonth())

  const commandesParDate: Record<string, { total: number; enAttente: number }> = {}
  commandesMois.forEach(c => {
    if (!commandesParDate[c.date]) commandesParDate[c.date] = { total: 0, enAttente: 0 }
    commandesParDate[c.date].total++
    if (c.statut === 'en_attente') commandesParDate[c.date].enAttente++
  })

  const totalMois = commandesMois.length
  const enAttenteMois = commandesMois.filter(c => c.statut === 'en_attente').length

  // ─── Panneau jour : état de fermeture ────────────────────────────────────────

  const jourRecFerme  = jourSel ? estRecurrentFerme(jourSel) : false
  const jourOuvExcep  = jourSel ? ouvertureExceptionnellePour(jourSel) : undefined
  const jourManFerme  = jourSel ? fermetureManuelleFor(jourSel) : undefined
  const jourEstFerme  = jourSel ? estFerme(jourSel) : false

  // ─── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>

      {/* En-tête */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1C2B1A', margin: 0 }}>Calendrier</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          {totalMois} commande{totalMois !== 1 ? 's' : ''} ce mois
          {enAttenteMois > 0 && (
            <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#fef9c3', color: '#854d0e', borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
              {enAttenteMois} en attente
            </span>
          )}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ marginBottom: '14px', padding: '10px 16px', borderRadius: '8px', fontSize: '14px',
          background: toast.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: toast.type === 'ok' ? '#166534' : '#991b1b' }}>
          {toast.texte}
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* ── Calendrier ── */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>

          {/* Navigation mois */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#1C2B1A' }}>
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '18px', color: '#fff' }}>
              {MOIS[mois.getMonth()]} {mois.getFullYear()}
            </span>
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* En-têtes jours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {JOURS_SEMAINE_COURTS.map(j => (
              <div key={j} style={{ padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{j}</div>
            ))}
          </div>

          {/* Cellules */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {joursAffiches.map((date, i) => {
              const dateStr   = formatDate(date)
              const dansMois  = date.getMonth() === mois.getMonth()
              const estAuj    = memeJour(date, today)
              const selectionne = jourSel ? memeJour(date, jourSel) : false
              const ferme     = dansMois ? estFerme(date) : false
              const recFerme  = dansMois ? estRecurrentFerme(date) : false
              const ouvExcep  = dansMois ? !!ouvertureExceptionnellePour(date) : false
              const stats     = commandesParDate[dateStr]

              let bg = '#fff'
              if (!dansMois) bg = '#f9fafb'
              else if (ferme) bg = '#fff5f5'
              else if (date.getDay() === 0 || date.getDay() === 6) bg = '#fafafa'
              if (selectionne) bg = '#f0f9e8'

              return (
                <div key={i} onClick={() => dansMois && selectionnerJour(date)}
                  style={{
                    minHeight: '78px', padding: '7px 8px',
                    background: bg,
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid #f0f0f0' : 'none',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: dansMois ? 'pointer' : 'default',
                    outline: selectionne ? '2px solid #7CBF3A' : 'none',
                    outlineOffset: '-2px',
                    position: 'relative',
                  }}>
                  {/* Numéro */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: estAuj ? '#1C2B1A' : 'transparent',
                    color: estAuj ? '#fff' : dansMois ? '#1C2B1A' : '#d1d5db',
                    fontWeight: estAuj ? 700 : 400, fontSize: '13px', marginBottom: '3px',
                  }}>{date.getDate()}</div>

                  {/* Indicateur fermeture */}
                  {dansMois && ferme && (
                    <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, lineHeight: 1, marginBottom: '2px' }}>
                      {recFerme && !ouvExcep ? '🔒 Fermé' : '🔒 Fermé'}
                    </div>
                  )}
                  {dansMois && ouvExcep && (
                    <div style={{ fontSize: '10px', color: '#7CBF3A', fontWeight: 700, lineHeight: 1, marginBottom: '2px' }}>
                      ✓ Ouvert
                    </div>
                  )}

                  {/* Badges commandes */}
                  {dansMois && stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, background: '#d1fae5', color: '#065f46', borderRadius: '4px', padding: '1px 4px', display: 'inline-block' }}>
                        {stats.total} cmd
                      </span>
                      {stats.enAttente > 0 && (
                        <span style={{ fontSize: '10px', fontWeight: 600, background: '#fef9c3', color: '#854d0e', borderRadius: '4px', padding: '1px 4px', display: 'inline-block' }}>
                          {stats.enAttente} att.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Légende */}
          <div style={{ padding: '10px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { bg: '#1C2B1A', label: "Aujourd'hui" },
              { bg: '#fff5f5', border: '1px solid #fca5a5', label: 'Fermé' },
              { bg: '#d1fae5', label: 'Commandes' },
              { bg: '#fef9c3', label: 'En attente' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.bg, border: item.border ?? '1px solid #e5e7eb' }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Fermetures récurrentes (toujours visible) */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1C2B1A' }}>Fermetures hebdomadaires</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Configurées dans la base de données</div>
            </div>
            <div style={{ padding: '12px 16px' }}>
              {fermetures.filter(f => f.type === 'recurrente').length === 0 && (
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Aucune fermeture récurrente.</p>
              )}
              {fermetures.filter(f => f.type === 'recurrente').map(f => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#fef2f2', borderRadius: '6px', marginBottom: '4px' }}>
                  <Lock size={12} color="#ef4444" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1C2B1A' }}>
                    {f.jour_semaine !== null ? JOURS_SEMAINE_LONGS[f.jour_semaine] : '—'}
                  </span>
                  {f.motif && <span style={{ fontSize: '11px', color: '#9ca3af' }}>· {f.motif}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Panneau jour sélectionné */}
          {jourSel && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>

              {/* En-tête jour */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: jourEstFerme ? '#fff5f5' : '#f9fafb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#1C2B1A' }}>
                    {JOURS_SEMAINE_LONGS[(jourSel.getDay() + 6) % 7]} {jourSel.getDate()} {MOIS[jourSel.getMonth()]} {jourSel.getFullYear()}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '2px', color: jourEstFerme ? '#ef4444' : '#7CBF3A', fontWeight: 600 }}>
                    {jourEstFerme ? '🔒 Fermé' : '✓ Ouvert'}
                    {jourOuvExcep && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '6px' }}>(ouverture exceptionnelle)</span>}
                  </div>
                </div>
                <button onClick={() => { setJourSel(null); setPanneauAction(null); setAlerteClientsVisible(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Alerte clients impactés */}
              {alerteClientsVisible && clientsImpactes.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <AlertTriangle size={14} color="#d97706" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                      {clientsImpactes.length} commande{clientsImpactes.length > 1 ? 's' : ''} existante{clientsImpactes.length > 1 ? 's' : ''} ce jour !
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#92400e', margin: '0 0 8px', fontStyle: 'italic' }}>
                    Clients à contacter avant de fermer :
                  </p>
                  {clientsImpactes.map((c, i) => (
                    <div key={i} style={{ padding: '6px 8px', background: '#fff', borderRadius: '6px', marginBottom: '4px', fontSize: '12px', border: '1px solid #fde68a' }}>
                      <div style={{ fontWeight: 600, color: '#1C2B1A', marginBottom: '2px' }}>{c.nom}</div>
                      {c.tel && (
                        <a href={`tel:${c.tel}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#1C2B1A', textDecoration: 'none', marginBottom: '1px' }}>
                          <Phone size={10} /> {c.tel}
                        </a>
                      )}
                      {c.email && (
                        <a href={`mailto:${c.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3B6D11', textDecoration: 'none' }}>
                          <Mail size={10} /> {c.email}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions fermeture/ouverture */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>

                {/* Cas 1 : Jour normalement ouvert, pas de fermeture manuelle */}
                {!jourRecFerme && !jourManFerme && panneauAction === null && (
                  <button onClick={demanderFermeture}
                    style={{ width: '100%', padding: '8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Lock size={14} /> Fermer ce jour
                  </button>
                )}

                {/* Cas 1b : Fermeture manuelle → bouton rouvrir */}
                {!jourRecFerme && jourManFerme && panneauAction === null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600, padding: '6px 8px', background: '#fef2f2', borderRadius: '6px' }}>
                      🔒 {jourManFerme.motif || 'Fermeture ponctuelle'}
                    </div>
                    <button onClick={supprimerFermetureManuelle}
                      style={{ padding: '7px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Unlock size={14} /> Rouvrir ce jour
                    </button>
                  </div>
                )}

                {/* Cas 2 : Jour récurrent fermé, sans ouverture exceptionnelle */}
                {jourRecFerme && !jourOuvExcep && panneauAction === null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#9ca3af', padding: '6px 8px', background: '#fef2f2', borderRadius: '6px' }}>
                      🔒 Fermé chaque {JOURS_SEMAINE_LONGS[(jourSel.getDay() + 6) % 7].toLowerCase()}
                    </div>
                    <button onClick={() => { setPanneauAction('ouvrir'); setMotif('') }}
                      style={{ padding: '7px', background: '#f0f9e8', color: '#3B6D11', border: '1px solid #7CBF3A', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Unlock size={14} /> Ouvrir exceptionnellement
                    </button>
                  </div>
                )}

                {/* Cas 3 : Ouverture exceptionnelle active → proposer d'annuler */}
                {jourRecFerme && jourOuvExcep && panneauAction === null && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#3B6D11', fontWeight: 600, padding: '6px 8px', background: '#f0fdf4', borderRadius: '6px' }}>
                      ✓ {jourOuvExcep.motif || 'Ouverture exceptionnelle'}
                    </div>
                    <button onClick={annulerOuvertureExceptionnelle}
                      style={{ padding: '7px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Lock size={14} /> Refermer ce jour
                    </button>
                  </div>
                )}

                {/* Formulaire fermeture ponctuelle */}
                {panneauAction === 'fermer' && (
                  <div>
                    {clientsImpactes.length > 0 && (
                      <p style={{ fontSize: '12px', color: '#d97706', fontWeight: 600, marginBottom: '8px', marginTop: 0 }}>
                        ⚠ {clientsImpactes.length} commande{clientsImpactes.length > 1 ? 's' : ''} existante{clientsImpactes.length > 1 ? 's' : ''} — confirmez-vous la fermeture ?
                      </p>
                    )}
                    <input type="text" value={motif} onChange={e => setMotif(e.target.value)}
                      placeholder="Motif (ex : congé, travaux…)"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={confirmerFermeture}
                        style={{ flex: 1, padding: '7px', background: '#1C2B1A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                        Confirmer fermeture
                      </button>
                      <button onClick={() => { setPanneauAction(null); setAlerteClientsVisible(false) }}
                        style={{ padding: '7px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulaire ouverture exceptionnelle */}
                {panneauAction === 'ouvrir' && (
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', marginTop: 0 }}>
                      Ce jour sera ouvert exceptionnellement, malgré la fermeture habituelle.
                    </p>
                    <input type="text" value={motif} onChange={e => setMotif(e.target.value)}
                      placeholder="Motif (ex : fête locale, marché…)"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={confirmerOuvertureExceptionnelle}
                        style={{ flex: 1, padding: '7px', background: '#3B6D11', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                        Confirmer ouverture
                      </button>
                      <button onClick={() => setPanneauAction(null)}
                        style={{ padding: '7px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Liste commandes du jour */}
              <div style={{ padding: '12px 16px', maxHeight: '420px', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Commandes du jour ({commandesDuJour.length})
                </div>

                {chargementJour && <p style={{ fontSize: '13px', color: '#9ca3af' }}>Chargement…</p>}

                {!chargementJour && commandesDuJour.length === 0 && (
                  <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Aucune commande ce jour.</p>
                )}

                {commandesDuJour.map(cmd => {
                  const coul = STATUT_COULEURS[cmd.statut] ?? { bg: '#f3f4f6', color: '#374151' }
                  return (
                    <div key={cmd.id} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '8px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#1C2B1A' }}>
                            {cmd.client ? `${cmd.client.prenom} ${cmd.client.nom}` : 'Client inconnu'}
                          </div>
                          {cmd.client?.telephone && (
                            <a href={`tel:${cmd.client.telephone}`} style={{ fontSize: '11px', color: '#6b7280', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Phone size={10} /> {cmd.client.telephone}
                            </a>
                          )}
                        </div>
                        <span style={{ padding: '2px 7px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, background: coul.bg, color: coul.color, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}>
                          {STATUT_LABELS[cmd.statut] ?? cmd.statut}
                        </span>
                      </div>

                      <div style={{ marginBottom: '5px' }}>
                        {cmd.lignes.map((l, i) => (
                          <div key={i} style={{ fontSize: '12px', color: '#4b5563' }}>{l.quantite}× {l.produit?.nom ?? '—'}</div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: '#9ca3af' }}>{cmd.type === 'recurrente' ? '🔁 Récurrente' : '📋 Ponctuelle'}</span>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#1C2B1A' }}>{Number(cmd.montant_total).toFixed(2)} €</span>
                      </div>

                      {cmd.notes && (
                        <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '4px 6px', background: '#f9fafb', borderRadius: '4px', marginBottom: '6px' }}>
                          {cmd.notes}
                        </div>
                      )}

                      {cmd.statut !== 'annulee' && cmd.statut !== 'recuperee' && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {cmd.statut === 'en_attente' && (
                            <button onClick={() => changerStatutCommande(cmd.id, 'confirmee')}
                              style={{ fontSize: '11px', padding: '3px 8px', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                              Confirmer
                            </button>
                          )}
                          {cmd.statut === 'confirmee' && (
                            <button onClick={() => changerStatutCommande(cmd.id, 'preparee')}
                              style={{ fontSize: '11px', padding: '3px 8px', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                              Préparée
                            </button>
                          )}
                          {cmd.statut === 'preparee' && (
                            <button onClick={() => changerStatutCommande(cmd.id, 'recuperee')}
                              style={{ fontSize: '11px', padding: '3px 8px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                              Récupérée ✓
                            </button>
                          )}
                          <button onClick={() => changerStatutCommande(cmd.id, 'annulee')}
                            style={{ fontSize: '11px', padding: '3px 8px', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Hint quand aucun jour sélectionné */}
          {!jourSel && (
            <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
              Cliquez sur un jour du calendrier pour gérer les fermetures et consulter les commandes.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
