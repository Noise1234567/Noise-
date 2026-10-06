# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Mis à jour dans chaque PR et à la fin de chaque intervention de Claude. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Dernière mise à jour : 2026-10-06 (Claude).

## Synthèse

| Indicateur               | Valeur                                         |
| ------------------------ | ---------------------------------------------- |
| Tâches mergées dans main | 4 (NOISE-000, NOISE-006, NOISE-017, NOISE-041) |
| PR ouvertes              | 2 (NOISE-010 PR #2, NOISE-007)                 |
| Environnements en ligne  | aucun (local uniquement)                       |
| Dernière release         | aucune                                         |

## Terminé

| Tâche                                                     | Statut     | Preuve                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOISE-000 Socle du repository et documentation            | Validé     | PR #1 mergée dans main (commit 96e662c)                                                                                                                                                                                                                               |
| NOISE-004 Espace Notion                                   | Implémenté | Créé par Claude le 2026-09-24 ; partage et invitation de Yannis non reconfirmés                                                                                                                                                                                       |
| NOISE-017 Interface PaymentProvider (FedaPay + Fake)      | Validé     | PR #3 mergée dans main (commit 0975075) par ORiVS ; 47 tests API ; FedaPayProvider vérifié contre la vraie sandbox (MTN 0166000001 → SUCCEEDED, Moov 0164000000 → FAILED)                                                                                             |
| NOISE-041 Revue de PR par IA (Claude Code GitHub Actions) | Validé     | PR #4 mergée dans main ; DEC-021 ; app GitHub Claude installée, CODEOWNERS actif ; protection de main activée le 2026-10-06 (1 approbation, dismiss stale, Code Owners, checks CI obligatoires, règle appliquée aux admins) ; Revue Claude volontairement non requise |
| NOISE-006 Schéma Prisma v1, migration initiale, seed      | Implémenté | PR #5 mergée dans main (commit 008b61d) après revue d'Orias ; vérifiée par Yannis (port 55432) et Orias (port 55433) : migration sur noise_dev et noise_test, seed, 66 tests dont 16 d'intégration, checks CI requis verts                                            |

## En cours / en revue

| Tâche                                                | Statut                                 | Détail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NOISE-010 Choix du fournisseur de paiement (FedaPay) | En revue (PR #2, Orias reviewer)       | DEC-005 complétée côté branche (FedaPay). Bloquée par l'approbation obligatoire (Orias) et par un conflit sur progress.md à résoudre une seconde fois, suite à l'incident du 2026-10-06 (voir journal). decisions.md sur main n'a pas encore la mise à jour FedaPay tant que cette PR n'est pas mergée.                                                                                                                                                                                                                                                                                                                                                                         |
| NOISE-007 Authentification API                       | En revue (PR à ouvrir, Orias reviewer) | Branche feat/NOISE-007-auth, à jour avec main : POST /api/v1/auth/register, /login, /refresh (rotation ; réutilisation d'un ancien jeton = révocation de toutes les sessions), /logout, GET /api/v1/me, PATCH /api/v1/me/roles ; argon2id, access token JWT 15 min, refresh token opaque haché, limitation 5 essais / 15 min par IP et numéro, numéros béninois en E.164, JWT_ACCESS_SECRET obligatoire hors tests. Vérifié par Yannis le 2026-10-06 : 109 tests API (dont 16 d'authentification sur noise_test) et 26 tests shared ; 3 régressions volontaires détectées ; essai manuel sur le serveur avec le compte de démo ; aucun mot de passe ni jeton dans les journaux. |

## Bloqué

| Élément                       | Raison                                                                                  | Débloqué par |
| ----------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| NOISE-034 Paiement production | KYC du fournisseur impossible tant que le titulaire du compte marchand n'est pas décidé | DEC-016      |
| NOISE-040 OTP SMS             | Périmètre non décidé                                                                    | DEC-017      |

## Prochaines tâches

1. Résoudre le conflit progress.md et merger la PR #2 (NOISE-010) après approbation d'Orias.
2. Relire et merger NOISE-007 (authentification), puis enchaîner sur NOISE-008 (écrans d'auth mobile) : ne jamais lancer deux refresh en parallèle (docs/api.md).
3. Revoir le taux de commission (DEC-009) et DEC-016 à DEC-019.
4. Si le check "Revue Claude" continue d'échouer sur de prochaines PR, vérifier le jeton/quota de l'abonnement Claude d'Orias.

## Décisions récentes

- 2026-10-06 — DEC-021 acceptée : revue de PR par IA, consultative, validation humaine obligatoire.
- 2026-10-06 — DEC-022 proposée (PR #5) : parts Noise / partageur / organisateur sur la commande, affiliation optionnelle sur l'événement.
- 2026-10-01 — DEC-005 complétée côté branche NOISE-010 : FedaPay choisi comme fournisseur (pas encore sur main, PR #2 non mergée).
- 2026-09-24 — DEC-001 à DEC-014 et DEC-020 acceptées (plan global validé) ; DEC-011 et DEC-015 proposées ; DEC-016 à DEC-019 en attente.
- 2026-09-24 — DEC-012 : pas de hook Git local, format des commits vérifié en CI.

## Journal

- 2026-10-06 — NOISE-006 mergée (PR #5, commit 008b61d). Branche NOISE-007 mise à jour avec main (conflits app.ts, server.ts et progress.md résolus).
- 2026-10-06 — Incident : un commit direct sur main (b20ee61, "Revise progress document...") a remplacé le contenu de progress.md par celui de decisions.md par erreur de copier-coller. decisions.md lui-même n'a pas été touché. Corrigé par Claude via une nouvelle PR après constat.
- 2026-10-06 — Protection de la branche main activée (NOISE-041 complet) : 1 approbation, dismiss stale, Code Owners, checks CI obligatoires, règle appliquée aux admins.
- 2026-10-06 — NOISE-041 mergée (PR #4) : revue de PR par IA active, consultative, validation humaine obligatoire.
- 2026-10-06 — PR #5 (NOISE-006) relue par Orias : schéma de Yannis retenu (comparaison avec la version locale de Claude faite par lecture des fichiers), vérifié en local, conflit progress.md résolu.
- 2026-10-06 — PR #5 (NOISE-006) ouverte par Yannis, premier jet, revue demandée à Orias.
- 2026-10-02 — NOISE-017 vérifiée par Orias (Windows), mergée (PR #3).
- 2026-10-01 — NOISE-010 : FedaPay choisi comme fournisseur après tests sandbox (Yannis), PR #2 ouverte, revue demandée à Orias.
- 2026-09-26 — NOISE-006 implémentée par Claude sur la branche feat/NOISE-006-prisma-schema (non commitée), vérifiée en local (Postgres 16 Linux).
- 2026-09-25 — NOISE-000 à NOISE-005 déclarées faites par Orias, non revérifiées par Claude.
- 2026-09-24 — Espace Notion créé par Claude (NOISE-004). Plan global validé, socle du monorepo créé (NOISE-000), PR #1 mergée.
