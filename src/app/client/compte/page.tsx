'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ComptePage() {
  const [client, setClient] = useState<any>(null)
  const [commandes, setCommandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    chargerCompte()
  }, [])

  async function chargerCompte() {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      router.push('/client/auth/connexion')
      return
    }

    // Chercher le client par user_id
    let { data: clientData } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Si pas trouvé par user_id, chercher par email et lier
    if (!clientData) {
      const { data: clientParEmail } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user.email!)
        .single()

      if (clientParEmail) {
        await supabase
          .from('clients')
          .update({ user_id: user.id })
          .eq('id', clientParEmail.id)
        clientData = { ...clientParEmail, user_id: user.id }
      } else {
        // Créer la fiche client si elle n'existe pas
        const { data: nouveau } = await supabase
          .from('clients')
          .insert({
            user_id: user.id,
            nom: user.user_metadata?.nom ?? '',
            prenom: user.user_metadata?.prenom ?? '',
            email: user.email!,
            telephone: user.user_metadata?.telephone ?? '',
            statut: 'nouveau',
            actif: true,
          })
          .select('*')
          .single()
        clientData = nouveau
      }
    }

    if (!clientData) {
      router.push('/client/auth/connexion')
      return
    }

    const { data: commandesData } = await supabase
      .from('commandes')
      .select('*, lignes:lignes_commande(*, produit:produits(nom))')
      .eq('client_id', clientData.id)
      .order('created_at', { ascending: false })

    setClient(clientData)
    setCommandes(commandesData ?? [])
    setLoading(false)
  }

  async function seDeconnecter() {
    await supabase.auth.signOut()
    window.location.href = '/client/catalogue'
  }

  async function suspendreCommande(commandeId: string, semaine: string) {
    const commande = commandes.find(c => c.id === commandeId)
    const semaines = commande?.semaines_suspendues ?? []
    const nouvelles = semaines.includes(semaine)
      ? semaines.filter((s: string) => s !== semaine)
      : [...semaines, semaine]
    await supabase.from('commandes').update({ semaines_suspendues: nouvelles }).eq('id', commandeId)
    chargerCompte()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
      Chargement...
    </div>
  )

  if (!client) return (
    <div style={{ textAlign: 'center', padding: '60px' }}>
      <Link href="/client/auth/connexion" style={{ color: '#3B6D11' }}>
        Se connecter
      </Link>
    </div>
  )

  const commandesRecurrentes = commandes.filter(c => c.type === 'recurrente' && c.statut !== 'annulee')
  const commandesPonctuelles = commandes.filter(c => c.type === 'ponctuelle')

  const semaines = Array.from({ length: 4 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + (i + 1) * 7)
    const debut = new Date(d)
    debut.setDate(d.getDate() - d.getDay() + 1)
    const fin = new Date(debut)
    fin.setDate(debut.getDate() + 6)
    const cle = `S${Math.ceil(d.getDate() / 7)}-${d.getMonth() + 1}`
    return {
      cle,
      label: `${debut.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} – ${fin.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}`
    }
  })

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', color: '#1C2B1A', margin: '0 0 2px' }}>
            Bonjour {client.prenom || 'vous'} !
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{client.email}</p>
        </div>
        <button onClick={seDeconnecter}
          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>
          Déconnexion
        </button>
      </div>

      {/* Informations manquantes */}
      {(!client.prenom || !client.telephone) && (
        <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: '#854d0e' }}>
          ⚠️ Complétez votre profil pour faciliter vos commandes.
          <CompleterProfil client={client} supabase={supabase} onSave={chargerCompte} />
        </div>
      )}

      {/* Commandes récurrentes */}
      {commandesRecurrentes.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
            🔄 Mes commandes récurrentes
          </h2>
          {commandesRecurrentes.map(c => (
            <div key={c.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  {c.lignes?.map((l: any) => (
                    <div key={l.id} style={{ fontSize: '13px', color: '#374151' }}>
                      {l.produit?.nom} ×{l.quantite}
                    </div>
                  ))}
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#3B6D11', marginTop: '4px' }}>
                    {Number(c.montant_total).toFixed(2)} € / semaine
                  </div>
                </div>
                <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', height: 'fit-content', backgroundColor: c.recurence_validee ? '#dcfce7' : '#fef9c3', color: c.recurence_validee ? '#166534' : '#854d0e' }}>
                  {c.recurence_validee ? '✓ Active' : '⏳ En attente'}
                </span>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Suspendre pour :</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {semaines.map(s => {
                    const suspendue = c.semaines_suspendues?.includes(s.cle)
                    return (
                      <button key={s.cle} onClick={() => suspendreCommande(c.id, s.cle)}
                        style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '11px', border: '1px solid', cursor: 'pointer', backgroundColor: suspendue ? '#fee2e2' : 'white', borderColor: suspendue ? '#f87171' : '#d1d5db', color: suspendue ? '#991b1b' : '#6b7280' }}>
                        {suspendue ? '✕ ' : ''}{s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historique */}
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
          📋 Historique des commandes
        </h2>
        {commandes.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '30px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ fontSize: '30px', marginBottom: '8px' }}>🛒</p>
            <p style={{ margin: '0 0 12px' }}>Vous n'avez pas encore commandé</p>
            <Link href="/client/catalogue"
              style={{ backgroundColor: '#7CBF3A', color: '#1C2B1A', padding: '8px 18px', borderRadius: '8px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}>
              Commander maintenant
            </Link>
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {commandesPonctuelles.map((c, i) => (
              <div key={c.id} style={{ padding: '14px 16px', borderBottom: i < commandesPonctuelles.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                    Retrait le {new Date(c.date_retrait).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>
                    {Number(c.montant_total).toFixed(2)} €
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {c.lignes?.map((l: any) => `${l.produit?.nom} ×${l.quantite}`).join(', ')}
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: c.statut === 'recuperee' ? '#dcfce7' : '#f3f4f6', color: c.statut === 'recuperee' ? '#166534' : '#6b7280' }}>
                    {c.statut.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lien commander */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Link href="/client/catalogue"
          style={{ display: 'inline-block', backgroundColor: '#1C2B1A', color: '#7CBF3A', padding: '12px 28px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' }}>
          🥖 Passer une commande
        </Link>
      </div>
    </div>
  )
}

// Composant pour compléter le profil
function CompleterProfil({ client, supabase, onSave }: any) {
  const [prenom, setPrenom] = useState(client.prenom ?? '')
  const [nom, setNom] = useState(client.nom ?? '')
  const [telephone, setTelephone] = useState(client.telephone ?? '')
  const [ouvert, setOuvert] = useState(false)

  async function sauvegarder() {
    await supabase.from('clients').update({ prenom, nom, telephone }).eq('id', client.id)
    setOuvert(false)
    onSave()
  }

  if (!ouvert) return (
    <button onClick={() => setOuvert(true)}
      style={{ display: 'block', marginTop: '8px', color: '#854d0e', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
      Compléter mon profil →
    </button>
  )

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom"
        style={{ border: '1px solid #fbbf24', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }} />
      <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom"
        style={{ border: '1px solid #fbbf24', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }} />
      <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Téléphone"
        style={{ border: '1px solid #fbbf24', borderRadius: '6px', padding: '6px 10px', fontSize: '13px' }} />
      <button onClick={sauvegarder}
        style={{ backgroundColor: '#1C2B1A', color: '#7CBF3A', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
        Sauvegarder
      </button>
    </div>
  )
}