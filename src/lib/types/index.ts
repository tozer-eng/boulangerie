// ─── Produits ───────────────────────────────────────────────
export type Categorie = {
  id: string
  nom: string
  ordre: number
  created_at: string
}

export type Produit = {
  id: string
  nom: string
  description?: string
  prix: number
  categorie_id: string
  categorie?: Categorie
  jours_disponibles: number[] // 0=lun … 6=dim
  actif: boolean
  image_url?: string
  created_at: string
  updated_at: string
}

// ─── Clients ────────────────────────────────────────────────
export type StatutClient = 'nouveau' | 'verifie'

export type Client = {
  id: string
  user_id?: string
  nom: string
  prenom: string
  email: string
  telephone: string
  statut: StatutClient
  actif: boolean
  notes?: string
  created_at: string
  updated_at: string
}

// ─── Commandes ──────────────────────────────────────────────
export type TypeCommande = 'ponctuelle' | 'recurrente'
export type StatutCommande =
  | 'en_attente'
  | 'confirmee'
  | 'preparee'
  | 'recuperee'
  | 'annulee'
export type StatutPaiement =
  | 'en_attente'
  | 'acompte_paye'
  | 'paye'
  | 'rembourse'
export type ModePaiement = 'en_ligne' | 'en_magasin'

export type LigneCommande = {
  id: string
  commande_id: string
  produit_id: string
  produit?: Produit
  quantite: number
  prix_unitaire: number
}

export type Commande = {
  id: string
  client_id: string
  client?: Client
  type: TypeCommande
  statut: StatutCommande
  statut_paiement: StatutPaiement
  mode_paiement: ModePaiement
  date_retrait: string
  montant_total: number
  montant_acompte?: number
  lignes?: LigneCommande[]
  notes?: string
  recurence_validee: boolean
  suspendue: boolean
  semaines_suspendues?: string[]
  created_at: string
  updated_at: string
}

// ─── Calendrier ─────────────────────────────────────────────
export type TypeFermeture = 'manuelle' | 'recurrente' | 'exceptionnelle'

export type Fermeture = {
  id: string
  date?: string
  jour_semaine?: number // 0=lun … 6=dim
  type: TypeFermeture
  motif?: string
  created_at: string
}

// ─── Ingrédients & Recettes ─────────────────────────────────
export type Unite = 'g' | 'kg' | 'ml' | 'l' | 'pcs' | 'cl'

export type Ingredient = {
  id: string
  nom: string
  unite: Unite
  prix_par_unite: number
  fournisseur?: string
  created_at: string
}

export type LigneRecette = {
  id: string
  produit_id: string
  ingredient_id: string
  ingredient?: Ingredient
  quantite: number
}

// ─── Paramètres ─────────────────────────────────────────────
export type Parametres = {
  id: string
  nom_boutique: string
  slogan?: string
  adresse: string
  telephone: string
  email: string
  site_web?: string
  couleur_principale: string
  seuil_acompte: number
  pourcentage_acompte: number
  heure_blocage_semaine: string
  heure_blocage_weekend: string
  livraison_active: boolean
  frais_livraison: number
  montant_minimum_livraison: number
  seuil_gratuite_livraison?: number
  email_quotidien_destinataire?: string
  email_quotidien_heure: string
  updated_at: string
}

// ─── Paiements ──────────────────────────────────────────────
export type Transaction = {
  id: string
  commande_id: string
  commande?: Commande
  montant: number
  type: 'acompte' | 'solde' | 'total' | 'remboursement'
  statut: 'succes' | 'echec' | 'en_attente'
  reference_mollie?: string
  created_at: string
}

// ─── Notifications ──────────────────────────────────────────
export type TypeNotification =
  | 'commande_non_recuperee'
  | 'nouveau_client'
  | 'modification_commande'
  | 'recap_matin'
  | 'bilan_soir'
  | 'paiement_recu'
  | 'jour_ferme'

export type Notification = {
  id: string
  type: TypeNotification
  titre: string
  message: string
  envoye_email: boolean
  envoye_sms: boolean
  statut: 'envoye' | 'echec' | 'en_attente'
  created_at: string
}
