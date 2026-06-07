'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, X, Check, ChevronDown } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Unite = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'cl'

interface Ingredient {
  id: string
  nom: string
  unite: Unite
  prix_par_unite: number
  fournisseur: string | null
  created_at: string
}

interface Produit {
  id: string
  nom: string
  prix: number
  actif: boolean
}

interface LigneRecette {
  id: string
  produit_id: string
  ingredient_id: string
  quantite: number
  ingredient: Ingredient
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const UNITES: Unite[] = ['g', 'kg', 'ml', 'l', 'pcs', 'cl']

const COULEURS = {
  vertNuit: '#1C2B1A',
  vertVif: '#7CBF3A',
  vertFonce: '#3B6D11',
  creme: '#F5F0E8',
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function IngredientsPage() {
  const supabase = createClient()

  // Onglet actif
  const [onglet, setOnglet] = useState<'ingredients' | 'recettes'>('ingredients')

  // Données globales
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  // Messages feedback
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  // ── État onglet Ingrédients ──
  const [showFormIngredient, setShowFormIngredient] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [formIng, setFormIng] = useState({ nom: '', unite: 'g' as Unite, prix_par_unite: '', fournisseur: '' })

  // ── État onglet Recettes ──
  const [produitSelectionne, setProduitSelectionne] = useState<string>('')
  const [lignesRecette, setLignesRecette] = useState<LigneRecette[]>([])
  const [showFormRecette, setShowFormRecette] = useState(false)
  const [formRec, setFormRec] = useState({ ingredient_id: '', quantite: '' })
  const [editingLigne, setEditingLigne] = useState<string | null>(null)
  const [editQuantite, setEditQuantite] = useState('')

  // ─── Chargement initial ────────────────────────────────────────────────────

  const chargerIngredients = useCallback(async () => {
    const { data } = await supabase.from('ingredients').select('*').order('nom')
    setIngredients(data ?? [])
  }, [supabase])

  const chargerProduits = useCallback(async () => {
    const { data } = await supabase.from('produits').select('id, nom, prix, actif').order('nom')
    setProduits(data ?? [])
  }, [supabase])

  useEffect(() => {
    Promise.all([chargerIngredients(), chargerProduits()]).then(() => setLoading(false))
  }, [chargerIngredients, chargerProduits])

  // ─── Chargement recettes du produit sélectionné ───────────────────────────

  const chargerRecettes = useCallback(async (produitId: string) => {
    if (!produitId) { setLignesRecette([]); return }
    const { data } = await supabase
      .from('recettes')
      .select('*, ingredient:ingredients(*)')
      .eq('produit_id', produitId)
      .order('ingredient(nom)')
    setLignesRecette((data ?? []) as LigneRecette[])
  }, [supabase])

  useEffect(() => {
    chargerRecettes(produitSelectionne)
  }, [produitSelectionne, chargerRecettes])

  // ─── Utilitaires ──────────────────────────────────────────────────────────

  function afficherMessage(type: 'ok' | 'err', texte: string) {
    setMessage({ type, texte })
    setTimeout(() => setMessage(null), 3000)
  }

  function resetFormIng() {
    setFormIng({ nom: '', unite: 'g', prix_par_unite: '', fournisseur: '' })
    setEditingIngredient(null)
    setShowFormIngredient(false)
  }

  function ouvrirEditionIngredient(ing: Ingredient) {
    setEditingIngredient(ing)
    setFormIng({
      nom: ing.nom,
      unite: ing.unite,
      prix_par_unite: String(ing.prix_par_unite ?? ''),
      fournisseur: ing.fournisseur ?? '',
    })
    setShowFormIngredient(true)
  }

  // ─── CRUD Ingrédients ─────────────────────────────────────────────────────

  async function sauvegarderIngredient(e: React.FormEvent) {
    e.preventDefault()
    if (!formIng.nom.trim()) { afficherMessage('err', 'Le nom est requis.'); return }

    const payload = {
      nom: formIng.nom.trim(),
      unite: formIng.unite,
      prix_par_unite: formIng.prix_par_unite !== '' ? parseFloat(formIng.prix_par_unite) : null,
      fournisseur: formIng.fournisseur.trim() || null,
    }

    if (editingIngredient) {
      const { error } = await supabase.from('ingredients').update(payload).eq('id', editingIngredient.id)
      if (error) { afficherMessage('err', 'Erreur lors de la mise à jour.'); return }
      afficherMessage('ok', 'Ingrédient mis à jour.')
    } else {
      const { error } = await supabase.from('ingredients').insert(payload)
      if (error) { afficherMessage('err', 'Erreur lors de la création.'); return }
      afficherMessage('ok', 'Ingrédient créé.')
    }

    resetFormIng()
    await chargerIngredients()
  }

  async function supprimerIngredient(id: string, nom: string) {
    if (!confirm(`Supprimer l'ingrédient "${nom}" ? Cette action est irréversible.`)) return
    const { error } = await supabase.from('ingredients').delete().eq('id', id)
    if (error) { afficherMessage('err', 'Impossible de supprimer (utilisé dans des recettes ?).'); return }
    afficherMessage('ok', 'Ingrédient supprimé.')
    await chargerIngredients()
  }

  // ─── CRUD Recettes ────────────────────────────────────────────────────────

  async function ajouterLigneRecette(e: React.FormEvent) {
    e.preventDefault()
    if (!formRec.ingredient_id) { afficherMessage('err', 'Choisissez un ingrédient.'); return }
    if (!formRec.quantite || parseFloat(formRec.quantite) <= 0) { afficherMessage('err', 'Quantité invalide.'); return }

    const { error } = await supabase.from('recettes').insert({
      produit_id: produitSelectionne,
      ingredient_id: formRec.ingredient_id,
      quantite: parseFloat(formRec.quantite),
    })

    if (error) {
      if (error.code === '23505') { afficherMessage('err', 'Cet ingrédient est déjà dans la recette.'); return }
      afficherMessage('err', 'Erreur lors de l\'ajout.'); return
    }

    afficherMessage('ok', 'Ingrédient ajouté à la recette.')
    setFormRec({ ingredient_id: '', quantite: '' })
    setShowFormRecette(false)
    await chargerRecettes(produitSelectionne)
  }

  async function supprimerLigneRecette(id: string, nomIng: string) {
    if (!confirm(`Retirer "${nomIng}" de cette recette ?`)) return
    const { error } = await supabase.from('recettes').delete().eq('id', id)
    if (error) { afficherMessage('err', 'Erreur lors de la suppression.'); return }
    afficherMessage('ok', 'Ingrédient retiré.')
    await chargerRecettes(produitSelectionne)
  }

  function ouvrirEditionQuantite(ligne: LigneRecette) {
    setEditingLigne(ligne.id)
    setEditQuantite(String(ligne.quantite))
  }

  async function sauvegarderQuantite(ligne: LigneRecette) {
    const q = parseFloat(editQuantite)
    if (isNaN(q) || q <= 0) { afficherMessage('err', 'Quantité invalide.'); return }
    const { error } = await supabase.from('recettes').update({ quantite: q }).eq('id', ligne.id)
    if (error) { afficherMessage('err', 'Erreur de mise à jour.'); return }
    setEditingLigne(null)
    afficherMessage('ok', 'Quantité mise à jour.')
    await chargerRecettes(produitSelectionne)
  }

  // ─── Calculs ──────────────────────────────────────────────────────────────

  function coutRevientProduit(produitId: string): number {
    // On ne peut pas appeler chargerRecettes ici (async), donc on ne calcule
    // le coût que pour le produit sélectionné dans l'onglet recettes.
    // Dans le tableau ingrédients, ce calcul n'est pas pertinent par ligne.
    return 0
  }

  function coutRevientRecetteActive(): number {
    return lignesRecette.reduce((acc, l) => {
      const prix = l.ingredient?.prix_par_unite ?? 0
      return acc + l.quantite * prix
    }, 0)
  }

  const produitActif = produits.find(p => p.id === produitSelectionne)
  const coutTotal = coutRevientRecetteActive()
  const prixVente = produitActif?.prix ?? 0
  const marge = prixVente - coutTotal
  const pctMarge = prixVente > 0 ? (marge / prixVente) * 100 : 0

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '40px', color: '#6b7280', textAlign: 'center' }}>
        Chargement…
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#111827' }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: COULEURS.vertNuit }}>
          Ingrédients &amp; Recettes
        </h1>

        {/* Toggle onglets */}
        <div style={{ display: 'flex', backgroundColor: '#e5e7eb', borderRadius: '999px', padding: '4px', gap: '4px' }}>
          {(['ingredients', 'recettes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setOnglet(tab)}
              style={{
                padding: '6px 20px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s',
                backgroundColor: onglet === tab ? COULEURS.vertNuit : 'transparent',
                color: onglet === tab ? COULEURS.vertVif : '#6b7280',
              }}
            >
              {tab === 'ingredients' ? 'Ingrédients' : 'Recettes'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Message feedback ── */}
      {message && (
        <div style={{
          marginBottom: '16px',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          backgroundColor: message.type === 'ok' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'ok' ? '#166534' : '#991b1b',
          border: `1px solid ${message.type === 'ok' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {message.texte}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET INGRÉDIENTS
      ════════════════════════════════════════════════════════════════════ */}
      {onglet === 'ingredients' && (
        <div>
          {/* Bouton nouvel ingrédient */}
          {!showFormIngredient && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => { resetFormIng(); setShowFormIngredient(true) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  backgroundColor: COULEURS.vertNuit, color: COULEURS.vertVif,
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                }}
              >
                <Plus size={16} />
                Nouvel ingrédient
              </button>
            </div>
          )}

          {/* ── Formulaire création / édition ── */}
          {showFormIngredient && (
            <div style={{
              backgroundColor: COULEURS.creme,
              border: `1px solid ${COULEURS.vertVif}`,
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px',
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 'bold', color: COULEURS.vertFonce }}>
                {editingIngredient ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient'}
              </h2>
              <form onSubmit={sauvegarderIngredient}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>

                  {/* Nom */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                      Nom <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      value={formIng.nom}
                      onChange={e => setFormIng(f => ({ ...f, nom: e.target.value }))}
                      placeholder="ex: Farine T55"
                      required
                      style={styleInput}
                    />
                  </div>

                  {/* Unité */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Unité</label>
                    <select
                      value={formIng.unite}
                      onChange={e => setFormIng(f => ({ ...f, unite: e.target.value as Unite }))}
                      style={styleInput}
                    >
                      {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  {/* Prix par unité */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Prix / unité (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={formIng.prix_par_unite}
                      onChange={e => setFormIng(f => ({ ...f, prix_par_unite: e.target.value }))}
                      placeholder="0.0000"
                      style={styleInput}
                    />
                  </div>

                  {/* Fournisseur */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Fournisseur</label>
                    <input
                      value={formIng.fournisseur}
                      onChange={e => setFormIng(f => ({ ...f, fournisseur: e.target.value }))}
                      placeholder="ex: Minoterie Dupont"
                      style={styleInput}
                    />
                  </div>
                </div>

                {/* Actions formulaire */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="submit"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: COULEURS.vertNuit, color: COULEURS.vertVif,
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                    }}
                  >
                    <Check size={14} />
                    {editingIngredient ? 'Enregistrer' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    onClick={resetFormIng}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: '#f3f4f6', color: '#374151',
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                      cursor: 'pointer', fontSize: '14px',
                    }}
                  >
                    <X size={14} />
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Tableau ingrédients ── */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Nom', 'Unité', 'Prix / unité', 'Fournisseur', 'Actions'].map((col, i) => (
                    <th
                      key={col}
                      style={{
                        padding: '10px 16px',
                        textAlign: i === 4 ? 'right' : 'left',
                        fontSize: '12px',
                        color: '#6b7280',
                        fontWeight: '600',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ingredients.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                      Aucun ingrédient. Cliquez sur "Nouvel ingrédient" pour commencer.
                    </td>
                  </tr>
                )}
                {ingredients.map(ing => (
                  <tr key={ing.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111827' }}>{ing.nom}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        backgroundColor: '#f0fdf4',
                        color: COULEURS.vertFonce,
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: `1px solid ${COULEURS.vertVif}33`,
                      }}>
                        {ing.unite}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {ing.prix_par_unite != null
                        ? `${Number(ing.prix_par_unite).toFixed(4)} €`
                        : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                      {ing.fournisseur ?? <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => ouvrirEditionIngredient(ing)}
                          title="Modifier"
                          style={styleBtnIcon('#eff6ff', '#1d4ed8')}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => supprimerIngredient(ing.id, ing.nom)}
                          title="Supprimer"
                          style={styleBtnIcon('#fef2f2', '#dc2626')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compteur */}
          {ingredients.length > 0 && (
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#9ca3af', textAlign: 'right' }}>
              {ingredients.length} ingrédient{ingredients.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET RECETTES
      ════════════════════════════════════════════════════════════════════ */}
      {onglet === 'recettes' && (
        <div>
          {/* Sélecteur produit */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151', whiteSpace: 'nowrap' }}>
              Produit :
            </label>
            <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
              <select
                value={produitSelectionne}
                onChange={e => { setProduitSelectionne(e.target.value); setShowFormRecette(false) }}
                style={{ ...styleInput, paddingRight: '32px', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="">— Sélectionnez un produit —</option>
                {produits.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nom}{!p.actif ? ' (inactif)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }}
              />
            </div>

            {produitActif && (
              <span style={{
                backgroundColor: '#f0fdf4',
                color: COULEURS.vertFonce,
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: '600',
                border: `1px solid ${COULEURS.vertVif}44`,
                whiteSpace: 'nowrap',
              }}>
                Prix vente : {Number(prixVente).toFixed(2)} €
              </span>
            )}
          </div>

          {/* Contenu recette */}
          {!produitSelectionne ? (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '60px',
              textAlign: 'center',
              color: '#9ca3af',
            }}>
              Sélectionnez un produit pour afficher ou modifier sa recette.
            </div>
          ) : (
            <div>
              {/* Bouton ajouter ingrédient */}
              {!showFormRecette && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => { setFormRec({ ingredient_id: '', quantite: '' }); setShowFormRecette(true) }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      backgroundColor: COULEURS.vertNuit, color: COULEURS.vertVif,
                      padding: '8px 16px', borderRadius: '8px', border: 'none',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                    }}
                  >
                    <Plus size={16} />
                    Ajouter un ingrédient
                  </button>
                </div>
              )}

              {/* ── Formulaire ajout ingrédient à la recette ── */}
              {showFormRecette && (
                <div style={{
                  backgroundColor: COULEURS.creme,
                  border: `1px solid ${COULEURS.vertVif}`,
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '16px',
                }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 'bold', color: COULEURS.vertFonce }}>
                    Ajouter un ingrédient à la recette
                  </h3>
                  <form onSubmit={ajouterLigneRecette}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>

                      {/* Ingrédient */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                          Ingrédient <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                          value={formRec.ingredient_id}
                          onChange={e => setFormRec(f => ({ ...f, ingredient_id: e.target.value }))}
                          required
                          style={styleInput}
                        >
                          <option value="">— Choisir —</option>
                          {ingredients.map(ing => (
                            <option key={ing.id} value={ing.id}>
                              {ing.nom} ({ing.unite})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantité */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                          Quantité <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="number"
                          min="0.0001"
                          step="any"
                          value={formRec.quantite}
                          onChange={e => setFormRec(f => ({ ...f, quantite: e.target.value }))}
                          placeholder="ex: 250"
                          required
                          style={styleInput}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="submit"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          backgroundColor: COULEURS.vertNuit, color: COULEURS.vertVif,
                          padding: '8px 16px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                        }}
                      >
                        <Check size={14} />
                        Ajouter
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFormRecette(false)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          backgroundColor: '#f3f4f6', color: '#374151',
                          padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
                          cursor: 'pointer', fontSize: '14px',
                        }}
                      >
                        <X size={14} />
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Tableau des lignes de recette ── */}
              <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Ingrédient</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Unité</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Quantité</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Prix / unité</th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Coût ligne</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignesRecette.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                          Aucun ingrédient dans cette recette.
                        </td>
                      </tr>
                    )}
                    {lignesRecette.map(ligne => {
                      const ing = ligne.ingredient
                      const coutLigne = ligne.quantite * (ing?.prix_par_unite ?? 0)
                      const isEditing = editingLigne === ligne.id

                      return (
                        <tr key={ligne.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500', color: '#111827' }}>
                            {ing?.nom ?? '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              backgroundColor: '#f0fdf4',
                              color: COULEURS.vertFonce,
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: '600',
                              border: `1px solid ${COULEURS.vertVif}33`,
                            }}>
                              {ing?.unite ?? '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0.0001"
                                step="any"
                                value={editQuantite}
                                onChange={e => setEditQuantite(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') sauvegarderQuantite(ligne)
                                  if (e.key === 'Escape') setEditingLigne(null)
                                }}
                                autoFocus
                                style={{ ...styleInput, width: '90px', padding: '4px 8px' }}
                              />
                            ) : (
                              <span
                                onClick={() => ouvrirEditionQuantite(ligne)}
                                title="Cliquer pour modifier"
                                style={{ cursor: 'pointer', borderBottom: '1px dashed #9ca3af', paddingBottom: '1px' }}
                              >
                                {ligne.quantite}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                            {ing?.prix_par_unite != null
                              ? `${Number(ing.prix_par_unite).toFixed(4)} €`
                              : <span style={{ color: '#9ca3af' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: '500', color: COULEURS.vertFonce }}>
                            {ing?.prix_par_unite != null
                              ? `${coutLigne.toFixed(4)} €`
                              : <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => sauvegarderQuantite(ligne)}
                                    title="Valider"
                                    style={styleBtnIcon('#f0fdf4', COULEURS.vertFonce)}
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingLigne(null)}
                                    title="Annuler"
                                    style={styleBtnIcon('#f3f4f6', '#374151')}
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => ouvrirEditionQuantite(ligne)}
                                    title="Modifier la quantité"
                                    style={styleBtnIcon('#eff6ff', '#1d4ed8')}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => supprimerLigneRecette(ligne.id, ing?.nom ?? '')}
                                    title="Retirer de la recette"
                                    style={styleBtnIcon('#fef2f2', '#dc2626')}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Récapitulatif coût / marge ── */}
              {lignesRecette.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  backgroundColor: COULEURS.vertNuit,
                  color: 'white',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '16px',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Coût de revient
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 'bold', color: COULEURS.vertVif }}>
                      {coutTotal.toFixed(4)} €
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Prix de vente
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 'bold', color: 'white' }}>
                      {Number(prixVente).toFixed(2)} €
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Marge brute
                    </p>
                    <p style={{
                      margin: '4px 0 0', fontSize: '22px', fontWeight: 'bold',
                      color: marge >= 0 ? COULEURS.vertVif : '#f87171',
                    }}>
                      {marge >= 0 ? '+' : ''}{marge.toFixed(2)} €
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      % Marge
                    </p>
                    <p style={{
                      margin: '4px 0 0', fontSize: '22px', fontWeight: 'bold',
                      color: pctMarge >= 0 ? COULEURS.vertVif : '#f87171',
                    }}>
                      {prixVente > 0 ? `${pctMarge.toFixed(1)} %` : <span style={{ fontSize: '14px', color: '#6b7280' }}>Prix manquant</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Cas : recette vide, affichage marge quand même si prix connu */}
              {lignesRecette.length === 0 && produitActif && (
                <div style={{
                  marginTop: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px dashed #d1d5db',
                  borderRadius: '12px',
                  padding: '16px 24px',
                  color: '#9ca3af',
                  fontSize: '14px',
                }}>
                  Ajoutez des ingrédients pour calculer le coût de revient et la marge.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Styles réutilisables ─────────────────────────────────────────────────────

const styleInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '14px',
  color: '#111827',
  backgroundColor: 'white',
  boxSizing: 'border-box',
  outline: 'none',
}

function styleBtnIcon(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: bg,
    color,
  }
}
