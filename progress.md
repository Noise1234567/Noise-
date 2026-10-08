# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Mise à jour : par la PR de suivi (une seule PR groupée, après les fusions), pas par chaque PR de fonctionnalité. Une ligne par tâche, sans tableau, pour que Git fusionne sans conflit. Chaque PR de fonctionnalité porte son statut dans sa propre description.

Dernière mise à jour : 2026-10-07 (Claude).

## Synthèse

- Tâches mergées dans main : NOISE-000, NOISE-006, NOISE-007, NOISE-010, NOISE-017, NOISE-041, NOISE-042.
- PR ouvertes : #9 (NOISE-039), #11 (NOISE-012), #12 (NOISE-026), #13 (NOISE-019), #15 (NOISE-011).
- Environnements en ligne : aucun (local uniquement).
- Dernière release : aucune.

## Terminé

- NOISE-000 Socle du repository et documentation : Validé. PR #1 mergée (commit 96e662c).
- NOISE-004 Espace Notion : Implémenté. Créé par Claude le 2026-09-24 ; partage et invitation de Yannis non reconfirmés.
- NOISE-006 Schéma Prisma v1, migration initiale, seed : Implémenté. PR #5 mergée (commit 008b61d) ; vérifiée par Yannis et Orias (migration sur noise_dev et noise_test, seed, 66 tests dont 16 d'intégration).
- NOISE-007 Authentification API : Implémenté. PR #6 mergée (commit a6407e5) ; routes register, login, refresh (rotation, réutilisation = révocation de toutes les sessions), logout, GET /api/v1/me, PATCH /api/v1/me/roles ; argon2id, access token JWT 15 min, refresh token opaque haché, limitation 5 essais / 15 min. Vérifiée par Yannis puis par Orias en local (109 tests API, 26 tests shared). Pas encore vérifiée sur staging (inexistant).
- NOISE-010 Choix du fournisseur de paiement : Validé. FedaPay retenu (DEC-005), mergée (commit 8b0f79e).
- NOISE-017 Interface PaymentProvider (FedaPay + Fake) : Validé. PR #3 mergée ; 47 tests API ; FedaPayProvider vérifié contre la vraie sandbox.
- NOISE-041 Revue de PR par IA : Validé. PR #4 mergée ; DEC-021 ; protection de main activée le 2026-10-06 (1 approbation, Code Owners, checks CI requis) ; Revue Claude non requise.
- NOISE-042 Évaluation de FeexPay : Validé. PR #10 mergée (commit 7416a92) ; FedaPay conservé (FeexPay : webhooks non signés, aucun paiement validé en sandbox).

## En revue

- NOISE-039 Export des ventes et répartition (DEC-022) : PR #9 (Yannis). Revue d'Orias en cours ; conflit de fusion à résoudre par Yannis.
- NOISE-019 Paiement, webhook signé, statut de commande : PR #13 (Yannis, construite sur #9). À lancer en local par le reviewer (CLAUDE.md section 12).
- NOISE-011 API événements : PR #15 (Orias). 148 tests API confirmés par Orias sur Postgres 17 ; revue de Yannis à demander.
- NOISE-012 Upload d'affiche : PR #11 (Yannis, dépend de NOISE-011).
- NOISE-026 Scanner : PR #12 (Yannis ; test manuel sur téléphone requis).

## Bloqué

- NOISE-034 Paiement production : KYC impossible tant que le titulaire du compte marchand n'est pas décidé (DEC-016).
- NOISE-040 OTP SMS : périmètre non décidé (DEC-017).
- NOISE-008 Application mobile (socle) : choix de navigation à confirmer (DEC-011).

## Prochaines tâches

- Relire et fusionner #9, puis #13, #11 (après #15), #12.
- NOISE-008 : ne jamais lancer deux refresh en parallèle (docs/api.md).
- Décisions en attente : DEC-011, DEC-016 à DEC-019, écart des frais FedaPay (1,8 % annoncé, environ 4 % observé en sandbox).
- Si le check « Revue Claude » échoue encore, vérifier le jeton de l'abonnement Claude d'Orias.

## Décisions récentes

- 2026-10-06 — DEC-021 acceptée : revue de PR par IA, consultative, validation humaine obligatoire.
- 2026-10-06 — DEC-022 proposée (PR #5) : parts Noise / partageur / organisateur sur la commande, affiliation optionnelle sur l'événement.
- 2026-10-01 — DEC-005 complétée : FedaPay choisi comme fournisseur (proposé par Yannis, validé par Orias) ; consignée dans decisions.md par la PR #2, en revue.
- 2026-09-24 — DEC-001 à DEC-014 et DEC-020 acceptées (plan global validé) ; DEC-011 et DEC-015 proposées ; DEC-016 à DEC-019 en attente.
- 2026-09-24 — DEC-012 : pas de hook Git local, format des commits vérifié en CI.

## Journal

- 2026-10-07 — NOISE-042 mergée (PR #10, commit 7416a92) ; NOISE-010 mergée (commit 8b0f79e). Revue de #9 (NOISE-039) en cours, #13 (NOISE-019) attend #9. Passage de progress.md en listes pour éviter les conflits de fusion.
- 2026-10-07 — NOISE-007 mergée (PR #6, commit a6407e5) après vérification locale d'Orias (109 tests API, 26 tests shared). Conflit progress.md de la PR #2 résolu sur la dernière main.
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
