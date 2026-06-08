-- Ajouter la colonne recuperee_at à la table commandes
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS recuperee_at TIMESTAMPTZ;

-- Mettre à jour les commandes déjà récupérées avec updated_at comme approximation
UPDATE commandes
SET recuperee_at = updated_at
WHERE statut = 'recuperee' AND recuperee_at IS NULL;
