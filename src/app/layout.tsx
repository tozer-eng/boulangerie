import type { Metadata } from 'next'
import { Playfair_Display, Lato } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-lato',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Au Vieux Moulin — Pierre Chantraine',
  description: 'Boulangerie & Pâtisserie artisanale à Vezin. Commandez en ligne, récupérez en boutique.',
  keywords: 'boulangerie, pâtisserie, Vezin, Namur, artisanal, commande en ligne',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${playfair.variable} ${lato.variable}`}>
      <body className="font-lato antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
