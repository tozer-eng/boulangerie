import ClientHeader from '@/components/client/ClientHeader'
import ClientFooter from '@/components/client/ClientFooter'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F0E8]">
      <ClientHeader />
      <main className="flex-1">{children}</main>
      <ClientFooter />
    </div>
  )
}
