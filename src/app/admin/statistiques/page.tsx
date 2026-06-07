'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { TrendingUp, ShoppingBag, Users, BarChart2 } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Periode = 'semaine' | 'mois' | 'trimestre' | 'annee';

interface KPI {
  ca: number;
  nbCommandes: number;
  panierMoyen: number;
  clientsActifs: number;
}

interface SemaineData {
  label: string;
  ca: number;
}

interface TopProduit {
  nom: string;
  quantite: number;
  ca: number;
}

interface CategorieStat {
  nom: string;
  nbCommandes: number;
  pourcentage: number;
}

function getPeriodeDates(periode: Periode): { debut: string; fin: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let debut: Date;
  let fin: Date = new Date(now);

  if (periode === 'semaine') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    debut = new Date(now);
    debut.setDate(now.getDate() - day);
  } else if (periode === 'mois') {
    debut = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (periode === 'trimestre') {
    const trimestre = Math.floor(now.getMonth() / 3);
    debut = new Date(now.getFullYear(), trimestre * 3, 1);
  } else {
    debut = new Date(now.getFullYear(), 0, 1);
  }

  return { debut: fmt(debut), fin: fmt(fin) };
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getLast8Weeks(): { key: string; label: string }[] {
  const weeks: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    const key = getISOWeek(d);
    const weekNum = key.split('-W')[1];
    weeks.push({ key, label: `S${parseInt(weekNum)}` });
  }
  return weeks;
}

export default function StatistiquesPage() {
  const [periode, setPeriode] = useState<Periode>('mois');
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPI>({ ca: 0, nbCommandes: 0, panierMoyen: 0, clientsActifs: 0 });
  const [semaines, setSemaines] = useState<SemaineData[]>([]);
  const [topProduits, setTopProduits] = useState<TopProduit[]>([]);
  const [categories, setCategories] = useState<CategorieStat[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  useEffect(() => {
    chargerDonnees();
  }, [periode]);

  async function chargerDonnees() {
    setLoading(true);
    const { debut, fin } = getPeriodeDates(periode);

    await Promise.all([
      chargerKPI(debut, fin),
      chargerSemaines(),
      chargerTopProduits(debut, fin),
      chargerCategories(debut, fin),
    ]);

    setLoading(false);
  }

  async function chargerKPI(debut: string, fin: string) {
    const { data, error } = await supabase
      .from('commandes')
      .select('montant_total, client_id')
      .neq('statut', 'annulee')
      .gte('date_retrait', debut)
      .lte('date_retrait', fin);

    if (error || !data) return;

    const ca = data.reduce((sum, c) => sum + (Number(c.montant_total) || 0), 0);
    const nb = data.length;
    const clientsSet = new Set(data.map((c) => c.client_id).filter(Boolean));

    setKpi({
      ca,
      nbCommandes: nb,
      panierMoyen: nb > 0 ? ca / nb : 0,
      clientsActifs: clientsSet.size,
    });
  }

  async function chargerSemaines() {
    const last8 = getLast8Weeks();
    const firstDate = last8[0].key;
    const [year, week] = firstDate.split('-W').map(Number);
    const startDate = new Date(year, 0, 1 + (week - 1) * 7);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const { data, error } = await supabase
      .from('commandes')
      .select('montant_total, date_retrait')
      .neq('statut', 'annulee')
      .gte('date_retrait', fmt(startDate));

    if (error || !data) return;

    const byWeek: Record<string, number> = {};
    for (const c of data) {
      if (!c.date_retrait) continue;
      const key = getISOWeek(new Date(c.date_retrait));
      byWeek[key] = (byWeek[key] || 0) + (Number(c.montant_total) || 0);
    }

    const result = last8.map(({ key, label }) => ({
      label,
      ca: byWeek[key] || 0,
    }));

    setSemaines(result);
  }

  async function chargerTopProduits(debut: string, fin: string) {
    const { data: commandes, error: errC } = await supabase
      .from('commandes')
      .select('id')
      .neq('statut', 'annulee')
      .gte('date_retrait', debut)
      .lte('date_retrait', fin);

    if (errC || !commandes || commandes.length === 0) {
      setTopProduits([]);
      return;
    }

    const commandeIds = commandes.map((c) => c.id);

    const { data: lignes, error: errL } = await supabase
      .from('lignes_commande')
      .select('produit_id, quantite, prix_unitaire, produits(nom)')
      .in('commande_id', commandeIds);

    if (errL || !lignes) return;

    const byProduit: Record<string, { nom: string; quantite: number; ca: number }> = {};
    for (const l of lignes) {
      const id = l.produit_id;
      const nom = (l.produits as any)?.nom || 'Inconnu';
      if (!byProduit[id]) byProduit[id] = { nom, quantite: 0, ca: 0 };
      byProduit[id].quantite += Number(l.quantite) || 0;
      byProduit[id].ca += (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
    }

    const sorted = Object.values(byProduit)
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);

    setTopProduits(sorted);
  }

  async function chargerCategories(debut: string, fin: string) {
    const { data: commandes, error: errC } = await supabase
      .from('commandes')
      .select('id')
      .neq('statut', 'annulee')
      .gte('date_retrait', debut)
      .lte('date_retrait', fin);

    if (errC || !commandes || commandes.length === 0) {
      setCategories([]);
      return;
    }

    const commandeIds = commandes.map((c) => c.id);

    const { data: lignes, error: errL } = await supabase
      .from('lignes_commande')
      .select('commande_id, produits(categorie_id, categories(nom))')
      .in('commande_id', commandeIds);

    if (errL || !lignes) return;

    const byCat: Record<string, { nom: string; nb: Set<string> }> = {};
    for (const l of lignes) {
      const cat = (l.produits as any)?.categories;
      if (!cat) continue;
      const nom = cat.nom || 'Sans catégorie';
      if (!byCat[nom]) byCat[nom] = { nom, nb: new Set() };
      byCat[nom].nb.add(String(l.commande_id));
    }

    const total = commandeIds.length;
    const result: CategorieStat[] = Object.values(byCat)
      .map(({ nom, nb }) => ({
        nom,
        nbCommandes: nb.size,
        pourcentage: total > 0 ? Math.round((nb.size / total) * 100) : 0,
      }))
      .sort((a, b) => b.nbCommandes - a.nbCommandes);

    setCategories(result);
  }

  const maxCA = semaines.length > 0 ? Math.max(...semaines.map((s) => s.ca), 1) : 1;

  const formatEuro = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

  const periodeLabels: Record<Periode, string> = {
    semaine: 'Cette semaine',
    mois: 'Ce mois',
    trimestre: 'Ce trimestre',
    annee: 'Cette année',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F5F0E8',
        padding: '32px 24px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* En-tête */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1C2B1A',
            margin: '0 0 4px 0',
          }}
        >
          Statistiques
        </h1>
        <p style={{ color: '#3B6D11', margin: 0, fontSize: '15px' }}>
          Tableau de bord — Au Vieux Moulin
        </p>
      </div>

      {/* Filtres période */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          flexWrap: 'wrap',
        }}
      >
        {(Object.keys(periodeLabels) as Periode[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriode(p)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '2px solid',
              borderColor: periode === p ? '#7CBF3A' : '#3B6D11',
              backgroundColor: periode === p ? '#7CBF3A' : 'transparent',
              color: periode === p ? '#fff' : '#1C2B1A',
              fontWeight: periode === p ? '700' : '500',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {periodeLabels[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: '#3B6D11',
            fontSize: '18px',
            fontWeight: '500',
          }}
        >
          Chargement des données...
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}
          >
            {/* CA Total */}
            <div
              style={{
                backgroundColor: '#1C2B1A',
                borderRadius: '12px',
                padding: '24px',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(28,43,26,0.15)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#7CBF3A', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Chiffre d'affaires
                </span>
                <TrendingUp size={20} color="#7CBF3A" />
              </div>
              <div style={{ fontSize: '30px', fontWeight: '700', color: '#fff' }}>
                {formatEuro(kpi.ca)}
              </div>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                Sur la période sélectionnée
              </div>
            </div>

            {/* Nb commandes */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
                borderLeft: '4px solid #7CBF3A',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#3B6D11', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Commandes
                </span>
                <ShoppingBag size={20} color="#3B6D11" />
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#1C2B1A' }}>
                {kpi.nbCommandes}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Commandes non annulées
              </div>
            </div>

            {/* Panier moyen */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
                borderLeft: '4px solid #3B6D11',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#3B6D11', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Panier moyen
                </span>
                <BarChart2 size={20} color="#3B6D11" />
              </div>
              <div style={{ fontSize: '30px', fontWeight: '700', color: '#1C2B1A' }}>
                {formatEuro(kpi.panierMoyen)}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                CA / nombre de commandes
              </div>
            </div>

            {/* Clients actifs */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
                borderLeft: '4px solid #7CBF3A',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '13px', color: '#3B6D11', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Clients actifs
                </span>
                <Users size={20} color="#3B6D11" />
              </div>
              <div style={{ fontSize: '36px', fontWeight: '700', color: '#1C2B1A' }}>
                {kpi.clientsActifs}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Clients distincts ayant commandé
              </div>
            </div>
          </div>

          {/* Graphique CA par semaine */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '28px',
              marginBottom: '24px',
              boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
            }}
          >
            <h2
              style={{
                fontSize: '17px',
                fontWeight: '700',
                color: '#1C2B1A',
                margin: '0 0 24px 0',
              }}
            >
              CA par semaine — 8 dernières semaines
            </h2>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '12px',
                height: '200px',
                paddingBottom: '32px',
                position: 'relative',
              }}
            >
              {/* Lignes de grille */}
              {[0, 25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${32 + (pct / 100) * 168}px`,
                    borderTop: '1px dashed #e0e0e0',
                    zIndex: 0,
                  }}
                />
              ))}

              {semaines.map((s, i) => {
                const heightPct = maxCA > 0 ? (s.ca / maxCA) * 100 : 0;
                const barHeight = Math.max(heightPct * 1.68, s.ca > 0 ? 4 : 0);
                const isHovered = hoveredBar === i;

                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                      position: 'relative',
                      zIndex: 1,
                    }}
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip au survol */}
                    {isHovered && s.ca > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: `${barHeight + 40}px`,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          backgroundColor: '#1C2B1A',
                          color: '#fff',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                      >
                        {formatEuro(s.ca)}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-5px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '5px solid #1C2B1A',
                          }}
                        />
                      </div>
                    )}

                    {/* Montant en haut de barre */}
                    {s.ca > 0 && !isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: `${barHeight + 34}px`,
                          fontSize: '10px',
                          color: '#3B6D11',
                          fontWeight: '600',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.ca >= 1000
                          ? `${(s.ca / 1000).toFixed(1)}k€`
                          : `${Math.round(s.ca)}€`}
                      </div>
                    )}

                    {/* Barre */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '48px',
                        height: `${barHeight}px`,
                        backgroundColor: isHovered ? '#3B6D11' : '#7CBF3A',
                        borderRadius: '6px 6px 0 0',
                        transition: 'height 0.4s ease, background-color 0.15s ease',
                        cursor: 'pointer',
                        minHeight: s.ca > 0 ? '4px' : '0',
                      }}
                    />

                    {/* Label semaine */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '0',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#1C2B1A',
                        marginTop: '8px',
                      }}
                    >
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {semaines.every((s) => s.ca === 0) && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '14px',
                  paddingTop: '16px',
                }}
              >
                Aucune donnée disponible pour cette période
              </div>
            )}
          </div>

          {/* Ligne : Top 5 + Catégories */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Top 5 produits */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '28px',
                boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
              }}
            >
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1C2B1A',
                  margin: '0 0 20px 0',
                }}
              >
                Top 5 produits commandés
              </h2>

              {topProduits.length === 0 ? (
                <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                  Aucune donnée disponible
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['#', 'Produit', 'Qté', 'CA'].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: h === '#' || h === 'Qté' || h === 'CA' ? 'center' : 'left',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#3B6D11',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            paddingBottom: '12px',
                            borderBottom: '2px solid #F5F0E8',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProduits.map((p, i) => (
                      <tr
                        key={i}
                        style={{
                          backgroundColor: i % 2 === 0 ? 'transparent' : '#fafaf8',
                        }}
                      >
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px 8px',
                            fontWeight: '700',
                            color: i === 0 ? '#7CBF3A' : '#888',
                            fontSize: '15px',
                          }}
                        >
                          {i + 1}
                        </td>
                        <td
                          style={{
                            padding: '12px 8px',
                            fontSize: '14px',
                            color: '#1C2B1A',
                            fontWeight: '500',
                            maxWidth: '160px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.nom}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px 8px',
                            fontSize: '14px',
                            color: '#1C2B1A',
                            fontWeight: '600',
                          }}
                        >
                          {p.quantite}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '12px 8px',
                            fontSize: '13px',
                            color: '#3B6D11',
                            fontWeight: '600',
                          }}
                        >
                          {formatEuro(p.ca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Répartition par catégorie */}
            <div
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '28px',
                boxShadow: '0 4px 12px rgba(28,43,26,0.08)',
              }}
            >
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#1C2B1A',
                  margin: '0 0 20px 0',
                }}
              >
                Répartition par catégorie
              </h2>

              {categories.length === 0 ? (
                <div style={{ color: '#888', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                  Aucune donnée disponible
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {categories.map((cat, i) => (
                    <div key={i}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#1C2B1A',
                          }}
                        >
                          {cat.nom}
                        </span>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {cat.nbCommandes} cmd
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#3B6D11',
                              minWidth: '36px',
                              textAlign: 'right',
                            }}
                          >
                            {cat.pourcentage}%
                          </span>
                        </div>
                      </div>

                      {/* Barre horizontale */}
                      <div
                        style={{
                          width: '100%',
                          height: '10px',
                          backgroundColor: '#F5F0E8',
                          borderRadius: '999px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${cat.pourcentage}%`,
                            height: '100%',
                            backgroundColor:
                              i === 0
                                ? '#7CBF3A'
                                : i === 1
                                ? '#3B6D11'
                                : i === 2
                                ? '#5a9a28'
                                : '#8ed44e',
                            borderRadius: '999px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
