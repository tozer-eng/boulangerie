'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function NouveauProduitPage() {
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [prix, setPrix] = useState('')
  const [categorieId, setCategorieId] = useState('')
  const [jours, setJours] = useState([0, 1, 2, 3, 4, 5, 6])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    supabase.from('categories').select('*').order('ordre').then(({ data }) => setCategories(data ?? []))
  }, [])

  function toggleJour(jour: number) {
    setJours(prev => prev.includes(jour) ? prev.filter(j => j !== jour) : [...prev, jour])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom || !prix) return setMessage('Le nom et le prix sont obligatoires.')
    setLoading(true)
    const { error } = await supabase.from('produits').insert({
      nom,
      description: description || null,
      prix: parseFloat(prix),
      categorie_id: categorieId || null,
      jours_disponibles: jours,
      actif: true,
    })
    if (error) {
      setMessage('Erreur : ' + error.message)
      setLoading(false)
    } else {
      router.push('/admin/produits')
    }
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '14px' }}>
          ← Retour
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>Nouveau produit</h1>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '24px' }}>
        {message && (
          <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nom */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Nom du produit *</label>
            <input
              type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Ex: Baguette tradition"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Description (optionnel)</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Pain artisanal au levain..."
              rows={3}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          {/* Prix et Catégorie */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Prix (€) *</label>
              <input
                type="number" value={prix} onChange={e => setPrix(e.target.value)}
                placeholder="1.20" step="0.01" min="0"
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Catégorie</label>
              <select
                value={categorieId} onChange={e => setCategorieId(e.target.value)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', boxSizing: 'border-box' }}
              >
                <option value="">Sans catégorie</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>

          {/* Jours disponibles */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Jours disponibles</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {JOURS.map((jour, i) => (
                <button
                  key={i} type="button" onClick={() => toggleJour(i)}
                  style={{
                    padding: '4px 10px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer', border: '1px solid',
                    backgroundColor: jours.includes(i) ? '#7CBF3A' : 'white',
                    borderColor: jours.includes(i) ? '#7CBF3A' : '#d1d5db',
                    color: jours.includes(i) ? '#1C2B1A' : '#6b7280',
                    fontWeight: jours.includes(i) ? '600' : 'normal',
                  }}
                >
                  {jour.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Bouton */}
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Enregistrement...' : 'Créer le produit'}
          </button>
        </form>
      </div>
    </div>
  )
}