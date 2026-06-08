'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fermeture {
  id: string
  type: 'recurrente' | 'manuelle' | 'exceptionnelle'
  date: string | null
  jour_semaine: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const JOURS_COURTS  = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_LONGS    = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** JS getDay() 0=dim → index lundi-first 0=lun…6=dim */
function jsToLundi(jsDay: number): number { return (jsDay + 6) % 7 }

/** Un jour est-il fermé ? */
function estFerme(date: Date, fermetures: Fermeture[]): boolean {
  const dateStr  = formatDate(date)
  const lundiIdx = jsToLundi(date.getDay())

  const recurrente  = fermetures.find(f => f.type === 'recurrente' && f.jour_semaine === lundiIdx)
  const ouverture   = fermetures.find(f => f.type === 'exceptionnelle' && f.date === dateStr)
  if (recurrente && !ouverture) return true
  return fermetures.some(f => f.type === 'manuelle' && f.date === dateStr)
}

/** Première date disponible à partir d'un offset J+1 ou J+2 */
function premiereDateDispo(fermetures: Fermeture[], offsetMin: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetMin)
  // Avancer jusqu'à un jour ouvert (max 60 jours pour éviter boucle infinie)
  for (let i = 0; i < 60; i++) {
    if (!estFerme(d, fermetures)) return d
    d.setDate(d.getDate() + 1)
  }
  return d
}

function calculerOffsetMin(heureBloqueSemaine: string, heureBloqueWeekend: string): number {
  const now = new Date()
  const jour = now.getDay()
  const isWeekendBlocage = jour === 5 || jour === 6
  const heure = isWeekendBlocage ? heureBloqueWeekend : heureBloqueSemaine
  const [h, m] = heure.split(':').map(Number)
  const limite = new Date(now)
  limite.setHours(h, m, 0, 0)
  return now >= limite ? 2 : 1
}

// ─── Composant CalendrierRetrait ──────────────────────────────────────────────

function CalendrierRetrait({
  value,
  onChange,
  fermetures,
  dateMinStr,
}: {
  value: string
  onChange: (date: string) => void
  fermetures: Fermeture[]
  dateMinStr: string
}) {
  const today  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const dateMin = useMemo(() => { if (!dateMinStr) return today; const [y,m,d] = dateMinStr.split('-').map(Number); return new Date(y,m-1,d) }, [dateMinStr, today])

  const initMois = useMemo(() => {
    if (value) { const [y,m] = value.split('-').map(Number); return new Date(y,m-1,1) }
    return new Date(today.getFullYear(), today.getMonth(), 1)
  }, [value, today])

  const [mois, setMois] = useState(initMois)

  const valeurDate = useMemo(() => {
    if (!value) return null
    const [y,m,d] = value.split('-').map(Number)
    return new Date(y, m-1, d)
  }, [value])

  // Grille
  const premierJour = new Date(mois.getFullYear(), mois.getMonth(), 1)
  const offset      = jsToLundi(premierJour.getDay())
  const debutGrille = new Date(premierJour)
  debutGrille.setDate(premierJour.getDate() - offset)

  const jours: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille)
    d.setDate(debutGrille.getDate() + i)
    return d
  })
  const nbLignes = jours[35]?.getMonth() === mois.getMonth() ? 42 : 35
  const joursAffiches = jours.slice(0, nbLignes)

  const selectionner = (date: Date) => {
    if (date < dateMin) return
    if (estFerme(date, fermetures)) return
    onChange(formatDate(date))
  }

  return (
    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1C2B1A' }}>
        <button
          onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>
          {MOIS_LONGS[mois.getMonth()]} {mois.getFullYear()}
        </span>
        <button
          onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
        {JOURS_COURTS.map(j => (
          <div key={j} style={{ padding: '7px 0', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{j}</div>
        ))}
      </div>

      {/* Cellules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {joursAffiches.map((date, i) => {
          const dansMois   = date.getMonth() === mois.getMonth()
          const ferme      = dansMois && estFerme(date, fermetures)
          const passe      = date < dateMin
          const disabled   = !dansMois || ferme || passe
          const selectionne = valeurDate ? date.toDateString() === valeurDate.toDateString() : false
          const estAuj     = date.toDateString() === today.toDateString()

          let bg = '#fff'
          if (!dansMois || passe) bg = '#f9fafb'
          else if (ferme) bg = '#fef2f2'
          else if (selectionne) bg = '#1C2B1A'

          return (
            <div key={i}
              onClick={() => !disabled && selectionner(date)}
              style={{
                padding: '6px 4px',
                background: bg,
                borderRight: (i + 1) % 7 !== 0 ? '1px solid #f0f0f0' : 'none',
                borderBottom: '1px solid #f0f0f0',
                cursor: disabled ? 'not-allowed' : 'pointer',
                textAlign: 'center',
                minHeight: '48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
              }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: selectionne ? '#7CBF3A' : estAuj && !disabled ? 'rgba(28,43,26,0.08)' : 'transparent',
                color: disabled ? '#d1d5db' : selectionne ? '#fff' : ferme ? '#fca5a5' : '#1C2B1A',
                fontSize: '13px',
                fontWeight: selectionne || estAuj ? 700 : 400,
                textDecoration: ferme && dansMois ? 'line-through' : 'none',
              }}>
                {date.getDate()}
              </div>
              {ferme && dansMois && (
                <div style={{ fontSize: '9px', color: '#fca5a5', fontWeight: 600, lineHeight: 1 }}>Fermé</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div style={{ padding: '8px 14px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {[
          { bg: '#1C2B1A', color: '#7CBF3A', label: 'Sélectionné', round: true },
          { bg: '#fef2f2', border: '1px solid #fca5a5', label: 'Fermé' },
          { bg: '#f9fafb', label: 'Indisponible' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#6b7280' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: item.round ? '50%' : '3px', background: item.bg, border: item.border ?? '1px solid #e5e7eb' }} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CommandePage() {
  const [produits, setProduits]           = useState<any[]>([])
  const [panier, setPanier]               = useState<Record<string, number>>({})
  const [dateRetrait, setDateRetrait]     = useState('')
  const [dateMinStr, setDateMinStr]       = useState('')
  const [fermetures, setFermetures]       = useState<Fermeture[]>([])
  const [nom, setNom]                     = useState('')
  const [prenom, setPrenom]               = useState('')
  const [email, setEmail]                 = useState('')
  const [telephone, setTelephone]         = useState('')
  const [notes, setNotes]                 = useState('')
  const [recurrente, setRecurrente]         = useState(false)
  const [clientVerifie, setClientVerifie]   = useState(false)
  const [clientConnecte, setClientConnecte] = useState(false)
  const [creerCompte, setCreerCompte]       = useState(false)
  const [mdpCompte, setMdpCompte]           = useState('')
  const [mdpConfirm, setMdpConfirm]         = useState('')
  const [erreurCompte, setErreurCompte]     = useState('')
  const [loading, setLoading]               = useState(false)
  const [etape, setEtape]                   = useState<'panier' | 'infos' | 'confirmation'>('panier')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    const panierSauvegarde = localStorage.getItem('panier')
    if (panierSauvegarde) setPanier(JSON.parse(panierSauvegarde))

    supabase.from('produits').select('*').eq('actif', true).then(({ data }) => setProduits(data ?? []))

    // Charger fermetures + paramètres + statut client connecté en parallèle
    Promise.all([
      supabase.from('fermetures').select('id, type, date, jour_semaine'),
      supabase.from('parametres').select('heure_blocage_semaine, heure_blocage_weekend').single(),
      supabase.auth.getUser(),
    ]).then(async ([{ data: ferm }, { data: params }, { data: authData }]) => {
      const fermeturesList = (ferm ?? []) as Fermeture[]
      setFermetures(fermeturesList)

      const heureSemaine  = params?.heure_blocage_semaine ?? '23:00'
      const heureWeekend  = params?.heure_blocage_weekend ?? '20:00'
      const offset        = calculerOffsetMin(heureSemaine, heureWeekend)
      const premiereDispo = premiereDateDispo(fermeturesList, offset)

      setDateMinStr(formatDate(premiereDateDispo(fermeturesList, offset)))
      setDateRetrait(formatDate(premiereDispo))

      // Vérifier si le client connecté est vérifié ou vip
      if (authData.user) {
        setClientConnecte(true)
        const { data: clientData } = await supabase
          .from('clients')
          .select('statut, prenom, nom, telephone, email')
          .eq('user_id', authData.user.id)
          .single()
        if (clientData) {
          if (clientData.statut === 'verifie' || clientData.statut === 'vip') setClientVerifie(true)
          // Préremplir les champs si connecté
          if (clientData.prenom) setPrenom(clientData.prenom)
          if (clientData.nom) setNom(clientData.nom)
          if (clientData.telephone) setTelephone(clientData.telephone)
          if (clientData.email) setEmail(clientData.email)
        }
      }
    })
  }, [])

  function getProduit(id: string) { return produits.find(p => p.id === id) }

  const lignesPanier = Object.entries(panier).filter(([, qty]) => qty > 0)
  const total        = lignesPanier.reduce((acc, [id, qty]) => acc + (getProduit(id)?.prix ?? 0) * qty, 0)
  const nbArticles   = lignesPanier.reduce((acc, [, qty]) => acc + qty, 0)

  function modifierQty(id: string, delta: number) {
    const nouveau = { ...panier }
    nouveau[id] = (nouveau[id] ?? 0) + delta
    if (nouveau[id] <= 0) delete nouveau[id]
    setPanier(nouveau)
    localStorage.setItem('panier', JSON.stringify(nouveau))
  }

  const labelDateRetrait = useMemo(() => {
    if (!dateRetrait) return ''
    const [y, m, d] = dateRetrait.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
  }, [dateRetrait])

  async function passerCommande() {
    if (!nom || !prenom || !email || !telephone) return
    if (!recurrente && !dateRetrait) return
    if (creerCompte && (mdpCompte.length < 8 || mdpCompte !== mdpConfirm)) return
    setLoading(true)
    setErreurCompte('')

    // Créer le compte auth si demandé
    if (creerCompte && !clientConnecte) {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password: mdpCompte,
        options: { data: { prenom, nom, telephone } },
      })
      if (authError) {
        setErreurCompte(authError.message.includes('already') ? 'Un compte existe déjà avec cet email.' : authError.message)
        setLoading(false)
        return
      }
    }

    let clientId: string
    const { data: clientExistant } = await supabase
      .from('clients').select('id').eq('email', email).single()

    if (clientExistant) {
      clientId = clientExistant.id
      await supabase.from('clients').update({ nom, prenom, telephone }).eq('id', clientId)
    } else {
      const { data: nouveauClient } = await supabase
        .from('clients').insert({ nom, prenom, email, telephone, statut: 'nouveau', actif: true })
        .select('id').single()
      clientId = nouveauClient!.id
    }

    const { data: commande } = await supabase
      .from('commandes').insert({
        client_id: clientId,
        type: recurrente ? 'recurrente' : 'ponctuelle',
        statut: 'en_attente',
        statut_paiement: 'en_attente',
        mode_paiement: 'en_magasin',
        date_retrait: dateRetrait || null,
        recurence_validee: false,
        montant_total: total,
        notes: notes || null,
      }).select('id').single()

    await supabase.from('lignes_commande').insert(
      lignesPanier.map(([id, qty]) => ({
        commande_id: commande!.id,
        produit_id: id,
        quantite: qty,
        prix_unitaire: getProduit(id)?.prix ?? 0,
      }))
    )

    localStorage.removeItem('panier')
    setPanier({})
    setEtape('confirmation')
    setLoading(false)
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────
  if (etape === 'confirmation') {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>🎉</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '24px', color: '#1C2B1A', marginBottom: '8px' }}>
          Commande confirmée !
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '8px' }}>Merci {prenom} ! Votre commande a bien été enregistrée.</p>
        {recurrente ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px' }}>
            <p style={{ color: '#166534', fontWeight: 700, margin: '0 0 4px' }}>🔄 Commande récurrente soumise</p>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>La boulangerie va l'activer sous 24h. Vous recevrez une confirmation.{dateRetrait ? ` Premier retrait le ${labelDateRetrait}.` : ''}</p>
          </div>
        ) : (
          <p style={{ color: '#3B6D11', fontWeight: 600, marginBottom: '24px' }}>
            À récupérer le {labelDateRetrait}
          </p>
        )}
        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 4px', fontWeight: 600 }}>📍 Au Vieux Moulin</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Rue de la Tour Carrée 338, 5300 Vezin</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>081/30.25.76</p>
        </div>
        {creerCompte && (
          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1d4ed8', textAlign: 'left' }}>
            <strong>📧 Vérifiez votre email !</strong><br />
            Un lien de confirmation a été envoyé à <strong>{email}</strong> pour activer votre compte.
          </div>
        )}
        <button onClick={() => router.push('/client/catalogue')}
          style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
          Retour au catalogue
        </button>
      </div>
    )
  }

  // ── Layout principal ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '580px', margin: '0 auto', padding: '24px 16px' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => etape === 'panier' ? router.push('/client/catalogue') : setEtape('panier')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Retour
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1C2B1A' }}>
          {etape === 'panier' ? '🛒 Mon panier' : '📋 Mes informations'}
        </h1>
      </div>

      {/* Indicateur d'étapes */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['Panier & date', 'Mes infos'].map((label, i) => {
          const actif = (i === 0 && etape === 'panier') || (i === 1 && etape === 'infos')
          return (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: actif ? '#1C2B1A' : '#e5e7eb', color: actif ? '#7CBF3A' : '#9ca3af', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </div>
              <span style={{ fontSize: '12px', fontWeight: actif ? 700 : 400, color: actif ? '#1C2B1A' : '#9ca3af' }}>{label}</span>
              {i === 0 && <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />}
            </div>
          )
        })}
      </div>

      {/* ── Étape 1 : Panier + calendrier ── */}
      {etape === 'panier' && (
        <div>
          {lignesPanier.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <p style={{ fontSize: '40px', marginBottom: '8px' }}>🛒</p>
              <p>Votre panier est vide</p>
              <button onClick={() => router.push('/client/catalogue')}
                style={{ marginTop: '12px', backgroundColor: '#7CBF3A', color: '#1C2B1A', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold' }}>
                Voir le catalogue
              </button>
            </div>
          ) : (
            <>
              {/* Articles */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '16px' }}>
                {lignesPanier.map(([id, qty]) => {
                  const p = getProduit(id)
                  if (!p) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: '#111827' }}>{p.nom}</div>
                        <div style={{ fontSize: '13px', color: '#3B6D11', fontWeight: 600 }}>{Number(p.prix).toFixed(2)} € / unité</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => modifierQty(id, -1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '16px' }}>−</button>
                        <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => modifierQty(id, 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: '#7CBF3A', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>+</button>
                        <span style={{ width: '60px', textAlign: 'right', fontWeight: 600 }}>{(Number(p.prix) * qty).toFixed(2)} €</span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Total ({nbArticles} article{nbArticles > 1 ? 's' : ''})</span>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1C2B1A' }}>{total.toFixed(2)} €</span>
                </div>
              </div>

              {/* Toggle récurrence */}
              {clientVerifie ? (
                <div
                  onClick={() => setRecurrente(!recurrente)}
                  style={{ marginBottom: '16px', padding: '14px 16px', background: recurrente ? '#f0fdf4' : '#f9fafb', borderRadius: '12px', border: `2px solid ${recurrente ? '#7CBF3A' : '#e5e7eb'}`, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'all 0.15s' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '4px', border: `2px solid ${recurrente ? '#7CBF3A' : '#d1d5db'}`, background: recurrente ? '#7CBF3A' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    {recurrente && <span style={{ color: '#1C2B1A', fontWeight: 900, fontSize: '14px', lineHeight: 1 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: recurrente ? '#166534' : '#374151' }}>
                      🔄 Commande récurrente (chaque semaine)
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                      Votre commande sera préparée toutes les semaines. Vous pourrez la suspendre depuis votre espace client.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: '16px', padding: '14px 16px', background: '#f9fafb', borderRadius: '12px', border: '2px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '12px', opacity: 0.7 }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '4px', border: '2px solid #d1d5db', background: '#f3f4f6', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#9ca3af' }}>
                      🔄 Commande récurrente (chaque semaine)
                    </div>
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>
                      🔒 Disponible après votre premier retrait en boutique. Passez votre première commande ponctuelle, et cette option se débloquera automatiquement.
                    </div>
                  </div>
                </div>
              )}

              {/* Calendrier retrait */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C2B1A', marginBottom: '10px' }}>
                  📅 {recurrente ? 'Date de début souhaitée (optionnel)' : 'Choisissez votre date de retrait'}
                </div>

                {fermetures.length === 0 && !dateMinStr ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Chargement du calendrier…</div>
                ) : (
                  <CalendrierRetrait
                    value={dateRetrait}
                    onChange={setDateRetrait}
                    fermetures={fermetures}
                    dateMinStr={dateMinStr}
                  />
                )}

                {dateRetrait && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                    ✓ {recurrente ? 'Début le' : 'Retrait le'} {labelDateRetrait}
                  </div>
                )}

                {recurrente && !dateRetrait && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '13px', color: '#166534' }}>
                    💡 Sans date de début, la boulangerie vous contactera pour définir le premier retrait.
                  </div>
                )}
              </div>

              <button
                onClick={() => setEtape('infos')}
                disabled={!recurrente && !dateRetrait}
                style={{ width: '100%', backgroundColor: (recurrente || dateRetrait) ? '#1C2B1A' : '#9ca3af', color: '#7CBF3A', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: 'bold', cursor: (recurrente || dateRetrait) ? 'pointer' : 'not-allowed' }}>
                Continuer → Mes informations
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Étape 2 : Informations client ── */}
      {etape === 'infos' && (
        <div>
          {/* Résumé commande */}
          <div style={{ backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #86efac', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534' }}>
            <strong>{nbArticles} article{nbArticles > 1 ? 's' : ''}</strong> — Total : <strong>{total.toFixed(2)} €</strong>
            {recurrente
              ? <><br />🔄 <strong>Commande récurrente</strong>{dateRetrait ? ` — début le ${labelDateRetrait}` : ' — date à définir'}</>
              : <><br />Retrait le <strong>{labelDateRetrait}</strong></>
            }
          </div>

          {/* Si connecté : info */}
          {clientConnecte && (
            <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#1d4ed8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>👤 Connecté — vos informations sont préremplies</span>
              <a href="/client/compte" style={{ color: '#1d4ed8', fontSize: '12px', fontWeight: 600 }}>Mon compte →</a>
            </div>
          )}

          {/* Infos coordonnées */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>Vos coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Prénom *</label>
                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Nom *</label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Dubois"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie@exemple.be"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Téléphone *</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="0471 12 34 56"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Notes (optionnel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: sans gluten, tranche fin..." rows={2}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box', resize: 'none' }} />
            </div>
          </div>

          {/* Option créer un compte (si non connecté) */}
          {!clientConnecte && (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: `1px solid ${creerCompte ? '#7CBF3A' : '#e5e7eb'}`, overflow: 'hidden', marginBottom: '16px' }}>
              <div
                onClick={() => { setCreerCompte(!creerCompte); setErreurCompte('') }}
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: creerCompte ? '#f0fdf4' : '#fafafa' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${creerCompte ? '#7CBF3A' : '#d1d5db'}`, background: creerCompte ? '#7CBF3A' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {creerCompte && <span style={{ color: '#1C2B1A', fontWeight: 900, fontSize: '13px', lineHeight: 1 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: creerCompte ? '#166534' : '#374151' }}>
                    ✨ Créer mon compte en même temps
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                    Suivez vos commandes, accédez à votre historique, suspendez vos abonnements
                  </div>
                </div>
              </div>

              {creerCompte && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #e5e7eb' }}>
                  {erreurCompte && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', margin: '12px 0 8px', fontSize: '12px' }}>
                      {erreurCompte}
                    </div>
                  )}
                  <div style={{ marginTop: '12px', marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Mot de passe *</label>
                    <input type="password" value={mdpCompte} onChange={e => setMdpCompte(e.target.value)} placeholder="Min. 8 caractères"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>Confirmer le mot de passe *</label>
                    <input type="password" value={mdpConfirm} onChange={e => setMdpConfirm(e.target.value)} placeholder="••••••••"
                      style={{ width: '100%', border: `1px solid ${mdpConfirm && mdpConfirm !== mdpCompte ? '#fca5a5' : '#d1d5db'}`, borderRadius: '8px', padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
                    {mdpConfirm && mdpConfirm !== mdpCompte && (
                      <p style={{ fontSize: '11px', color: '#ef4444', margin: '4px 0 0' }}>Les mots de passe ne correspondent pas</p>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '10px 0 0' }}>
                    📧 Un email de confirmation vous sera envoyé après la commande.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bouton confirmer */}
          <button
            onClick={passerCommande}
            disabled={loading || !nom || !prenom || !email || !telephone || (creerCompte && (!mdpCompte || mdpCompte !== mdpConfirm || mdpCompte.length < 8))}
            style={{
              width: '100%',
              backgroundColor: (!nom || !prenom || !email || !telephone) ? '#9ca3af' : '#1C2B1A',
              color: '#7CBF3A', border: 'none', borderRadius: '12px', padding: '16px',
              fontSize: '15px', fontWeight: 'bold',
              cursor: (!nom || !prenom || !email || !telephone) ? 'not-allowed' : 'pointer'
            }}>
            {loading ? 'Envoi en cours…' : recurrente ? `🔄 Activer ma commande récurrente — ${total.toFixed(2)} € / sem.` : `✓ Confirmer ma commande — ${total.toFixed(2)} €`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
            Paiement en boutique lors du retrait
          </p>
        </div>
      )}
    </div>
  )
}
