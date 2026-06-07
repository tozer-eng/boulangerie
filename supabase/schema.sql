-- ============================================================
-- AU VIEUX MOULIN - Schéma base de données Supabase
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CATÉGORIES ────────────────────────────────────────────
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUITS ──────────────────────────────────────────────
CREATE TABLE produits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT,
  prix DECIMAL(10,2) NOT NULL,
  categorie_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  jours_disponibles INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
  actif BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CLIENTS ───────────────────────────────────────────────
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telephone TEXT NOT NULL,
  statut TEXT DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'verifie')),
  actif BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── COMMANDES ─────────────────────────────────────────────
CREATE TABLE commandes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'ponctuelle' CHECK (type IN ('ponctuelle', 'recurrente')),
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','confirmee','preparee','recuperee','annulee')),
  statut_paiement TEXT DEFAULT 'en_attente' CHECK (statut_paiement IN ('en_attente','acompte_paye','paye','rembourse')),
  mode_paiement TEXT DEFAULT 'en_ligne' CHECK (mode_paiement IN ('en_ligne','en_magasin')),
  date_retrait DATE NOT NULL,
  montant_total DECIMAL(10,2) NOT NULL,
  montant_acompte DECIMAL(10,2),
  notes TEXT,
  recurence_validee BOOLEAN DEFAULT false,
  suspendue BOOLEAN DEFAULT false,
  semaines_suspendues TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LIGNES DE COMMANDE ────────────────────────────────────
CREATE TABLE lignes_commande (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  produit_id UUID REFERENCES produits(id) ON DELETE RESTRICT,
  quantite INTEGER NOT NULL CHECK (quantite > 0),
  prix_unitaire DECIMAL(10,2) NOT NULL
);

-- ─── FERMETURES ────────────────────────────────────────────
CREATE TABLE fermetures (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE,
  jour_semaine INTEGER CHECK (jour_semaine BETWEEN 0 AND 6),
  type TEXT NOT NULL CHECK (type IN ('manuelle','recurrente','exceptionnelle')),
  motif TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INGRÉDIENTS ───────────────────────────────────────────
CREATE TABLE ingredients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom TEXT NOT NULL,
  unite TEXT NOT NULL CHECK (unite IN ('g','kg','ml','l','pcs','cl')),
  prix_par_unite DECIMAL(10,4) DEFAULT 0,
  fournisseur TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RECETTES ──────────────────────────────────────────────
CREATE TABLE recettes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produit_id UUID REFERENCES produits(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  quantite DECIMAL(10,3) NOT NULL,
  UNIQUE(produit_id, ingredient_id)
);

-- ─── TRANSACTIONS ──────────────────────────────────────────
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  commande_id UUID REFERENCES commandes(id) ON DELETE CASCADE,
  montant DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('acompte','solde','total','remboursement')),
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('succes','echec','en_attente')),
  reference_mollie TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  envoye_email BOOLEAN DEFAULT false,
  envoye_sms BOOLEAN DEFAULT false,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('envoye','echec','en_attente')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PARAMÈTRES ────────────────────────────────────────────
CREATE TABLE parametres (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom_boutique TEXT DEFAULT 'Au Vieux Moulin',
  slogan TEXT,
  adresse TEXT DEFAULT 'Rue de la Tour Carrée 338, 5300 Vezin',
  telephone TEXT DEFAULT '081/30.25.76',
  email TEXT,
  site_web TEXT,
  couleur_principale TEXT DEFAULT '#7CBF3A',
  seuil_acompte DECIMAL(10,2) DEFAULT 10.00,
  pourcentage_acompte INTEGER DEFAULT 30,
  heure_blocage_semaine TEXT DEFAULT '23:00',
  heure_blocage_weekend TEXT DEFAULT '20:00',
  livraison_active BOOLEAN DEFAULT false,
  frais_livraison DECIMAL(10,2) DEFAULT 2.50,
  montant_minimum_livraison DECIMAL(10,2) DEFAULT 10.00,
  seuil_gratuite_livraison DECIMAL(10,2),
  email_quotidien_destinataire TEXT,
  email_quotidien_heure TEXT DEFAULT '06:00',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les paramètres par défaut
INSERT INTO parametres DEFAULT VALUES;

-- ─── PRODUCTION HORS COMMANDE ──────────────────────────────
CREATE TABLE production_extra (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produit_id UUID REFERENCES produits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantite_extra INTEGER DEFAULT 0,
  UNIQUE(produit_id, date)
);

-- ─── TRIGGERS updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER produits_updated_at BEFORE UPDATE ON produits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER commandes_updated_at BEFORE UPDATE ON commandes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER parametres_updated_at BEFORE UPDATE ON parametres FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS (Row Level Security) ──────────────────────────────
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Admin : accès total (via service_role)
-- Client : accès à ses propres données uniquement
CREATE POLICY "clients_own" ON clients FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "commandes_own" ON commandes FOR ALL USING (
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

-- ─── DONNÉES INITIALES ─────────────────────────────────────
INSERT INTO categories (nom, ordre) VALUES
  ('Pains', 1),
  ('Viennoiseries', 2),
  ('Pâtisseries', 3),
  ('Sandwichs', 4);

-- Fermeture récurrente lundi et mardi
INSERT INTO fermetures (jour_semaine, type, motif) VALUES
  (0, 'recurrente', 'Fermé le lundi'),
  (1, 'recurrente', 'Fermé le mardi');
