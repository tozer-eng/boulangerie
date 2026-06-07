'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CataloguePage() {
  const [produits, setProduits] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [categorieActive, setCategorieActive] = useState<string | null>(null)
  const [panier, setPanier] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function charger() {
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('produits').select('*, categorie:categories(nom)').eq('actif', true).order('nom'),
        supabase.from('categories').select('*').order('ordre'),
      ])
      setProduits(prods ?? [])
      setCategories(cats ?? [])
      setLoading(false)
    }
    charger()

    // Charger panier depuis localStorage
    const panierSauvegarde = localStorage.getItem('panier')
    if (panierSauvegarde) setPanier(JSON.parse(panierSauvegarde))
  }, [])

  function sauvegarderPanier(nouveauPanier: Record<string, number>) {
    setPanier(nouveauPanier)
    localStorage.setItem('panier', JSON.stringify(nouveauPanier))
  }

  function ajouter(produitId: string) {
    const nouveau = { ...panier, [produitId]: (panier[produitId] ?? 0) + 1 }
    sauvegarderPanier(nouveau)
  }

  function retirer(produitId: string) {
    const nouveau = { ...panier }
    if ((nouveau[produitId] ?? 0) <= 1) delete nouveau[produitId]
    else nouveau[produitId]--
    sauvegarderPanier(nouveau)
  }

  const produitsFiltres = categorieActive
    ? produits.filter(p => p.categorie_id === categorieActive)
    : produits

  const nbArticles = Object.values(panier).reduce((a, b) => a + b, 0)
  const total = Object.entries(panier).reduce((acc, [id, qty]) => {
    const p = produits.find(p => p.id === id)
    return acc + (p?.prix ?? 0) * qty
  }, 0)

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
      Chargement...
    </div>
  )

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px 16px 100px' }}>

      {/* Titre */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '28px', color: '#1C2B1A', margin: '0 0 4px' }}>
          Notre catalogue
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Commandez en ligne, récupérez en boutique
        </p>
      </div>

      {/* Filtres catégories */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button
          onClick={() => setCategorieActive(null)}
          style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '13px', border: '1px solid', cursor: 'pointer', backgroundColor: !categorieActive ? '#7CBF3A' : 'white', borderColor: !categorieActive ? '#7CBF3A' : '#d1d5db', color: !categorieActive ? '#1C2B1A' : '#6b7280', fontWeight: !categorieActive ? '600' : 'normal' }}
        >
          Tout
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategorieActive(cat.id)}
            style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '13px', border: '1px solid', cursor: 'pointer', backgroundColor: categorieActive === cat.id ? '#7CBF3A' : 'white', borderColor: categorieActive === cat.id ? '#7CBF3A' : '#d1d5db', color: categorieActive === cat.id ? '#1C2B1A' : '#6b7280', fontWeight: categorieActive === cat.id ? '600' : 'normal' }}
          >
            {cat.nom}
          </button>
        ))}
      </div>

      {/* Produits */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {produitsFiltres.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>
            Aucun produit disponible
          </p>
        )}
        {produitsFiltres.map(produit => {
          const qty = panier[produit.id] ?? 0
          return (
            <div key={produit.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '500', color: '#111827', marginBottom: '2px' }}>{produit.nom}</div>
                {produit.description && (
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{produit.description}</div>
                )}
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#3B6D11' }}>
                  {Number(produit.prix).toFixed(2)} €
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {qty > 0 && (
                  <>
                    <button
                      onClick={() => retirer(produit.id)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}
                    >
                      −
                    </button>
                    <span style={{ width: '20px', textAlign: 'center', fontWeight: '600', fontSize: '15px' }}>{qty}</span>
                  </>
                )}
                <button
                  onClick={() => ajouter(produit.id)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: '#7CBF3A', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1C2B1A', fontWeight: 'bold' }}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bouton panier flottant */}
      {nbArticles > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '400px', padding: '0 16px', zIndex: 100 }}>
          <button
            onClick={() => router.push('/client/commande')}
            style={{ width: '100%', backgroundColor: '#1C2B1A', color: 'white', border: 'none', borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
          >
            <span style={{ backgroundColor: '#7CBF3A', color: '#1C2B1A', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px' }}>
              {nbArticles}
            </span>
            <span style={{ fontWeight: '600', fontSize: '15px' }}>Voir mon panier</span>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{total.toFixed(2)} €</span>
          </button>
        </div>
      )}
    </div>
  )
}