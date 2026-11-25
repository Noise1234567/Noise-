# Interface d'administration (NOISE-065) — conception

Statut : proposition à valider par Orias avant de commencer le code (DEC-030, Proposée).

## 1. Besoin

L'équipe Noise doit pouvoir, sans Prisma Studio ni requêtes à la main :

- valider ou refuser les pièces d'identité des organisateurs (DEC-018) ;
- suivre les paiements et traiter les alertes « client à rembourser » (NOISE-059) ;
- suivre les annulations : remboursements à faire, montants dus par les organisateurs (DEC-025, NOISE-066) ;
- suspendre ou réactiver un organisateur ou un événement (DEC-020) ;
- voir les chiffres clés : ventes, commissions, événements, organisateurs, taux d'échec des paiements.

Utilisateurs : 2 à 3 personnes, sur ordinateur portable, parfois sur téléphone. Peu de trafic, mais des données sensibles (numéros complets, pièces d'identité).

## 2. Choix techniques proposés

| Sujet       | Proposition                                                                             | Alternative écartée                                                                                        |
| ----------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Emplacement | `apps/admin`, build servi par l'API sous `/admin`, comme le scanner sous `/scan`        | Site séparé : un déploiement de plus, CORS à ouvrir, une origine de plus à sécuriser                       |
| Framework   | Vite + React + TypeScript, sans bibliothèque de composants                              | TypeScript sans framework comme le scanner : trop lourd pour une dizaine d'écrans avec tableaux et filtres |
| Navigation  | React Router                                                                            | Next.js : rendu serveur inutile, un deuxième serveur Node                                                  |
| Données     | `fetch` et un petit client typé avec les DTO de `@noise/shared`                         | TanStack Query : utile plus tard, pas nécessaire pour un premier jet                                       |
| Style       | Thème sombre de l'app (couleurs et polices reprises de `apps/mobile/src/theme`)         | Thème clair d'outil d'administration : incohérent avec l'identité de Noise                                 |
| Tests       | Vitest et Testing Library (composants), Playwright (parcours de validation d'une pièce) | —                                                                                                          |

Dépendances ajoutées : `react`, `react-dom`, `react-router`, et en développement `@vitejs/plugin-react`, `@testing-library/react`. Aucune côté API.

## 3. Connexion et sécurité

- Connexion avec `POST /api/v1/auth/login` ; l'interface refuse tout compte sans le rôle ADMIN, et l'API le vérifie déjà sur chaque route `/admin/*`.
- Jeton d'accès (15 min) gardé en mémoire seulement. Jeton de rafraîchissement dans `sessionStorage` : fermer l'onglet déconnecte. Jamais de `localStorage`.
- Politique de sécurité du contenu stricte sur `/admin` (scripts de la même origine uniquement), pour limiter le risque de vol de jeton par injection de script.
- Option à discuter : jeton de rafraîchissement dans un cookie `HttpOnly; Secure; SameSite=Strict` limité à `/api/v1/auth`. Plus sûr, mais demande de modifier les routes d'authentification et de traiter le CSRF. Proposé pour NOISE-030.
- Déconnexion automatique après 30 minutes d'inactivité.
- Numéros complets affichés seulement là où ils servent (remboursements) ; ailleurs, numéro masqué comme dans les journaux.
- Chaque action reste journalisée par l'API (`admin_audit_logs`) ; un écran permet de consulter ce journal.

## 4. Écrans

| Écran                         | Contenu                                                                                                                                                                            | Routes existantes                                                                           | Routes à créer              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------- |
| Connexion                     | Téléphone, mot de passe                                                                                                                                                            | `POST /auth/login`, `/auth/refresh`, `/auth/logout`                                         | —                           |
| Tableau de bord               | Ventes et commissions (jour, 7 jours, 30 jours), événements publiés, organisateurs, taux d'échec des paiements, compteurs « à traiter » (pièces, alertes, remboursements restants) | —                                                                                           | `GET /admin/stats`          |
| Pièces d'identité             | File d'attente, la plus ancienne d'abord ; aperçu de la pièce (lien signé 5 min) ; valider, refuser avec motif, refus immédiat                                                     | `GET /admin/identity-verifications`, `.../document`, `.../approve`, `.../refuse`            | —                           |
| Paiements et alertes          | Liste filtrable (statut, opérateur, dates, événement) ; onglet « Alertes » : paiements reçus sans billet (commande expirée, doublon, montant incohérent)                           | `GET /admin/payments`, `GET /admin/orders`                                                  | `GET /admin/payment-alerts` |
| Annulations et remboursements | Événements annulés : dû par l'organisateur, échéance, remboursements faits et restants ; détail avec « Marquer remboursé » et la référence du transfert                            | `GET /admin/events/:id/refunds`, `POST /admin/orders/:id/refund` (NOISE-066)                | `GET /admin/cancellations`  |
| Organisateurs                 | Recherche par nom ou téléphone ; statut, pièce, événements ; suspendre ou réactiver avec motif                                                                                     | `POST /admin/users/:id/suspend`, `/reactivate`                                              | `GET /admin/organizers`     |
| Événements                    | Recherche, filtre par statut ; ventes et export CSV ; suspendre ou réactiver avec motif                                                                                            | `GET /admin/events/:id/sales`, `sales.csv`, `POST /admin/events/:id/suspend`, `/reactivate` | `GET /admin/events`         |
| Journal                       | Actions d'administration : qui, quoi, quand, motif                                                                                                                                 | —                                                                                           | `GET /admin/audit-logs`     |

Toutes les listes utilisent la pagination par curseur des listes existantes (`limit`, `cursor`, réponse `{ items, nextCursor }`).

## 5. Découpage proposé

La tâche est estimée à 2 à 3 jours. Elle est découpée pour garder des PR de moins de 400 lignes et respecter la règle « celui qui fait l'API ne fait pas l'écran » (CLAUDE.md section 11).

| Partie | Contenu                                                                                                                                                                            | Responsable proposé |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| (a)    | API : `GET /admin/stats`, `/admin/organizers`, `/admin/events`, `/admin/cancellations`, `/admin/payment-alerts`, `/admin/audit-logs`, avec tests d'intégration (nominal, 401, 403) | Orias               |
| (b)    | Socle `apps/admin` : build servi sous `/admin`, CSP, connexion ADMIN, mise en page, écran Pièces d'identité, E2E Playwright de la validation d'une pièce                           | Yannis              |
| (c)    | Écrans Annulations et remboursements, Paiements et alertes                                                                                                                         | Yannis              |
| (d)    | Tableau de bord, Organisateurs, Événements, Journal                                                                                                                                | Yannis              |

La partie (b) n'utilise que des routes existantes et peut commencer dès la validation ; (c) et (d) attendent (a).

## 6. Questions pour Orias

1. React et React Router dans `apps/admin`, servi sous `/admin` : d'accord ?
2. Jeton de rafraîchissement en `sessionStorage` pour le MVP, cookie `HttpOnly` reporté à NOISE-030 : d'accord ?
3. Répartition de la section 5 : l'API pour toi, les écrans pour Yannis ?
4. Manque-t-il un écran pour le support au quotidien (recherche d'un client par téléphone, renvoi d'un billet) ?
