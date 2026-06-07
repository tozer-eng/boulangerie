import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AdminSidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ height: '48px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Pierre Chantraine — Boulangerie & Pâtisserie</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a href="/client/catalogue" target="_blank" style={{ fontSize: '12px', color: '#6b7280', textDecoration: 'none' }}>
              🔗 Voir la boutique
            </a>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#7CBF3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: '#1C2B1A' }}>
              PC
            </div>
          </div>
        </header>
        {/* Contenu principal */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}