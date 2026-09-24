# Roadmap — Noise

Roadmap initiale du 24 septembre au 28 octobre 2026. Elle est maintenue par Claude et validée par Yannis et Orias ; toute modification de périmètre est consignée dans `decisions.md`. L'état réel des tâches est dans `progress.md` et Notion ; les statuts ci-dessous sont ceux à la date de mise à jour.

Dernière mise à jour : 2026-09-24.

## 1. Milestones

| ID  | Milestone                                | Sprint   | Date cible                  | Objectif                                                                                             | Critère de sortie                                                                                            |
| --- | ---------------------------------------- | -------- | --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| M0  | Fondations et pilotage                   | S1       | 2026-09-30                  | Socle validé, décisions tranchées, auth de bout en bout sur appareil, fournisseur de paiement choisi | NOISE-003 mergée ; un utilisateur s'inscrit et se connecte depuis l'APK de développement ; DEC-005 complétée |
| M1  | Événements                               | S2       | 2026-10-07                  | Un organisateur crée un événement, un participant le consulte ; staging en ligne                     | Parcours création → consultation vérifié sur staging depuis l'APK preview                                    |
| M2  | Achat de billet                          | S3       | 2026-10-14                  | Achat → paiement sandbox → billet → QR hors ligne                                                    | NOISE-023 validée avec preuves                                                                               |
| M3  | Contrôle, statistiques et release v0.1.0 | S4       | 2026-10-21                  | Cycle complet achat → paiement → QR → scan sur APK (objectif technique du CDC)                       | NOISE-032 validée ; tag v0.1.0                                                                               |
| M4  | Production et pilotes                    | S5       | 2026-10-28 (dépend du KYC)  | Paiement réel, production, 2–3 organisateurs pilotes                                                 | NOISE-036 : bilan du test terrain                                                                            |
| M5  | Google Play                              | Post-MVP | Après M4 + 14 jours minimum | Application publiée sur Google Play                                                                  | Accès production Google Play obtenu                                                                          |

## 2. Sprints

Sprints d'une semaine, du jeudi au mercredi. Planification le jeudi, rétrospective le mercredi soir (15 min).

| Sprint | Dates                   | Milestone | Objectif                                                                        |
| ------ | ----------------------- | --------- | ------------------------------------------------------------------------------- |
| S1     | 2026-09-24 → 2026-09-30 | M0        | Fondations, auth de bout en bout, premier APK, choix du fournisseur de paiement |
| S2     | 2026-10-01 → 2026-10-07 | M1        | Événements (API + deux vues mobiles), staging, abstraction paiement             |
| S3     | 2026-10-08 → 2026-10-14 | M2        | Commandes, paiement, billets, QR hors ligne, E2E sandbox                        |
| S4     | 2026-10-15 → 2026-10-21 | M3        | Scanner, stats, push, annulation, sécurité, release v0.1.0, AAB                 |
| S5     | 2026-10-22 → 2026-10-28 | M4        | Paiement production (si KYC), production, test terrain                          |

Le test terrain (S5) correspond à la semaine 5 du CDC. Il dépend de la validation KYC du fournisseur de paiement (DEC-016), hors de notre contrôle : il n'est pas forcé dans la S5 si le KYC n'est pas obtenu.

## 3. Chemin critique

```
NOISE-002 comptes sandbox ─► NOISE-010 choix fournisseur ─► NOISE-017 PaymentProvider ─┐
NOISE-003 socle ─► NOISE-006 schéma ─► NOISE-011 events ─► NOISE-018 commandes ──────────┴─► NOISE-019 paiement
  ─► NOISE-020 billets/QR ─► NOISE-025 scan atomique ─► NOISE-026 scanner ─► NOISE-032 release v0.1.0

En parallèle, hors de notre contrôle :
DEC-016 entité légale ─► KYC agrégateur ─► NOISE-034 paiement production ─► NOISE-036 test terrain
```

Tout retard sur NOISE-002, NOISE-006 ou NOISE-019 décale directement la release. Ces trois tâches sont traitées en priorité et en binôme lorsque c'est prévu.

## 4. Vue par catégorie

| Catégorie                      | Tâches                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Réalisables immédiatement      | NOISE-001, NOISE-002, NOISE-003                                                                                                                                                                                                                                                                                                                                                      |
| Dépendantes d'une autre tâche  | NOISE-005, NOISE-006, NOISE-007, NOISE-008, NOISE-009, NOISE-010, NOISE-011, NOISE-012, NOISE-013, NOISE-014, NOISE-015, NOISE-016, NOISE-017, NOISE-018, NOISE-019, NOISE-020, NOISE-021, NOISE-022, NOISE-023, NOISE-024, NOISE-025, NOISE-026, NOISE-027, NOISE-028, NOISE-029, NOISE-030, NOISE-031, NOISE-032, NOISE-033, NOISE-035, NOISE-036, NOISE-037, NOISE-038, NOISE-039 |
| Bloquées (décision ou externe) | NOISE-034, NOISE-040 — NOISE-034 : KYC (DEC-016) ; NOISE-040 : DEC-017                                                                                                                                                                                                                                                                                                               |
| Yannis                         | NOISE-003, NOISE-005, NOISE-007, NOISE-010, NOISE-012, NOISE-013, NOISE-017, NOISE-021, NOISE-022, NOISE-025, NOISE-026, NOISE-029, NOISE-033, NOISE-035, NOISE-039, NOISE-040                                                                                                                                                                                                       |
| Orias                          | NOISE-008, NOISE-009, NOISE-011, NOISE-014, NOISE-015, NOISE-018, NOISE-020, NOISE-024, NOISE-027, NOISE-028, NOISE-031, NOISE-037                                                                                                                                                                                                                                                   |
| Les deux (binôme / décision)   | NOISE-001, NOISE-002, NOISE-006, NOISE-016, NOISE-019, NOISE-023, NOISE-030, NOISE-032, NOISE-034, NOISE-036, NOISE-038                                                                                                                                                                                                                                                              |
| Intervention externe           | NOISE-002, NOISE-005, NOISE-009, NOISE-010, NOISE-016, NOISE-023, NOISE-028, NOISE-030, NOISE-034, NOISE-035, NOISE-036, NOISE-038                                                                                                                                                                                                                                                   |

NOISE-000 a été réalisée par Claude ; sa revue est NOISE-003.

## 5. Équilibre Yannis / Orias (S1 à S4)

Estimations en heures. Les tâches communes comptent pour moitié à chacun.

|                                                                  | Yannis | Orias |
| ---------------------------------------------------------------- | ------ | ----- |
| Charge estimée                                                   | 93 h   | 88 h  |
| dont Backend / API (en responsable)                              | 28 h   | 26 h  |
| dont Frontend (mobile, scanner, Android) (en responsable)        | 35 h   | 29 h  |
| dont Full stack (en responsable)                                 | 5 h    | 12 h  |
| dont Transverse (infra, CI, pilotage, sécurité) (en responsable) | 4 h    | 0 h   |
| Reviews prévues                                                  | 11     | 14    |

Chacun a des tâches backend ET mobile à chaque milestone ; sur chaque fonctionnalité, l'API et l'écran sont attribués à deux personnes différentes. Charge à recalibrer quand DEC-019 (disponibilités) sera connue.

- S1 : Yannis 23.5 h, Orias 18.5 h
- S2 : Yannis 20 h, Orias 21 h
- S3 : Yannis 24 h, Orias 22 h
- S4 : Yannis 25.5 h, Orias 26.5 h
- S5 : Yannis 21 h, Orias 10 h

## 6. Tâches

Format de chaque tâche : objectif, responsable, reviewer, dépendances, critères d'acceptation, tests, fichiers, statut. La définition de terminé commune s'applique en plus (CLAUDE.md section 13).

### M0 — Fondations et pilotage

#### NOISE-000 — Socle du repository et documentation

- Objectif : Créer la structure du monorepo, l'outillage, la CI et la documentation de pilotage.
- Responsable : Claude · Reviewer : Yannis + Orias
- Sprint : S1 · Type : Chore · Domaine : Infra · Priorité : P0 · Estimation : 6 h
- Dépendances : —
- Statut : Implémenté (non commité, en attente de revue)
- Fichiers concernés : Racine, apps/*, packages/shared, docs/, .github/
- Critères d'acceptation :
  - [ ] Structure apps/api, apps/mobile, apps/scanner, packages/shared en place
  - [ ] pnpm check passe (format, lint, typecheck, tests)
  - [ ] CLAUDE.md, roadmap.md, progress.md, decisions.md, CHANGELOG.md, docs/ rédigés
- Tests :
  - 4 tests API (health, 404 standard, x-powered-by, env invalide)

#### NOISE-001 — Trancher les décisions en attente

- Objectif : Répondre à DEC-015 à DEC-019 et au taux de commission (DEC-009) pour débloquer la suite.
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S1 · Type : Décision · Domaine : Produit · Priorité : P0 · Estimation : 2 h
- Dépendances : —
- Statut : À faire
- Fichiers concernés : decisions.md
- Critères d'acceptation :
  - [ ] Chaque décision a un statut Acceptée ou une date limite
  - [ ] decisions.md et Notion à jour
- Tests :
  - Sans objet

#### NOISE-002 — Créer les comptes externes et lancer le KYC

- Objectif : Ouvrir les comptes nécessaires et démarrer tout de suite les démarches longues.
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S1 · Type : Chore · Domaine : Externe · Priorité : P0 · Estimation : 3 h
- Dépendances : — · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/environments.md
- Critères d'acceptation :
  - [ ] Comptes sandbox FedaPay et KKiaPay créés
  - [ ] Démarche KYC production lancée (dépend de DEC-016)
  - [ ] Comptes Expo, Railway, Cloudinary, Firebase, Sentry créés et partagés entre les deux développeurs
  - [ ] Base Notion « Services & accès » renseignée (sans aucun secret)
- Tests :
  - Sans objet

#### NOISE-003 — Revoir et valider le socle NOISE-000

- Objectif : S'approprier le socle, le vérifier sur vos machines et le corriger si besoin.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S1 · Type : Revue · Domaine : Infra · Priorité : P0 · Estimation : 3 h
- Dépendances : NOISE-000
- Statut : À faire
- Fichiers concernés : Tout le socle
- Critères d'acceptation :
  - [ ] pnpm install et pnpm check passent sur les deux machines (Windows)
  - [ ] pnpm db:up puis pnpm dev:api : /health répond
  - [ ] pnpm dev:mobile ouvre l'app sur un téléphone ou émulateur
  - [ ] npx prisma generate fonctionne (non vérifiable depuis l'environnement de Claude)
  - [ ] npx expo-doctor sans erreur
  - [ ] PR chore: NOISE-000 project bootstrap mergée
- Tests :
  - CI verte sur la PR

#### NOISE-004 — Connecter Notion et mettre en place le modèle de suivi

- Objectif : Mettre en place l'espace Notion (docs/notion-model.md) : soit via le connecteur Notion de Claude, soit par import des CSV.
- Responsable : Claude · Reviewer : Orias
- Sprint : S1 · Type : Chore · Domaine : Pilotage · Priorité : P1 · Estimation : 2 h
- Dépendances : NOISE-000
- Statut : Implémenté (espace créé par Claude le 2026-09-24, revue Orias à faire)
- Fichiers concernés : docs/notion-model.md, docs/notion/*.csv
- Critères d'acceptation :
  - [ ] Bases Tasks, Milestones, Sprints, Bugs, Decisions, Releases, Risks, Documentation, Technical Debt, Services créées
  - [ ] Relations et vues « Équilibre », « Mes tâches », « Bloquées » opérationnelles
  - [ ] Tâches NOISE-000 à NOISE-040 importées
- Tests :
  - Vérification manuelle des vues par Orias

#### NOISE-005 — Configurer GitHub (protection, CI, CODEOWNERS)

- Objectif : Appliquer la stratégie Git sur le dépôt distant.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S1 · Type : Chore · Domaine : CI/CD · Priorité : P0 · Estimation : 1 h
- Dépendances : NOISE-003 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : .github/CODEOWNERS
- Critères d'acceptation :
  - [ ] Règle de protection de main conforme à docs/git-workflow.md section 7
  - [ ] Squash merge seul, suppression auto des branches
  - [ ] CODEOWNERS activé avec les deux identifiants
  - [ ] Orias a les droits d'écriture
- Tests :
  - Une PR de test sans approbation ne peut pas être mergée

#### NOISE-006 — Schéma Prisma v1, migration initiale et seed

- Objectif : Traduire docs/database.md en modèles Prisma (binôme : Orias pilote, Yannis co-pilote).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S1 · Type : Feature · Domaine : Base de données · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-003
- Statut : À faire
- Fichiers concernés : apps/api/prisma/*, apps/api/src/lib/prisma.ts, docs/database.md
- Critères d'acceptation :
  - [ ] Modèles User, Event, TicketType, Order, Payment, Ticket, ScannerLink, ScanLog avec contraintes, index et enums
  - [ ] Montants en Int (FCFA), dates en UTC, qrTokenHash unique, providerTransactionId unique
  - [ ] Migration initiale appliquée sur noise_dev et noise_test
  - [ ] Seed : 1 organisateur, 1 participant, 2 événements, 3 types de billets
  - [ ] Client Prisma exposé via apps/api/src/lib/prisma.ts ; /health/ready vérifie la base
  - [ ] CI : db:generate + db:deploy ajoutés
- Tests :
  - Test d'intégration : connexion, contraintes d'unicité, cascade/restrict attendus

#### NOISE-007 — Authentification API (register, login, refresh, logout, rôles)

- Objectif : Implémenter l'auth JWT double token décrite dans le CDC 5.3 et docs/security.md.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S1 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 8 h
- Dépendances : NOISE-006
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/auth/*, packages/shared/src/schemas/auth.ts
- Critères d'acceptation :
  - [ ] POST /api/v1/auth/register, /login, /refresh, /logout conformes à docs/api.md
  - [ ] Mot de passe haché argon2id ; refresh token stocké haché, rotation à chaque refresh, révocation au logout
  - [ ] Middleware requireAuth et requireRole ; activation du second rôle (PATCH /api/v1/me/roles)
  - [ ] Rate limiting sur /auth (5 tentatives / 15 min / IP+téléphone)
  - [ ] Numéro de téléphone normalisé (format béninois) et unique
- Tests :
  - Unitaires : hachage, génération/vérification des tokens
  - Intégration : inscription, doublon, login faux mot de passe, refresh rejoué refusé, logout, 401/403

#### NOISE-008 — App mobile : thème, navigation, onboarding et auth

- Objectif : Poser l'architecture mobile et le premier parcours de bout en bout : choisir son rôle, s'inscrire, se connecter.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S1 · Type : Feature · Domaine : Mobile · Priorité : P0 · Estimation : 10 h
- Dépendances : NOISE-003, NOISE-007
- Statut : À faire
- Fichiers concernés : apps/mobile/src/*
- Critères d'acceptation :
  - [ ] DEC-011 tranchée ; navigation participant / organisateur en place
  - [ ] Thème sombre (couleurs et polices Syne/Inter du CDC 8.1–8.2)
  - [ ] Client Axios avec intercepteur de refresh ; tokens dans SecureStore ; store Zustand (session, rôle actif)
  - [ ] Écrans : bienvenue (choix du rôle), inscription, connexion, accueil vide selon le rôle ; états chargement / erreur
  - [ ] jest-expo + RN Testing Library configurés
- Tests :
  - Tests UI : formulaire d'inscription (validation), redirection selon le rôle
  - Test manuel sur appareil contre l'API locale

#### NOISE-009 — Premier APK de développement sur un téléphone réel

- Objectif : Dérisquer tôt la chaîne de build Android.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S1 · Type : Chore · Domaine : Android · Priorité : P0 · Estimation : 3 h
- Dépendances : NOISE-002, NOISE-003 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : apps/mobile/app.json, apps/mobile/eas.json, docs/android-release.md
- Critères d'acceptation :
  - [ ] DEC-015 (identifiant Android) tranchée
  - [ ] expo-dev-client installé ; build EAS profil development réussi
  - [ ] APK installé sur au moins un téléphone Android et connecté au Metro local
  - [ ] Procédure notée dans docs/android-release.md
- Tests :
  - Installation manuelle vérifiée

#### NOISE-010 — Exploration du paiement : comparer FedaPay et KKiaPay en sandbox

- Objectif : Choisir le fournisseur sur preuves et documenter le flux réel.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S1 · Type : Spike · Domaine : Paiement · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-002 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/payments.md, decisions.md
- Critères d'acceptation :
  - [ ] Paiement sandbox MTN et Moov déclenché via API avec chacun des deux fournisseurs
  - [ ] Webhook reçu en local (tunnel) ; mécanisme de signature identifié
  - [ ] Frais, délais de KYC et de reversement comparés
  - [ ] DEC-005 complétée avec le fournisseur retenu ; docs/payments.md complété
- Tests :
  - Script d'exploration jetable (hors src/), captures des réponses sans secret

### M1 — Événements

#### NOISE-011 — API événements et types de billets

- Objectif : CRUD événements et types de billets pour les organisateurs ; lecture pour les participants.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S2 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 8 h
- Dépendances : NOISE-006, NOISE-007
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/events/*, packages/shared/src/schemas/events.ts
- Critères d'acceptation :
  - [ ] GET /events (filtres genre, ville, date ; pagination), GET /events/:id, POST/PUT /events, POST /events/:id/ticket-types
  - [ ] Un organisateur ne modifie que ses événements (403 sinon)
  - [ ] Disponibilité calculée selon DEC-007
  - [ ] Statuts DRAFT / PUBLISHED / CANCELLED ; seuls les PUBLISHED sont listés aux participants
- Tests :
  - Intégration : création, modification par un autre organisateur refusée, filtres, pagination, validation des prix et quantités

#### NOISE-012 — Upload des affiches (Cloudinary)

- Objectif : Permettre l'envoi d'une affiche compressée et servie légère en 3G.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S2 · Type : Feature · Domaine : Backend · Priorité : P1 · Estimation : 4 h
- Dépendances : NOISE-002, NOISE-011
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/uploads/*
- Critères d'acceptation :
  - [ ] Upload signé côté serveur (le mobile ne détient aucun secret)
  - [ ] Types et taille limités (jpeg/png/webp, 5 Mo)
  - [ ] URL transformée (largeur max, qualité auto, format auto) stockée sur l'événement
- Tests :
  - Intégration avec Cloudinary simulé : type refusé, taille refusée, succès

#### NOISE-013 — Mobile organisateur : création d'événement et « Mes événements »

- Objectif : Formulaire multi-étapes (infos, date, lieu, affiche, types de billets) et liste avec statut.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S2 · Type : Feature · Domaine : Mobile · Priorité : P0 · Estimation : 10 h
- Dépendances : NOISE-008, NOISE-011
- Statut : À faire
- Fichiers concernés : apps/mobile/src/features/organizer/*
- Critères d'acceptation :
  - [ ] Création en moins de 5 minutes sur un Android milieu de gamme
  - [ ] Validation partagée (schémas Zod de packages/shared)
  - [ ] Liste « Mes événements » : à venir / passé / annulé
  - [ ] Erreurs réseau gérées avec possibilité de réessayer
- Tests :
  - Tests UI : validation des étapes, soumission
  - Test manuel sur appareil

#### NOISE-014 — Mobile participant : accueil, filtres et détail

- Objectif : Découvrir les événements et voir le détail avec les types de billets en FCFA.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S2 · Type : Feature · Domaine : Mobile · Priorité : P0 · Estimation : 8 h
- Dépendances : NOISE-008, NOISE-011
- Statut : À faire
- Fichiers concernés : apps/mobile/src/features/participant/*
- Critères d'acceptation :
  - [ ] Liste paginée avec filtre par genre ; détail (affiche, description, types, prix, disponibilité)
  - [ ] Images en cache, placeholders, états vides et erreurs
  - [ ] Utilisable en 3G (payloads minimaux)
- Tests :
  - Tests UI : filtre, affichage d'un type épuisé

#### NOISE-015 — Sélecteur de rôle et activation du second rôle

- Objectif : Basculer participant / organisateur sans se reconnecter (CDC 3.1).
- Responsable : Orias · Reviewer : Yannis
- Sprint : S2 · Type : Feature · Domaine : Mobile · Priorité : P1 · Estimation : 3 h
- Dépendances : NOISE-007, NOISE-008
- Statut : À faire
- Fichiers concernés : apps/mobile/src/shared/_, apps/api/src/modules/users/_
- Critères d'acceptation :
  - [ ] Sélecteur en haut de l'app si l'utilisateur a les deux rôles
  - [ ] Activation du second rôle depuis les paramètres
  - [ ] Rôle actif persistant
- Tests :
  - Test UI du sélecteur ; test API d'activation

#### NOISE-016 — Environnement staging sur Railway

- Objectif : Déployer automatiquement main sur staging (binôme).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S2 · Type : Chore · Domaine : DevOps · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-002, NOISE-005, NOISE-006 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/environments.md, apps/mobile/eas.json
- Critères d'acceptation :
  - [ ] Service API + Postgres staging ; migrations appliquées au déploiement (prisma migrate deploy)
  - [ ] Variables d'environnement staging renseignées dans Railway (aucune dans Git)
  - [ ] URL HTTPS staging ; /health/ready OK
  - [ ] Profil EAS preview pointant vers staging
  - [ ] docs/environments.md complété
- Tests :
  - Smoke test automatique après déploiement (/health/ready)

#### NOISE-017 — Interface PaymentProvider et faux fournisseur

- Objectif : Isoler le fournisseur réel derrière une interface pour pouvoir tester et en changer.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S2 · Type : Feature · Domaine : Paiement · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-010
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/payments/providers/*
- Critères d'acceptation :
  - [ ] Interface : initiate, getStatus, verifyWebhookSignature, parseWebhook
  - [ ] Implémentation du fournisseur retenu (sandbox)
  - [ ] FakeProvider pour local et tests (succès, échec, délai, webhook rejoué)
  - [ ] Sélection par PAYMENT_PROVIDER
- Tests :
  - Unitaires sur le FakeProvider et la vérification de signature

### M2 — Achat de billet

#### NOISE-018 — Commandes : réservation de stock et expiration 15 min

- Objectif : Créer une commande PENDING qui réserve le stock et expire automatiquement.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S3 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 8 h
- Dépendances : NOISE-011
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/orders/*
- Critères d'acceptation :
  - [ ] POST /orders : 1 à 5 billets, type en vente, date limite respectée, stock suffisant (DEC-007) dans une transaction
  - [ ] Expiration : job toutes les minutes + contrôle à la lecture ; stock libéré
  - [ ] GET /orders/:id pour le suivi
- Tests :
  - Concurrence : N commandes simultanées sur le dernier billet → une seule réussit
  - Expiration : commande PENDING > 15 min → EXPIRED

#### NOISE-019 — Paiement : initiation, webhook signé, revérification, idempotence

- Objectif : Confirmer une commande uniquement sur preuve serveur (binôme : Yannis pilote, Orias co-pilote).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S3 · Type : Feature · Domaine : Paiement · Priorité : P0 · Estimation : 12 h
- Dépendances : NOISE-017, NOISE-018
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/payments/*, docs/payments.md
- Critères d'acceptation :
  - [ ] POST /payments/initiate (opérateur + numéro) ; rate limiting
  - [ ] POST /payments/webhook : signature vérifiée, statut revérifié via l'API du fournisseur, montant et devise contrôlés
  - [ ] Traitement idempotent (providerTransactionId unique) ; commande PAID et billets créés dans une seule transaction
  - [ ] Webhook sur commande expirée : paiement marqué à rembourser + alerte admin
  - [ ] GET /orders/:id/status pour le polling mobile
- Tests :
  - Webhook : signature invalide, rejeu, ordre inversé, montant incohérent, commande expirée
  - Concurrence : double webhook simultané → une seule confirmation

#### NOISE-020 — Billets et QR signé ; GET /tickets/mine

- Objectif : Générer un QR token unique, signé, jamais recalculable côté client.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S3 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-019
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/tickets/*, docs/qr-scanner.md
- Critères d'acceptation :
  - [ ] Token = UUID v4 + signature HMAC (QR_SIGNING_SECRET) ; seul le hash est stocké
  - [ ] Génération une seule fois à la confirmation
  - [ ] GET /tickets/mine : billets du participant avec payload QR, événement et statut
- Tests :
  - Unitaires : signature, falsification détectée
  - Intégration : un participant ne voit que ses billets

#### NOISE-021 — Mobile : tunnel d'achat et écran de paiement

- Objectif : Acheter en 3 étapes maximum : type et quantité → numéro Mobile Money → confirmation.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S3 · Type : Feature · Domaine : Mobile · Priorité : P0 · Estimation : 10 h
- Dépendances : NOISE-014, NOISE-018, NOISE-019
- Statut : À faire
- Fichiers concernés : apps/mobile/src/features/participant/checkout/*
- Critères d'acceptation :
  - [ ] Récapitulatif avec compte à rebours de 15 min
  - [ ] Saisie opérateur + numéro, validation
  - [ ] Écran d'attente avec polling (backoff) : en attente / confirmé / échoué / expiré
  - [ ] Écrans succès et échec avec instructions claires
  - [ ] Aucune décision de succès côté client sans statut serveur
- Tests :
  - Tests UI : états du polling, expiration
  - Test manuel avec FakeProvider

#### NOISE-022 — Mobile : « Mes billets » avec QR hors ligne

- Objectif : Afficher ses billets et leur QR plein écran même sans réseau.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S3 · Type : Feature · Domaine : Mobile · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-020
- Statut : À faire
- Fichiers concernés : apps/mobile/src/features/participant/tickets/*
- Critères d'acceptation :
  - [ ] Billets stockés localement après confirmation ; synchronisation au retour du réseau
  - [ ] QR plein écran, luminosité maximale
  - [ ] Billet annulé affiché comme tel après synchronisation
- Tests :
  - Tests UI : affichage hors ligne à partir du cache
  - Test manuel en mode avion

#### NOISE-023 — Parcours d'achat de bout en bout en sandbox sur staging

- Objectif : Prouver le cycle achat → paiement → billet avec le vrai fournisseur en sandbox.
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S3 · Type : Test · Domaine : Paiement · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-016, NOISE-019, NOISE-020, NOISE-021, NOISE-022 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/testing.md
- Critères d'acceptation :
  - [ ] Achat MTN et Moov réussis en sandbox depuis l'APK preview
  - [ ] Échec et expiration vérifiés
  - [ ] Preuves (captures, IDs de transaction sandbox) jointes à la tâche
- Tests :
  - Checklist manuelle documentée dans docs/testing.md

### M3 — Contrôle, statistiques et release v0.1.0

#### NOISE-024 — Liens scanner : JWT dédié, durée configurable, révocation

- Objectif : Permettre à l'organisateur de déléguer le scan sans compte.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S4 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-011
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/scanner/*
- Critères d'acceptation :
  - [ ] POST /scanner/links (durée choisie), liste et révocation
  - [ ] JWT signé par SCANNER_JWT_SECRET, portée limitée à un événement, jti stocké
  - [ ] Mobile organisateur : générer et partager le lien (WhatsApp / SMS)
- Tests :
  - Intégration : lien d'un autre organisateur refusé, lien expiré ou révoqué refusé

#### NOISE-025 — Validation atomique des QR

- Objectif : Un billet = une seule entrée, même avec plusieurs scanners simultanés.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S4 · Type : Feature · Domaine : Backend · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-020, NOISE-024
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/scanner/*
- Critères d'acceptation :
  - [ ] POST /scanner/validate : vérification de signature, SELECT FOR UPDATE + UPDATE en transaction
  - [ ] Résultats : ACCEPTED, ALREADY_USED (avec heure du premier scan), INVALID, CANCELLED, WRONG_EVENT
  - [ ] Chaque tentative journalisée (ScanLog)
- Tests :
  - Concurrence : 10 validations simultanées du même billet → 1 ACCEPTED
  - Un test par résultat possible

#### NOISE-026 — Web app scanner staff

- Objectif : Scanner via Chrome Android, sans installation.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S4 · Type : Feature · Domaine : Scanner · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-025
- Statut : À faire
- Fichiers concernés : apps/scanner/*, apps/api/src/app.ts
- Critères d'acceptation :
  - [ ] Ouverture par lien, accès caméra, lecture QR (BarcodeDetector, repli jsQR)
  - [ ] Écran vert (nom, type de billet) / rouge (raison) en moins d'une seconde sur 3G
  - [ ] Build servi par l'API sous /scan
  - [ ] Gestion lien expiré et perte de réseau (message explicite, nouvelle tentative)
- Tests :
  - Playwright : rendu des états avec API simulée
  - Test manuel sur 2 téléphones

#### NOISE-027 — Statistiques organisateur

- Objectif : Ventes, revenus et entrées en quasi temps réel.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S4 · Type : Feature · Domaine : Full stack · Priorité : P1 · Estimation : 6 h
- Dépendances : NOISE-020, NOISE-025
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/stats/_, apps/mobile/src/features/organizer/stats/_
- Critères d'acceptation :
  - [ ] GET /events/:id/stats : billets vendus par type, revenus bruts et nets estimés (DEC-009), scans
  - [ ] Écran mobile avec rafraîchissement périodique (30 s)
- Tests :
  - Intégration : exactitude des agrégats, accès limité au propriétaire

#### NOISE-028 — Notifications push : confirmation d'achat et rappel J-1

- Objectif : Informer le participant sans qu'il ouvre l'app.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S4 · Type : Feature · Domaine : Full stack · Priorité : P1 · Estimation : 6 h
- Dépendances : NOISE-002, NOISE-020 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/notifications/_, apps/mobile/src/shared/notifications/_
- Critères d'acceptation :
  - [ ] Enregistrement du token push (Expo + FCM)
  - [ ] Push à la confirmation d'achat ; rappel la veille de l'événement (job)
  - [ ] Échec d'envoi journalisé sans bloquer l'achat
- Tests :
  - Unitaires : sélection des destinataires du rappel
  - Test manuel sur appareil

#### NOISE-029 — Annulation d'un événement

- Objectif : Annuler proprement : billets invalidés, acheteurs prévenus, remboursement manuel tracé.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S4 · Type : Feature · Domaine : Full stack · Priorité : P1 · Estimation : 5 h
- Dépendances : NOISE-020, NOISE-028
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/events/*
- Critères d'acceptation :
  - [ ] POST /events/:id/cancel (organisateur propriétaire)
  - [ ] Billets → CANCELLED, commandes → CANCELLED, liens scanner révoqués
  - [ ] Push aux acheteurs ; liste des remboursements à effectuer (DEC-010)
- Tests :
  - Intégration : scan d'un billet annulé → CANCELLED

#### NOISE-030 — Revue de sécurité, Sentry et monitoring

- Objectif : Vérifier la checklist de docs/security.md avant la première release (binôme).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S4 · Type : Sécurité · Domaine : Sécurité · Priorité : P0 · Estimation : 6 h
- Dépendances : NOISE-019, NOISE-025 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/security.md
- Critères d'acceptation :
  - [ ] Checklist docs/security.md cochée ou tickets créés
  - [ ] Sentry API et mobile (sans données personnelles)
  - [ ] UptimeRobot sur /health/ready staging
  - [ ] pnpm audit sans vulnérabilité haute non traitée
- Tests :
  - Tests d'autorisation transverses (IDOR) sur tous les endpoints

#### NOISE-031 — Tests E2E Maestro du parcours critique

- Objectif : Automatiser inscription → achat (FakeProvider) → QR visible.
- Responsable : Orias · Reviewer : Yannis
- Sprint : S4 · Type : Test · Domaine : Mobile · Priorité : P1 · Estimation : 5 h
- Dépendances : NOISE-021, NOISE-022
- Statut : À faire
- Fichiers concernés : apps/mobile/e2e/*
- Critères d'acceptation :
  - [ ] Flow Maestro exécutable en local sur émulateur
  - [ ] Documenté dans docs/testing.md
- Tests :
  - Le flow lui-même

#### NOISE-032 — Release v0.1.0 : APK preview, test sur 3 appareils

- Objectif : Livrer un APK testable du cycle complet (objectif technique du CDC).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S4 · Type : Release · Domaine : Android · Priorité : P0 · Estimation : 5 h
- Dépendances : NOISE-023, NOISE-026, NOISE-030
- Statut : À faire
- Fichiers concernés : CHANGELOG.md, docs/android-release.md
- Critères d'acceptation :
  - [ ] APK preview signé v0.1.0 (versionCode incrémenté)
  - [ ] Cycle achat → paiement sandbox → QR → scan validé sur 3 modèles Android
  - [ ] Page de téléchargement avec guide d'installation (sources inconnues)
  - [ ] Test réseau du scanner sur un lieu réel
  - [ ] Release enregistrée dans Notion, CHANGELOG à jour, tag v0.1.0
- Tests :
  - Checklist de release

#### NOISE-033 — Build AAB de production et gestion de la signature

- Objectif : Préparer la publication Play sans l'effectuer (DEC-006).
- Responsable : Yannis · Reviewer : Orias
- Sprint : S4 · Type : Chore · Domaine : Android · Priorité : P1 · Estimation : 3 h
- Dépendances : NOISE-009
- Statut : À faire
- Fichiers concernés : apps/mobile/eas.json, docs/android-release.md
- Critères d'acceptation :
  - [ ] Build EAS profil production (AAB) réussi
  - [ ] Keystore géré par EAS, sauvegarde documentée (qui, où)
  - [ ] Politique de versioning appliquée
- Tests :
  - Vérification du bundle (bundletool) documentée

### M4 — Production et pilotes

#### NOISE-034 — Passage du paiement en production

- Objectif : Encaisser de vrais paiements.
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S5 · Type : Chore · Domaine : Paiement · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-023, NOISE-001 · Dépend d'un service ou d'une validation externe
- Statut : Bloqué
- Fichiers concernés : docs/payments.md
- Critères d'acceptation :
  - [ ] KYC validé (DEC-016), clés live dans Railway production uniquement
  - [ ] Taux de commission fixé (DEC-009)
  - [ ] Transaction réelle de faible montant réussie puis remboursée
- Tests :
  - Checklist de mise en production paiement (docs/payments.md)

#### NOISE-035 — Environnement production et déploiement sur tag

- Objectif : Production isolée, déployée uniquement sur tag validé.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S5 · Type : Chore · Domaine : DevOps · Priorité : P0 · Estimation : 4 h
- Dépendances : NOISE-016, NOISE-030 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : .github/workflows/deploy.yml, docs/environments.md
- Critères d'acceptation :
  - [ ] Environnement Railway production, base séparée, sauvegardes activées
  - [ ] Workflow : tag vX.Y.Z → approbation manuelle → déploiement → smoke test
  - [ ] Rollback documenté
- Tests :
  - Smoke test post-déploiement

#### NOISE-036 — Test terrain avec 2–3 organisateurs pilotes

- Objectif : Objectif marché du CDC : vrais billets, vrais événements.
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : S5 · Type : Test · Domaine : Produit · Priorité : P0 · Estimation : 8 h
- Dépendances : NOISE-032, NOISE-034, NOISE-035 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/pilot-report.md
- Critères d'acceptation :
  - [ ] 2–3 organisateurs accompagnés
  - [ ] Bugs remontés dans Notion et triés
  - [ ] Bilan écrit (métriques : temps d'achat, taux d'échec paiement, temps de scan)
- Tests :
  - Sans objet

#### NOISE-037 — Endpoints d'administration minimale

- Objectif : Donner aux administrateurs les leviers de support (DEC-020).
- Responsable : Orias · Reviewer : Yannis
- Sprint : S5 · Type : Feature · Domaine : Backend · Priorité : P1 · Estimation : 4 h
- Dépendances : NOISE-019
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/admin/*
- Critères d'acceptation :
  - [ ] Rôle ADMIN ; suspendre un organisateur ou un événement ; lister paiements et commandes
  - [ ] Validation des organisateurs si DEC-018 l'exige
  - [ ] Chaque action admin journalisée
- Tests :
  - Intégration : accès refusé aux non-admins

#### NOISE-039 — Export des ventes et procédure de reversement

- Objectif : Permettre les reversements manuels (DEC-009).
- Responsable : Yannis · Reviewer : Orias
- Sprint : S5 · Type : Feature · Domaine : Backend · Priorité : P1 · Estimation : 3 h
- Dépendances : NOISE-027
- Statut : À faire
- Fichiers concernés : apps/api/src/modules/admin/*
- Critères d'acceptation :
  - [ ] Export CSV par événement : ventes, commission, net organisateur
  - [ ] Procédure de reversement et de remboursement dans docs/payments.md
- Tests :
  - Unitaires : calcul de commission (arrondis en FCFA entiers)

#### NOISE-040 — Vérification du téléphone et mot de passe oublié (OTP SMS)

- Objectif : Selon DEC-017.
- Responsable : Yannis · Reviewer : Orias
- Sprint : S5 · Type : Feature · Domaine : Full stack · Priorité : P2 · Estimation : 8 h
- Dépendances : NOISE-001, NOISE-007
- Statut : Bloqué
- Fichiers concernés : apps/api/src/modules/auth/*
- Critères d'acceptation :
  - [ ] Fournisseur SMS choisi ; OTP réel (pas simulé), expiré après 5 min, 5 essais max
  - [ ] Écrans mobiles associés
- Tests :
  - Intégration : OTP expiré, essais épuisés, rejeu

### M5 — Google Play

#### NOISE-038 — Google Play Console et test fermé

- Objectif : Publier sur Google Play après le MVP (DEC-006).
- Responsable : Commun · Reviewer : revue mutuelle (binôme)
- Sprint : Post-MVP · Type : Release · Domaine : Android · Priorité : P2 · Estimation : 4 h
- Dépendances : NOISE-033 · Dépend d'un service ou d'une validation externe
- Statut : À faire
- Fichiers concernés : docs/android-release.md
- Critères d'acceptation :
  - [ ] Compte développeur créé (titulaire décidé), vérification d'identité
  - [ ] Fiche store, politique de confidentialité, Data safety
  - [ ] Test fermé 12 testeurs pendant 14 jours, puis demande d'accès production
- Tests :
  - Rapport de pré-lancement sans erreur bloquante

## 7. Hors MVP (idées, à ne pas démarrer)

iOS, remboursements automatisés, revente de billets, analytics avancés, multi-langue, recommandation, abonnement Pro, mise en avant payante, extension Lomé / Dakar / Abidjan, mode scanner hors ligne. Suivi dans la base Notion « Ideas ».
