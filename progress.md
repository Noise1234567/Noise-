# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Mise à jour : par la PR de suivi (une seule PR groupée, après les fusions), pas par chaque PR de fonctionnalité. Une ligne par tâche, sans tableau, pour que Git fusionne sans conflit. Chaque PR de fonctionnalité porte son statut dans sa propre description.

Dernière mise à jour : 2026-10-15 (Claude, d'après l'historique de main et les branches poussées).

## Synthèse

- Tâches mergées dans main : NOISE-000, NOISE-001 (décisions), NOISE-006, NOISE-007, NOISE-008, NOISE-010, NOISE-011, NOISE-012, NOISE-014, NOISE-017, NOISE-018, NOISE-019, NOISE-020, NOISE-026 (interface), NOISE-039, NOISE-041, NOISE-042, NOISE-044 (partie 1), NOISE-047.
- Branches poussées en attente de revue : NOISE-013, NOISE-021, NOISE-022, NOISE-049, DEC-027.
- Aucune tâche n'est encore « Testée » : le statut exige une vérification sur staging, qui n'existe pas (NOISE-016).
- Environnements en ligne : aucun (local uniquement).
- Notion : pas synchronisé depuis le 2026-10-07 (limite de blocs de l'offre gratuite atteinte).
- Dernière release : aucune.

## Terminé

- NOISE-000 Socle du repository et documentation : Validé. PR #1 mergée (commit 96e662c).
- NOISE-001 Décisions métier (frais, commission, reversements, annulation, e-mail, identité) : Implémenté. PR #19 mergée (commit b9e6fda) ; DEC-018 et DEC-022 à DEC-026 ; DEC-023 précisée par la PR #24 (commit c24b6e7).
- NOISE-004 Espace Notion : Implémenté. Créé par Claude le 2026-09-24 ; synchronisation arrêtée par la limite de blocs.
- NOISE-006 Schéma Prisma v1, migration initiale, seed : Implémenté. PR #5 mergée (commit 008b61d).
- NOISE-007 Authentification API : Implémenté. PR #6 mergée (commit a6407e5).
- NOISE-008 Application mobile (thème, navigation, auth, accueils par rôle) : Implémenté. PR #17, #20, #18, #21, #22 mergées (dernier commit 38fa7f4) ; champ e-mail de l'inscription inclus (NOISE-047).
- NOISE-010 Choix du fournisseur de paiement : Validé. FedaPay retenu (DEC-005), commit 8b0f79e.
- NOISE-011 API événements et types de billets : Implémenté. PR #15 mergée (commit a111413) ; GET /events/mine inclus.
- NOISE-012 Upload des affiches : Implémenté. PR #11 (commit 10a2f25) et #28 (commit d003b52, route montée avec contrôle de propriété avant la réception du fichier). Non vérifié : envoi réel vers Cloudinary (pas de compte).
- NOISE-014 Mobile participant (accueil, filtres, détail) : Implémenté. PR #29 (commit e7e102b, styles multiples et « presque complet ») et #30 (commit f7c37b0).
- NOISE-017 Interface PaymentProvider (FedaPay + Fake) : Validé. PR #3 mergée.
- NOISE-018 Commandes, réservation du stock, expiration : Implémenté. PR #26 mergée (commit 48954ea).
- NOISE-019 Paiement, webhook signé, statut de commande : Implémenté. PR #13 mergée (commit b2b9eb5) ; paiement réel en sandbox FedaPay vérifié le 2026-10-07 avant fusion (6 000 FCFA, confirmé sans webhook par la revérification) ; billets créés à la confirmation, test de bout en bout ajouté.
- NOISE-020 Billets et QR signé, GET /tickets/mine : Implémenté. PR #27 fusionnée dans la branche de NOISE-018, mergée avec la PR #26.
- NOISE-026 Scanner web staff (interface) : Implémenté. PR #12 mergée (commit 246cbb5) ; test manuel sur iPhone (iOS 18.7). La validation côté serveur attend NOISE-025.
- NOISE-039 Export des ventes et répartition : Implémenté. PR #9 mergée (commit 2769d90).
- NOISE-041 Revue de PR par IA : Validé. PR #4 mergée.
- NOISE-042 Évaluation de FeexPay : Validé. PR #10 mergée (commit 7416a92).
- NOISE-044 Frais d'organisation, partie 1 (capacité, calcul des frais, billets gratuits) : Implémenté. PR #23 mergée (commit c7876c7). Reste : paiement des frais avant publication.
- NOISE-047 E-mail demandé à l'inscription : Implémenté. PR #25 mergée (commit 4c9f81b) ; champ mobile dans la PR #21.

## En revue

- NOISE-013 Mobile organisateur, création d'événement et « Mes événements » : branche feat/NOISE-013-organizer-events (Yannis), poussée le 2026-10-15. 146 tests mobile en local. Reste : test manuel sur téléphone, numéro de virement (DEC-027).
- NOISE-022 Mes billets avec QR hors ligne : branche feat/NOISE-022-offline-tickets (Yannis), poussée le 2026-10-15. Modifie la reprise de session hors ligne (code de NOISE-008, relecture d'Orias demandée).
- NOISE-021 Tunnel d'achat et paiement : branche feat/NOISE-021-checkout (Yannis), poussée le 2026-10-15.
- NOISE-049 Mission de prospection à Cotonou : branche docs/NOISE-049-prospection-cotonou (Yannis), poussée le 2026-10-15 ; le classeur rempli reste hors de Git (données personnelles).
- DEC-027 Solde de l'organisateur et virements à la demande : branche docs/DEC-027-organizer-withdrawals, poussée le 2026-10-15 ; décision commune à relire par Orias.

## En cours

- NOISE-024 Liens scanner : branche feat/NOISE-024-scanner-links (Orias), sans PR au 2026-10-15.

## Bloqué

- NOISE-034 Paiement production : KYC impossible tant que le titulaire du compte marchand n'est pas décidé (DEC-016).
- NOISE-043 CGU : dépend de DEC-016 (entité qui signe).
- NOISE-040 OTP SMS : fournisseur SMS non choisi (DEC-017) ; il conditionne aussi NOISE-052.
- NOISE-045 Transferts FedaPay : activation des transferts demandée au support le 2026-10-15 ; accusé de réception reçu, aucune réponse sur le fond.

## Prochaines tâches

- Relire et fusionner NOISE-013, puis NOISE-022, puis NOISE-021 : la boucle création, achat, billet devient testable sur téléphone avec le faux fournisseur.
- NOISE-016 Staging : priorité suivante (aucune tâche ne peut passer « Testée » sans lui).
- NOISE-025 Scan atomique, après NOISE-024.
- docs/api.md annonce l'en-tête Idempotency-Key sur POST /orders et POST /payments/initiate, mais l'API ne le gère pas : à implémenter ou à retirer de la doc.
- NOISE-012 : essai réel vers Cloudinary dès qu'un compte existe.
- Relancer FedaPay vers le 2026-10-22 sans réponse ; régénérer les clés sandbox exposées.
- Décisions en attente : DEC-016, DEC-017, DEC-019, montant des frais des virements payants (DEC-027), report des virements et de la vérification d'identité en manuel pour les pilotes (proposition du 2026-10-15).

## Décisions récentes

- 2026-10-15 — DEC-027 proposée : solde par événement visible en temps réel, un virement gratuit programmé 72 h après l'événement et déclenchable plus tôt, virements suivants payants (frais déduits), numéro de virement confirmé par SMS.
- 2026-10-12 — DEC-023 précisée (PR #24) : frais sur la capacité déclarée, gratuit jusqu'à 50 participants, différence à payer si la capacité augmente.
- 2026-10-08 — DEC-018 et DEC-022 à DEC-026 acceptées (PR #19) : identité vérifiée pour organiser, frais d'organisation, commission de 10 %, annulation, e-mail à l'inscription.
- 2026-10-08 — DEC-011 acceptée : navigation mobile avec Expo Router.
- 2026-10-06 — DEC-021 acceptée : revue de PR par IA, consultative, validation humaine obligatoire.
- 2026-10-01 — DEC-005 complétée : FedaPay choisi comme fournisseur.

## Journal

- 2026-10-15 — Branches NOISE-013, NOISE-021, NOISE-022, NOISE-049 et DEC-027 poussées par Yannis. Réponse de FedaPay : accusé de réception, dossier en cours. SasPay étudié comme solution de secours (non retenu, à discuter).
- 2026-10-14 — NOISE-012 (route), NOISE-014 et la fin de NOISE-008 mergées (PR #28, #29, #30, #22).
- 2026-10-13 — NOISE-019, NOISE-018 (avec NOISE-020), NOISE-044 partie 1, NOISE-047 et NOISE-008 (formulaires) mergées (PR #13, #26, #23, #25, #21). Fixtures de NOISE-018 corrigées après la capacité obligatoire de NOISE-044. Paiement branché sur la création réelle des billets.
- 2026-10-12 — NOISE-011, NOISE-012 (stockage) et NOISE-026 mergées (PR #15, #11, #12) ; DEC-023 précisée (PR #24).
- 2026-10-11 — NOISE-008, client API et session persistante, mergée (PR #18).
- 2026-10-09 — NOISE-008, identité visuelle violette, mergée (PR #20).
- 2026-10-08 — NOISE-039 et les décisions métier (NOISE-001) mergées (PR #9, #19) ; NOISE-008 socle mobile mergé (PR #17) ; nouvelle règle pour progress.md (PR #16).
- 2026-10-07 — NOISE-042 et NOISE-010 mergées ; NOISE-007 mergée (PR #6).
- 2026-10-06 — NOISE-006 mergée (PR #5) ; protection de main activée ; NOISE-041 mergée (PR #4). Incident : un commit direct sur main avait remplacé progress.md par erreur, corrigé par PR.
- 2026-10-02 — NOISE-017 mergée (PR #3).
- 2026-10-01 — FedaPay choisi après tests sandbox (NOISE-010).
- 2026-09-24 — Espace Notion créé (NOISE-004). Plan global validé, socle du monorepo créé (NOISE-000), PR #1 mergée.
