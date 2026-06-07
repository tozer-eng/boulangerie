'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { section: 'Tableau de bord', items: [
    { href: '/admin/dashboard', label: '🏠 Accueil' },
  ]},
  { section: 'Gestion', items: [
    { href: '/admin/produits', label: '🥖 Produits' },
    { href: '/admin/ingredients', label: '🌿 Ingrédients' },
    { href: '/admin/calendrier', label: '📅 Calendrier' },
    { href: '/admin/preparation', label: '✅ Préparation' },
    { href: '/admin/production', label: '🔧 Production' },
  ]},
  { section: 'Clients', items: [
    { href: '/admin/clients', label: '👥 Clients' },
    { href: '/admin/commandes', label: '🛒 Commandes' },
    { href: '/admin/paiements', label: '💳 Paiements' },
  ]},
  { section: 'Livraison & Stats', items: [
    { href: '/admin/livraison', label: '🚚 Livraison' },
    { href: '/admin/statistiques', label: '📊 Statistiques' },
  ]},
  { section: 'Système', items: [
    { href: '/admin/notifications', label: '🔔 Notifications' },
    { href: '/admin/parametres', label: '⚙️ Paramètres' },
  ]},
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside style={{ width: '200px', backgroundColor: '#f3f4f6', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: '13px', fontWeight: '600', color: '#111827', margin: 0 }}>Au Vieux Moulin</p>
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>Administration</p>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {navItems.map((group) => (
          <div key={group.section}>
            <p style={{ padding: '8px 14px 2px', fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              {group.section}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    fontSize: '12px',
                    color: active ? '#111827' : '#4b5563',
                    backgroundColor: active ? 'white' : 'transparent',
                    fontWeight: active ? '500' : 'normal',
                    textDecoration: 'none',
                    borderLeft: active ? '2px solid #1C2B1A' : '2px solid transparent',
                    margin: '1px 4px',
                    borderRadius: '4px',
                  }}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px' }}>
        <form action="/auth/signout" method="POST">
          <button type="submit" style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '6px 10px', fontSize: '12px', color: '#4b5563', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
            🚪 Déconnexion
          </button>
        </form>
      </div>
    </aside>
  )
}