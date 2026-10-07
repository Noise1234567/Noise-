# Architecture

État : cible validée (DEC-001 à DEC-005). Seul le socle existe (NOISE-000).

## 1. Vue d'ensemble

```
┌──────────────────────────┐        ┌──────────────────────────┐
│ App mobile Noise (Expo)  │        │ Scanner web (Vite/TS)    │
│ vue participant          │        │ Chrome Android, caméra   │
│ vue organisateur         │        │ lien JWT par événement   │
└────────────┬─────────────┘        └────────────┬─────────────┘
             │ HTTPS REST /api/v1                │ HTTPS REST /api/v1/scanner
             ▼                                   ▼
        ┌────────────────────────────────────────────┐
        │ API Noise — Express 5 / TypeScript          │
        │ modules : auth · users · events · orders ·  │
        │ payments · tickets · scanner · stats ·      │
        │ notifications · admin · uploads             │
        │ jobs : expiration commandes, rappel J-1     │
        └──────┬──────────────┬──────────────┬───────┘
               │ Prisma       │ HTTPS        │ HTTPS
               ▼              ▼              ▼
        PostgreSQL 17   Agrégateur MM   Cloudinary · Expo Push/FCM
        (Hetzner)       (MTN, Moov)
                        └─► webhook signé vers /api/v1/payments/webhook
```

## 2. Choix structurants

| Sujet                | Choix                                                      | Raison                                                                                          |
| -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Forme                | Monolithe modulaire                                        | 2 développeurs, 4 semaines ; transactions simples ; un seul déploiement                         |
| Organisation du code | Monorepo pnpm                                              | Contrats partagés (`packages/shared`), une CI                                                   |
| Source de vérité     | Backend                                                    | Le client ne décide jamais d'un paiement, d'un billet ou d'une entrée                           |
| Temps réel           | Polling (paiement : backoff 2 → 5 s ; stats : 30 s)        | Suffisant pour le MVP, robuste en 3G, pas de WebSocket à héberger                               |
| Jobs                 | Planificateur dans le process API + contrôles à la lecture | Pas d'infrastructure de file d'attente ; l'expiration reste correcte même si le job a du retard |
| Fichiers             | Cloudinary                                                 | Compression et redimensionnement à la volée pour la 3G                                          |

## 3. Découpage d'un module API

```
src/modules/<domaine>/
  <domaine>.routes.ts      routes Express, middlewares auth/rôle, validation Zod des entrées
  <domaine>.controller.ts  traduit requête ↔ appel de service ↔ réponse
  <domaine>.service.ts     règles métier, transactions Prisma
  <domaine>.schemas.ts     schémas spécifiques (les contrats partagés vont dans packages/shared)
  <domaine>.test.ts        tests unitaires ; intégration dans apps/api/tests/
```

Un service ne connaît pas Express. Un controller ne connaît pas Prisma.

## 4. Organisation du mobile (cible, NOISE-008)

```
apps/mobile/src/
  app/ ou navigation/     selon DEC-011
  features/auth/          onboarding, inscription, connexion
  features/participant/   accueil, détail, checkout, tickets
  features/organizer/     événements, création, stats, liens scanner
  shared/api/             client Axios, intercepteur de refresh
  shared/store/           Zustand : session, rôle actif
  shared/ui/              composants et thème (CDC 8.1–8.2)
  shared/storage/         SecureStore (tokens), stockage local (billets hors ligne)
```

## 5. Flux critiques

### Achat

1. `POST /orders` : transaction → vérifie type en vente, quantité ≤ 5, stock disponible (DEC-007) → commande PENDING, `expiresAt = now + 15 min`.
2. `POST /payments/initiate` : appel au fournisseur, enregistrement du Payment (INITIATED/PENDING).
3. Le participant valide sur son téléphone (USSD / notification opérateur).
4. Webhook → vérification de signature → revérification du statut via l'API du fournisseur → transaction : Payment SUCCEEDED, Order PAID, création des Tickets avec QR token.
5. Le mobile, qui interroge `GET /orders/:id/status`, affiche le succès et enregistre les billets localement.

### Scan

1. Le staff ouvre le lien `https://<api>/scan/#<jwt>` (le token n'est pas envoyé au serveur dans l'URL grâce au fragment).
2. Le scanner lit le QR et appelle `POST /scanner/validate` avec le JWT en en-tête.
3. Transaction : `SELECT ... FOR UPDATE` sur le billet → contrôles → `UPDATE status = USED` → ScanLog.
4. Réponse affichée en vert ou rouge.

## 6. Évolutions prévues hors MVP

Mode scanner hors ligne, remboursements automatisés, iOS, abonnement Pro, extension régionale. Aucune de ces évolutions ne justifie aujourd'hui de complexifier l'architecture.
