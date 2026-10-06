# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Mis à jour dans chaque PR et à la fin de chaque intervention de Claude. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Dernière mise à jour : 2026-10-06 (Claude).

## Synthèse

| Indicateur | Valeur |
| --- | --- |
| Tâches mergées dans main | 4 (NOISE-000, NOISE-010, NOISE-017, NOISE-041) |
| PR ouverte | aucune |
| Travail local non poussé | NOISE-006 (branche feat/NOISE-006-prisma-schema, non commitée) |
| Environnements en ligne | aucun (local uniquement) |
| Dernière release | aucune |

## Terminé

| Tâche | Statut | Preuve |
| --- | --- | --- |
| NOISE-000 Socle du repository et documentation | Validé | PR #1 mergée dans main (commit 96e662c) |
| NOISE-004 Espace Notion | Implémenté | Créé par Claude le 2026-09-24 ; partage et invitation de Yannis non reconfirmés |
| NOISE-017 Interface PaymentProvider (FedaPay + Fake) | Validé | PR #3 mergée dans main (commit 0975075) par ORiVS ; 47 tests API ; FedaPayProvider vérifié contre la vraie sandbox (MTN 0166000001 → SUCCEEDED, Moov 0164000000 → FAILED) |
| NOISE-041 Revue de PR par IA (Claude Code GitHub Actions) | Validé | PR #4 mergée dans main ; DEC-021 ; app GitHub Claude installée, CODEOWNERS actif ; protection de main activée le 2026-10-06 (1 approbation, dismiss stale, Code Owners, checks CI obligatoires, règle appliquée aux admins) ; Revue Claude volontairement non requise |
| NOISE-010 Choix du fournisseur de paiement (FedaPay) | Validé | PR #2 mergée dans main par ORiVS ; DEC-005 complétée ; conflit decisions.md résolu le 2026-10-06 |

## En cours / en revue

| Tâche | Statut | Détail |
| --- | --- | --- |
| NOISE-006 Schéma Prisma v1, migration initiale, seed | En cours, non poussé | Branche feat/NOISE-006-prisma-schema en local (poste d'Orias), non commitée. Vérifié par Claude le 2026-09-26 sur PostgreSQL 16 (Linux) : schéma valide, migration appliquée, seed exécuté 3 fois sans doublon, /health/ready correct, 16 tests passent. Jamais ouvert en PR. Non vérifié depuis sous Windows/CI. |

## Bloqué

| Élément | Raison | Débloqué par |
| --- | --- | --- |
| NOISE-034 Paiement production | KYC du fournisseur impossible tant que le titulaire du compte marchand n'est pas décidé | DEC-016 |
| NOISE-040 OTP SMS | Périmètre non décidé | DEC-017 |

## Prochaines tâches

1. Committer NOISE-006 sur sa branche et ouvrir la PR.
2. Revoir le taux de commission (DEC-009) et DEC-016 à DEC-019.
3. Si le check "Revue Claude" continue d'échouer sur de prochaines PR, vérifier le jeton/quota de l'abonnement Claude d'Orias.

## Décisions récentes

- 2026-10-06 — DEC-021 acceptée : revue de PR par IA, consultative, validation humaine obligatoire.
- 2026-10-01 — DEC-005 complétée : FedaPay choisi comme fournisseur (NOISE-010).
- 2026-09-24 — DEC-001 à DEC-014 et DEC-020 acceptées (plan global validé) ; DEC-011 et DEC-015 proposées ; DEC-016 à DEC-019 en attente.
- 2026-09-24 — DEC-012 : pas de hook Git local, format des commits vérifié en CI.

## Journal

- 2026-10-06 — Protection de la branche main activée (NOISE-041 complet) : 1 approbation, dismiss stale, Code Owners, checks CI obligatoires, règle appliquée aux admins.
- 2026-10-06 — PR #2 (NOISE-010) mergée par ORiVS après résolution du conflit decisions.md et correction du formatage Prettier.
- 2026-10-06 — progress.md resynchronisé par Claude avec l'état réel du dépôt GitHub (PR #1, #3, #4 mergées ; PR #2 en conflit). L'ancienne version de ce fichier n'était plus à jour depuis le 2026-09-24 sur main.
- 2026-10-06 — NOISE-041 mergée (PR #4) : revue de PR par IA active, consultative, validation humaine obligatoire.
- 2026-10-02 — NOISE-017 vérifiée par Orias (Windows), mergée (PR #3).
- 2026-10-01 — NOISE-010 : FedaPay choisi comme fournisseur après tests sandbox (Yannis), PR #2 ouverte, revue demandée à Orias.
- 2026-09-26 — NOISE-006 implémentée par Claude sur la branche feat/NOISE-006-prisma-schema (non commitée), vérifiée en local (Postgres 16 Linux).
- 2026-09-25 — NOISE-000 à NOISE-005 déclarées faites par Orias, non revérifiées par Claude.
- 2026-09-24 — Espace Notion créé par Claude (NOISE-004). Plan global validé, socle du monorepo créé (NOISE-000), PR #1 mergée.
