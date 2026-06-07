'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  Store,
  Clock,
  CreditCard,
  Bell,
  Settings,
  Save,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Parametres = {
  id: string;
  nom_boutique: string;
  slogan: string;
  adresse: string;
  telephone: string;
  email: string;
  site_web: string;
  couleur_principale: string;
  seuil_acompte: number;
  pourcentage_acompte: number;
  heure_blocage_semaine: string;
  heure_blocage_weekend: string;
  livraison_active: boolean;
  frais_livraison: number;
  montant_minimum_livraison: number;
  seuil_gratuite_livraison: number | null;
  email_quotidien_destinataire: string;
  email_quotidien_heure: string;
  updated_at: string | null;
};

type Toast = { message: string; type: 'success' | 'error' } | null;

const TABS = [
  { id: 'boutique', label: 'Boutique', icon: Store },
  { id: 'horaires', label: 'Horaires', icon: Clock },
  { id: 'paiements', label: 'Paiements', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'avance', label: 'Avancé', icon: Settings },
];

const DEFAULTS: Partial<Parametres> = {
  nom_boutique: 'Au Vieux Moulin',
  slogan: '',
  adresse: 'Rue de la Tour Carrée 338, 5300 Vezin',
  telephone: '081/30.25.76',
  email: '',
  site_web: '',
  couleur_principale: '#7CBF3A',
  seuil_acompte: 10.0,
  pourcentage_acompte: 30,
  heure_blocage_semaine: '23:00',
  heure_blocage_weekend: '20:00',
  livraison_active: false,
  frais_livraison: 2.5,
  montant_minimum_livraison: 10.0,
  seuil_gratuite_livraison: null,
  email_quotidien_destinataire: '',
  email_quotidien_heure: '06:00',
};

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState('boutique');
  const [params, setParams] = useState<Parametres | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Extra fields stored locally (not in Supabase schema but kept in state for UX)
  const [mollieKey, setMollieKey] = useState('');
  const [resendKey, setResendKey] = useState('');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('maintenanceMode');
    if (stored === 'true') setMaintenanceMode(true);
  }, []);

  useEffect(() => {
    fetchParams();
  }, []);

  async function fetchParams() {
    setLoading(true);
    const { data, error } = await supabase
      .from('parametres')
      .select('*')
      .single();

    if (error) {
      showToast('Erreur lors du chargement des paramètres', 'error');
    } else if (data) {
      setParams(data as Parametres);
    }
    setLoading(false);
  }

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  function update(field: keyof Parametres, value: string | number | boolean | null) {
    if (!params) return;
    setParams({ ...params, [field]: value });
  }

  async function save(fields: (keyof Parametres)[]) {
    if (!params) return;
    const payload: Partial<Parametres> & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    fields.forEach((f) => {
      (payload as Record<string, unknown>)[f] = params[f];
    });

    const { error } = await supabase
      .from('parametres')
      .update(payload)
      .eq('id', params.id);

    if (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
    } else {
      showToast('Paramètres enregistrés avec succès', 'success');
    }
  }

  async function resetDefaults() {
    if (!params) return;
    const confirmed = confirm(
      'Voulez-vous vraiment réinitialiser tous les paramètres par défaut ? Cette action est irréversible.'
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from('parametres')
      .update({ ...DEFAULTS, updated_at: new Date().toISOString() })
      .eq('id', params.id);

    if (error) {
      showToast('Erreur lors de la réinitialisation', 'error');
    } else {
      showToast('Paramètres réinitialisés', 'success');
      fetchParams();
    }
  }

  function toggleMaintenance() {
    const next = !maintenanceMode;
    setMaintenanceMode(next);
    localStorage.setItem('maintenanceMode', String(next));
  }

  // ─── Styles ────────────────────────────────────────────────────────────────

  const colors = {
    night: '#1C2B1A',
    vivid: '#7CBF3A',
    dark: '#3B6D11',
    cream: '#F5F0E8',
  };

  const s = {
    page: {
      minHeight: '100vh',
      backgroundColor: colors.cream,
      padding: '32px 24px',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    } as React.CSSProperties,

    heading: {
      color: colors.night,
      fontSize: '28px',
      fontWeight: 700,
      marginBottom: '8px',
    } as React.CSSProperties,

    subheading: {
      color: '#5a6b58',
      fontSize: '14px',
      marginBottom: '32px',
    } as React.CSSProperties,

    tabBar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '28px',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,

    tabBtn: (active: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '9px 18px',
      borderRadius: '999px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600,
      transition: 'all 0.2s',
      backgroundColor: active ? colors.vivid : '#e8e2d8',
      color: active ? '#fff' : colors.night,
      boxShadow: active ? '0 2px 8px rgba(124,191,58,0.35)' : 'none',
    }),

    card: {
      backgroundColor: '#fff',
      borderRadius: '16px',
      padding: '32px',
      boxShadow: '0 2px 12px rgba(28,43,26,0.08)',
      maxWidth: '680px',
    } as React.CSSProperties,

    sectionTitle: {
      color: colors.night,
      fontSize: '18px',
      fontWeight: 700,
      marginBottom: '20px',
      paddingBottom: '12px',
      borderBottom: `2px solid ${colors.cream}`,
    } as React.CSSProperties,

    label: {
      display: 'block',
      color: colors.dark,
      fontSize: '13px',
      fontWeight: 600,
      marginBottom: '5px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
    } as React.CSSProperties,

    input: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: `1.5px solid #d6cfbf`,
      backgroundColor: '#faf8f4',
      fontSize: '15px',
      color: colors.night,
      outline: 'none',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.15s',
    } as React.CSSProperties,

    fieldGroup: {
      marginBottom: '18px',
    } as React.CSSProperties,

    hint: {
      color: '#8a9e86',
      fontSize: '12px',
      marginTop: '4px',
    } as React.CSSProperties,

    saveBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '24px',
      padding: '11px 24px',
      backgroundColor: colors.vivid,
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(124,191,58,0.3)',
    } as React.CSSProperties,

    dangerBtn: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '16px',
      padding: '11px 24px',
      backgroundColor: '#e53935',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: 700,
      cursor: 'pointer',
    } as React.CSSProperties,

    infoBox: {
      backgroundColor: '#f0f7e8',
      border: `1.5px solid ${colors.vivid}`,
      borderRadius: '10px',
      padding: '14px 18px',
      marginBottom: '20px',
      fontSize: '14px',
      color: colors.dark,
      lineHeight: 1.6,
    } as React.CSSProperties,

    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: '1px solid #ece7dc',
    } as React.CSSProperties,

    toggleLabel: {
      fontSize: '15px',
      fontWeight: 600,
      color: colors.night,
    } as React.CSSProperties,

    toggleDesc: {
      fontSize: '13px',
      color: '#7a8c78',
      marginTop: '2px',
    } as React.CSSProperties,

    toggleBtn: (active: boolean): React.CSSProperties => ({
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: active ? colors.vivid : '#b0a898',
      padding: 0,
    }),

    toast: (type: 'success' | 'error'): React.CSSProperties => ({
      position: 'fixed',
      bottom: '28px',
      right: '28px',
      padding: '14px 22px',
      borderRadius: '10px',
      backgroundColor: type === 'success' ? colors.vivid : '#e53935',
      color: '#fff',
      fontWeight: 600,
      fontSize: '14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      zIndex: 9999,
      animation: 'slideUp 0.3s ease',
    }),

    row2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    } as React.CSSProperties,
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: colors.dark, fontSize: '16px' }}>Chargement des paramètres…</div>
      </div>
    );
  }

  if (!params) {
    return (
      <div style={s.page}>
        <p style={{ color: '#e53935' }}>
          Impossible de charger les paramètres. Vérifiez que la table{' '}
          <code>parametres</code> contient une ligne.
        </p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <h1 style={s.heading}>Paramètres</h1>
      <p style={s.subheading}>Configuration générale de la boulangerie Au Vieux Moulin</p>

      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            style={s.tabBtn(activeTab === id)}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Onglet Boutique ─────────────────────────────────────────────────── */}
      {activeTab === 'boutique' && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Informations de la boutique</h2>

          <div style={s.fieldGroup}>
            <label style={s.label}>Nom de la boutique</label>
            <input
              style={s.input}
              value={params.nom_boutique ?? ''}
              onChange={(e) => update('nom_boutique', e.target.value)}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Slogan</label>
            <input
              style={s.input}
              value={params.slogan ?? ''}
              onChange={(e) => update('slogan', e.target.value)}
              placeholder="Ex. : Artisan boulanger depuis 1985"
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Adresse</label>
            <input
              style={s.input}
              value={params.adresse ?? ''}
              onChange={(e) => update('adresse', e.target.value)}
            />
          </div>

          <div style={s.row2}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Téléphone</label>
              <input
                style={s.input}
                value={params.telephone ?? ''}
                onChange={(e) => update('telephone', e.target.value)}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Email</label>
              <input
                style={s.input}
                type="email"
                value={params.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Site web</label>
            <input
              style={s.input}
              value={params.site_web ?? ''}
              onChange={(e) => update('site_web', e.target.value)}
              placeholder="https://"
            />
          </div>

          <button
            style={s.saveBtn}
            onClick={() =>
              save(['nom_boutique', 'slogan', 'adresse', 'telephone', 'email', 'site_web'])
            }
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      )}

      {/* ── Onglet Horaires ─────────────────────────────────────────────────── */}
      {activeTab === 'horaires' && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Horaires de blocage des commandes</h2>

          <div style={s.infoBox}>
            Les clients ne peuvent plus commander après ces heures pour le lendemain. Par exemple,
            si le blocage semaine est à 23h00, une commande passée après 23h00 le lundi sera
            automatiquement repoussée au surlendemain.
          </div>

          <div style={s.row2}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Lundi – Jeudi</label>
              <input
                style={s.input}
                type="time"
                value={params.heure_blocage_semaine ?? '23:00'}
                onChange={(e) => update('heure_blocage_semaine', e.target.value)}
              />
              <p style={s.hint}>Heure max de commande pour le lendemain (jours de semaine)</p>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Vendredi – Samedi</label>
              <input
                style={s.input}
                type="time"
                value={params.heure_blocage_weekend ?? '20:00'}
                onChange={(e) => update('heure_blocage_weekend', e.target.value)}
              />
              <p style={s.hint}>Heure max de commande pour le lendemain (week-end)</p>
            </div>
          </div>

          <button
            style={s.saveBtn}
            onClick={() => save(['heure_blocage_semaine', 'heure_blocage_weekend'])}
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      )}

      {/* ── Onglet Paiements ────────────────────────────────────────────────── */}
      {activeTab === 'paiements' && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Règles de paiement & acomptes</h2>

          <div style={s.infoBox}>
            <strong>Règles automatiques :</strong>
            <br />• Nouveau client → 100 % en ligne obligatoire
            <br />• Client vérifié → choix du mode de paiement
            <br />• Commande supérieure au seuil → acompte requis
          </div>

          <div style={s.row2}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Seuil d'acompte (€)</label>
              <input
                style={s.input}
                type="number"
                min="0"
                step="0.5"
                value={params.seuil_acompte ?? 10}
                onChange={(e) => update('seuil_acompte', parseFloat(e.target.value))}
              />
              <p style={s.hint}>Au-dessus de ce montant, un acompte sera demandé</p>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Pourcentage d'acompte (%)</label>
              <input
                style={s.input}
                type="number"
                min="1"
                max="100"
                value={params.pourcentage_acompte ?? 30}
                onChange={(e) => update('pourcentage_acompte', parseInt(e.target.value))}
              />
              <p style={s.hint}>Part du total exigée à la commande</p>
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Clé API Mollie</label>
            <input
              style={s.input}
              type="password"
              value={mollieKey}
              onChange={(e) => setMollieKey(e.target.value)}
              placeholder="live_xxxxxxxxxxxxxxxxxxxx"
            />
            <p style={s.hint}>Clé de production Mollie pour les paiements en ligne</p>
          </div>

          <button
            style={s.saveBtn}
            onClick={() => save(['seuil_acompte', 'pourcentage_acompte'])}
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      )}

      {/* ── Onglet Notifications ────────────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Notifications & emails quotidiens</h2>

          <div style={s.row2}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Destinataire email quotidien</label>
              <input
                style={s.input}
                type="email"
                value={params.email_quotidien_destinataire ?? ''}
                onChange={(e) => update('email_quotidien_destinataire', e.target.value)}
                placeholder="boulangerie@example.com"
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Heure d'envoi</label>
              <input
                style={s.input}
                type="time"
                value={params.email_quotidien_heure ?? '06:00'}
                onChange={(e) => update('email_quotidien_heure', e.target.value)}
              />
              <p style={s.hint}>Récapitulatif des commandes du jour</p>
            </div>
          </div>

          <h3
            style={{
              ...s.sectionTitle,
              fontSize: '15px',
              marginTop: '24px',
              marginBottom: '16px',
            }}
          >
            Clés API
          </h3>

          <div style={s.fieldGroup}>
            <label style={s.label}>Clé API Resend (emails)</label>
            <input
              style={s.input}
              type="password"
              value={resendKey}
              onChange={(e) => setResendKey(e.target.value)}
              placeholder="re_xxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Twilio Account SID</label>
            <input
              style={s.input}
              type="password"
              value={twilioSid}
              onChange={(e) => setTwilioSid(e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Twilio Auth Token</label>
            <input
              style={s.input}
              type="password"
              value={twilioToken}
              onChange={(e) => setTwilioToken(e.target.value)}
              placeholder="••••••••••••••••••••••••••••••••"
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Numéro expéditeur Twilio</label>
            <input
              style={s.input}
              value={twilioNumber}
              onChange={(e) => setTwilioNumber(e.target.value)}
              placeholder="+32XXXXXXXXX"
            />
          </div>

          <button
            style={s.saveBtn}
            onClick={() => save(['email_quotidien_destinataire', 'email_quotidien_heure'])}
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      )}

      {/* ── Onglet Avancé ───────────────────────────────────────────────────── */}
      {activeTab === 'avance' && (
        <div style={s.card}>
          <h2 style={s.sectionTitle}>Paramètres avancés</h2>

          <div style={s.toggleRow}>
            <div>
              <div style={s.toggleLabel}>Mode maintenance</div>
              <div style={s.toggleDesc}>
                Affiche une page de maintenance aux visiteurs. Les admins restent connectés.
              </div>
            </div>
            <button style={s.toggleBtn(maintenanceMode)} onClick={toggleMaintenance}>
              {maintenanceMode ? (
                <ToggleRight size={40} />
              ) : (
                <ToggleLeft size={40} />
              )}
            </button>
          </div>

          <p
            style={{
              marginTop: '10px',
              fontSize: '13px',
              color: maintenanceMode ? '#e53935' : '#8a9e86',
              fontWeight: maintenanceMode ? 600 : 400,
            }}
          >
            {maintenanceMode
              ? 'Mode maintenance ACTIF — le site est inaccessible aux visiteurs.'
              : 'Mode maintenance désactivé — le site est accessible normalement.'}
          </p>

          <div
            style={{
              marginTop: '36px',
              padding: '20px',
              backgroundColor: '#fff5f5',
              border: '1.5px solid #ffcdd2',
              borderRadius: '12px',
            }}
          >
            <h3
              style={{ color: '#c62828', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}
            >
              Zone de danger
            </h3>
            <p style={{ color: '#7a4040', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
              La réinitialisation remet tous les paramètres à leurs valeurs par défaut. Cette
              opération est irréversible.
            </p>
            <button style={s.dangerBtn} onClick={resetDefaults}>
              <RefreshCw size={16} />
              Réinitialiser les paramètres par défaut
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={s.toast(toast.type)}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(0.4);
        }
      `}</style>
    </div>
  );
}
