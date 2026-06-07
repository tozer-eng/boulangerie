'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [clientOuvert, setClientOuvert] = useState<any>(null)
  const [note, setNote] = useState('')
  const supabase = createClient()

  useEffect(() => {
    chargerClients()
  }, [])

  async function chargerClients() {
    const { data } = await supabase
      .from('clients')
      .select('*, commandes(id, montant_total, statut, date_retrait)')
      .order('nom')
    setClients(data ?? [])
    setLoading(false)
  }

  async function toggleActif(id: string, actif: boolean) {
    await supabase.from('clients').update({ actif: !actif }).eq('id', id)
    chargerClients()
  }

  async function sauvegarderNote() {
    await supabase.from('clients').update({ notes: note }).eq('id', clientOuvert.id)
    setClientOuvert({ ...clientOuvert, notes: note })
    chargerClients()
  }

  async function changerStatut(id: string, statut: string) {
    await supabase.from('clients').update({ statut }).eq('id', id)
    chargerClients()
    if (clientOuvert?.id === id) setClientOuvert({ ...clientOuvert, statut })
  }

  const clientsFiltres = clients.filter(c =>
    `${c.nom} ${c.prenom} ${c.email} ${c.telephone}`.toLowerCase().includes(recherche.toLowerCase())
  )

  if (loading) return <p style={{ color: '#6b7280' }}>Chargement...</p>

  return (
    <div style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 96px)' }}>

      {/* Liste clients */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            Clients <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: 'normal' }}>({clients.length})</span>
          </h1>
        </div>

        {/* Recherche */}
        <input
          type="text"
          placeholder="🔍 Rechercher par nom, email, téléphone..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }}
        />

        {/* Tableau */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Client</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Téléphone</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Statut</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Commandes</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>Actif</th>
              </tr>
            </thead>
            <tbody>
              {clientsFiltres.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    {recherche ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                  </td>
                </tr>
              )}
              {clientsFiltres.map(c => (
                <tr
                  key={c.id}
                  onClick={() => { setClientOuvert(c); setNote(c.notes ?? '') }}
                  style={{
                    borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                    backgroundColor: clientOuvert?.id === c.id ? '#f0fdf4' : 'white'
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '500', color: '#111827' }}>{c.prenom} {c.nom}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <a href={`tel:${c.telephone}`} onClick={e => e.stopPropagation()} style={{ color: '#3B6D11', textDecoration: 'none', fontWeight: '500' }}>
                      📞 {c.telephone}
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '500',
                      backgroundColor: c.statut === 'verifie' ? '#dcfce7' : '#fef9c3',
                      color: c.statut === 'verifie' ? '#166534' : '#854d0e'
                    }}>
                      {c.statut === 'verifie' ? '✓ Vérifié' : '⏳ Nouveau'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280', fontSize: '13px' }}>
                    {c.commandes?.length ?? 0} commande{(c.commandes?.length ?? 0) > 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); toggleActif(c.id, c.actif) }}
                      style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', border: 'none', cursor: 'pointer',
                        backgroundColor: c.actif ? '#dcfce7' : '#f3f4f6',
                        color: c.actif ? '#166534' : '#6b7280'
                      }}
                    >
                      {c.actif ? '● Actif' : '○ Inactif'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fiche client */}
      {clientOuvert && (
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Infos principales */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px' }}>{clientOuvert.prenom} {clientOuvert.nom}</h2>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                  Client depuis le {new Date(clientOuvert.created_at).toLocaleDateString('fr-BE')}
                </p>
              </div>
              <button onClick={() => setClientOuvert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '18px' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <a href={`tel:${clientOuvert.telephone}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', textDecoration: 'none', color: '#166534', fontSize: '13px', fontWeight: '500' }}>
                📞 {clientOuvert.telephone}
              </a>
              <a href={`mailto:${clientOuvert.email}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f0f9ff', borderRadius: '8px', textDecoration: 'none', color: '#0369a1', fontSize: '13px' }}>
                ✉️ {clientOuvert.email}
              </a>
            </div>

            {/* Statut */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>Statut du compte</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => changerStatut(clientOuvert.id, 'nouveau')}
                  style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '12px', backgroundColor: clientOuvert.statut === 'nouveau' ? '#fef9c3' : 'white', borderColor: clientOuvert.statut === 'nouveau' ? '#fbbf24' : '#d1d5db', color: clientOuvert.statut === 'nouveau' ? '#854d0e' : '#6b7280' }}
                >
                  ⏳ Nouveau
                </button>
                <button
                  onClick={() => changerStatut(clientOuvert.id, 'verifie')}
                  style={{ flex: 1, padding: '6px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontSize: '12px', backgroundColor: clientOuvert.statut === 'verifie' ? '#dcfce7' : 'white', borderColor: clientOuvert.statut === 'verifie' ? '#86efac' : '#d1d5db', color: clientOuvert.statut === 'verifie' ? '#166534' : '#6b7280' }}
                >
                  ✓ Vérifié
                </button>
              </div>
            </div>
          </div>

          {/* Historique commandes */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 10px', color: '#374151' }}>
              Commandes ({clientOuvert.commandes?.length ?? 0})
            </h3>
            {(!clientOuvert.commandes || clientOuvert.commandes.length === 0) ? (
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Aucune commande</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {clientOuvert.commandes.slice(0, 5).map((cmd: any) => (
                  <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280' }}>{new Date(cmd.date_retrait).toLocaleDateString('fr-BE')}</span>
                    <span style={{ fontWeight: '500' }}>{Number(cmd.montant_total).toFixed(2)} €</span>
                    <span style={{ color: '#3B6D11' }}>{cmd.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes internes */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 8px', color: '#374151' }}>Notes internes</h3>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Notes visibles uniquement par le boulanger..."
              rows={4}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px', fontSize: '12px', boxSizing: 'border-box', resize: 'vertical' }}
            />
            <button
              onClick={sauvegarderNote}
              style={{ width: '100%', marginTop: '8px', backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Sauvegarder la note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}