'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUTS = ['en_attente', 'confirmee', 'preparee', 'recuperee', 'annulee']
const STATUT_COULEURS: Record<string, { bg: string; color: string }> = {
  en_attente: { bg: '#fef9c3', color: '#854d0e' },
  confirmee: { bg: '#dbeafe', color: '#1e40af' },
  preparee: { bg: '#f0fdf4', color: '#166534' },
  recuperee: { bg: '#dcfce7', color: '#166534' },
  annulee: { bg: '#fee2e2', color: '#991b1b' },
}

export default function CommandesPage() {
  const [commandes, setCommandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtre, setFiltre] = useState('tous')
  const [commandeOuverte, setCommandeOuverte] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => { chargerCommandes() }, [])

  async function chargerCommandes() {
    const { data } = await supabase
      .from('commandes')
      .select('*, client:clients(nom, prenom, telephone, email), lignes:lignes_commande(*, produit:produits(nom, prix))')
      .order('date_retrait', { ascending: true })
    setCommandes(data ?? [])
    setLoading(false)
  }

  async function changerStatut(id: string, statut: string) {
    await supabase.from('commandes').update({ statut }).eq('id', id)
    chargerCommandes()
    if (commandeOuverte?.id === id) setCommandeOuverte({ ...commandeOuverte, statut })
  }

  const commandesFiltrees = filtre === 'tous'
    ? commandes
    : commandes.filter(c => c.statut === filtre)

  const aujourd_hui = new Date().toISOString().split('T')[0]
  const commandesAujourdhui = commandes.filter(c => c.date_retrait === aujourd_hui)

  if (loading) return <p style={{ color: '#6b7280' }}>Chargement...</p>

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 96px)' }}>

      {/* Liste */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            Commandes <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>({commandes.length})</span>
          </h1>
          <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: '#854d0e' }}>
            📅 Aujourd'hui : {commandesAujourdhui.length} commande{commandesAujourdhui.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Filtres statut */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltre('tous')}
            style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', border: '1px solid', cursor: 'pointer', backgroundColor: filtre === 'tous' ? '#1C2B1A' : 'white', color: filtre === 'tous' ? '#7CBF3A' : '#6b7280', borderColor: filtre === 'tous' ? '#1C2B1A' : '#d1d5db' }}
          >
            Toutes ({commandes.length})
          </button>
          {STATUTS.map(s => {
            const nb = commandes.filter(c => c.statut === s).length
            const col = STATUT_COULEURS[s]
            return (
              <button key={s} onClick={() => setFiltre(s)}
                style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12px', border: '1px solid', cursor: 'pointer', backgroundColor: filtre === s ? col.bg : 'white', color: filtre === s ? col.color : '#6b7280', borderColor: filtre === s ? col.color : '#d1d5db' }}
              >
                {s.replace('_', ' ')} ({nb})
              </button>
            )
          })}
        </div>

        {/* Tableau */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Date retrait</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Type</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Montant</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {commandesFiltrees.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    Aucune commande
                  </td>
                </tr>
              )}
              {commandesFiltrees.map(c => {
                const col = STATUT_COULEURS[c.statut]
                return (
                  <tr key={c.id}
                    onClick={() => setCommandeOuverte(c)}
                    style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', backgroundColor: commandeOuverte?.id === c.id ? '#f0fdf4' : 'white' }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '500' }}>{c.client?.prenom} {c.client?.nom}</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.client?.telephone}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>
                      {new Date(c.date_retrait).toLocaleDateString('fr-BE')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', backgroundColor: c.type === 'recurrente' ? '#e0f2fe' : '#f3f4f6', color: c.type === 'recurrente' ? '#0369a1' : '#6b7280' }}>
                        {c.type === 'recurrente' ? '🔄 Récurrente' : '📋 Ponctuelle'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                      {Number(c.montant_total).toFixed(2)} €
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '999px', backgroundColor: col.bg, color: col.color, fontWeight: '500' }}>
                        {c.statut.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détail commande */}
      {commandeOuverte && (
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Infos commande */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px' }}>
                  {commandeOuverte.client?.prenom} {commandeOuverte.client?.nom}
                </h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                  Retrait le {new Date(commandeOuverte.date_retrait).toLocaleDateString('fr-BE')}
                </p>
              </div>
              <button onClick={() => setCommandeOuverte(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px' }}>×</button>
            </div>

            {/* Contact */}
            <a href={`tel:${commandeOuverte.client?.telephone}`}
              style={{ display: 'block', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', textDecoration: 'none', color: '#166534', fontSize: '13px', marginBottom: '12px' }}>
              📞 {commandeOuverte.client?.telephone}
            </a>

            {/* Produits commandés */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Produits commandés</p>
              {commandeOuverte.lignes?.map((l: any) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span>{l.produit?.nom} <span style={{ color: '#6b7280' }}>×{l.quantite}</span></span>
                  <span style={{ fontWeight: '500' }}>{(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', marginTop: '8px', paddingTop: '8px', borderTop: '2px solid #e5e7eb' }}>
                <span>Total</span>
                <span>{Number(commandeOuverte.montant_total).toFixed(2)} €</span>
              </div>
            </div>

            {/* Changer statut */}
            <div>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', fontWeight: '500' }}>Changer le statut</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {STATUTS.map(s => {
                  const col = STATUT_COULEURS[s]
                  const actif = commandeOuverte.statut === s
                  return (
                    <button key={s} onClick={() => changerStatut(commandeOuverte.id, s)}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid', cursor: 'pointer', fontSize: '13px', textAlign: 'left', backgroundColor: actif ? col.bg : 'white', color: actif ? col.color : '#6b7280', borderColor: actif ? col.color : '#e5e7eb', fontWeight: actif ? '600' : 'normal' }}
                    >
                      {actif ? '● ' : '○ '}{s.replace('_', ' ')}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Notes */}
          {commandeOuverte.notes && (
            <div style={{ backgroundColor: '#fef9c3', borderRadius: '12px', border: '1px solid #fbbf24', padding: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: '600', color: '#854d0e', margin: '0 0 6px' }}>📝 Notes</p>
              <p style={{ fontSize: '13px', color: '#78350f', margin: 0 }}>{commandeOuverte.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}