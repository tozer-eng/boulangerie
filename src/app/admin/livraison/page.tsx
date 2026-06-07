'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ChevronLeft, ChevronRight, X, Truck, Plus, Repeat, CalendarDays, Trash2 } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Constantes ───────────────────────────────────────────────────────────────

const JOURS_COURTS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONGS   = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MOIS_LONGS    = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const RECURRENCES: { value: string; label: string; desc: string }[] = [
  { value: 'hebdomadaire',    label: 'Chaque semaine',     desc: 'Toutes les semaines ce jour-là' },
  { value: 'bi-hebdomadaire', label: 'Une semaine sur deux', desc: 'En alternance, à partir de la date choisie' },
  { value: 'mensuelle',       label: 'Une fois par mois',  desc: "Le même rang dans le mois (ex : 2e mercredi)" },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface Parametres {
  id: string
  livraison_active: boolean
  frais_livraison: number
  montant_minimum_livraison: number
  seuil_gratuite_livraison: number | null
}

interface JourLivraison {
  id: string
  type: 'ponctuelle' | 'recurrente'
  date: string | null
  jour_semaine: number | null
  recurrence: string | null
  date_reference: string | null
  motif: string | null
  actif: boolean
}

// ─── Helpers date ─────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** JS getDay() (0=dim) → index lundi-first (0=lun…6=dim) */
function jsToLundi(jsDay: number): number { return (jsDay + 6) % 7 }

/** Index lundi-first → JS getDay() */
function lundiToJS(i: number): number { return (i + 1) % 7 }

/** Rang de l'occurrence d'un jour dans son mois (1 = premier, 2 = deuxième…) */
function rangOccurrenceMois(d: Date): number {
  return Math.ceil(d.getDate() / 7)
}

/**
 * Détermine si une date donnée est un jour de livraison
 * en fonction de la liste de créneaux.
 */
function estJourLivraison(date: Date, creneaux: JourLivraison[]): JourLivraison | undefined {
  const dateStr  = formatDate(date)
  const jsDay    = date.getDay()
  const lundiIdx = jsToLundi(jsDay)

  return creneaux.find(c => {
    if (!c.actif) return false

    if (c.type === 'ponctuelle') {
      return c.date === dateStr
    }

    // recurrente : vérifier le jour de semaine en premier
    if (c.jour_semaine === null || c.jour_semaine !== lundiIdx) return false

    if (c.recurrence === 'hebdomadaire') return true

    if (c.recurrence === 'bi-hebdomadaire') {
      if (!c.date_reference) return false
      const ref  = parseDate(c.date_reference)
      const diff = Math.round((date.getTime() - ref.getTime()) / (7 * 86400000))
      return diff >= 0 && diff % 2 === 0
    }

    if (c.recurrence === 'mensuelle') {
      if (!c.date_reference) return false
      const ref  = parseDate(c.date_reference)
      return rangOccurrenceMois(date) === rangOccurrenceMois(ref)
    }

    return false
  })
}

/** Label court pour un créneau récurrent */
function labelCreneau(c: JourLivraison): string {
  if (c.type === 'ponctuelle') {
    return c.date ? `Ponctuelle ${c.date}` : 'Ponctuelle'
  }
  const jour = c.jour_semaine !== null ? JOURS_LONGS[c.jour_semaine] : '?'
  switch (c.recurrence) {
    case 'hebdomadaire':    return `Chaque ${jour}`
    case 'bi-hebdomadaire': return `1 ${jour} / 2`
    case 'mensuelle': {
      if (!c.date_reference) return `${jour} mensuel`
      const rang = rangOccurrenceMois(parseDate(c.date_reference))
      const ordinal = ['', '1er', '2e', '3e', '4e', '5e'][rang] ?? `${rang}e`
      return `${ordinal} ${jour} du mois`
    }
    default: return jour
  }
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function LivraisonPage() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const [params, setParams]           = useState<Parametres | null>(null)
  const [creneaux, setCreneaux]       = useState<JourLivraison[]>([])
  const [mois, setMois]               = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [jourSel, setJourSel]         = useState<Date | null>(null)
  const [chargement, setChargement]   = useState(true)
  const [saving, setSaving]           = useState(false)
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null)

  // Formulaire ajout créneau
  const [panneau, setPanneau]         = useState<'ajout' | 'detail' | null>(null)
  const [formType, setFormType]       = useState<'ponctuelle' | 'recurrente'>('ponctuelle')
  const [formRecurrence, setFormRecurrence] = useState('hebdomadaire')
  const [formMotif, setFormMotif]     = useState('')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Chargement ───────────────────────────────────────────────────────────

  const charger = useCallback(async () => {
    setChargement(true)
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('parametres').select('id, livraison_active, frais_livraison, montant_minimum_livraison, seuil_gratuite_livraison').single(),
      supabase.from('jours_livraison').select('*').eq('actif', true).order('created_at'),
    ])
    if (p) setParams(p as Parametres)
    setCreneaux((c ?? []) as JourLivraison[])
    setChargement(false)
  }, [])

  useEffect(() => { charger() }, [charger])

  // ─── Actions ─────────────────────────────────────────────────────────────

  const toggleLivraison = async () => {
    if (!params) return
    const val = !params.livraison_active
    setParams(p => p ? { ...p, livraison_active: val } : p)
    const { error } = await supabase.from('parametres').update({ livraison_active: val }).eq('id', params.id)
    if (error) { setParams(p => p ? { ...p, livraison_active: !val } : p); showToast('Erreur', false) }
    else showToast(val ? 'Livraison activée' : 'Livraison désactivée')
  }

  const enregistrerParametres = async () => {
    if (!params) return
    setSaving(true)
    const { error } = await supabase.from('parametres').update({
      frais_livraison: params.frais_livraison,
      montant_minimum_livraison: params.montant_minimum_livraison,
      seuil_gratuite_livraison: params.seuil_gratuite_livraison,
    }).eq('id', params.id)
    setSaving(false)
    showToast(error ? 'Erreur' : 'Paramètres enregistrés', !error)
  }

  const ajouterCreneau = async () => {
    if (!jourSel) return
    const dateStr = formatDate(jourSel)

    let payload: Partial<JourLivraison>

    if (formType === 'ponctuelle') {
      payload = { type: 'ponctuelle', date: dateStr, motif: formMotif || null }
    } else {
      const lundiIdx = jsToLundi(jourSel.getDay())
      payload = {
        type: 'recurrente',
        jour_semaine: lundiIdx,
        recurrence: formRecurrence,
        date_reference: dateStr,   // référence pour bi-hebdo et mensuel
        motif: formMotif || null,
      }
    }

    const { error } = await supabase.from('jours_livraison').insert({ ...payload, actif: true })
    if (error) { showToast('Erreur lors de l\'ajout', false); return }

    showToast('Créneau ajouté')
    setFormMotif('')
    setPanneau(null)
    charger()
  }

  const supprimerCreneau = async (id: string) => {
    if (!confirm('Supprimer ce créneau de livraison ?')) return
    await supabase.from('jours_livraison').update({ actif: false }).eq('id', id)
    showToast('Créneau supprimé')
    charger()
  }

  // ─── Grille calendrier ────────────────────────────────────────────────────

  const premierJour   = new Date(mois.getFullYear(), mois.getMonth(), 1)
  const offset        = jsToLundi(premierJour.getDay())
  const debutGrille   = new Date(premierJour)
  debutGrille.setDate(premierJour.getDate() - offset)

  const joursCalendrier: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille)
    d.setDate(debutGrille.getDate() + i)
    return d
  })
  const nbLignes = joursCalendrier[35] && joursCalendrier[35].getMonth() === mois.getMonth() ? 42 : 35
  const jours = joursCalendrier.slice(0, nbLignes)

  // Créneaux du jour sélectionné
  const creneauxDuJour = jourSel
    ? creneaux.filter(c => {
        const match = estJourLivraison(jourSel, [c])
        return !!match
      })
    : []

  const jourSelLivraison = jourSel ? !!estJourLivraison(jourSel, creneaux) : false

  // ─── Rendu ───────────────────────────────────────────────────────────────

  if (chargement) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>Chargement…</div>
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '24px', zIndex: 100,
          background: toast.ok ? '#1C2B1A' : '#dc2626', color: toast.ok ? '#7CBF3A' : '#fff',
          padding: '12px 20px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast.ok ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1C2B1A', margin: 0 }}>Livraison</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          Calendrier des créneaux de livraison et paramètres
        </p>
      </div>

      {/* Toggle livraison + stats */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Toggle */}
        <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1C2B1A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={16} /> Livraison à domicile
            </div>
            <div style={{ fontSize: '12px', color: params?.livraison_active ? '#166534' : '#9ca3af', marginTop: '3px' }}>
              {params?.livraison_active ? '🟢 Active — visible par les clients' : '🔴 Inactive — masquée côté client'}
            </div>
          </div>
          <button onClick={toggleLivraison}
            style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer',
              background: params?.livraison_active ? '#7CBF3A' : '#d1d5db', position: 'relative', flexShrink: 0 }}>
            <span style={{
              position: 'absolute', top: '2px', width: '24px', height: '24px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              left: params?.livraison_active ? '26px' : '2px',
            }} />
          </button>
        </div>

        {/* Stat créneaux */}
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#1C2B1A' }}>
            {creneaux.filter(c => c.type === 'recurrente').length}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>créneaux récurrents</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '160px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#7CBF3A' }}>
            {creneaux.filter(c => c.type === 'ponctuelle').length}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>dates ponctuelles</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>

        {/* ── Calendrier ── */}
        <div style={{ flex: 1, background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#1C2B1A' }}>
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#fff' }}>
              {MOIS_LONGS[mois.getMonth()]} {mois.getFullYear()}
            </span>
            <button onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* En-têtes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            {JOURS_COURTS.map(j => (
              <div key={j} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{j}</div>
            ))}
          </div>

          {/* Cellules */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {jours.map((date, i) => {
              const dansMois   = date.getMonth() === mois.getMonth()
              const estAuj     = date.toDateString() === today.toDateString()
              const estSel     = jourSel ? date.toDateString() === jourSel.toDateString() : false
              const livraison  = dansMois ? estJourLivraison(date, creneaux) : undefined
              const estPasse   = dansMois && date < today

              let bg = '#fff'
              if (!dansMois) bg = '#f9fafb'
              else if (livraison) bg = estSel ? '#d1fae5' : '#f0fdf4'
              else if (estSel) bg = '#f0f9e8'

              return (
                <div key={i}
                  onClick={() => { if (dansMois) { setJourSel(date); setPanneau(null) } }}
                  style={{
                    minHeight: '72px', padding: '7px 8px', background: bg,
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid #f0f0f0' : 'none',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: dansMois ? 'pointer' : 'default',
                    outline: estSel ? '2px solid #7CBF3A' : 'none',
                    outlineOffset: '-2px',
                    opacity: estPasse && !livraison ? 0.5 : 1,
                  }}>

                  {/* Numéro */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: estAuj ? '#1C2B1A' : 'transparent',
                    color: estAuj ? '#fff' : dansMois ? '#1C2B1A' : '#d1d5db',
                    fontSize: '13px', fontWeight: estAuj ? 700 : 400,
                  }}>{date.getDate()}</div>

                  {/* Badge livraison */}
                  {livraison && dansMois && (
                    <div style={{ marginTop: '3px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#166534', background: '#bbf7d0', borderRadius: '4px', padding: '1px 5px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <Truck size={9} /> Livraison
                      </div>
                      {livraison.recurrence && (
                        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '1px' }}>
                          {livraison.recurrence === 'hebdomadaire' ? '↻ hebdo' : livraison.recurrence === 'bi-hebdomadaire' ? '↻ /2sem' : '↻ mens.'}
                        </div>
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
              { bg: '#f0fdf4', border: '#bbf7d0', label: 'Jour de livraison' },
              { bg: '#1C2B1A', label: "Aujourd'hui", round: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: item.round ? '50%' : '3px', background: item.bg, border: item.border ? `1px solid ${item.border}` : '1px solid #e5e7eb' }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Panneau jour sélectionné */}
          {jourSel && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {/* En-tête jour */}
              <div style={{ padding: '14px 16px', background: jourSelLivraison ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1C2B1A' }}>
                    {JOURS_LONGS[jsToLundi(jourSel.getDay())]} {jourSel.getDate()} {MOIS_LONGS[jourSel.getMonth()]}
                  </div>
                  <div style={{ fontSize: '12px', color: jourSelLivraison ? '#166534' : '#9ca3af', fontWeight: 600, marginTop: '2px' }}>
                    {jourSelLivraison ? '🚚 Livraison prévue' : 'Pas de livraison'}
                  </div>
                </div>
                <button onClick={() => { setJourSel(null); setPanneau(null) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Créneaux du jour */}
              <div style={{ padding: '12px 16px' }}>
                {creneauxDuJour.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    {creneauxDuJour.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#f0fdf4', borderRadius: '7px', marginBottom: '5px', border: '1px solid #bbf7d0' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {c.type === 'recurrente' ? <Repeat size={11} /> : <CalendarDays size={11} />}
                            {labelCreneau(c)}
                          </div>
                          {c.motif && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{c.motif}</div>}
                        </div>
                        <button onClick={() => supprimerCreneau(c.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bouton ajouter */}
                {panneau !== 'ajout' && (
                  <button onClick={() => { setPanneau('ajout'); setFormType('ponctuelle'); setFormMotif('') }}
                    style={{ width: '100%', padding: '8px', background: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Plus size={15} /> Ajouter un créneau
                  </button>
                )}

                {/* Formulaire ajout */}
                {panneau === 'ajout' && (
                  <div style={{ marginTop: '4px' }}>
                    {/* Type ponctuelle / récurrente */}
                    <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '8px', padding: '3px', marginBottom: '12px' }}>
                      {([
                        { v: 'ponctuelle', l: 'Ce jour uniquement', icon: <CalendarDays size={13} /> },
                        { v: 'recurrente', l: 'Récurrent',          icon: <Repeat size={13} /> },
                      ] as const).map(({ v, l, icon }) => (
                        <button key={v} onClick={() => setFormType(v)}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            background: formType === v ? '#fff' : 'transparent', color: formType === v ? '#1C2B1A' : '#6b7280',
                            boxShadow: formType === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {icon} {l}
                        </button>
                      ))}
                    </div>

                    {/* Options récurrence */}
                    {formType === 'recurrente' && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Fréquence</div>
                        {RECURRENCES.map(r => (
                          <label key={r.value} onClick={() => setFormRecurrence(r.value)}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', borderRadius: '7px', cursor: 'pointer', marginBottom: '4px',
                              background: formRecurrence === r.value ? '#f0fdf4' : '#f9fafb',
                              border: `1px solid ${formRecurrence === r.value ? '#7CBF3A' : '#e5e7eb'}` }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${formRecurrence === r.value ? '#7CBF3A' : '#d1d5db'}`, background: formRecurrence === r.value ? '#7CBF3A' : '#fff', flexShrink: 0, marginTop: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {formRecurrence === r.value && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C2B1A' }}>{r.label}</div>
                              <div style={{ fontSize: '11px', color: '#6b7280' }}>{r.desc}</div>
                            </div>
                          </label>
                        ))}
                        {formType === 'recurrente' && formRecurrence === 'bi-hebdomadaire' && (
                          <div style={{ padding: '8px 10px', background: '#fef9c3', borderRadius: '6px', fontSize: '11px', color: '#854d0e', marginTop: '4px' }}>
                            La livraison aura lieu <strong>une semaine sur deux</strong>, en commençant le {jourSel.getDate()} {MOIS_LONGS[jourSel.getMonth()]}.
                          </div>
                        )}
                        {formType === 'recurrente' && formRecurrence === 'mensuelle' && (
                          <div style={{ padding: '8px 10px', background: '#f0f9e8', borderRadius: '6px', fontSize: '11px', color: '#3B6D11', marginTop: '4px' }}>
                            Chaque mois, le <strong>{rangOccurrenceMois(jourSel)}e {JOURS_LONGS[jsToLundi(jourSel.getDay())].toLowerCase()}</strong> du mois.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Motif */}
                    <input type="text" value={formMotif} onChange={e => setFormMotif(e.target.value)}
                      placeholder="Motif (optionnel)"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={ajouterCreneau}
                        style={{ flex: 1, padding: '8px', background: '#7CBF3A', color: '#fff', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
                        Enregistrer
                      </button>
                      <button onClick={() => setPanneau(null)}
                        style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '13px' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Liste tous les créneaux actifs */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px', color: '#374151' }}>
              Tous les créneaux actifs
            </div>
            <div style={{ padding: '8px 16px', maxHeight: '260px', overflowY: 'auto' }}>
              {creneaux.length === 0 && (
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: '8px 0' }}>
                  Aucun créneau configuré. Cliquez sur un jour du calendrier pour en ajouter.
                </p>
              )}
              {creneaux.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: c.type === 'recurrente' ? '#f0fdf4' : '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.type === 'recurrente' ? <Repeat size={13} color="#166534" /> : <CalendarDays size={13} color="#1e40af" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C2B1A' }}>{labelCreneau(c)}</div>
                      {c.motif && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.motif}</div>}
                    </div>
                  </div>
                  <button onClick={() => supprimerCreneau(c.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', display: 'flex', padding: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Paramètres financiers */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '13px', color: '#374151' }}>
              Paramètres financiers
            </div>
            <div style={{ padding: '14px 16px' }}>
              {[
                { label: 'Frais de livraison', key: 'frais_livraison' as const },
                { label: 'Minimum de commande', key: 'montant_minimum_livraison' as const },
                { label: 'Seuil gratuité', key: 'seuil_gratuite_livraison' as const, optional: true },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    {field.label}{field.optional && <span style={{ color: '#9ca3af', fontWeight: 400 }}> (optionnel)</span>}
                  </label>
                  <div style={{ position: 'relative', maxWidth: '160px' }}>
                    <input type="number" min="0" step="0.01"
                      value={params?.[field.key] ?? ''}
                      placeholder={field.optional ? 'Non défini' : '0'}
                      onChange={e => setParams(p => p ? { ...p, [field.key]: e.target.value ? parseFloat(e.target.value) : null } : p)}
                      style={{ width: '100%', padding: '7px 28px 7px 10px', border: '1px solid #d1d5db', borderRadius: '7px', fontSize: '13px', boxSizing: 'border-box' }} />
                    <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>€</span>
                  </div>
                </div>
              ))}
              <button onClick={enregistrerParametres} disabled={saving}
                style={{ width: '100%', padding: '8px', background: saving ? '#9ca3af' : '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
