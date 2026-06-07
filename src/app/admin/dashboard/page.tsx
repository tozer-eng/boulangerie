import { createClient } from '@/lib/supabase/server'
import { Package, Users, ShoppingCart, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ count: nbCommandes }, { count: nbClients }, { data: commandesRecentes }] = await Promise.all([
    supabase.from('commandes').select('*', { count: 'exact', head: true }).eq('statut', 'en_attente'),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('actif', true),
    supabase.from('commandes').select('*, client:clients(nom, prenom), lignes:lignes_commande(*, produit:produits(nom))').order('created_at', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Commandes aujourd\'hui', value: nbCommandes ?? 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Clients actifs', value: nbClients ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'CA ce mois', value: '–', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Produits actifs', value: '–', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-playfair font-semibold text-gray-900">Tableau de bord</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-semibold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Commandes récentes */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Dernières commandes</h2>
        {commandesRecentes && commandesRecentes.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b">
                <th className="pb-2">Client</th>
                <th className="pb-2">Date retrait</th>
                <th className="pb-2">Montant</th>
                <th className="pb-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {commandesRecentes.map((c: any) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 font-medium">{c.client?.prenom} {c.client?.nom}</td>
                  <td className="py-2 text-gray-500">{new Date(c.date_retrait).toLocaleDateString('fr-BE')}</td>
                  <td className="py-2">{c.montant_total.toFixed(2)} €</td>
                  <td className="py-2"><span className="badge-vert">{c.statut}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-sm text-center py-6">Aucune commande récente</p>
        )}
      </div>
    </div>
  )
}
