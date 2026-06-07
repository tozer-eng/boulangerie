'use client'
import { Bell, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function AdminHeader({ user }: { user: any }) {
  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-sm text-gray-500">
        Pierre Chantraine — Boulangerie & Pâtisserie
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/client/catalogue"
          target="_blank"
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
        >
          <ExternalLink className="w-3 h-3" />
          Voir la boutique
        </Link>
        <button className="relative p-1 text-gray-500 hover:text-gray-900">
          <Bell className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-full bg-[#7CBF3A] flex items-center justify-center text-xs font-bold text-[#1C2B1A]">
          PC
        </div>
      </div>
    </header>
  )
}
