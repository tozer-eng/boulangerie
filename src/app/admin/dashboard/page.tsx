import { createClient } from '@/lib/supabase/server'

const STATUT_META: Record<string, { bg: string; color: string; label: string }> = {
  en_attente: { bg: '#fef9c3', color: '#854d0e', label: 'En attente' },
  confirmee:  { bg: '#dbeafe', color: '#1e40af', label: 'Confirmée' },
  preparee:   { bg: '#fef3c7', color: '#92400e', label: 'Prête' },
  recuperee:  { bg: '#dcfce7', color: '#166534', label: 'Récupérée' },
  annulee:    { bg: '#fee2e2', color: '#991b1b', label: 'Annulée' },
}

export default async function DashboardPage() {
  const supabase = createClient()
  const aujourd_hui = new Date().toISOString().split('T')[0]

  const [
    { count: nbEnAttente },
    { count: nbClients },
    { count: nbAujourdhui },
    { data: produitsActifs },
    { data: commandesRecentes },
  ] = await Promise.all([
    supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('actif', true),
    supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('date_retrait', aujourd_hui).neq('statut', 'annulee'),
    supabase.from('produits').select('id').eq('actif', true),
    supabase.from('commandes')
      .select('*, client:clients(nom, prenom), lignes:lignes_commande(*, produit:produits(nom))')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const stats = [
    { label: 'En attente',        valeur: nbEnAttente ?? 0,       emoji: '⏳', bg: '#fef9c3', color: '#854d0e' },
    { label: 'Retraits aujourd\'hui', valeur: nbAujourdhui ?? 0,  emoji: '📅', bg: '#dbeafe', color: '#1e40af' },
    { label: 'Clients actifs',    valeur: nbClients ?? 0,          emoji: '👥', bg: '#f0fdf4', color: '#166534' },
    { label: 'Produits actifs',   valeur: produitsActifs?.length ?? 0, emoji: '🥖', bg: '#f5f3ff', color: '#6d28d9' },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1C2B1A', marginBottom: '20px' }}>
        Tableau de bord
      </h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              {s.emoji}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.valeur}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Commandes récentes */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#374151', margin: 0 }}>Dernières commandes</h2>
          <a href="/admin/commandes" style={{ fontSize: '12px', color: '#3B6D11', textDecoration: 'none', fontWeight: 600 }}>
            Voir tout →
          </a>
        </div>

        {commandesRecentes && commandesRecentes.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Client', 'Date retrait', 'Produits', 'Montant', 'Statut'].map(h => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(commandesRecentes as any[]).map((c) => {
                const sm = STATUT_META[c.statut] ?? STATUT_META['en_attente']
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600, color: '#1C2B1A' }}>
                      {c.client?.prenom} {c.client?.nom}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280' }}>
                      {c.date_retrait ? new Date(c.date_retrait).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#6b7280', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.lignes?.map((l: any) => `${l.produit?.nom} ×${l.quantite}`).join(', ') || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontWeight: 700, color: '#1C2B1A' }}>
                      {Number(c.montant_total).toFixed(2)} €
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ padding: '3px 9px', borderRadius: '999px', background: sm.bg, color: sm.color, fontSize: '11px', fontWeight: 600 }}>
                        {sm.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            Aucune commande pour l'instant
          </div>
        )}
      </div>
    </div>
  )
}
