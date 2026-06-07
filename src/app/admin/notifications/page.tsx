'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bell,
  ShoppingBag,
  Clock,
  UserPlus,
  CreditCard,
  XCircle,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Save,
  Wifi,
  WifiOff,
  ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string
  type: string
  titre: string
  message: string
  envoye_email: boolean
  envoye_sms: boolean
  statut: 'envoye' | 'echec' | 'en_attente'
  created_at: string
}

type Parametres = {
  email_quotidien_destinataire?: string
  email_quotidien_heure?: string
  resend_api_key?: string
  twilio_account_sid?: string
}

type AlertePrefs = {
  [type: string]: { email: boolean; sms: boolean }
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COULEURS = {
  vertNuit: '#1C2B1A',
  vertVif: '#7CBF3A',
  vertFonce: '#3B6D11',
}

const TYPES_ALERTES = [
  { type: 'nouvelle_commande', label: 'Nouvelle commande', icone: ShoppingBag },
  { type: 'commande_non_recuperee', label: 'Commande non récupérée', icone: Clock },
  { type: 'nouveau_client', label: 'Nouveau client inscrit', icone: UserPlus },
  { type: 'paiement_recu', label: 'Paiement reçu', icone: CreditCard },
  { type: 'commande_annulee', label: 'Commande annulée', icone: XCircle },
]

const PREFS_DEFAULT: AlertePrefs = {
  nouvelle_commande:      { email: true,  sms: false },
  commande_non_recuperee: { email: true,  sms: true  },
  nouveau_client:         { email: false, sms: false },
  paiement_recu:          { email: true,  sms: false },
  commande_annulee:       { email: true,  sms: true  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `il y a ${h} h`
  const j = Math.floor(h / 24)
  if (j < 7)    return `il y a ${j} j`
  return new Date(iso).toLocaleDateString('fr-FR')
}

function iconeType(type: string) {
  const entry = TYPES_ALERTES.find(t => t.type === type)
  return entry ? entry.icone : Bell
}

function couleurStatut(statut: string): { bg: string; color: string } {
  switch (statut) {
    case 'envoye':     return { bg: '#dcfce7', color: '#166534' }
    case 'echec':      return { bg: '#fee2e2', color: '#991b1b' }
    case 'en_attente': return { bg: '#fef9c3', color: '#854d0e' }
    default:           return { bg: '#f3f4f6', color: '#6b7280' }
  }
}

function labelStatut(statut: string): string {
  switch (statut) {
    case 'envoye':     return 'Envoyé'
    case 'echec':      return 'Échec'
    case 'en_attente': return 'En attente'
    default:           return statut
  }
}

// ─── Composant Toggle ─────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: 44,
        height: 24,
        borderRadius: 12,
        background: value ? COULEURS.vertVif : '#d1d5db',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
      aria-checked={value}
      role="switch"
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: value ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const supabase = createClient()

  // Historique
  const [notifications, setNotifications]   = useState<Notification[]>([])
  const [loadingNotifs, setLoadingNotifs]   = useState(true)
  const [filtre, setFiltre]                 = useState<string>('tous')
  const [marquageCours, setMarquageCours]   = useState(false)

  // Préférences alertes (localStorage)
  const [prefs, setPrefs] = useState<AlertePrefs>(PREFS_DEFAULT)

  // Email quotidien
  const [emailActif, setEmailActif]           = useState(false)
  const [emailHeure, setEmailHeure]           = useState('06:00')
  const [emailDest, setEmailDest]             = useState('')
  const [savingEmail, setSavingEmail]         = useState(false)
  const [saveEmailMsg, setSaveEmailMsg]       = useState('')

  // Paramètres intégrations
  const [parametres, setParametres]           = useState<Parametres>({})
  const [loadingParams, setLoadingParams]     = useState(true)

  // ── Chargement initial ──────────────────────────────────────────────────────

  useEffect(() => {
    chargerNotifications()
    chargerParametres()
    chargerPrefsLocales()
  }, [])

  async function chargerNotifications() {
    setLoadingNotifs(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data ?? [])
    setLoadingNotifs(false)
  }

  async function chargerParametres() {
    setLoadingParams(true)
    const { data } = await supabase
      .from('parametres')
      .select('email_quotidien_destinataire, email_quotidien_heure, resend_api_key, twilio_account_sid')
      .single()
    if (data) {
      setParametres(data)
      setEmailDest(data.email_quotidien_destinataire ?? '')
      setEmailHeure(data.email_quotidien_heure ?? '06:00')
      setEmailActif(!!(data.email_quotidien_destinataire))
    }
    setLoadingParams(false)
  }

  function chargerPrefsLocales() {
    try {
      const raw = localStorage.getItem('notif_prefs')
      if (raw) setPrefs({ ...PREFS_DEFAULT, ...JSON.parse(raw) })
    } catch {}
  }

  // ── Filtrage ────────────────────────────────────────────────────────────────

  const notifsFiltrees = notifications.filter(n => {
    if (filtre === 'tous')       return true
    if (filtre === 'en_attente') return n.statut === 'en_attente'
    if (filtre === 'envoye')     return n.statut === 'envoye'
    if (filtre === 'echec')      return n.statut === 'echec'
    return true
  })

  // ── Marquer tout ────────────────────────────────────────────────────────────

  async function marquerToutEnvoye() {
    setMarquageCours(true)
    await supabase
      .from('notifications')
      .update({ statut: 'envoye' })
      .eq('statut', 'en_attente')
    await chargerNotifications()
    setMarquageCours(false)
  }

  // ── Préférences toggles ─────────────────────────────────────────────────────

  function updatePref(type: string, canal: 'email' | 'sms', val: boolean) {
    setPrefs(prev => {
      const next = { ...prev, [type]: { ...prev[type], [canal]: val } }
      try { localStorage.setItem('notif_prefs', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // ── Enregistrer email quotidien ──────────────────────────────────────────────

  async function enregistrerEmail() {
    setSavingEmail(true)
    setSaveEmailMsg('')
    const { error } = await supabase
      .from('parametres')
      .update({
        email_quotidien_destinataire: emailActif ? emailDest : '',
        email_quotidien_heure: emailHeure,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000') // update all rows (single-row table)
    if (error) {
      setSaveEmailMsg('Erreur lors de l\'enregistrement.')
    } else {
      setSaveEmailMsg('Enregistré avec succès.')
    }
    setSavingEmail(false)
    setTimeout(() => setSaveEmailMsg(''), 3000)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Bell size={28} color={COULEURS.vertVif} />
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: COULEURS.vertNuit }}>
            Notifications
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>
            Alertes, configuration et intégrations email / SMS
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — Historique des alertes
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: 28,
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: COULEURS.vertNuit }}>
            Historique des alertes
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filtres */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { val: 'tous',       label: 'Tous' },
                { val: 'en_attente', label: 'En attente' },
                { val: 'envoye',     label: 'Envoyés' },
                { val: 'echec',      label: 'Échec' },
              ].map(f => (
                <button
                  key={f.val}
                  onClick={() => setFiltre(f.val)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: `1px solid ${filtre === f.val ? COULEURS.vertVif : '#d1d5db'}`,
                    background: filtre === f.val ? COULEURS.vertVif : '#fff',
                    color: filtre === f.val ? '#fff' : '#374151',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: filtre === f.val ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Rafraîchir */}
            <button
              onClick={chargerNotifications}
              disabled={loadingNotifs}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} style={{ animation: loadingNotifs ? 'spin 1s linear infinite' : 'none' }} />
              Actualiser
            </button>

            {/* Marquer tout */}
            <button
              onClick={marquerToutEnvoye}
              disabled={marquageCours}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 14px',
                borderRadius: 8,
                border: 'none',
                background: COULEURS.vertFonce,
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <CheckCircle size={14} />
              Marquer tout comme envoyé
            </button>
          </div>
        </div>

        {/* Liste notifications */}
        {loadingNotifs ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            Chargement…
          </div>
        ) : notifsFiltrees.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            Aucune notification pour ce filtre.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {notifsFiltrees.map((n, i) => {
              const Icone = iconeType(n.type)
              const sc    = couleurStatut(n.statut)
              return (
                <li
                  key={n.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                    padding: '14px 24px',
                    borderBottom: i < notifsFiltrees.length - 1 ? '1px solid #f5f5f5' : 'none',
                    background: n.statut === 'en_attente' ? '#fffdf0' : '#fff',
                  }}
                >
                  {/* Icône type */}
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#f0fdf4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icone size={18} color={COULEURS.vertFonce} />
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: COULEURS.vertNuit }}>
                        {n.titre}
                      </span>
                      {/* Badges canaux */}
                      {n.envoye_email && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: '#dbeafe', color: '#1e40af',
                          borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                        }}>
                          <Mail size={10} /> Email
                        </span>
                      )}
                      {n.envoye_sms && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          background: '#fdf4ff', color: '#7c3aed',
                          borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                        }}>
                          <MessageSquare size={10} /> SMS
                        </span>
                      )}
                      {/* Statut */}
                      <span style={{
                        background: sc.bg, color: sc.color,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>
                        {labelStatut(n.statut)}
                      </span>
                    </div>
                    <p style={{
                      margin: '3px 0 0',
                      fontSize: 13,
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 520,
                    }}>
                      {n.message}
                    </p>
                  </div>

                  {/* Date relative */}
                  <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, marginTop: 2 }}>
                    {dateRelative(n.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — Configuration des alertes
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: 28,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: COULEURS.vertNuit }}>
            Configuration des alertes
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Choisissez les canaux de notification pour chaque type d'événement.
            Ces préférences sont sauvegardées localement.
          </p>
        </div>

        {/* En-têtes colonnes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 90px',
          padding: '10px 24px',
          background: '#f9fafb',
          borderBottom: '1px solid #f0f0f0',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Événement
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
            Email
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
            SMS
          </span>
        </div>

        {TYPES_ALERTES.map((alerte, i) => {
          const Icone = alerte.icone
          const pref  = prefs[alerte.type] ?? { email: false, sms: false }
          return (
            <div
              key={alerte.type}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 90px',
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: i < TYPES_ALERTES.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icone size={16} color={COULEURS.vertFonce} />
                <span style={{ fontSize: 14, color: COULEURS.vertNuit, fontWeight: 500 }}>
                  {alerte.label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Toggle
                  value={pref.email}
                  onChange={v => updatePref(alerte.type, 'email', v)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Toggle
                  value={pref.sms}
                  onChange={v => updatePref(alerte.type, 'sms', v)}
                />
              </div>
            </div>
          )
        })}
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3 — Email quotidien récapitulatif
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: 28,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: COULEURS.vertNuit }}>
            Email quotidien récapitulatif
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Recevez chaque matin un résumé des commandes et activités de la journée.
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Toggle activer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: '#f9fafb',
            borderRadius: 10,
            marginBottom: 20,
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: COULEURS.vertNuit }}>
                Activer l'email quotidien
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Envoie un récapitulatif automatique chaque matin
              </div>
            </div>
            <Toggle value={emailActif} onChange={setEmailActif} />
          </div>

          {/* Champs config */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            opacity: emailActif ? 1 : 0.45,
            pointerEvents: emailActif ? 'auto' : 'none',
            marginBottom: 20,
          }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email destinataire
              </label>
              <input
                type="email"
                value={emailDest}
                onChange={e => setEmailDest(e.target.value)}
                placeholder="boulangerie@exemple.fr"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  color: COULEURS.vertNuit,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Heure d'envoi
              </label>
              <input
                type="time"
                value={emailHeure}
                onChange={e => setEmailHeure(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  color: COULEURS.vertNuit,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Bouton enregistrer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={enregistrerEmail}
              disabled={savingEmail}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: COULEURS.vertVif,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                opacity: savingEmail ? 0.7 : 1,
              }}
            >
              <Save size={15} />
              {savingEmail ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saveEmailMsg && (
              <span style={{
                fontSize: 13,
                color: saveEmailMsg.includes('Erreur') ? '#dc2626' : '#16a34a',
                fontWeight: 500,
              }}>
                {saveEmailMsg}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4 — État des intégrations
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: COULEURS.vertNuit }}>
            État des intégrations
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Vérifiez que vos services d'envoi sont bien configurés.
          </p>
        </div>

        {loadingParams ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>Chargement…</div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Resend */}
            <IntegrationCard
              nom="Resend"
              description="Service d'envoi d'emails transactionnels"
              configure={!!(parametres.resend_api_key)}
            />

            {/* Twilio */}
            <IntegrationCard
              nom="Twilio"
              description="Service d'envoi de SMS"
              configure={!!(parametres.twilio_account_sid)}
            />
          </div>
        )}
      </section>

      {/* Keyframe spin pour le bouton actualiser */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Sous-composant carte intégration ─────────────────────────────────────────

function IntegrationCard({ nom, description, configure }: {
  nom: string
  description: string
  configure: boolean
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderRadius: 10,
      border: `1px solid ${configure ? '#bbf7d0' : '#f3f4f6'}`,
      background: configure ? '#f0fdf4' : '#fafafa',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {configure
          ? <Wifi size={22} color="#16a34a" />
          : <WifiOff size={22} color="#9ca3af" />
        }
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1C2B1A' }}>{nom}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{description}</div>
        </div>
      </div>

      {configure ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#dcfce7', color: '#16a34a',
          borderRadius: 8, padding: '6px 14px',
          fontWeight: 600, fontSize: 13,
        }}>
          <CheckCircle size={14} />
          Configuré
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#fee2e2', color: '#dc2626',
          borderRadius: 8, padding: '6px 14px',
          fontWeight: 600, fontSize: 13,
        }}>
          <AlertCircle size={14} />
          Non configuré — aller dans Paramètres
        </div>
      )}
    </div>
  )
}
