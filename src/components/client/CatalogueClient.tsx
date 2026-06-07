'use client'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import type { Categorie, Produit } from '@/lib/types'

interface Props {
  categories: Categorie[]
  produits: Produit[]
}

export default function CatalogueClient({ categories, produits }: Props) {
  const [categorieActive, setCategorieActive] = useState<string | null>(null)
  const [panier, setPanier] = useState<Record<string, number>>({})

  const produitsFiltres = categorieActive
    ? produits.filter((p) => p.categorie_id === categorieActive)
    : produits

  const totalPanier = Object.entries(panier).reduce((acc, [id, qty]) => {
    const produit = produits.find((p) => p.id === id)
    return acc + (produit?.prix ?? 0) * qty
  }, 0)

  const nbArticles = Object.values(panier).reduce((a, b) => a + b, 0)

  function ajouterAuPanier(produitId: string) {
    setPanier((prev) => ({ ...prev, [produitId]: (prev[produitId] ?? 0) + 1 }))
  }

  function retirerDuPanier(produitId: string) {
    setPanier((prev) => {
      const next = { ...prev }
      if ((next[produitId] ?? 0) <= 1) delete next[produitId]
      else next[produitId]--
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-playfair italic text-[#1C2B1A] mb-1">Au Vieux Moulin</h1>
        <p className="text-sm text-[#3B6D11] tracking-widest uppercase">Pierre Chantraine · Boulangerie & Pâtisserie</p>
      </div>

      {/* Filtres catégories */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setCategorieActive(null)}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            !categorieActive
              ? 'bg-[#7CBF3A] border-[#7CBF3A] text-[#1C2B1A] font-medium'
              : 'border-gray-300 text-gray-600 hover:border-[#7CBF3A]'
          }`}
        >
          Tout
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategorieActive(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              categorieActive === cat.id
                ? 'bg-[#7CBF3A] border-[#7CBF3A] text-[#1C2B1A] font-medium'
                : 'border-gray-300 text-gray-600 hover:border-[#7CBF3A]'
            }`}
          >
            {cat.nom}
          </button>
        ))}
      </div>

      {/* Produits */}
      <div className="space-y-3">
        {produitsFiltres.map((produit) => {
          const qty = panier[produit.id] ?? 0
          return (
            <div key={produit.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{produit.nom}</p>
                {produit.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{produit.description}</p>
                )}
                <p className="text-sm font-semibold text-[#3B6D11] mt-1">{produit.prix.toFixed(2)} €</p>
              </div>
              <div className="flex items-center gap-2">
                {qty > 0 ? (
                  <>
                    <button
                      onClick={() => retirerDuPanier(produit.id)}
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-medium">{qty}</span>
                  </>
                ) : null}
                <button
                  onClick={() => ajouterAuPanier(produit.id)}
                  className="w-8 h-8 rounded-full bg-[#7CBF3A] flex items-center justify-center text-[#1C2B1A] font-bold hover:bg-[#3B6D11] hover:text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Panier flottant */}
      {nbArticles > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
          <button className="w-full bg-[#1C2B1A] text-white rounded-xl py-4 flex items-center justify-between px-5 shadow-lg hover:bg-[#3B6D11] transition-colors">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{nbArticles} article{nbArticles > 1 ? 's' : ''}</span>
            </div>
            <span className="font-bold">{totalPanier.toFixed(2)} €</span>
          </button>
        </div>
      )}
    </div>
  )
}
