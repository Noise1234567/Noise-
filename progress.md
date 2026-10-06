# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Mis à jour dans chaque PR et à la fin de chaque intervention de Claude. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Dernière mise à jour : 2026-09-24 (Claude).

## Synthèse

| Indicateur                          | Valeur                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| Sprint en cours                     | S1 (2026-09-24 → 2026-09-30) — M0 Fondations et pilotage |
| Fonctionnalités métier implémentées | 0                                                        |
| Tâches validées                     | 0 / 41                                                   |
| Environnements en ligne             | aucun (local uniquement)                                 |
| Dernière release                    | aucune                                                   |

## Terminé

Rien n'est encore au statut Validé.

## En cours / en revue

| Tâche                                          | Statut                                                   | Détail vérifié                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOISE-000 Socle du repository et documentation | Implémenté, non commité, en attente de revue (NOISE-003) | Fichiers déposés dans le dossier local du repo le 2026-09-24. Vérifié dans l'environnement de Claude (Linux, Node 22) : `pnpm install`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck` et `pnpm test` passent (4 tests API) ; `pnpm build` produit `apps/api/dist` et `apps/scanner/dist` ; `node dist/server.js` répond sur `/health` et renvoie une 404 au format standard ; `expo config` lit la configuration de l'app. |

| NOISE-004 Espace Notion | Implémenté, revue Orias à faire | Créé par Claude via le connecteur le 2026-09-24 : page « Noise — Pilotage » (privée), 11 bases reliées, 41 tâches avec dépendances, formules de charge et d'équilibre, vues (Kanban, Tâches Yannis/Orias, Partagées, Bloquées, Prêtes, Externes, Roadmap, Équilibre, À relire) et tableau de bord. Non fait : partage de la page, invitation de Yannis. |

| NOISE-006 Schéma Prisma v1, migration initiale et seed | En cours (binôme ; premier jet de Yannis le 2026-10-06, à relire et approuver par Orias) | Branche `feat/NOISE-006-prisma-schema` : 10 modèles (User, RefreshToken, Event, TicketType, Order, Payment, Ticket, ScannerLink, ScanLog, PushToken), enums, index, contraintes CHECK en SQL, parts de répartition et affiliation préparées (DEC-022) ; client `apps/api/src/lib/prisma.ts` ; `/health/ready` ; seed ; CI (db:generate, db:deploy). Vérifié le 2026-10-06 : migration appliquée sur noise_dev et noise_test (Docker, port 55432 sur cette machine), seed relançable, lint, typecheck, 23 tests dont 16 d'intégration sur noise_test ; un test a révélé un trou dans une contrainte CHECK (NULL), corrigé. Non vérifié : CI GitHub. |

| NOISE-007 Authentification API | Implémentation terminée, PR à ouvrir (Yannis ; revue Orias ; à merger après NOISE-006) | Branche `feat/NOISE-007-auth` (contient NOISE-006) : POST /api/v1/auth/register, /login, /refresh (rotation, réutilisation = révocation de toutes les sessions), /logout, GET /api/v1/me, PATCH /api/v1/me/roles ; argon2id, access token JWT 15 min, refresh token opaque haché, limitation 5 essais / 15 min par IP et numéro, numéros béninois normalisés en E.164, JWT_ACCESS_SECRET obligatoire hors tests. Vérifié le 2026-10-06 : 65 tests API (dont 16 d'authentification de bout en bout sur noise_test) et 26 tests shared ; 3 régressions volontaires détectées (dont une course entre deux rafraîchissements, reproduite de façon déterministe) ; essai manuel sur le serveur réel avec le compte de démo ; aucun mot de passe ni jeton dans les journaux. |

Non vérifié par Claude (à faire dans NOISE-003) :

- `prisma generate` : le téléchargement des moteurs Prisma est bloqué par le réseau de l'environnement de Claude ;
- `expo-doctor` : 19/21 contrôles passent, les 2 restants échouent faute d'accès réseau aux services Expo ;
- fonctionnement sous Windows, Docker (`pnpm db:up`) et lancement de l'app sur un téléphone ;
- exécution de la CI GitHub Actions (jamais lancée).

## Bloqué

| Élément                       | Raison                                                                                  | Débloqué par |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| NOISE-034 Paiement production | KYC du fournisseur impossible tant que le titulaire du compte marchand n'est pas décidé | DEC-016      |
| NOISE-040 OTP SMS             | Périmètre non décidé                                                                    | DEC-017      |

## Prochaines tâches

1. NOISE-001 — trancher DEC-015 à DEC-019 et le taux de commission (les deux).
2. NOISE-002 — créer les comptes externes, lancer le KYC (les deux).
3. NOISE-003 — revoir, tester et merger le socle (Yannis, revue Orias).
4. NOISE-004 — Orias : relire l'espace Notion, le déplacer dans un espace partagé, inviter Yannis.
5. Ensuite : NOISE-005 (Yannis), NOISE-006 en binôme, puis NOISE-007 (Yannis) et NOISE-008 (Orias) en parallèle.

## Décisions récentes

- 2026-09-24 — DEC-001 à DEC-014 et DEC-020 acceptées (plan global validé) ; DEC-011 et DEC-015 proposées ; DEC-016 à DEC-019 en attente.
- 2026-09-24 — DEC-012 : pas de hook Git local, format des commits vérifié en CI.

## Journal

- 2026-09-24 — Espace Notion créé par Claude (NOISE-004). NOISE-004 réattribuée à Claude, revue par Orias.
- 2026-09-24 — Plan global validé. Socle du monorepo, documentation, roadmap (41 tâches) et modèle Notion créés par Claude (NOISE-000).
