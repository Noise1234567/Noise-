# Décisions — Noise

Format inspiré des ADR. Une décision n'est jamais supprimée : si elle change, elle passe au statut « Remplacée » et une nouvelle décision la référence. Chaque décision est dupliquée dans la base Notion « Decisions ».

Statuts : Proposée · Acceptée · En attente (bloquée par une information ou une personne) · Remplacée.

## Index

| ID      | Décision                                                                                | Statut                                          | Date       |
| ------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| DEC-001 | Monorepo pnpm workspaces                                                                | Acceptée                                        | 2026-09-24 |
| DEC-002 | Conserver la stack du cahier des charges (Express/TS, Prisma, PostgreSQL, React Native) | Acceptée                                        | 2026-09-24 |
| DEC-003 | Expo (CNG) + EAS Build plutôt que React Native bare                                     | Acceptée                                        | 2026-09-24 |
| DEC-004 | Hébergement Railway (API + Postgres), staging et production                             | Acceptée                                        | 2026-09-24 |
| DEC-005 | Paiement via un agrégateur béninois plutôt que MTN et Moov en direct                    | Acceptée (fournisseur à choisir dans NOISE-010) | 2026-09-24 |
| DEC-006 | Google Play après le MVP ; AAB préparé dès la S4                                        | Acceptée                                        | 2026-09-24 |
| DEC-007 | Réservation du stock à la création de la commande                                       | Acceptée (écart au CDC)                         | 2026-09-24 |
| DEC-008 | Maximum 5 billets par commande                                                          | Acceptée                                        | 2026-09-24 |
| DEC-009 | Reversements aux organisateurs manuels pour le MVP                                      | Acceptée ; commission 10 % (DEC-021)            | 2026-10-06 |
| DEC-010 | Remboursements manuels en cas d'annulation d'événement                                  | Acceptée                                        | 2026-09-24 |
| DEC-011 | Navigation mobile : Expo Router (bâti sur React Navigation)                             | Proposée                                        | 2026-09-24 |
| DEC-012 | Format des commits vérifié en CI (titre de PR), sans hook Git local                     | Acceptée                                        | 2026-09-24 |
| DEC-013 | Stratégie Git trunk-based : main protégée + branches courtes + squash                   | Acceptée                                        | 2026-09-24 |
| DEC-014 | Scanner en ligne uniquement pour le MVP                                                 | Acceptée                                        | 2026-09-24 |
| DEC-015 | Identifiant Android `com.noise.app`                                                     | Proposée                                        | 2026-09-24 |
| DEC-016 | Entité légale et titulaire du compte marchand (KYC)                                     | En attente                                      | —          |
| DEC-017 | Vérification du téléphone et mot de passe oublié (OTP SMS)                              | En attente                                      | —          |
| DEC-018 | Validation des organisateurs avant la mise en vente                                     | En attente                                      | —          |
| DEC-019 | Disponibilité hebdomadaire de Yannis et Orias                                           | En attente                                      | —          |
| DEC-020 | Administration minimale : rôle ADMIN + endpoints internes, pas d'interface dédiée       | Acceptée                                        | 2026-09-24 |
| DEC-021 | Répartition de chaque vente, commission Noise 10 %, affiliation après le MVP            | Acceptée                                        | 2026-10-06 |
| DEC-022 | Versement à l'organisateur au fil des ventes, alerte de non-tenue, réserve              | Proposée (en discussion)                        | 2026-10-06 |

---

## DEC-001 — Monorepo pnpm workspaces

- Contexte : trois applications (API, mobile, scanner) partagent des contrats (statuts, erreurs, schémas).
- Alternatives : multirepo ; monorepo npm workspaces ; monorepo avec Turborepo/Nx.
- Choix : monorepo pnpm workspaces, sans orchestrateur au départ.
- Raison : une seule CI, contrats typés partagés, pas de divergence de versions. Turborepo sera ajouté seulement si la CI devient lente.
- Conséquence : `node-linker=hoisted` requis pour Metro (Expo).
- Personnes : Yannis, Orias.

## DEC-002 — Stack du cahier des charges conservée

- Contexte : le CDC fixe Node/Express/TypeScript, Prisma, PostgreSQL, React Native, Zustand, Axios.
- Choix : conservée, en versions actuelles (Express 5, Prisma 7, Zod 4).
- Raison : adaptée au besoin (transactions ACID pour le scan, async pour les webhooks), connue de l'équipe. Aucun bénéfice à changer.
- Personnes : Yannis, Orias.

## DEC-003 — Expo + EAS Build

- Contexte : le CDC laisse le choix « Expo / bare ». Besoin d'APK de test puis d'AAB signé.
- Alternatives : React Native bare avec Gradle local.
- Choix : Expo avec génération native continue (dossiers `android/` non versionnés) et EAS Build.
- Raison : signature et keystore gérés, profils APK/AAB, moins de configuration native à maintenir. Repli possible : `npx expo prebuild` + Gradle local si EAS est indisponible.
- Personnes : Yannis, Orias.

## DEC-004 — Railway

- Alternatives : Render (offre gratuite en veille : latence au réveil, risque sur les webhooks), VPS.
- Choix : Railway, un projet avec deux environnements (staging, production), Postgres managé.
- Raison : pas de mise en veille, déploiement depuis GitHub, coût faible (environ 5 à 20 $ par mois).
- Personnes : Yannis, Orias.

## DEC-005 — Agrégateur de paiement

- Contexte : le CDC prévoit MTN MoMo API et Moov Money API en direct. L'intégration directe impose deux contrats, deux intégrations, deux processus de mise en production.
- Alternatives : MTN + Moov en direct ; agrégateur (FedaPay, KKiaPay).
- Choix : agrégateur. FedaPay documente MTN Bénin et Moov Bénin en XOF, avec un environnement sandbox. Le choix final entre FedaPay et KKiaPay est fait dans NOISE-010 après test des deux sandbox.
- Raison : une seule intégration et un seul KYC ; réduction du risque « Élevé » du CDC. Coût : frais de l'agrégateur par transaction.
- Conséquence : le code passe par une interface `PaymentProvider` (NOISE-017) pour pouvoir changer de fournisseur.
- Personnes : Yannis, Orias.

## DEC-006 — Google Play après le MVP

- Contexte : le CDC prévoit le sideloading pour le MVP. Un compte développeur personnel récent doit passer un test fermé (12 testeurs, 14 jours) avant la production.
- Choix : distribution APK par lien pour le MVP ; build AAB et configuration de la signature en S4 (NOISE-033) ; Play Console et test fermé après le MVP (NOISE-038).
- Personnes : Yannis, Orias.

## DEC-007 — Réservation du stock à la commande

- Contexte : le CDC (6.2) incrémente `quantite_vendue` uniquement au paiement. Deux commandes en attente pourraient alors payer la dernière place.
- Choix : la quantité disponible = quantité totale − billets vendus − billets réservés par des commandes PENDING non expirées. La réservation est faite dans une transaction à la création de la commande ; elle est libérée à l'expiration (15 min) ou à l'échec.
- Raison : empêcher la survente. Tests de concurrence obligatoires (NOISE-018).
- Personnes : Yannis, Orias.

## DEC-008 — 5 billets maximum par commande

- Choix : 1 à 5 billets d'un même type par commande. Constante `MAX_TICKETS_PER_ORDER` dans `packages/shared`.

## DEC-009 — Reversements manuels

- Choix : Noise encaisse via l'agrégateur, puis reverse manuellement aux organisateurs après l'événement, sur la base d'un export des ventes (NOISE-039).
- Commission et frais : fixés par DEC-021 (2026-10-06) : 10 % pour Noise, frais de l'agrégateur payés par le client.

## DEC-010 — Remboursements manuels

- Choix : en cas d'annulation d'événement, les billets passent à CANCELLED, les acheteurs sont notifiés, le remboursement est effectué manuellement (procédure dans `docs/payments.md`).

## DEC-011 — Navigation mobile (proposée)

- Contexte : le CDC cite React Navigation v6. En 2026, Expo recommande Expo Router, qui est bâti sur React Navigation.
- Proposition : Expo Router (routes typées, structure par fichiers, liens profonds). Alternative : React Navigation utilisé directement (plus explicite pour apprendre).
- À valider par Orias au début de NOISE-008.

## DEC-012 — Format des commits vérifié en CI

- Contexte : la création d'un hook Git local (husky) a été refusée le 2026-09-24.
- Choix : pas de hook local ; la CI vérifie que le titre de PR respecte Conventional Commits. Comme le merge est en squash, le titre de PR devient le message de commit sur `main`.

## DEC-013 — Stratégie Git

- Choix : trunk-based. `main` protégée, branches courtes par tâche, squash merge, tags `vX.Y.Z` pour la production. Détails : `docs/git-workflow.md`.
- Raison : deux développeurs, livraisons fréquentes ; une branche `develop` n'apporterait que de la synchronisation.

## DEC-014 — Scanner en ligne uniquement

- Choix : la validation reste serveur (atomicité). Un mode dégradé hors ligne est hors MVP ; il sera réévalué après le test réseau sur un lieu réel (NOISE-032).

## DEC-015 — Identifiant Android (proposée)

- Contexte : l'identifiant d'application (`android.package`) est définitif une fois publié sur Google Play.
- Proposition : `com.noise.app` (provisoire dans `apps/mobile/app.json`). À confirmer ou remplacer (par exemple un domaine possédé : `bj.noise.app`) avant le premier build EAS (NOISE-009).

## DEC-016 — Entité légale et KYC (en attente)

- Besoin : l'agrégateur exige un titulaire vérifié (entreprise ou personne) pour encaisser en production.
- Bloque : NOISE-034 (paiement production), donc le test terrain avec vrais billets.

## DEC-017 — OTP SMS (en attente)

- Question : vérification du numéro à l'inscription et « mot de passe oublié » par SMS dans le MVP, ou réinitialisation manuelle par le support ?
- Impact : fournisseur SMS, coût par SMS, une tâche supplémentaire (NOISE-040).

## DEC-018 — Validation des organisateurs (en attente)

- Question : un nouvel organisateur peut-il vendre immédiatement, ou après validation par un administrateur ?
- Impact : statut sur le compte organisateur, endpoint admin (NOISE-037).

## DEC-019 — Disponibilités (en attente)

- Besoin : nombre d'heures par semaine de chacun, pour calibrer les sprints et la charge dans Notion.

## DEC-020 — Administration minimale

- Choix : rôle ADMIN en base, quelques endpoints protégés (suspendre un organisateur ou un événement, lister les paiements, exporter les ventes) et Prisma Studio pour le reste. Pas d'interface d'administration dédiée dans le MVP.

## DEC-021 — Répartition de chaque vente et affiliation

- Contexte : DEC-009 laissait le taux de commission en attente. Yannis et Orias ajoutent une affiliation : une personne qui partage l'événement touche une part des billets vendus grâce à son lien.
- Alternatives étudiées : sous-comptes FedaPay (répartition automatique à chaque paiement) ; virements par l'API FedaPay (payouts) ; reversements manuels.
- Choix :
  - Commission Noise : 10 % du prix du billet, obligatoire. L'organisateur en est informé au moment de fixer son prix (montant qu'il recevra par billet affiché à la création de l'événement, NOISE-013).
  - Frais de l'agrégateur (environ 1,8 %, taux exact à confirmer) : payés par le client, en plus du prix du billet (réglage du compte FedaPay).
  - Affiliation (option choisie par l'organisateur) : 1 % du prix du billet pour le partageur, pris sur la part de l'organisateur. Implémentée après le MVP ; les données sont préparées dès le MVP (voir conséquences).
  - Organisateur : le reste. Arrondis : chaque commission est arrondie au FCFA inférieur, l'organisateur reçoit le reste, la somme des parts est toujours égale au prix payé.
  - La répartition de chaque commande est calculée et enregistrée par l'API à la confirmation du paiement (registre), jamais saisie à la main.
  - Reversement à l'organisateur après l'événement, à partir du registre : manuel pour le MVP (DEC-009, procédure NOISE-039) ; virement par l'API FedaPay envisagé ensuite. Les partageurs seront payés de façon groupée au-delà d'un seuil (le coût d'un virement, 150 FCFA minimum, dépasse 1 % d'un petit billet).
- Écartés : les sous-comptes FedaPay, qui versent l'argent à l'organisateur dès la vente (impossible de rembourser les clients si l'événement est annulé, risque de fraude) et exigent un compte FedaPay vérifié pour chaque bénéficiaire.
- Conséquences : NOISE-006 prévoit sur la commande les parts calculées (Noise, partageur, organisateur) et un partageur facultatif ; NOISE-019 enregistre la répartition à la confirmation ; NOISE-039 produit l'export à partir du registre. À vérifier avant la production : le cadre réglementaire de la détention des fonds des organisateurs entre la vente et le reversement (BCEAO), auprès de FedaPay ou d'un juriste.
- Personnes : Yannis, Orias (accord du 2026-10-06).

## DEC-022 — Versement à l'organisateur au fil des ventes (proposée, en discussion)

- Contexte : les organisateurs financent leur soirée avec les ventes, souvent semaines avant l'événement ; un reversement après l'événement (DEC-021) n'est pas viable pour eux.
- Proposition (2026-10-06, Yannis, à valider avec Orias et l'équipe) :
  - versement automatique chaque lendemain de vente, par l'API de virements FedaPay, sur le numéro Mobile Money de l'organisateur (coût du virement déduit de sa part) ;
  - identité de l'organisateur vérifiée avant son premier versement (lien avec DEC-018) ;
  - remboursements en cas d'annulation à la charge de l'organisateur, règles affichées à l'achat (remplace DEC-010) ; restitution ou non des 10 % de Noise à trancher ;
  - alerte de non-tenue : si le taux de billets scannés reste sous un seuil après l'heure de fin, le versement suivant est mis en attente et un administrateur vérifie avant de débloquer, rembourser ou bannir (pas de sanction automatique : fausses alertes possibles) ;
  - réserve pour les nouveaux organisateurs (part de chaque versement gardée jusqu'à la tenue de la soirée), seule protection permettant réellement de rembourser.
- Valeurs à fixer : seuil de l'alerte, pourcentage et durée de la réserve, texte des règles de remboursement.
- Impact : remplace le « reversement après l'événement » de DEC-021 et les procédures 7.2 / 7.3 de docs/payments.md ; nouvelles tâches (versement quotidien, alerte, réserve) à ajouter à la roadmap après validation.
