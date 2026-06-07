# 🥖 Au Vieux Moulin — Pierre Chantraine
## Contexte projet pour Claude Code

---

## Description
Système de gestion complet pour une boulangerie artisanale belge.
- **Boutique** : Au Vieux Moulin — Pierre Chantraine, Boulangerie & Pâtisserie
- **Adresse** : Rue de la Tour Carrée 338, 5300 Vezin
- **Téléphone** : 081/30.25.76
- **Horaires** : Lun-Mar fermé · Mer-Sam 7h-13h & 13h30-18h · Dim 7h-13h & 13h30-16h

---

## Stack technique
- **Framework** : Next.js 14 (App Router)
- **Base de données** : Supabase (PostgreSQL)
- **Style** : CSS inline (pas de Tailwind pour l'instant)
- **Auth** : Supabase Auth
- **Paiements** : Mollie (Bancontact) — à intégrer
- **Emails** : Resend — à intégrer
- **SMS** : Twilio — à intégrer
- **Hébergement** : Vercel — à déployer

---

## Identité visuelle
| Couleur | Hex | Usage |
|---------|-----|-------|
| Vert vif | `#7CBF3A` | Couleur principale, boutons client |
| Vert foncé | `#3B6D11` | Textes, liens |
| Vert clair | `#C8E89A` | Fonds doux |
| Vert nuit | `#1C2B1A` | Fond sombre, boutons admin |
| Crème | `#F5F0E8` | Fond général client |

**Typographies** : Georgia/serif pour les titres, system-ui pour le corps

---

## Structure base de données (Supabase)
- `categories` — catégories produits
- `produits` — catalogue avec prix, jours disponibles, actif/inactif
- `clients` — fiche client avec statut nouveau/verifie, user_id lié à auth
- `commandes` — ponctuelle ou récurrente, statuts, paiement
- `lignes_commande` — détail des produits par commande
- `fermetures` — fermetures manuelles, récurrentes, exceptionnelles
- `ingredients` — matières premières avec prix/unité
- `recettes` — quantités d'ingrédients par produit
- `transactions` — historique paiements Bancontact
- `notifications` — alertes email/SMS
- `parametres` — configuration globale (1 seule ligne)
- `production_extra` — production hors commande par jour

---

## ✅ MODULES TERMINÉS

### Calendrier (admin)
- `src/app/admin/calendrier/page.tsx`
- Vue mensuelle, navigation mois
- Fermetures récurrentes, manuelles, ouvertures exceptionnelles
- Alerte clients impactés si commandes sur jour fermé
- Gestion statut commandes depuis le calendrier

### Préparation (admin)
- `src/app/admin/preparation/page.tsx`
- Navigation J / J+1 / J+2 + sélecteur date libre
- Vue produits : quantités totales agrégées + cases à cocher (checklist)
- Vue clients : liste commandes avec actions Préparée / Récupérée
- Recherche client (vue clients)
- Mini-calendrier avec points verts sur jours avec commandes
- Récap produits dans la sidebar

### Auth admin
- `src/app/auth/login/page.tsx` — login email/password
- Redirige vers `/admin/dashboard` après connexion

### Produits
- `src/app/admin/produits/page.tsx` — liste avec toggle actif/inactif et suppression
- `src/app/admin/produits/nouveau/page.tsx` — formulaire création
- `src/app/admin/produits/[id]/page.tsx` — formulaire modification
- Champs : nom, description, prix, catégorie, jours disponibles, actif

### Clients
- `src/app/admin/clients/page.tsx` — liste + fiche client en panneau latéral
- Recherche par nom/email/téléphone
- Fiche : contact rapide (tel/email), statut nouveau/vérifié, historique commandes, notes internes
- Toggle actif/inactif

### Commandes (admin)
- `src/app/admin/commandes/page.tsx` — liste + détail en panneau latéral
- Filtres par statut (en_attente, confirmee, preparee, recuperee, annulee)
- Détail : produits commandés, total, changement de statut
- Badge commandes du jour

### Page client — Catalogue
- `src/app/client/catalogue/page.tsx` — catalogue avec filtres catégories
- Panier flottant avec quantités
- Sauvegarde panier dans localStorage

### Page client — Commande
- `src/app/client/commande/page.tsx` — 2 étapes : panier puis informations
- Étape 1 : récap panier, modification quantités, date retrait
- Étape 2 : nom, prénom, email, téléphone, notes
- Crée automatiquement la fiche client si nouveau
- Page de confirmation après commande

### Auth client
- `src/app/client/auth/inscription/page.tsx` — création compte
- `src/app/client/auth/connexion/page.tsx` — login
- `src/app/client/compte/page.tsx` — espace client
  - Historique commandes
  - Commandes récurrentes avec statut validation
  - Suspension par semaine (4 prochaines semaines)
  - Complétion profil si infos manquantes

### Composants
- `src/components/admin/AdminSidebar.tsx` — navigation admin avec emojis
- `src/components/admin/AdminHeader.tsx` — header avec lien boutique
- `src/components/client/ClientHeader.tsx` — header vert avec bouton compte
- `src/components/client/ClientFooter.tsx` — footer sombre avec infos boutique

### Ingrédients & Recettes (admin)
- `src/app/admin/ingredients/page.tsx`
- Onglet Ingrédients : CRUD complet (nom, unité, prix/unité, fournisseur)
- Onglet Recettes : sélecteur produit → liste ingrédients avec quantités éditables inline
- Calcul coût de revient, marge brute et % marge par produit

### Production hors commande (admin)
- `src/app/admin/production/page.tsx`
- Sélecteur J / J+1 / J+2 + date libre
- Saisie quantités extra par produit actif (debounce 500ms, upsert Supabase)
- Calcul matières premières agrégées et coût journalier estimé

### Statistiques (admin)
- `src/app/admin/statistiques/page.tsx`
- Filtres : Cette semaine / Ce mois / Ce trimestre / Cette année
- 4 KPI cards, graphique barres CSS (8 semaines), top 5 produits, répartition catégories

### Paramètres (admin)
- `src/app/admin/parametres/page.tsx`
- 5 onglets : Boutique, Horaires, Paiements (Mollie), Notifications (Resend/Twilio), Avancé
- Chargement et sauvegarde depuis table `parametres` (ligne unique)

### Notifications (admin)
- `src/app/admin/notifications/page.tsx`
- Historique 50 alertes avec filtres, dates relatives, badges email/SMS
- Config toggles par type d'alerte (localStorage)
- Email quotidien récapitulatif (heure + destinataire)
- État intégrations Resend / Twilio

### Paiements (admin)
- `src/app/admin/paiements/page.tsx`
- 3 KPI cards, tableau 50 transactions avec filtres
- Commandes en attente de paiement avec actions Marquer payé / Enregistrer acompte
- Règles de paiement affichées avec valeurs live depuis `parametres`

### Livraison (admin)
- `src/app/admin/livraison/page.tsx`
- Toggle ON/OFF livraison (update `parametres`)
- Jours de livraison (localStorage), frais, montant minimum, seuil gratuité

### Blocage commandes automatique
- Modif `src/app/client/commande/page.tsx`
- `calculerDateMin()` lit `heure_blocage_semaine` / `heure_blocage_weekend` depuis `parametres`
- Date minimum dynamique J+1 ou J+2 selon l'heure actuelle

---

## 🔜 À FAIRE / AMÉLIORER

- Intégration Mollie réelle (paiement Bancontact côté client)
- Intégration Resend réelle (envoi emails)
- Intégration Twilio réelle (envoi SMS)
- Page maintenance côté client (si mode maintenance activé dans paramètres)
- Choix livraison côté client (formulaire adresse dans checkout)
- Dashboard : améliorer avec graphiques stats

---

## Notes importantes
- Tout le CSS est en inline styles (pas de classes Tailwind utilisées)
- Les composants utilisent 'use client' car pas de SSR configuré
- RLS Supabase activé avec politique permissive (FOR ALL USING true) pour le développement
- Confirmer email désactivé dans Supabase Auth pour faciliter les tests
- Le fichier .env.local contient les clés Supabase