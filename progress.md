# Progress — Noise

Fichier factuel : il décrit uniquement ce qui a été vérifié. Statuts : À faire · En cours · En revue · Implémenté · Testé · Validé · Déployé · Bloqué (CLAUDE.md section 10).

Mise à jour : par la PR de suivi (une seule PR groupée, après les fusions), pas par chaque PR de fonctionnalité. Une ligne par tâche, sans tableau, pour que Git fusionne sans conflit. Chaque PR de fonctionnalité porte son statut dans sa propre description.

Dernière mise à jour : 2026-10-25 (Claude, d'après l'historique de main, l'état des PR sur GitHub et les vérifications faites en session par Orias).

## Synthèse

- Tâches mergées dans main : NOISE-000, NOISE-001 (décisions), NOISE-006, NOISE-007, NOISE-008, NOISE-010, NOISE-011, NOISE-012, NOISE-013, NOISE-014, NOISE-015, NOISE-016, NOISE-017, NOISE-018, NOISE-019, NOISE-020, NOISE-021, NOISE-022, NOISE-024, NOISE-025, NOISE-026, NOISE-027 (API), NOISE-029, NOISE-037, NOISE-039, NOISE-041, NOISE-042, NOISE-044 (partie 1), NOISE-047, NOISE-048 (API), NOISE-049 (document), NOISE-053 (API), NOISE-054, NOISE-055, NOISE-056, NOISE-057, NOISE-059.
- PR ouvertes au 2026-10-25 : #59 (NOISE-048, écran mobile, approbation de Yannis attendue) et #46 (NOISE-053, partie mobile, changements demandés).
- Aucune tâche n'est encore « Testée » : le staging existe depuis le 2026-10-22 mais seul /health/ready y a été vérifié ; aucune fonctionnalité n'y a été essayée à la main.
- Environnements en ligne : staging (https://77-42-37-145.sslip.io, serveur Hetzner dédié, déploiement automatique après chaque fusion sur main). Production : aucun.
- Derniers pnpm check complets chez Orias : API 32 fichiers et 432 tests (2026-10-22) ; mobile 35 suites et 252 tests (2026-10-25).
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
- NOISE-014 Mobile participant (accueil, filtres, détail) : Implémenté. PR #29 (commit e7e102b, styles multiples et « presque complet ») et #30 (commit f7c37b0). PR #37 le 2026-10-16 (nom de l'organisateur dans l'événement).
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
- NOISE-013 Mobile organisateur, création d'événement et « Mes événements » : Implémenté. PR #32 mergée le 2026-10-20 (assistant de création, liste groupée par statut) ; PR #55 le 2026-10-22 (message clair quand l'identité n'a pas été envoyée). Non vérifié : test manuel sur téléphone.
- NOISE-015 Sélecteur de rôle : Implémenté. PR #35 mergée le 2026-10-16. DEC-029 (un compte par rôle) le remplacera, voir NOISE-060.
- NOISE-016 Staging : Implémenté. PR #53 mergée le 2026-10-22 (serveur Hetzner dédié, Docker Compose, Caddy, déploiement par GitHub Actions, DEC-028) ; PR #58 le 2026-10-25 (compilation de @noise/shared pendant le build EAS). Vérifié : le workflow « Deploy staging » a réussi après la fusion, et GET /health/ready répond {"status":"ready","checks":{"database":"up"}} (curl d'Orias, 2026-10-23). Un APK de test (profil EAS preview, pointé sur le staging) a été construit le 2026-10-23 ; il n'a pas encore été installé ni essayé sur un téléphone Android. Le staging utilise le faux fournisseur de paiement : les clés FedaPay sandbox ne sont pas encore posées (NOISE-002).
- NOISE-021 Tunnel d'achat et paiement Mobile Money : Implémenté. PR #34 mergée le 2026-10-20. Paiement avec le faux fournisseur ; non vérifié sur téléphone.
- NOISE-022 Mes billets avec QR hors ligne : Implémenté. PR #33 mergée le 2026-10-19.
- NOISE-024 Liens scanner à durée limitée et révocables (API et scanner web) : Implémenté. PR #36 mergée le 2026-10-16. La partie mobile est dans NOISE-054.
- NOISE-025 Scan atomique du QR à l'entrée : Implémenté. PR #41 mergée le 2026-10-19.
- NOISE-027 Statistiques d'un événement, API : Implémenté. PR #56 mergée le 2026-10-22 (GET /events/:id/stats : ventes par type de billet, courbe des arrivées, résultats de scan). L'écran mobile reste à faire.
- NOISE-029 Annulation d'un événement par l'organisateur : Implémenté, hors notification des acheteurs. PR #45 le 2026-10-20 (API, DEC-025), PR #54 le 2026-10-22 (écran organisateur), PR #57 le 2026-10-22 (correctif : annuler un événement dont un billet est déjà scanné répondait 500). Notification push à faire avec NOISE-028.
- NOISE-037 Endpoints d'administration minimale : Implémenté. PR #38 mergée le 2026-10-16.
- NOISE-048 Vérification d'identité des organisateurs, API : Implémenté. PR #39 mergée le 2026-10-18. L'écran mobile est en revue (PR #59).
- NOISE-049 Mission de prospection à Cotonou, document : Implémenté. PR #31 mergée le 2026-10-21 ; le classeur rempli reste hors de Git (données personnelles). L'avancement de la prospection n'est pas renseigné.
- NOISE-053 Clé d'idempotence sur la commande et le paiement, API : Implémenté. PR #42 mergée le 2026-10-20. La partie mobile est en revue (PR #46).
- NOISE-054 Mobile organisateur, détail d'un événement et liens scanner : Implémenté. PR #47 mergée le 2026-10-25.
- NOISE-055 Création d'un compte administrateur : Implémenté. PR #50 mergée le 2026-10-25 (script, procédure dans docs/environments.md). Le compte administrateur du staging n'est pas encore créé (à faire à deux).
- NOISE-056 Index des styles déclaré dans le schéma Prisma : Implémenté. PR #51 mergée le 2026-10-23.
- NOISE-057 Contact du support dans l'app : Implémenté. PR #52 mergée le 2026-10-25.
- NOISE-059 E-mails à l'équipe (soirée publiée, client à rembourser) : Implémenté. PR #48 mergée le 2026-10-25. Envoi réel vérifié en local par l'auteur de la PR ; non configuré sur le staging (SMTP_USER, SMTP_PASSWORD et TEAM_EMAIL absents : envoi simulé). Non vérifié : le port SMTP par défaut (465) peut être bloqué sur Hetzner.
- DEC-027 Solde de l'organisateur et virements à la demande : mergée le 2026-10-19 (PR #43). DEC-028 : mergée le 2026-10-22 avec NOISE-016.
- Roadmap des manques du MVP (NOISE-055 à NOISE-069, DEC-029) : mergée le 2026-10-25 (PR #49).

## En revue

- NOISE-048 Écran mobile d'envoi de la pièce d'identité : PR #59 (Orias), ouverte le 2026-10-25. Elle reprend la PR #40, fermée par erreur après un push de branche vide. 35 suites et 252 tests mobile verts en local. Approbation de Yannis attendue.
- NOISE-053 Clé d'idempotence côté mobile : PR #46 (Yannis), changements demandés par Orias le 2026-10-25 : ne garder la clé que sur erreur réseau ou 5xx, l'oublier sur une erreur 4xx.

## En cours

- NOISE-049 Mission de prospection à Cotonou : le document est mergé, la mission sur le terrain n'a pas de suivi dans ce fichier.

## Bloqué

- NOISE-034 Paiement production : KYC impossible tant que le titulaire du compte marchand n'est pas décidé (DEC-016).
- NOISE-043 CGU : dépend de DEC-016 (entité qui signe).
- NOISE-040 OTP SMS : fournisseur SMS non choisi (DEC-017) ; il conditionne aussi NOISE-052.
- NOISE-045 Transferts FedaPay : activation des transferts demandée au support le 2026-10-15 ; accusé de réception reçu, aucune réponse sur le fond (état au 2026-10-15, non revérifié depuis).

## Prochaines tâches

- Fusionner #59 (approbation de Yannis) et #46 (après correction).
- Essayer le staging à la main : inscription, création et publication d'un événement, achat avec le faux fournisseur, scan. C'est la condition pour passer des tâches en « Testé ». Il faut un téléphone Android (APK preview) ou un émulateur.
- Créer le compte administrateur du staging (NOISE-055, à deux, procédure dans docs/environments.md).
- Vérifier depuis le serveur de staging que les ports SMTP sortants passent, puis poser SMTP_USER, SMTP_PASSWORD et TEAM_EMAIL dans /opt/noise-staging/.env (NOISE-059).
- Clés FedaPay sandbox sur le staging (NOISE-002) et webhook https://77-42-37-145.sslip.io/api/v1/payments/webhook.
- NOISE-060 Un compte par rôle (DEC-029, à confirmer par Orias), puis NOISE-058 (seed de démonstration) et NOISE-061 à NOISE-069 (roadmap, section « Manques identifiés le 2026-10-21 »).
- NOISE-028 Notifications push, nécessaire à NOISE-029 pour prévenir les acheteurs d'une annulation.
- NOISE-027 écran mobile (statistiques), à ajouter à l'écran de détail de NOISE-054.
- Bouton vers l'écran d'identité dans l'assistant de création d'événement (après #59).
- Synchroniser les statuts de roadmap.md et le CHANGELOG avec ce fichier (PR de suivi à venir).
- Resynchroniser Notion.
- NOISE-012 : essai réel vers Cloudinary (le staging est configuré avec un compte, envoi d'affiche non vérifié).
- Relance FedaPay prévue vers le 2026-10-22, résultat non renseigné ; régénérer les clés sandbox exposées.
- Décisions en attente : DEC-016, DEC-017, DEC-019, montant des frais des virements payants (DEC-027), confirmation de DEC-029, choix de Gmail (SMTP) pour les e-mails à l'équipe (à consigner dans decisions.md).

## Décisions récentes

- 2026-10-25 — DEC-029 « Un compte par rôle : plus de sélecteur participant / organisateur » ajoutée par Yannis (PR #49), statut « Acceptée (Yannis) » ; confirmation d'Orias attendue.
- 2026-10-22 — DEC-028 acceptée (PR #53) : staging sur un serveur Hetzner dédié, Docker Compose et Caddy, déploiement depuis GitHub.
- 2026-10-19 — DEC-027 mergée (PR #43) : solde par événement visible en temps réel, un virement gratuit 72 h après l'événement, virements suivants payants, numéro de virement confirmé par SMS.
- 2026-10-12 — DEC-023 précisée (PR #24) : frais sur la capacité déclarée, gratuit jusqu'à 50 participants, différence à payer si la capacité augmente.
- 2026-10-08 — DEC-018 et DEC-022 à DEC-026 acceptées (PR #19) : identité vérifiée pour organiser, frais d'organisation, commission de 10 %, annulation, e-mail à l'inscription.
- 2026-10-08 — DEC-011 acceptée : navigation mobile avec Expo Router.
- 2026-10-06 — DEC-021 acceptée : revue de PR par IA, consultative, validation humaine obligatoire.
- 2026-10-01 — DEC-005 complétée : FedaPay choisi comme fournisseur.

## Journal

- 2026-10-25 — Mergées : #49 (roadmap NOISE-055 à NOISE-069 et DEC-029), #58, #52, #50, #48, #47. La PR #40 a été fermée par un push de branche vide, reprise dans #59 ; #46 : changements demandés. Staging redéployé après chaque fusion.
- 2026-10-23 — #51 mergée. /health/ready du staging vérifié. APK de test construit avec EAS (profil preview, pointé sur le staging), non installé sur un Android à ce jour.
- 2026-10-22 — Staging mergé (#53) : premier déploiement automatique réussi. Mergées aussi : #54, #55, #56, #57 (annulation avec un billet déjà scanné corrigée).
- 2026-10-21 — #31 mergée. Serveur Hetzner préparé (Docker, pare-feu, accès SSH par clé, utilisateur de déploiement, secrets du staging) et variables GitHub de l'environnement « staging » posées.
- 2026-10-20 — Mergées : #32, #34, #42, #44, #45.
- 2026-10-19 — Mergées : #33, #41, #43.
- 2026-10-18 — #39 mergée (identité des organisateurs, API).
- 2026-10-16 — Mergées : #35, #36, #37, #38.
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
