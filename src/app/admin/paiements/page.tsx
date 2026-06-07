'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  CreditCard,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  Info,
} from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const COLORS = {
  vertNuit: '#1C2B1A',
  vertVif: '#7CBF3A',
  vertFonce: '#3B6D11',
  white: '#FFFFFF',
  grayLight: '#F3F4F6',
  grayBorder: '#E5E7EB',
  grayText: '#6B7280',
};

const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  succes: { bg: '#dcfce7', color: '#166534', label: 'Succès' },
  echec: { bg: '#fee2e2', color: '#991b1b', label: 'Échec' },
  en_attente: { bg: '#fef9c3', color: '#854d0e', label: 'En attente' },
};

const TYPE_LABELS: Record<string, string> = {
  acompte: 'Acompte',
  solde: 'Solde',
  total: 'Total',
  remboursement: 'Remboursement',
};

const MODE_LABELS: Record<string, string> = {
  en_ligne: 'En ligne',
  en_magasin: 'En magasin',
};

interface Transaction {
  id: string;
  commande_id: string;
  montant: number;
  type: string;
  statut: string;
  reference_mollie: string | null;
  created_at: string;
  commandes: {
    clients: {
      nom: string;
      prenom: string;
    } | null;
  } | null;
}

interface CommandeEnAttente {
  id: string;
  montant_total: number;
  montant_acompte: number | null;
  statut_paiement: string;
  mode_paiement: string;
  date_retrait: string;
  type: string;
  clients: {
    nom: string;
    prenom: string;
    email: string;
  } | null;
}

interface Parametres {
  seuil_acompte: number;
  pourcentage_acompte: number;
}

interface KPIs {
  totalEncaisse: number;
  paiementsEnAttente: number;
  acomptesEnAttente: number;
}

type FiltreStatut = 'tous' | 'succes' | 'en_attente' | 'echec';

export default function PaiementsPage() {
  const [kpis, setKpis] = useState<KPIs>({ totalEncaisse: 0, paiementsEnAttente: 0, acomptesEnAttente: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [commandesEnAttente, setCommandesEnAttente] = useState<CommandeEnAttente[]>([]);
  const [parametres, setParametres] = useState<Parametres>({ seuil_acompte: 0, pourcentage_acompte: 0 });
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const debutMois = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        transactionsResult,
        kpiEncaisseResult,
        kpiAttenteResult,
        kpiAcompteResult,
        commandesResult,
        parametresResult,
      ] = await Promise.all([
        supabase
          .from('transactions')
          .select(`
            id,
            commande_id,
            montant,
            type,
            statut,
            reference_mollie,
            created_at,
            commandes (
              clients (
                nom,
                prenom
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('transactions')
          .select('montant')
          .eq('statut', 'succes')
          .gte('created_at', debutMois),

        supabase
          .from('commandes')
          .select('id', { count: 'exact', head: true })
          .eq('statut_paiement', 'en_attente'),

        supabase
          .from('commandes')
          .select('id', { count: 'exact', head: true })
          .eq('statut_paiement', 'acompte_paye'),

        supabase
          .from('commandes')
          .select(`
            id,
            montant_total,
            montant_acompte,
            statut_paiement,
            mode_paiement,
            date_retrait,
            type,
            clients (
              nom,
              prenom,
              email
            )
          `)
          .in('statut_paiement', ['en_attente', 'acompte_paye'])
          .order('date_retrait', { ascending: true }),

        supabase
          .from('parametres')
          .select('seuil_acompte, pourcentage_acompte')
          .single(),
      ]);

      const totalEncaisse = (kpiEncaisseResult.data || []).reduce(
        (sum: number, t: { montant: number }) => sum + (t.montant || 0),
        0
      );

      setKpis({
        totalEncaisse,
        paiementsEnAttente: kpiAttenteResult.count || 0,
        acomptesEnAttente: kpiAcompteResult.count || 0,
      });

      setTransactions((transactionsResult.data as unknown as Transaction[]) || []);
      setCommandesEnAttente((commandesResult.data as unknown as CommandeEnAttente[]) || []);

      if (parametresResult.data) {
        setParametres(parametresResult.data as Parametres);
      }
    } catch (err) {
      console.error('Erreur chargement données:', err);
      showMessage('error', 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const marquerPaye = async (commandeId: string) => {
    setActionLoading(commandeId + '_paye');
    try {
      const { error } = await supabase
        .from('commandes')
        .update({ statut_paiement: 'paye' })
        .eq('id', commandeId);

      if (error) throw error;
      showMessage('success', 'Commande marquée comme payée.');
      await loadData();
    } catch (err) {
      console.error(err);
      showMessage('error', 'Erreur lors de la mise à jour.');
    } finally {
      setActionLoading(null);
    }
  };

  const enregistrerAcompte = async (commande: CommandeEnAttente) => {
    setActionLoading(commande.id + '_acompte');
    try {
      const montantAcompte =
        commande.montant_acompte ||
        Math.round((commande.montant_total * parametres.pourcentage_acompte) / 100 * 100) / 100;

      const { error: updateError } = await supabase
        .from('commandes')
        .update({ statut_paiement: 'acompte_paye', montant_acompte: montantAcompte })
        .eq('id', commande.id);

      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('transactions').insert({
        commande_id: commande.id,
        montant: montantAcompte,
        type: 'acompte',
        statut: 'succes',
        reference_mollie: null,
      });

      if (insertError) throw insertError;

      showMessage('success', `Acompte de ${montantAcompte.toFixed(2)} € enregistré.`);
      await loadData();
    } catch (err) {
      console.error(err);
      showMessage('error', "Erreur lors de l'enregistrement de l'acompte.");
    } finally {
      setActionLoading(null);
    }
  };

  const transactionsFiltrees = transactions.filter((t) => {
    if (filtreStatut === 'tous') return true;
    return t.statut === filtreStatut;
  });

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateCourt = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatMontant = (montant: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: COLORS.vertNuit,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.white,
          fontSize: '18px',
          gap: '12px',
        }}
      >
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        Chargement des paiements…
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{
          background: COLORS.vertNuit,
          color: COLORS.white,
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <CreditCard size={28} color={COLORS.vertVif} />
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Paiements</h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#9CA3AF' }}>Au Vieux Moulin — Gestion des encaissements</p>
          </div>
        </div>
        <button
          onClick={loadData}
          style={{
            background: COLORS.vertVif,
            color: COLORS.white,
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Message toast */}
        {message && (
          <div
            style={{
              padding: '12px 20px',
              borderRadius: '8px',
              marginBottom: '24px',
              background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
            {message.text}
          </div>
        )}

        {/* SECTION 1 — KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {/* Total encaissé */}
          <div
            style={{
              background: COLORS.white,
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderLeft: `4px solid ${COLORS.vertVif}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: COLORS.grayText, fontWeight: 500 }}>Total encaissé ce mois</span>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={20} color={COLORS.vertFonce} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.vertNuit }}>
              {formatMontant(kpis.totalEncaisse)}
            </div>
            <div style={{ fontSize: '12px', color: COLORS.grayText, marginTop: '4px' }}>Transactions validées</div>
          </div>

          {/* Paiements en attente */}
          <div
            style={{
              background: COLORS.white,
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderLeft: '4px solid #854d0e',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: COLORS.grayText, fontWeight: 500 }}>Paiements en attente</span>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fef9c3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={20} color='#854d0e' />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.vertNuit }}>
              {kpis.paiementsEnAttente}
            </div>
            <div style={{ fontSize: '12px', color: COLORS.grayText, marginTop: '4px' }}>Commandes non réglées</div>
          </div>

          {/* Acomptes en attente */}
          <div
            style={{
              background: COLORS.white,
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderLeft: '4px solid #991b1b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: COLORS.grayText, fontWeight: 500 }}>Acomptes en attente (solde dû)</span>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={20} color='#991b1b' />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.vertNuit }}>
              {kpis.acomptesEnAttente}
            </div>
            <div style={{ fontSize: '12px', color: COLORS.grayText, marginTop: '4px' }}>Commandes avec solde restant</div>
          </div>
        </div>

        {/* SECTION 2 — Liste transactions */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            marginBottom: '32px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.grayBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.vertNuit, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} color={COLORS.vertVif} />
              Transactions récentes
              <span style={{ fontSize: '13px', color: COLORS.grayText, fontWeight: 400 }}>
                (50 dernières)
              </span>
            </h2>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['tous', 'succes', 'en_attente', 'echec'] as FiltreStatut[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltreStatut(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: `1px solid ${filtreStatut === f ? COLORS.vertVif : COLORS.grayBorder}`,
                    background: filtreStatut === f ? COLORS.vertVif : COLORS.white,
                    color: filtreStatut === f ? COLORS.white : COLORS.grayText,
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: filtreStatut === f ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'tous' ? 'Tous' : f === 'succes' ? 'Succès' : f === 'en_attente' ? 'En attente' : 'Échec'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Date', 'Client', 'Type', 'Montant', 'Statut', 'Référence Mollie'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: COLORS.grayText,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: `1px solid ${COLORS.grayBorder}`,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactionsFiltrees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: COLORS.grayText,
                        fontSize: '14px',
                      }}
                    >
                      Aucune transaction trouvée.
                    </td>
                  </tr>
                ) : (
                  transactionsFiltrees.map((t, idx) => {
                    const statutStyle = STATUT_STYLES[t.statut] || STATUT_STYLES['en_attente'];
                    const client = t.commandes?.clients;
                    return (
                      <tr
                        key={t.id}
                        style={{
                          background: idx % 2 === 0 ? COLORS.white : '#FAFAFA',
                          borderBottom: `1px solid ${COLORS.grayBorder}`,
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: COLORS.vertNuit, whiteSpace: 'nowrap' }}>
                          {formatDate(t.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: COLORS.vertNuit }}>
                          {client ? `${client.prenom} ${client.nom}` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: COLORS.grayText }}>
                          {TYPE_LABELS[t.type] || t.type}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: COLORS.vertNuit }}>
                          {formatMontant(t.montant)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: statutStyle.bg,
                              color: statutStyle.color,
                            }}
                          >
                            {statutStyle.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: COLORS.grayText, fontFamily: 'monospace' }}>
                          {t.reference_mollie || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 3 — Commandes en attente */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            marginBottom: '32px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.grayBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShoppingBag size={20} color={COLORS.vertVif} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.vertNuit }}>
              Commandes avec paiement en attente
            </h2>
            <span
              style={{
                marginLeft: '8px',
                background: '#fef9c3',
                color: '#854d0e',
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              {commandesEnAttente.length}
            </span>
          </div>

          {commandesEnAttente.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: COLORS.grayText, fontSize: '14px' }}>
              <CheckCircle size={36} color={COLORS.vertVif} style={{ marginBottom: '12px' }} />
              <div>Aucune commande en attente de paiement.</div>
            </div>
          ) : (
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {commandesEnAttente.map((cmd) => {
                const client = cmd.clients;
                const soldeRestant =
                  cmd.statut_paiement === 'acompte_paye' && cmd.montant_acompte
                    ? cmd.montant_total - cmd.montant_acompte
                    : null;
                const isLoadingPaye = actionLoading === cmd.id + '_paye';
                const isLoadingAcompte = actionLoading === cmd.id + '_acompte';

                return (
                  <div
                    key={cmd.id}
                    style={{
                      border: `1px solid ${COLORS.grayBorder}`,
                      borderRadius: '10px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      background: cmd.statut_paiement === 'acompte_paye' ? '#FFFBEB' : COLORS.white,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.vertNuit }}>
                          {client ? `${client.prenom} ${client.nom}` : 'Client inconnu'}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: cmd.statut_paiement === 'acompte_paye' ? '#fef9c3' : '#fee2e2',
                            color: cmd.statut_paiement === 'acompte_paye' ? '#854d0e' : '#991b1b',
                          }}
                        >
                          {cmd.statut_paiement === 'acompte_paye' ? 'Acompte versé' : 'En attente'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: COLORS.grayText, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>Retrait : {formatDateCourt(cmd.date_retrait)}</span>
                        <span>Mode : {MODE_LABELS[cmd.mode_paiement] || cmd.mode_paiement}</span>
                        {client?.email && <span>{client.email}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.vertNuit }}>
                          {formatMontant(cmd.montant_total)}
                        </div>
                        {cmd.montant_acompte && (
                          <div style={{ fontSize: '12px', color: COLORS.grayText }}>
                            Acompte : {formatMontant(cmd.montant_acompte)}
                          </div>
                        )}
                        {soldeRestant !== null && (
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
                            Solde dû : {formatMontant(soldeRestant)}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {cmd.statut_paiement === 'en_attente' && (
                          <button
                            onClick={() => enregistrerAcompte(cmd)}
                            disabled={isLoadingAcompte}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: `1px solid ${COLORS.vertFonce}`,
                              background: COLORS.white,
                              color: COLORS.vertFonce,
                              cursor: isLoadingAcompte ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: 600,
                              opacity: isLoadingAcompte ? 0.6 : 1,
                            }}
                          >
                            {isLoadingAcompte ? 'Enregistrement…' : 'Enregistrer acompte'}
                          </button>
                        )}
                        <button
                          onClick={() => marquerPaye(cmd.id)}
                          disabled={isLoadingPaye}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isLoadingPaye ? '#9CA3AF' : COLORS.vertVif,
                            color: COLORS.white,
                            cursor: isLoadingPaye ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <CheckCircle size={15} />
                          {isLoadingPaye ? 'Mise à jour…' : 'Marquer payé'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 4 — Règles de paiement */}
        <div
          style={{
            background: COLORS.white,
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${COLORS.grayBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={20} color={COLORS.vertVif} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: COLORS.vertNuit }}>
              Règles de paiement
            </h2>
            <span style={{ fontSize: '13px', color: COLORS.grayText, marginLeft: '4px' }}>(lecture seule)</span>
          </div>

          <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Règle 1 */}
            <div
              style={{
                borderRadius: '10px',
                border: `1px solid #BFDBFE`,
                background: '#EFF6FF',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  🆕
                </div>
                <span style={{ fontWeight: 700, color: '#1E40AF', fontSize: '15px' }}>Nouveau client</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#1E3A8A', lineHeight: '1.6' }}>
                La <strong>1ère commande</strong> doit être réglée <strong>100 % en ligne</strong>. Aucun paiement en magasin n'est autorisé avant validation du compte.
              </p>
            </div>

            {/* Règle 2 */}
            <div
              style={{
                borderRadius: '10px',
                border: `1px solid #BBF7D0`,
                background: '#F0FDF4',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  ✅
                </div>
                <span style={{ fontWeight: 700, color: '#166534', fontSize: '15px' }}>Client vérifié</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#14532D', lineHeight: '1.6' }}>
                Le client peut choisir librement entre le <strong>paiement en ligne</strong> ou <strong>en magasin</strong> lors de chaque commande.
              </p>
            </div>

            {/* Règle 3 */}
            <div
              style={{
                borderRadius: '10px',
                border: `1px solid #FDE68A`,
                background: '#FFFBEB',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#FEF9C3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  💶
                </div>
                <span style={{ fontWeight: 700, color: '#92400E', fontSize: '15px' }}>Acompte obligatoire</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#78350F', lineHeight: '1.6' }}>
                Si le montant dépasse le seuil de{' '}
                <strong
                  style={{
                    background: '#FDE68A',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {formatMontant(parametres.seuil_acompte)}
                </strong>{' '}
                et que le mode de paiement est <em>en magasin</em>, un acompte de{' '}
                <strong
                  style={{
                    background: '#FDE68A',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {parametres.pourcentage_acompte} %
                </strong>{' '}
                doit être réglé en ligne au moment de la commande.
              </p>
            </div>

            {/* Règle 4 */}
            <div
              style={{
                borderRadius: '10px',
                border: `1px solid #E9D5FF`,
                background: '#FAF5FF',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#EDE9FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                  }}
                >
                  🔄
                </div>
                <span style={{ fontWeight: 700, color: '#6B21A8', fontSize: '15px' }}>Commande récurrente</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#581C87', lineHeight: '1.6' }}>
                Pour les commandes récurrentes, la <strong>1ère semaine</strong> impose un paiement <strong>en ligne</strong>. Les semaines suivantes, le client peut payer <strong>en magasin</strong>.
              </p>
            </div>
          </div>

          {/* Paramètres actuels */}
          <div
            style={{
              margin: '0 24px 24px',
              padding: '16px 20px',
              borderRadius: '10px',
              background: COLORS.vertNuit,
              color: COLORS.white,
              display: 'flex',
              gap: '32px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>Paramètres actuels :</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Seuil acompte</span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: COLORS.vertVif,
                }}
              >
                {formatMontant(parametres.seuil_acompte)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#9CA3AF' }}>Pourcentage acompte</span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: COLORS.vertVif,
                }}
              >
                {parametres.pourcentage_acompte} %
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
