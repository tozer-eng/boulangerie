# 🥖 Au Vieux Moulin — Pierre Chantraine
## Système de gestion boulangerie

---

## 🚀 Démarrage rapide

### 1. Installer les dépendances
```bash
cd boulangerie
npm install
```

### 2. Configurer Supabase
1. Créer un compte sur [supabase.com](https://supabase.com)
2. Créer un nouveau projet
3. Dans l'éditeur SQL, copier-coller le contenu de `supabase/schema.sql`
4. Récupérer les clés dans **Settings → API**

### 3. Variables d'environnement
```bash
cp .env.local.example .env.local
# Remplir les valeurs avec vos clés Supabase
```

### 4. Lancer le projet
```bash
npm run dev
# → http://localhost:3000
```

---

## 📁 Structure du projet

```
boulangerie/
├── src/
│   ├── app/
│   │   ├── admin/          # Interface boulanger (protégée)
│   │   │   ├── dashboard/  # Tableau de bord
│   │   │   ├── produits/   # Gestion produits
│   │   │   ├── clients/    # Gestion clients
│   │   │   ├── commandes/  # Commandes & récurrentes
│   │   │   ├── calendrier/ # Ouvertures/fermetures
│   │   │   ├── preparation/# Liste de préparation
│   │   │   ├── production/ # Production hors commande
│   │   │   ├── paiements/  # Bancontact & acomptes
│   │   │   ├── statistiques/
│   │   │   ├── notifications/
│   │   │   └── parametres/
│   │   ├── client/         # Interface client (publique)
│   │   │   ├── catalogue/  # Commande en ligne
│   │   │   ├── commande/   # Récapitulatif & paiement
│   │   │   └── compte/     # Espace client
│   │   └── auth/           # Login
│   ├── components/
│   │   ├── admin/          # Composants interface admin
│   │   ├── client/         # Composants interface client
│   │   └── shared/         # Composants partagés
│   └── lib/
│       ├── supabase/       # Client Supabase (browser & server)
│       ├── types/          # Types TypeScript complets
│       └── utils/          # Fonctions utilitaires
├── supabase/
│   └── schema.sql          # Base de données complète
├── .env.local.example
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 🗄️ Base de données (tables)

| Table | Description |
|-------|-------------|
| `categories` | Catégories produits (Pains, Viennoiseries...) |
| `produits` | Catalogue avec prix et disponibilité |
| `clients` | Clients avec statut nouveau/vérifié |
| `commandes` | Commandes ponctuelles et récurrentes |
| `lignes_commande` | Détail des commandes |
| `fermetures` | Fermetures manuelles, récurrentes, exceptionnelles |
| `ingredients` | Matières premières |
| `recettes` | Recettes par produit |
| `transactions` | Historique paiements Bancontact |
| `notifications` | Alertes email/SMS |
| `parametres` | Configuration globale |
| `production_extra` | Production hors commande |

---

## 🎨 Identité visuelle

| Couleur | Hex | Usage |
|---------|-----|-------|
| Vert vif | `#7CBF3A` | Couleur principale, boutons |
| Vert foncé | `#3B6D11` | Textes, contours |
| Vert clair | `#C8E89A` | Fonds, badges |
| Vert nuit | `#1C2B1A` | Fond sombre, contraste |
| Crème | `#F5F0E8` | Fond neutre chaud |

**Typographies :**
- `Playfair Display` — titres & logo (Google Fonts)
- `Lato` — interface & corps (Google Fonts)

---

## 📦 Stack technique

| Technologie | Usage | Coût |
|-------------|-------|------|
| Next.js 14 | Framework React | Gratuit |
| Supabase | Base de données + Auth | Gratuit jusqu'à 500MB |
| Tailwind CSS | Styles | Gratuit |
| Vercel | Hébergement | Gratuit |
| Mollie | Paiements Bancontact | ~0.29€ + 1.2%/transaction |
| Resend | Emails automatiques | 3000/mois gratuit |
| Twilio | SMS | ~15€ crédit offert |

**Coût démarrage : 0€**

---

## 🔐 Accès

- **Admin** : `/auth/login` → créer un compte dans Supabase Auth
- **Client** : `/client/catalogue` → accès public

---

## 📋 Ordre de développement recommandé

1. ✅ Base de données (schema.sql)
2. ✅ Auth (login admin)
3. ✅ Produits (CRUD)
4. 🔜 Commandes clients
5. 🔜 Calendrier + Préparation
6. 🔜 Clients + Notifications
7. 🔜 Paiements Mollie
8. 🔜 Statistiques
9. 🔜 Production hors commande
10. 🔜 Livraison
"# boulangerie" 
