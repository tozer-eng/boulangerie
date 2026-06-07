-- ─── JOURS DE LIVRAISON ───────────────────────────────────────────────────────
-- À exécuter dans l'éditeur SQL de Supabase

CREATE TABLE jours_livraison (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  -- Type de créneau
  type TEXT NOT NULL CHECK (type IN ('ponctuelle', 'recurrente')),

  -- Pour type='ponctuelle' : la date exacte
  date DATE,

  -- Pour type='recurrente' : le jour de la semaine (0=Lundi … 6=Dimanche)
  jour_semaine INTEGER CHECK (jour_semaine BETWEEN 0 AND 6),

  -- Fréquence de récurrence (uniquement si type='recurrente')
  recurrence TEXT CHECK (recurrence IN ('hebdomadaire', 'bi-hebdomadaire', 'mensuelle')),

  -- Date de référence pour bi-hebdomadaire (détermine les semaines paires/impaires)
  -- et pour mensuelle (détermine le rang de l'occurrence : 1er mercredi, 2e jeudi…)
  date_reference DATE,

  motif TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contrainte : ponctuelle doit avoir une date, recurrente doit avoir jour_semaine + recurrence
ALTER TABLE jours_livraison ADD CONSTRAINT check_ponctuelle
  CHECK (type != 'ponctuelle' OR (date IS NOT NULL AND jour_semaine IS NULL));

ALTER TABLE jours_livraison ADD CONSTRAINT check_recurrente
  CHECK (type != 'recurrente' OR (jour_semaine IS NOT NULL AND recurrence IS NOT NULL AND date IS NULL));

-- RLS : lecture publique (clients), écriture admin uniquement
ALTER TABLE jours_livraison ENABLE ROW LEVEL SECURITY;
CREATE POLICY "livraison_lecture_publique" ON jours_livraison FOR SELECT USING (actif = true);
