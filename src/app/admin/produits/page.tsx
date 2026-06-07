'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ProduitsPage() {
  const [produits, setProduits] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produits').select('*, categorie:categories(nom)').order('nom'),
      supabase.from('categories').select('*').order('ordre'),
    ])
    setProduits(prods ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  async function toggleActif(id: string, actif: boolean) {
    await supabase.from('produits').update({ actif: !actif }).eq('id', id)
    chargerDonnees()
  }

  async function supprimerProduit(id: string, nom: string) {
    if (!confirm(`Supprimer "${nom}" ? Cette action est irréversible.`)) return
    await supabase.from('produits').delete().eq('id', id)
    chargerDonnees()
  }

  if (loading) return <p style={{ color: '#6b7280' }}>Chargement...</p>

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Produits</h1>
        <Link href="/admin/produits/nouveau" style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
          + Ajouter un produit
        </Link>
      </div>

      {/* Tableau */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Produit</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Catégorie</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Prix</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Statut</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {produits.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                  Aucun produit. <Link href="/admin/produits/nouveau" style={{ color: '#3B6D11' }}>Ajouter le premier</Link>
                </td>
              </tr>
            )}
            {produits.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111827' }}>{p.nom}</td>
                <td style={{ padding: '12px 16px', color: '#6b7280' }}>{p.categorie?.nom ?? '—'}</td>
                <td style={{ padding: '12px 16px', fontWeight: '500' }}>{Number(p.prix).toFixed(2)} €</td>
                <td style={{ padding: '12px 16px' }}>
                  <button
                    onClick={() => toggleActif(p.id, p.actif)}
                    style={{
                      padding: '2px 10px', borderRadius: '999px', fontSize: '12px', border: 'none', cursor: 'pointer',
                      backgroundColor: p.actif ? '#dcfce7' : '#f3f4f6',
                      color: p.actif ? '#166534' : '#6b7280',
                    }}
                  >
                    {p.actif ? '● Actif' : '○ Inactif'}
                  </button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <Link href={`/admin/produits/${p.id}`} style={{ color: '#3B6D11', fontSize: '12px', textDecoration: 'none', marginRight: '12px' }}>
                    Modifier
                  </Link>
                  <button onClick={() => supprimerProduit(p.id, p.nom)} style={{ color: '#dc2626', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}