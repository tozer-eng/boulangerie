'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ChevronLeft, ChevronRight, Search, Phone, CheckSquare, Square, Package, Users } from 'lucide-react'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Constantes ───────────────────────────────────────────────────────────────

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_LONGS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneCommande {
  quantite: number
  produit: { id: string; nom: string } | null
}

interface CommandeClient {
  id: string
  statut: string
  type: string
  montant_total: number
  notes?: string
  client: { id: string; nom: string; prenom: string; telephone?: string } | null
  lignes: LigneCommande[]
}

interface ProduitAggregat {
  produit_id: string
  nom: string
  quantite_totale: number
  commande_ids: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

function memeJour(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function labelJour(d: Date, today: Date): string {
  if (memeJour(d, today)) return "Aujourd'hui"
  if (memeJour(d, addDays(today, 1))) return 'Demain'
  if (memeJour(d, addDays(today, 2))) return 'Après-demain'
  return `${JOURS_COURTS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MOIS[d.getMonth()]}`
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PreparationPage() {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [dateSelectionnee, setDateSelectionnee] = useState(today)
  const [vue, setVue] = useState<'produits' | 'clients'>('produits')
  const [commandes, setCommandes] = useState<CommandeClient[]>([])
  const [chargement, setChargement] = useState(false)
  const [recherche, setRecherche] = useState('')

  // Cases cochées (local) pour la vue produits — par produit_id
  const [produitsCocheés, setProduitsCocheés] = useState<Set<string>>(new Set())
  // Statuts mis à jour (récupéré) en attente de refresh
  const [statutsLocaux, setStatutsLocaux] = useState<Record<string, string>>({})

  // Mini-calendrier — commandes par date sur le mois courant
  const [moisMini, setMoisMini] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [joursAvecCommandes, setJoursAvecCommandes] = useState<Set<string>>(new Set())

  // ─── Chargement commandes du jour ─────────────────────────────────────────

  const chargerCommandes = useCallback(async (date: Date) => {
    setChargement(true)
    const { data } = await supabase
      .from('commandes')
      .select('id, statut, type, montant_total, notes, client:clients(id, nom, prenom, telephone), lignes:lignes_commande(quantite, produit:produits(id, nom))')
      .eq('date_retrait', formatDate(date))
      .neq('statut', 'annulee')
      .order('created_at')
    setCommandes((data as unknown as CommandeClient[]) ?? [])
    setProduitsCocheés(new Set())
    setStatutsLocaux({})
    setChargement(false)
  }, [])

  // ─── Mini-calendrier : dates avec commandes ───────────────────────────────

  const chargerJoursAvecCommandes = useCallback(async () => {
    const debut = formatDate(new Date(moisMini.getFullYear(), moisMini.getMonth(), 1))
    const fin   = formatDate(new Date(moisMini.getFullYear(), moisMini.getMonth() + 1, 0))
    const { data } = await supabase
      .from('commandes')
      .select('date_retrait')
      .gte('date_retrait', debut)
      .lte('date_retrait', fin)
      .neq('statut', 'annulee')
    const dates = new Set((data ?? []).map((c: { date_retrait: string }) => c.date_retrait))
    setJoursAvecCommandes(dates)
  }, [moisMini])

  useEffect(() => { chargerCommandes(dateSelectionnee) }, [dateSelectionnee, chargerCommandes])
  useEffect(() => { chargerJoursAvecCommandes() }, [chargerJoursAvecCommandes])

  // ─── Agrégat produits ─────────────────────────────────────────────────────

  const produitsAgrégats = useMemo((): ProduitAggregat[] => {
    const map = new Map<string, ProduitAggregat>()
    commandes.forEach(cmd => {
      cmd.lignes.forEach(l => {
        if (!l.produit) return
        const existing = map.get(l.produit.id)
        if (existing) {
          existing.quantite_totale += l.quantite
          existing.commande_ids.push(cmd.id)
        } else {
          map.set(l.produit.id, {
            produit_id: l.produit.id,
            nom: l.produit.nom,
            quantite_totale: l.quantite,
            commande_ids: [cmd.id],
          })
        }
      })
    })
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
  }, [commandes])

  const commandesFiltrees = useMemo(() => {
    if (!recherche.trim()) return commandes
    const q = recherche.toLowerCase()
    return commandes.filter(c =>
      c.client && (`${c.client.prenom} ${c.client.nom}`.toLowerCase().includes(q) ||
      (c.client.telephone ?? '').includes(q))
    )
  }, [commandes, recherche])

  // ─── Actions ─────────────────────────────────────────────────────────────

  const toggleProduit = (produit_id: string) => {
    setProduitsCocheés(prev => {
      const next = new Set(prev)
      next.has(produit_id) ? next.delete(produit_id) : next.add(produit_id)
      return next
    })
  }

  const marquerRecuperee = async (id: string) => {
    setStatutsLocaux(prev => ({ ...prev, [id]: 'recuperee' }))
    await supabase.from('commandes').update({ statut: 'recuperee' }).eq('id', id)
    chargerCommandes(dateSelectionnee)
  }

  const marquerPreparee = async (id: string) => {
    setStatutsLocaux(prev => ({ ...prev, [id]: 'preparee' }))
    await supabase.from('commandes').update({ statut: 'preparee' }).eq('id', id)
    chargerCommandes(dateSelectionnee)
  }

  // ─── Mini-calendrier construction ────────────────────────────────────────

  const premierJourMois = new Date(moisMini.getFullYear(), moisMini.getMonth(), 1)
  const offset = (premierJourMois.getDay() + 6) % 7
  const debutGrille = new Date(premierJourMois)
  debutGrille.setDate(premierJourMois.getDate() - offset)
  const joursMini: Date[] = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(debutGrille)
    d.setDate(debutGrille.getDate() + i)
    return d
  })

  // ─── Stats rapides ───────────────────────────────────────────────────────

  const nbCommandes     = commandes.length
  const nbPreparees     = commandes.filter(c => (statutsLocaux[c.id] ?? c.statut) === 'preparee').length
  const nbRecuperees    = commandes.filter(c => (statutsLocaux[c.id] ?? c.statut) === 'recuperee').length
  const nbEnAttente     = commandes.filter(c => {
    const s = statutsLocaux[c.id] ?? c.statut
    return s === 'en_attente' || s === 'confirmee'
  }).length
  const nbProduitsCocheés = produitsCocheés.size
  const totalProduits   = produitsAgrégats.length

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px', maxWidth: '1400px' }}>

      {/* En-tête */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1C2B1A', margin: 0 }}>Préparation</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
          Liste de préparation et suivi des retraits
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

        {/* ── Colonne principale ── */}
        <div style={{ flex: 1 }}>

          {/* Sélecteur de date */}
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[0, 1, 2].map(offset => {
                const d = addDays(today, offset)
                const estSel = memeJour(d, dateSelectionnee)
                const dateStr = formatDate(d)
                const aCommandes = joursAvecCommandes.has(dateStr)
                return (
                  <button key={offset} onClick={() => setDateSelectionnee(d)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                      border: estSel ? 'none' : '1px solid #e5e7eb',
                      background: estSel ? '#1C2B1A' : '#f9fafb',
                      color: estSel ? '#fff' : '#374151',
                      cursor: 'pointer', position: 'relative',
                    }}>
                    {labelJour(d, today)}
                    {aCommandes && (
                      <span style={{
                        position: 'absolute', top: '4px', right: '4px',
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: estSel ? '#7CBF3A' : '#7CBF3A',
                        display: 'inline-block',
                      }} />
                    )}
                  </button>
                )
              })}

              {/* Séparateur */}
              <div style={{ width: '1px', height: '32px', background: '#e5e7eb' }} />

              {/* Sélecteur date personnalisée */}
              <input
                type="date"
                value={formatDate(dateSelectionnee)}
                onChange={e => {
                  const parts = e.target.value.split('-')
                  if (parts.length === 3) setDateSelectionnee(new Date(+parts[0], +parts[1] - 1, +parts[2]))
                }}
                style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', color: '#374151', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Titre du jour + stats */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1C2B1A', marginBottom: '8px' }}>
              {JOURS_COURTS[(dateSelectionnee.getDay() + 6) % 7]} {dateSelectionnee.getDate()} {MOIS_LONGS[dateSelectionnee.getMonth()]} {dateSelectionnee.getFullYear()}
            </div>
            {!chargement && nbCommandes > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Commandes', val: nbCommandes, bg: '#f3f4f6', color: '#374151' },
                  { label: 'En attente', val: nbEnAttente, bg: '#fef9c3', color: '#854d0e' },
                  { label: 'Préparées', val: nbPreparees, bg: '#dbeafe', color: '#1e40af' },
                  { label: 'Récupérées', val: nbRecuperees, bg: '#dcfce7', color: '#166534' },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '4px 12px', borderRadius: '9999px', background: stat.bg, color: stat.color, fontSize: '13px', fontWeight: 600 }}>
                    {stat.val} {stat.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Onglets vue */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px', background: '#f3f4f6', borderRadius: '10px', padding: '3px', width: 'fit-content' }}>
            {([
              { key: 'produits', label: 'Vue produits', icon: <Package size={15} /> },
              { key: 'clients',  label: 'Vue clients',  icon: <Users size={15} /> },
            ] as const).map(({ key, label, icon }) => (
              <button key={key} onClick={() => { setVue(key); setRecherche('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: vue === key ? '#fff' : 'transparent',
                  color: vue === key ? '#1C2B1A' : '#6b7280',
                  boxShadow: vue === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Recherche (vue clients uniquement) */}
          {vue === 'clients' && (
            <div style={{ position: 'relative', marginBottom: '14px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Rechercher un client…"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                style={{ width: '100%', padding: '8px 10px 8px 32px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          )}

          {/* Contenu */}
          {chargement ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>Chargement…</div>
          ) : nbCommandes === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🥖</div>
              <div style={{ fontWeight: 600, color: '#374151', marginBottom: '4px' }}>Aucune commande ce jour</div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>Pas de préparation prévue.</div>
            </div>
          ) : vue === 'produits' ? (
            // ── Vue produits ──────────────────────────────────────────────────
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  {totalProduits} produit{totalProduits > 1 ? 's' : ''} à préparer
                </span>
                {totalProduits > 0 && (
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {nbProduitsCocheés}/{totalProduits} cochés
                  </span>
                )}
              </div>

              {/* Barre de progression */}
              {totalProduits > 0 && (
                <div style={{ height: '4px', background: '#e5e7eb' }}>
                  <div style={{ height: '100%', background: '#7CBF3A', width: `${(nbProduitsCocheés / totalProduits) * 100}%`, transition: 'width 0.3s' }} />
                </div>
              )}

              {produitsAgrégats.map((p, i) => {
                const coche = produitsCocheés.has(p.produit_id)
                return (
                  <div key={p.produit_id}
                    onClick={() => toggleProduit(p.produit_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px',
                      borderBottom: i < produitsAgrégats.length - 1 ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      background: coche ? '#f0fdf4' : '#fff',
                      transition: 'background 0.15s',
                    }}>
                    <div style={{ color: coche ? '#7CBF3A' : '#d1d5db', flexShrink: 0 }}>
                      {coche ? <CheckSquare size={22} /> : <Square size={22} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '15px', fontWeight: 600,
                        color: coche ? '#6b7280' : '#1C2B1A',
                        textDecoration: coche ? 'line-through' : 'none',
                      }}>
                        {p.nom}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>
                        {p.commande_ids.length} commande{p.commande_ids.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '22px', fontWeight: 800,
                      color: coche ? '#9ca3af' : '#1C2B1A',
                      minWidth: '48px', textAlign: 'right',
                    }}>
                      {p.quantite_totale}
                    </div>
                  </div>
                )
              })}

              {nbProduitsCocheés === totalProduits && totalProduits > 0 && (
                <div style={{ padding: '14px 16px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>✅</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>Tous les produits sont préparés !</span>
                </div>
              )}
            </div>
          ) : (
            // ── Vue clients ───────────────────────────────────────────────────
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {commandesFiltrees.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                  Aucun client trouvé.
                </div>
              )}
              {commandesFiltrees.map(cmd => {
                const statutEffectif = statutsLocaux[cmd.id] ?? cmd.statut
                const estRecup = statutEffectif === 'recuperee'
                const estPrep  = statutEffectif === 'preparee'
                return (
                  <div key={cmd.id} style={{
                    background: '#fff', borderRadius: '12px',
                    border: `1px solid ${estRecup ? '#bbf7d0' : '#e5e7eb'}`,
                    overflow: 'hidden',
                    opacity: estRecup ? 0.75 : 1,
                  }}>
                    {/* En-tête client */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: estRecup ? '#f0fdf4' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1C2B1A' }}>
                          {cmd.client ? `${cmd.client.prenom} ${cmd.client.nom}` : 'Client inconnu'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          {cmd.client?.telephone && (
                            <a href={`tel:${cmd.client.telephone}`} style={{ fontSize: '12px', color: '#3B6D11', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Phone size={11} /> {cmd.client.telephone}
                            </a>
                          )}
                          {cmd.type === 'recurrente' && (
                            <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>🔁 Récurrente</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#1C2B1A' }}>
                          {Number(cmd.montant_total).toFixed(2)} €
                        </span>
                        {estRecup ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '9999px' }}>✓ Récupéré</span>
                        ) : estPrep ? (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '9999px' }}>Préparé</span>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#854d0e', background: '#fef9c3', padding: '2px 8px', borderRadius: '9999px' }}>En attente</span>
                        )}
                      </div>
                    </div>

                    {/* Produits */}
                    <div style={{ padding: '10px 16px' }}>
                      {cmd.lignes.map((l, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#374151', padding: '2px 0' }}>
                          <span>{l.produit?.nom ?? '—'}</span>
                          <span style={{ fontWeight: 600 }}>×{l.quantite}</span>
                        </div>
                      ))}
                      {cmd.notes && (
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic', padding: '4px 8px', background: '#f9fafb', borderRadius: '4px' }}>
                          {cmd.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!estRecup && (
                      <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {!estPrep && (
                          <button onClick={() => marquerPreparee(cmd.id)}
                            style={{ padding: '5px 12px', background: '#dbeafe', color: '#1e40af', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                            Marquer préparée
                          </button>
                        )}
                        <button onClick={() => marquerRecuperee(cmd.id)}
                          style={{ padding: '5px 12px', background: '#7CBF3A', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                          ✓ Récupérée
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Mini-calendrier ── */}
        <div style={{ width: '260px', flexShrink: 0 }}>
          <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>

            {/* Navigation mois */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#1C2B1A' }}>
              <button onClick={() => setMoisMini(new Date(moisMini.getFullYear(), moisMini.getMonth() - 1, 1))}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>
                {MOIS_LONGS[moisMini.getMonth()]} {moisMini.getFullYear()}
              </span>
              <button onClick={() => setMoisMini(new Date(moisMini.getFullYear(), moisMini.getMonth() + 1, 1))}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '5px', padding: '4px 6px', cursor: 'pointer', color: '#fff', display: 'flex' }}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* En-têtes jours */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
              {JOURS_COURTS.map(j => (
                <div key={j} style={{ padding: '5px 0', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{j}</div>
              ))}
            </div>

            {/* Cellules */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {joursMini.map((date, i) => {
                const dansMois  = date.getMonth() === moisMini.getMonth()
                const estAuj    = memeJour(date, today)
                const estSel    = memeJour(date, dateSelectionnee)
                const dateStr   = formatDate(date)
                const aCommande = joursAvecCommandes.has(dateStr) && dansMois

                return (
                  <div key={i}
                    onClick={() => dansMois && setDateSelectionnee(new Date(date))}
                    style={{
                      padding: '4px 0', textAlign: 'center', cursor: dansMois ? 'pointer' : 'default',
                      position: 'relative',
                      borderRight: (i + 1) % 7 !== 0 ? '1px solid #f5f5f5' : 'none',
                      borderBottom: '1px solid #f5f5f5',
                    }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: estSel ? '#7CBF3A' : estAuj ? '#1C2B1A' : 'transparent',
                      color: estSel || estAuj ? '#fff' : dansMois ? '#1C2B1A' : '#d1d5db',
                      fontSize: '12px', fontWeight: estAuj || estSel ? 700 : 400,
                      margin: '0 auto',
                    }}>
                      {date.getDate()}
                    </div>
                    {/* Point vert commandes */}
                    {aCommande && !estSel && (
                      <div style={{
                        width: '5px', height: '5px', borderRadius: '50%',
                        background: '#7CBF3A', margin: '1px auto 0',
                      }} />
                    )}
                    {!aCommande && <div style={{ height: '6px' }} />}
                  </div>
                )
              })}
            </div>

            {/* Légende mini-cal */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', background: '#f9fafb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#7CBF3A' }} />
                Jours avec commandes
              </div>
            </div>
          </div>

          {/* Résumé produits (dans la sidebar) */}
          {!chargement && produitsAgrégats.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginTop: '14px' }}>
              <div style={{ padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Récap produits
              </div>
              {produitsAgrégats.map(p => (
                <div key={p.produit_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid #f5f5f5', fontSize: '13px', color: '#374151' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                  <span style={{ fontWeight: 700, color: '#1C2B1A', marginLeft: '8px' }}>×{p.quantite_totale}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
