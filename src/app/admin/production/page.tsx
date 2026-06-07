'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Produit = { id: string; nom: string; prix: number; actif: boolean }
type Recette = { ingredient_id: string; quantite: number; ingredients: { nom: string; unite: string; prix_par_unite: number } }
type ProductionExtra = Record<string, number> // produit_id → quantite_extra

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export default function ProductionPage() {
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(toDateStr(today))
  const [produits, setProduits] = useState<Produit[]>([])
  const [recettes, setRecettes] = useState<Record<string, Recette[]>>({}) // produit_id → recette
  const [extras, setExtras] = useState<ProductionExtra>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string | null>(null)
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Charger produits + recettes
  useEffect(() => {
    supabase
      .from('produits')
      .select('*')
      .eq('actif', true)
      .then(({ data }) => setProduits(data ?? []))

    supabase
      .from('recettes')
      .select('*, ingredients(nom, unite, prix_par_unite)')
      .then(({ data }) => {
        const map: Record<string, Recette[]> = {}
        for (const r of data ?? []) {
          if (!map[r.produit_id]) map[r.produit_id] = []
          map[r.produit_id].push(r)
        }
        setRecettes(map)
      })
  }, [])

  // Charger extras pour la date sélectionnée
  useEffect(() => {
    supabase
      .from('production_extra')
      .select('produit_id, quantite_extra')
      .eq('date', selectedDate)
      .then(({ data }) => {
        const map: ProductionExtra = {}
        for (const row of data ?? []) {
          map[row.produit_id] = row.quantite_extra
        }
        setExtras(map)
      })
  }, [selectedDate])

  const upsertExtra = useCallback(async (produitId: string, quantite: number) => {
    setSaving(s => ({ ...s, [produitId]: true }))
    const { error } = await supabase.from('production_extra').upsert(
      { produit_id: produitId, date: selectedDate, quantite_extra: quantite },
      { onConflict: 'produit_id,date' }
    )
    setSaving(s => ({ ...s, [produitId]: false }))
    if (!error) {
      setToast('Enregistré ✓')
      setTimeout(() => setToast(null), 2000)
    }
  }, [selectedDate])

  function handleQuantiteChange(produitId: string, value: string) {
    const qty = Math.max(0, parseInt(value) || 0)
    setExtras(e => ({ ...e, [produitId]: qty }))
    if (debounceRefs.current[produitId]) clearTimeout(debounceRefs.current[produitId])
    debounceRefs.current[produitId] = setTimeout(() => upsertExtra(produitId, qty), 500)
  }

  // Calcul matières premières
  const matieres: Record<string, { nom: string; unite: string; quantite: number }> = {}
  let coutTotal = 0

  for (const produit of produits) {
    const qty = extras[produit.id] ?? 0
    if (qty <= 0) continue
    const lignes = recettes[produit.id] ?? []
    for (const ligne of lignes) {
      const ing = ligne.ingredients
      const qtyIng = Number(ligne.quantite) * qty
      if (!matieres[ligne.ingredient_id]) {
        matieres[ligne.ingredient_id] = { nom: ing.nom, unite: ing.unite, quantite: 0 }
      }
      matieres[ligne.ingredient_id].quantite += qtyIng
      coutTotal += qtyIng * Number(ing.prix_par_unite)
    }
  }

  const matieresList = Object.values(matieres)

  const labelDate = (d: Date) => d.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif', backgroundColor: '#F5F0E8', minHeight: '100vh' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', backgroundColor: '#3B6D11', color: 'white', padding: '10px 20px', borderRadius: '8px', zIndex: 100, fontWeight: '600' }}>
          {toast}
        </div>
      )}

      <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '26px', color: '#1C2B1A', marginBottom: '24px' }}>
        Production extra
      </h1>

      {/* Sélecteur de date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', backgroundColor: 'white' }}
        />
        {[0, 1, 2].map(offset => {
          const d = addDays(today, offset)
          const ds = toDateStr(d)
          const labels = ['Aujourd\'hui', 'J+1', 'J+2']
          return (
            <button
              key={offset}
              onClick={() => setSelectedDate(ds)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none',
                backgroundColor: selectedDate === ds ? '#1C2B1A' : 'white',
                color: selectedDate === ds ? '#7CBF3A' : '#374151',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {labels[offset]}<br />
              <span style={{ fontSize: '11px', fontWeight: '400', opacity: 0.8 }}>{labelDate(d)}</span>
            </button>
          )
        })}
      </div>

      {/* Deux colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>

        {/* Colonne gauche — saisie quantités */}
        <div>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#1C2B1A', color: '#7CBF3A', fontWeight: '700', fontSize: '15px' }}>
              Quantités supplémentaires
            </div>
            {produits.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>Aucun produit actif</div>
            ) : (
              produits.map((produit, i) => (
                <div
                  key={produit.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: i < produits.length - 1 ? '1px solid #f3f4f6' : 'none',
                    backgroundColor: (extras[produit.id] ?? 0) > 0 ? '#f0fdf4' : 'white',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#111827', fontSize: '14px' }}>{produit.nom}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{Number(produit.prix).toFixed(2)} €/u</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => handleQuantiteChange(produit.id, String(Math.max(0, (extras[produit.id] ?? 0) - 1)))}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }}
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      value={extras[produit.id] ?? 0}
                      onChange={e => handleQuantiteChange(produit.id, e.target.value)}
                      style={{ width: '60px', textAlign: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px', fontSize: '14px', fontWeight: '600' }}
                    />
                    <button
                      onClick={() => handleQuantiteChange(produit.id, String((extras[produit.id] ?? 0) + 1))}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', backgroundColor: '#7CBF3A', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', lineHeight: '1' }}
                    >+</button>
                    {saving[produit.id] && <span style={{ fontSize: '11px', color: '#9ca3af' }}>...</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Colonne droite — récap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Coût journalier */}
          <div style={{ backgroundColor: '#1C2B1A', borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ fontSize: '13px', color: '#7CBF3A', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coût estimé du jour</div>
            <div style={{ fontSize: '32px', fontWeight: '800', fontFamily: 'Georgia, serif' }}>
              {coutTotal.toFixed(2)} €
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
              {produits.filter(p => (extras[p.id] ?? 0) > 0).length} produit(s) en extra
            </div>
          </div>

          {/* Matières premières */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#3B6D11', color: 'white', fontWeight: '700', fontSize: '14px' }}>
              Matières premières nécessaires
            </div>
            {matieresList.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                Aucune quantité saisie
              </div>
            ) : (
              matieresList.map((mat, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: i < matieresList.length - 1 ? '1px solid #f3f4f6' : 'none',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#374151' }}>{mat.nom}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1C2B1A' }}>
                    {mat.quantite % 1 === 0 ? mat.quantite : mat.quantite.toFixed(2)} {mat.unite}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Détail par produit */}
          {produits.filter(p => (extras[p.id] ?? 0) > 0).length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '700', fontSize: '13px', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>
                Détail par produit
              </div>
              {produits.filter(p => (extras[p.id] ?? 0) > 0).map((produit, i, arr) => {
                const qty = extras[produit.id] ?? 0
                const lignes = recettes[produit.id] ?? []
                const cout = lignes.reduce((acc, l) => acc + Number(l.quantite) * Number(l.ingredients.prix_par_unite), 0)
                return (
                  <div key={produit.id} style={{ padding: '10px 16px', borderBottom: i < arr.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600' }}>
                      <span>{produit.nom} × {qty}</span>
                      <span style={{ color: '#3B6D11' }}>{(cout * qty).toFixed(2)} €</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {(cout).toFixed(3)} € / unité
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
