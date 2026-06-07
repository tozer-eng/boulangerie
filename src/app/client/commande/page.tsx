'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// Calcule la date minimum de retrait en tenant compte des heures de blocage
function calculerDateMin(heureBloqueSemaine: string, heureBloqueWeekend: string): string {
  const now = new Date()
  const jourSemaine = now.getDay() // 0=dim, 1=lun, ..., 5=ven, 6=sam

  // Vendredi soir (5) et samedi (6) → heure weekend
  const isWeekendBlocage = jourSemaine === 5 || jourSemaine === 6
  const heureBlocage = isWeekendBlocage ? heureBloqueWeekend : heureBloqueSemaine

  const [h, m] = heureBlocage.split(':').map(Number)
  const limiteHeure = new Date(now)
  limiteHeure.setHours(h, m, 0, 0)

  // Si l'heure actuelle dépasse l'heure de blocage → J+2, sinon J+1
  const offset = now >= limiteHeure ? 2 : 1
  const dateMin = new Date(now)
  dateMin.setDate(dateMin.getDate() + offset)
  return dateMin.toISOString().split('T')[0]
}

export default function CommandePage() {
  const [produits, setProduits] = useState<any[]>([])
  const [panier, setPanier] = useState<Record<string, number>>({})
  const [dateRetrait, setDateRetrait] = useState('')
  const [dateMin, setDateMin] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [etape, setEtape] = useState<'panier' | 'infos' | 'confirmation'>('panier')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const panierSauvegarde = localStorage.getItem('panier')
    if (panierSauvegarde) setPanier(JSON.parse(panierSauvegarde))

    supabase.from('produits').select('*').eq('actif', true).then(({ data }) => setProduits(data ?? []))

    // Charger les heures de blocage depuis les paramètres
    supabase
      .from('parametres')
      .select('heure_blocage_semaine, heure_blocage_weekend')
      .single()
      .then(({ data }) => {
        const heureBloqueSemaine = data?.heure_blocage_semaine ?? '23:00'
        const heureBloqueWeekend = data?.heure_blocage_weekend ?? '20:00'
        const min = calculerDateMin(heureBloqueSemaine, heureBloqueWeekend)
        setDateMin(min)
        setDateRetrait(min)
      })
      .catch(() => {
        // Fallback : J+1
        const demain = new Date()
        demain.setDate(demain.getDate() + 1)
        const min = demain.toISOString().split('T')[0]
        setDateMin(min)
        setDateRetrait(min)
      })
  }, [])

  function getProduit(id: string) {
    return produits.find(p => p.id === id)
  }

  const lignesPanier = Object.entries(panier).filter(([, qty]) => qty > 0)
  const total = lignesPanier.reduce((acc, [id, qty]) => acc + (getProduit(id)?.prix ?? 0) * qty, 0)
  const nbArticles = lignesPanier.reduce((acc, [, qty]) => acc + qty, 0)

  function modifierQty(id: string, delta: number) {
    const nouveau = { ...panier }
    nouveau[id] = (nouveau[id] ?? 0) + delta
    if (nouveau[id] <= 0) delete nouveau[id]
    setPanier(nouveau)
    localStorage.setItem('panier', JSON.stringify(nouveau))
  }

  async function passerCommande() {
    if (!nom || !prenom || !email || !telephone || !dateRetrait) return
    setLoading(true)

    // Créer ou récupérer le client
    let clientId: string
    const { data: clientExistant } = await supabase
      .from('clients').select('id').eq('email', email).single()

    if (clientExistant) {
      clientId = clientExistant.id
    } else {
      const { data: nouveauClient } = await supabase
        .from('clients').insert({ nom, prenom, email, telephone, statut: 'nouveau', actif: true })
        .select('id').single()
      clientId = nouveauClient!.id
    }

    // Créer la commande
    const { data: commande } = await supabase
      .from('commandes').insert({
        client_id: clientId,
        type: 'ponctuelle',
        statut: 'en_attente',
        statut_paiement: 'en_attente',
        mode_paiement: 'en_magasin',
        date_retrait: dateRetrait,
        montant_total: total,
        notes: notes || null,
      }).select('id').single()

    // Créer les lignes
    const lignes = lignesPanier.map(([id, qty]) => ({
      commande_id: commande!.id,
      produit_id: id,
      quantite: qty,
      prix_unitaire: getProduit(id)?.prix ?? 0,
    }))
    await supabase.from('lignes_commande').insert(lignes)

    // Vider le panier
    localStorage.removeItem('panier')
    setPanier({})
    setEtape('confirmation')
    setLoading(false)
  }

  // Page de confirmation
  if (etape === 'confirmation') {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>🎉</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '24px', color: '#1C2B1A', marginBottom: '8px' }}>
          Commande confirmée !
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '8px' }}>
          Merci {prenom} ! Votre commande a bien été enregistrée.
        </p>
        <p style={{ color: '#3B6D11', fontWeight: '600', marginBottom: '24px' }}>
          À récupérer le {new Date(dateRetrait).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
          <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 4px', fontWeight: '600' }}>📍 Au Vieux Moulin</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Rue de la Tour Carrée 338, 5300 Vezin</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>081/30.25.76</p>
        </div>
        <button
          onClick={() => router.push('/client/catalogue')}
          style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          Retour au catalogue
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => etape === 'panier' ? router.push('/client/catalogue') : setEtape('panier')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px' }}>
          ← Retour
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
          {etape === 'panier' ? '🛒 Mon panier' : '📋 Mes informations'}
        </h1>
      </div>

      {/* Étape 1 — Panier */}
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
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '16px' }}>
                {lignesPanier.map(([id, qty]) => {
                  const p = getProduit(id)
                  if (!p) return null
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: '#111827' }}>{p.nom}</div>
                        <div style={{ fontSize: '13px', color: '#3B6D11', fontWeight: '600' }}>{Number(p.prix).toFixed(2)} € / unité</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => modifierQty(id, -1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '16px' }}>
                          −
                        </button>
                        <span style={{ fontWeight: '600', width: '20px', textAlign: 'center' }}>{qty}</span>
                        <button onClick={() => modifierQty(id, 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: '#7CBF3A', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                          +
                        </button>
                        <span style={{ width: '60px', textAlign: 'right', fontWeight: '600' }}>
                          {(Number(p.prix) * qty).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f9fafb' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Total ({nbArticles} article{nbArticles > 1 ? 's' : ''})</span>
                  <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1C2B1A' }}>{total.toFixed(2)} €</span>
                </div>
              </div>

              {/* Date retrait */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  📅 Date de retrait souhaitée
                </label>
                <input
                  type="date" value={dateRetrait} onChange={e => setDateRetrait(e.target.value)}
                  min={dateMin}
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>

              <button
                onClick={() => setEtape('infos')}
                style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Continuer → Mes informations
              </button>
            </>
          )}
        </div>
      )}

      {/* Étape 2 — Informations */}
      {etape === 'infos' && (
        <div>
          {/* Récap commande */}
          <div style={{ backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #86efac', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#166534' }}>
            <strong>{nbArticles} article{nbArticles > 1 ? 's' : ''}</strong> — Total : <strong>{total.toFixed(2)} €</strong>
            <br />Retrait le <strong>{new Date(dateRetrait).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Prénom *</label>
                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Marie"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Nom *</label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Dubois"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie@exemple.be"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Téléphone *</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="0471 12 34 56"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Notes (optionnel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: sans gluten, tranche fin..." rows={2}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box', resize: 'none' }} />
            </div>
          </div>

          <button
            onClick={passerCommande}
            disabled={loading || !nom || !prenom || !email || !telephone}
            style={{ width: '100%', backgroundColor: (!nom || !prenom || !email || !telephone) ? '#9ca3af' : '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: 'bold', cursor: (!nom || !prenom || !email || !telephone) ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Envoi en cours...' : `✓ Confirmer ma commande — ${total.toFixed(2)} €`}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>
            Paiement en boutique lors du retrait
          </p>
        </div>
      )}
    </div>
  )
}