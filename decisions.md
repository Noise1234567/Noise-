# Décisions — Noise

Format inspiré des ADR. Une décision n'est jamais supprimée : si elle change, elle passe au statut « Remplacée » et une nouvelle décision la référence. Chaque décision est dupliquée dans la base Notion « Decisions ».

Statuts : Proposée · Acceptée · En attente (bloquée par une information ou une personne) · Remplacée.

## Index

| ID      | Décision                                                                                      | Statut                  | Date       |
| ------- | --------------------------------------------------------------------------------------------- | ----------------------- | ---------- |
| DEC-001 | Monorepo pnpm workspaces                                                                      | Acceptée                | 2026-09-24 |
| DEC-002 | Conserver la stack du cahier des charges (Express/TS, Prisma, PostgreSQL, React Native)       | Acceptée                | 2026-09-24 |
| DEC-003 | Expo (CNG) + EAS Build plutôt que React Native bare                                           | Acceptée                | 2026-09-24 |
| DEC-004 | Hébergement Railway (API + Postgres), staging et production                                   | Acceptée                | 2026-09-24 |
| DEC-005 | Paiement via un agrégateur béninois (FedaPay) plutôt que MTN et Moov en direct                | Acceptée (FedaPay)      | 2026-10-01 |
| DEC-006 | Google Play après le MVP ; AAB préparé dès la S4                                              | Acceptée                | 2026-09-24 |
| DEC-007 | Réservation du stock à la création de la commande                                             | Acceptée (écart au CDC) | 2026-09-24 |
| DEC-008 | Maximum 5 billets par commande                                                                | Acceptée                | 2026-09-24 |
| DEC-009 | Reversements aux organisateurs manuels pour le MVP                                            | Remplacée par DEC-024   | 2026-09-24 |
| DEC-010 | Remboursements manuels en cas d'annulation d'événement                                        | Remplacée par DEC-025   | 2026-09-24 |
| DEC-011 | Navigation mobile : Expo Router (bâti sur React Navigation)                                   | Acceptée                | 2026-10-08 |
| DEC-012 | Format des commits vérifié en CI (titre de PR), sans hook Git local                           | Acceptée                | 2026-09-24 |
| DEC-013 | Stratégie Git trunk-based : main protégée + branches courtes + squash                         | Acceptée                | 2026-09-24 |
| DEC-014 | Scanner en ligne uniquement pour le MVP                                                       | Acceptée                | 2026-09-24 |
| DEC-015 | Identifiant Android `com.noise.app`                                                           | Proposée                | 2026-09-24 |
| DEC-016 | Entité légale et titulaire du compte marchand (KYC)                                           | En attente              | —          |
| DEC-017 | Vérification du téléphone et mot de passe oublié (OTP SMS)                                    | En attente              | —          |
| DEC-018 | Pas de certification des organisateurs ; identité vérifiée obligatoire pour organiser         | Acceptée                | 2026-10-08 |
| DEC-019 | Disponibilité hebdomadaire de Yannis et Orias                                                 | En attente              | —          |
| DEC-020 | Administration minimale : rôle ADMIN + endpoints internes, pas d'interface dédiée             | Acceptée                | 2026-09-24 |
| DEC-021 | Revue de PR par IA (Claude Code GitHub Actions), consultative, validation humaine obligatoire | Acceptée                | 2026-10-06 |
| DEC-022 | Répartition de chaque vente, commission Noise 10 %, affiliation après le MVP                  | Acceptée                | 2026-10-06 |
| DEC-023 | Frais d'organisation : 40 FCFA par participant déclaré, gratuit jusqu'à 50 participants       | Acceptée                | 2026-10-08 |
| DEC-024 | Commission de 10 % et reversement à l'organisateur le lendemain de chaque journée de vente    | Remplacée en partie     | 2026-10-08 |
| DEC-025 | Annulation par l'organisateur : frais de 10 %, retour des sommes reversées sous 10 jours      | Acceptée                | 2026-10-08 |
| DEC-026 | E-mail demandé à l'inscription (tous les comptes)                                             | Acceptée                | 2026-10-08 |
| DEC-027 | Solde de l'organisateur, virements à la demande, reste versé sous 72 h après l'événement      | Acceptée                | 2026-10-15 |
| DEC-028 | Staging sur un serveur Hetzner dédié (Docker Compose, Caddy), déploiement depuis GitHub       | Acceptée                | 2026-10-21 |
| DEC-029 | Un compte par rôle : plus de sélecteur participant / organisateur                             | Acceptée (Yannis)       | 2026-10-21 |

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

Choix du fournisseur (NOISE-010, 2026-10-01) — statut : Acceptée (proposée par Yannis, validée par Orias le 2026-10-01).

- Choix proposé : FedaPay.
- Raisons (preuves dans `docs/payments.md` section 2.1) :
- paiement déclenché par notre serveur, sans widget ni redirection : vérifié en sandbox (mode `momo_test`) ;
- statut relu côté serveur par `GET /v1/transactions/{id}` : vérifié ;
- webhook signé en HMAC-SHA256 avec horodatage (`t=…,s=…`) : vérifié sur 4 webhooks ;
- MTN, Moov et Celtiis Bénin en XOF dans la documentation.
- KKiaPay écarté sur la documentation, sans test sandbox : aucune API publique pour qu'un serveur déclenche le paiement (widget côté mobile obligatoire), webhook authentifié par un simple secret partagé. Écart au critère de NOISE-010, qui prévoyait un essai sandbox des deux fournisseurs.
- Points ouverts, non bloquants pour le développement :
- le support doit confirmer que `mtn_open` et `moov` fonctionnent en production après KYC (refusés en sandbox) ;
- frais exacts : 4 % observés en sandbox, ajoutés au montant payé par le client ; prise en charge à fixer dans DEC-009 ;
- délai de KYC et de reversement à relever ; titulaire du compte marchand : DEC-016.

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

## DEC-009 — Reversements manuels (remplacée par DEC-024)

- Choix : Noise encaisse via l'agrégateur, puis reverse manuellement aux organisateurs après l'événement, sur la base d'un export des ventes (NOISE-039).
- En attente : taux de commission (5 % ou 10 %, ou selon l'organisateur) et répartition des frais de l'agrégateur. À fixer avant la mise en production du paiement (NOISE-034).

## DEC-010 — Remboursements manuels (remplacée par DEC-025)

- Choix : en cas d'annulation d'événement, les billets passent à CANCELLED, les acheteurs sont notifiés, le remboursement est effectué manuellement (procédure dans `docs/payments.md`).

## DEC-011 — Navigation mobile

- Contexte : le CDC cite React Navigation v6. En 2026, Expo recommande Expo Router, qui est bâti sur React Navigation.
- Proposition : Expo Router (routes typées, structure par fichiers, liens profonds). Alternative : React Navigation utilisé directement (plus explicite pour apprendre).
- Choix : Expo Router, validé par Orias le 2026-10-08 (NOISE-008), après explication des deux options. Pile racine à trois zones (authentification, Participant, Organisateur) choisies par la session et le rôle actif (`Stack.Protected`), barres d'onglets propres à chaque vue.
- Conséquence : le CDC (React Navigation v6) est écarté sur ce point ; React Navigation reste utilisé en dessous, via Expo Router.

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

## DEC-018 — Validation des organisateurs

- Choix (réunion d'équipe du 2026-10-08) : pas de statut « organisateur certifié ». En revanche, l'identité de l'organisateur doit être vérifiée (pièce d'identité) avant qu'il puisse organiser : tant que la vérification n'est pas finalisée, il ne peut ni créer ni publier d'événement (précisé par Yannis le 2026-10-08, NOISE-048). Une fois vérifié, il publie et vend sans autre validation.
- Raison : ne pas freiner l'arrivée des premiers organisateurs, tout en rendant applicables les sanctions et poursuites prévues par les CGU (DEC-025) : un organisateur identifié ne peut pas disparaître puis revenir sous un autre nom.
- Contrepartie : le risque de fuite (organisateur qui encaisse les reversements puis disparaît, DEC-024) est encadré par les CGU et la politique de confidentialité, qui précisent les obligations de l'organisateur et les sanctions encourues (NOISE-043). La suspension d'un organisateur reste possible (DEC-020).
- Précision du 2026-10-16 (Orias, à valider par Yannis en revue de la PR NOISE-048) : le déblocage se fait à l'envoi de la pièce, pas à sa validation. L'organisateur qui a envoyé sa pièce (en attente ou vérifiée) peut créer et publier ; l'administrateur valide ensuite. Une pièce refusée donne 72 heures pour en renvoyer une, après quoi ses événements publiés sont retirés de la vente (immédiatement en cas de fraude évidente). Les pièces sont supprimées tout de suite après un refus et 12 mois après une validation. Les reversements (DEC-024) ne partent qu'après validation de la pièce.
- Historique : en attente du 2026-09-24 au 2026-10-08.

## DEC-019 — Disponibilités (en attente)

- Besoin : nombre d'heures par semaine de chacun, pour calibrer les sprints et la charge dans Notion.

## DEC-020 — Administration minimale

- Choix : rôle ADMIN en base, quelques endpoints protégés (suspendre un organisateur ou un événement, lister les paiements, exporter les ventes) et Prisma Studio pour le reste. Pas d'interface d'administration dédiée dans le MVP.

## DEC-021 — Revue de PR par IA, consultative, validation humaine obligatoire

- Contexte : vérifier automatiquement chaque PR (sécurité, règles métier, respect de CLAUDE.md) sans affaiblir la revue humaine entre Yannis et Orias.
- Choix : Claude Code GitHub Actions (`anthropics/claude-code-action@v1`) commente chaque PR non brouillon à l'ouverture et à la réouverture (`.github/workflows/claude-review.yml`). Le workflow n'a que des permissions de lecture (`contents: read`, `pull-requests: read`, `issues: read`) : Claude ne peut ni approuver, ni merger, ni modifier le code. La protection de la branche `main` exige toujours une approbation humaine (`.github/CODEOWNERS`, 1 reviewer minimum, dismiss des approbations obsolètes) ; les commentaires de Claude sont des suggestions à trier par le reviewer, pas une validation.
- Authentification : token lié à l'abonnement Claude d'Orias (`CLAUDE_CODE_OAUTH_TOKEN`, généré par `claude setup-token`), stocké en secret GitHub. À revoir si le token personnel bloque l'équipe (ex. en cas d'absence) : bascule possible vers une clé API de la Claude Console.
- Écarté : le service « Code Review » géré par Anthropic (claude.ai/admin-settings/claude-code), réservé aux abonnements Team/Enterprise et facturé 15 à 25 $ par revue — hors budget et hors périmètre d'un abonnement personnel.
- Suivi : si le coût ou le bruit des commentaires devient gênant, ajouter un fichier `REVIEW.md` pour recalibrer ce que Claude signale.

## DEC-022 — Répartition de chaque vente et affiliation

- Contexte : DEC-009 laissait le taux de commission en attente. Yannis et Orias ajoutent une affiliation : une personne qui partage l'événement touche une part des billets vendus grâce à son lien.
- Alternatives étudiées : sous-comptes FedaPay (répartition automatique à chaque paiement) ; virements par l'API FedaPay (payouts) ; reversements manuels.
- Choix :
  - Commission Noise : 10 % du prix du billet, obligatoire. L'organisateur en est informé au moment de fixer son prix (montant qu'il recevra par billet affiché à la création de l'événement, NOISE-013).
  - Frais de l'agrégateur (environ 1,8 %, taux exact à confirmer) : payés par le client, en plus du prix du billet (réglage du compte FedaPay).
  - Affiliation (option choisie par l'organisateur) : 1 % du prix du billet pour le partageur, pris sur la part de l'organisateur. Implémentée après le MVP ; les données sont préparées dès le MVP (voir conséquences).
  - Organisateur : le reste. Arrondis : chaque commission est arrondie au FCFA inférieur, l'organisateur reçoit le reste, la somme des parts est toujours égale au prix payé.
  - La répartition de chaque commande est calculée et enregistrée par l'API à la confirmation du paiement (registre), jamais saisie à la main.
  - Reversement à l'organisateur : remplacé par DEC-024 (reversement automatique de 90 % le lendemain de chaque journée de vente, 2026-10-08).
- Écartés : les sous-comptes FedaPay, qui versent l'argent à l'organisateur dès la vente (impossible de rembourser les clients si l'événement est annulé, risque de fraude) et exigent un compte FedaPay vérifié pour chaque bénéficiaire.
- Conséquences : NOISE-006 prévoit sur la commande les parts calculées (Noise, partageur, organisateur) et un partageur facultatif ; NOISE-019 enregistre la répartition à la confirmation ; NOISE-039 produit l'export à partir du registre. À vérifier avant la production : le cadre réglementaire de la détention des fonds des organisateurs entre la vente et le reversement (BCEAO), auprès de FedaPay ou d'un juriste.
- Personnes : Yannis, Orias (accord du 2026-10-06).

## DEC-023 — Frais d'organisation

- Choix (réunion d'équipe du 2026-10-08) : pas de grille tarifaire. Les frais d'organisation sont proportionnels au nombre de participants, avec la constante 50 participants = 2 000 FCFA, soit 40 FCFA par participant.
- Précisé le 2026-10-09 (Orias, à confirmer par Yannis à la relecture) : la base est la capacité que l'organisateur déclare pour l'événement (nombre de participants attendus). La somme des places des types de billets ne peut pas dépasser cette capacité. Frais = 40 FCFA × capacité si la capacité dépasse 50, sinon 0 : jusqu'à 50 participants l'événement est gratuit, et au-delà le calcul porte sur le total déclaré, pas sur l'excédent seulement. Le calcul donne toujours un entier en FCFA, aucun arrondi n'est nécessaire.
- Augmentation de la capacité (règle de trois sur le total) : l'organisateur paie la différence entre les frais du nouveau total et ce qu'il a déjà payé. Exemples : 30 → 40 participants : 0 FCFA ; 40 → 60 : 2 400 FCFA ; 50 → 100 : 4 000 FCFA ; 60 → 85 : 1 000 FCFA.
- Billets gratuits autorisés (prix 0) ; prix maximal d'un billet : 1 000 000 FCFA.
- Le montant est affiché à l'organisateur dès qu'il fixe la capacité de son événement. Il s'ajoute à la commission de 10 % sur les ventes (DEC-024).
- Lancement : les frais d'organisation sont offerts aux premiers organisateurs prospectés.
- Exemple : 300 participants → 12 000 FCFA ; 50 participants → 0 FCFA ; 51 participants → 2 040 FCFA.
- Paiement (précisé le 2026-10-08) : avant la publication de l'événement, par Mobile Money via FedaPay, avec le même parcours que l'achat d'un billet (paiement déclenché par le serveur, confirmé par webhook signé et revérification).
- Points ouverts : remboursement ou non des frais en cas d'annulation ou de baisse de la capacité ; mécanisme de la gratuité de lancement (nombre d'organisateurs ou date de fin, exonération par un administrateur).
- Personnes : Yannis, Orias (et l'équipe).

## DEC-024 — Commission et reversement quotidien

- Statut : le reversement quotidien est remplacé par DEC-027 (2026-10-15) ; la commission de 10 % reste en vigueur.
- Remplace : DEC-009.
- Choix (réunion d'équipe du 2026-10-08) : Noise prélève 10 % du prix de chaque billet vendu. Les 90 % restants sont reversés à l'organisateur le lendemain de chaque journée de vente, sans attendre l'événement.
- Raison : permettre aux organisateurs de financer l'organisation de la soirée avec les premières ventes. L'équipe accepte en contrepartie le risque qu'un organisateur encaisse puis annule ou disparaisse ; ce risque est couvert par les frais d'annulation (DEC-025) et par les CGU (DEC-018).
- Frais du fournisseur : payés par l'acheteur en plus du prix du billet (1,8 % selon une source indirecte, 4 % observés en sandbox ; taux réel à confirmer en production, voir `docs/payments.md`). Ils n'entrent pas dans le calcul de la commission ni du reversement.
- Montants en FCFA entiers ; la règle d'arrondi de la commission est fixée et testée dans NOISE-039.
- Reversement automatique (précisé le 2026-10-08) : par les transferts (payouts) FedaPay vers le compte Mobile Money de l'organisateur. FedaPay annonce les transferts vers Mobile Money gratuits (vers un compte bancaire : frais selon la banque) ; la fonction s'active sur demande au support FedaPay. Gratuité et API à confirmer en sandbox et auprès du support (NOISE-045).
- Points ouverts : seuil minimum de reversement ; numéro Mobile Money de reversement et sa vérification.
- Personnes : Yannis, Orias (et l'équipe).

## DEC-025 — Annulation par l'organisateur et remboursement des acheteurs

- Remplace : DEC-010.
- Contexte : avec le reversement quotidien (DEC-024), l'organisateur a déjà reçu une partie des ventes au moment d'une annulation. Il peut aussi annuler parce que cela l'arrange, sans intention de fuite.
- Choix (réunion d'équipe du 2026-10-08) :
  - l'organisateur paie des frais d'annulation égaux à la commission Noise : prix du billet × nombre de billets vendus × 10 % (somme sur tous les types de billets) ;
  - il renvoie à Noise, dans les 10 jours suivant l'annulation, les sommes qui lui ont déjà été reversées (au plus 90 % des ventes) ; la part pas encore reversée est retenue par Noise ;
  - Noise rembourse à chaque acheteur 100 % du prix de ses billets après le retour des fonds par l'organisateur, par transfert automatique si le fournisseur le permet, sinon manuellement. Les frais de paiement payés par l'acheteur ne sont pas remboursés.
- Équilibre : sommes retournées + part retenue = 90 % des ventes ; avec les frais d'annulation (10 %), Noise dispose de 100 % des ventes pour rembourser et conserve la commission déjà perçue.
- Exemple : 200 billets à 5 000 FCFA, ventes 1 000 000 FCFA ; frais d'annulation 100 000 FCFA ; si 700 000 FCFA ont déjà été reversés, l'organisateur renvoie 700 000 FCFA et Noise retient 200 000 FCFA ; chaque acheteur récupère 5 000 FCFA par billet.
- Organisateur qui ne paie pas sous 10 jours (précisé le 2026-10-08) :
  - premier contact par e-mail et SMS pour comprendre la situation ;
  - relance par e-mail et SMS deux à trois jours plus tard : sans réponse sous 48 à 72 h, bannissement définitif et poursuites judiciaires selon la loi applicable (à préciser dans les CGU, NOISE-043) ;
  - les acheteurs sont informés de l'ouverture d'une enquête de 7 jours au plus ; si elle est concluante, ils sont remboursés dans les 10 jours, sur la trésorerie de Noise et, si nécessaire, sur les fonds propres des associés.
- Conséquences (réglées le 2026-10-08) : l'e-mail est demandé à l'inscription (DEC-026, NOISE-047) ; l'identité de l'organisateur est vérifiée avant qu'il puisse organiser (DEC-018, NOISE-048) ; la règle sur les données personnelles de CLAUDE.md section 9 est élargie en conséquence. Reste ouvert : l'envoi de SMS dépend d'un fournisseur SMS (DEC-017).
- Frais de transfert des remboursements : gratuits vers Mobile Money selon FedaPay, à confirmer (NOISE-045).
- Points ouverts : critères d'une enquête « concluante » ; montant maximal que la trésorerie peut avancer.
- Personnes : Yannis, Orias (et l'équipe).

## DEC-026 — E-mail demandé à l'inscription

- Contexte : la procédure de défaut de paiement (DEC-025) prévoit de contacter l'organisateur par e-mail ; jusqu'ici seuls le nom et le téléphone étaient collectés.
- Choix (Yannis, 2026-10-08) : l'e-mail est demandé à l'inscription, pour tous les comptes (participants et organisateurs), unique par compte.
- Conséquences : colonne `email` sur User (migration), schéma d'inscription et écrans mobiles mis à jour (NOISE-047) ; règle des données personnelles de CLAUDE.md section 9 élargie ; e-mail masqué dans les journaux comme le téléphone.
- Personnes : Yannis, Orias.

## DEC-027 — Solde de l'organisateur et virements à la demande

- Remplace : le reversement quotidien de DEC-024. La commission de 10 % (DEC-024) et la répartition de chaque vente (DEC-022) ne changent pas.
- Contexte : le reversement automatique le lendemain de chaque journée de vente multiplie les transferts, sort l'argent avant l'événement même quand l'organisateur n'en a pas besoin, et augmente l'exposition de Noise en cas d'annulation (DEC-025).
- Choix (décisions d'équipe du 2026-10-15) :
  - un solde par événement. L'organisateur le voit dans l'application, en temps réel : la part qui lui revient sur les ventes confirmées de l'événement (90 % du prix des billets, sans la commission Noise ni les frais de paiement payés par l'acheteur), moins les virements déjà effectués ;
  - deux montants affichés : « disponible » (fonds déjà reçus de FedaPay, qui peuvent être virés) et « en attente » (ventes confirmées dont FedaPay n'a pas encore versé les fonds ; environ 3 jours en sandbox). Noise n'avance jamais d'argent sur sa trésorerie ;
  - chaque événement a un virement gratuit, programmé automatiquement au plus tard 72 heures après la fin de l'événement, pour tout le solde ;
  - l'organisateur peut déclencher ce virement gratuit plus tôt, quand il le souhaite et du montant qu'il veut, dans la limite du solde disponible ; tous les virements suivants de cet événement sont alors payants ;
  - pas de plafond avant l'événement, pas de montant minimum : un virement payant doit seulement être supérieur à ses frais ;
  - les frais d'un virement payant sont déduits du montant viré : l'écran affiche « vous recevrez X, frais Y » avant confirmation ;
  - si le virement gratuit a été déclenché avant la fin, le reste du solde est quand même envoyé automatiquement au plus tard 72 heures après la fin de l'événement, frais déduits : aucun argent ne reste chez Noise ;
  - le numéro Mobile Money qui reçoit les virements est demandé à la création de l'événement, prérempli avec le numéro du compte de l'organisateur. Il doit être au nom de l'organisateur vérifié (DEC-018). Le numéro est confirmé par un code envoyé automatiquement par SMS à ce numéro, et l'e-mail de l'organisateur (DEC-026) par un code ou un lien envoyé à cette adresse : aucun virement n'est possible tant que les deux ne sont pas confirmés. Tout changement de ce numéro est confirmé par le mot de passe et suivi de 24 heures sans virement, pour qu'un vol de compte ne permette pas de détourner l'argent.
- Raison : l'organisateur garde la possibilité de financer sa soirée avec les premières ventes, mais l'argent reste par défaut chez Noise jusqu'à la fin de l'événement. Moins de transferts, et moins de sommes à récupérer en cas d'annulation.
- Conséquences :
  - en cas d'annulation (DEC-025), les sommes à renvoyer par l'organisateur sont les virements déjà effectués ; le reste du solde est retenu par Noise ;
  - NOISE-045 (transferts FedaPay) porte sur les virements à la demande et le versement automatique de fin d'événement, plus les remboursements ;
  - nouvelles tâches : NOISE-050 (API du solde et des virements) et NOISE-051 (écran « Solde » de l'organisateur) ;
  - le formulaire de création d'événement (NOISE-013) demande le numéro de virement ;
  - nouvelle tâche NOISE-052 : confirmation du numéro de virement par SMS et de l'e-mail par code ;
  - chaque virement est tracé (demande, montant, frais, statut, identifiant de transfert FedaPay) et idempotent.
- Points ouverts :
  - montant des frais d'un virement payant (fixe ou pourcentage), à fixer une fois connu le coût réel d'un transfert FedaPay ;
  - le code SMS prouve que l'organisateur détient le numéro, pas que le numéro est à son nom : la déclaration dans les CGU (NOISE-043) reste nécessaire, et un contrôle du titulaire auprès de l'opérateur sera ajouté si FedaPay le permet ;
  - fournisseur SMS (DEC-017, en attente) et fournisseur d'envoi d'e-mails (à choisir) : ils conditionnent la confirmation et servent aussi aux relances de DEC-025 ;
  - gratuité des transferts FedaPay vers Mobile Money et possibilité de virer des fonds encore en attente : à confirmer par écrit (NOISE-045).
- Personnes : Yannis, Orias (et l'équipe).

## DEC-028 — Staging sur un serveur Hetzner dédié

- Précise : DEC-004 (Railway) pour le staging. Railway reste l'option retenue pour la production tant qu'une autre décision ne la remplace pas.
- Contexte : NOISE-016 prévoyait un staging sur Railway. Orias dispose déjà de comptes Hetzner et de serveurs ; il veut apprendre et maîtriser le déploiement, et réduire le coût d'un environnement qui ne sert qu'à la recette.
- Alternatives :
  - Railway : rapide à mettre en place, base gérée, mais payant à l'usage et peu formateur ;
  - un serveur existant d'Orias déjà utilisé par d'autres applications : écarté, car une erreur ou un manque de mémoire pourrait toucher une application en production avec de vrais utilisateurs.
- Choix : un serveur Hetzner Cloud dédié à Noise (type `cax11`, ARM, 2 vCPU, 4 Go, Helsinki). L'API, PostgreSQL et Caddy (HTTPS automatique) tournent sous Docker Compose. Chaque fusion sur `main` dont la CI est verte déclenche un workflow GitHub qui envoie le code par SSH, construit l'image sur le serveur et lance un test de fumée. Sans nom de domaine, l'adresse publique est `<ip-avec-tirets>.sslip.io`.
- Raison : coût faible et fixe, contrôle complet, apprentissage du déploiement, et isolement total des autres applications d'Orias.
- Conséquences :
  - il faut gérer soi-même les sauvegardes de la base, le pare-feu et les mises à jour du serveur (procédure dans `docs/environments.md`) ;
  - le serveur de staging est sur ARM : l'image Docker est construite sur place, ce qui évite un registre d'images ;
  - les secrets restent dans `/opt/noise-staging/.env` sur le serveur et dans un environnement GitHub « staging » (clé SSH de déploiement) ; aucun secret dans Git ;
  - le choix de l'hébergement de production (NOISE-035) reste à confirmer.
- Personnes : Orias, Yannis.

## DEC-029 — Un compte par rôle

- Contexte : le cahier des charges prévoit qu'un même compte puisse être participant et organisateur, avec un sélecteur de vue (NOISE-015). En pratique, mélanger les deux rôles complique l'app, le support et la vérification d'identité (DEC-018), qui ne concerne que les organisateurs.
- Proposition (Yannis, 2026-10-21) : un compte n'a qu'un rôle. Le sélecteur participant / organisateur est retiré ; pour l'autre rôle, on crée un autre compte. Écart au cahier des charges.
- Numéro de téléphone : aujourd'hui un numéro ne peut porter qu'un compte, ce qui obligerait un organisateur à avoir un second numéro pour acheter un billet.
  - Option retenue (Yannis, 2026-10-21) : un même numéro peut porter un compte participant et un compte organisateur, distincts, mais jamais deux comptes du même rôle (numéro unique par rôle). La connexion se fait dans le rôle choisi (écran de bienvenue, ou choix Participant / Organisateur sur l'écran de connexion).
  - Option écartée : un numéro, un compte, un rôle (l'organisateur qui achète devrait utiliser un autre numéro).
- Statut : option retenue par Yannis, à confirmer par Orias à la relecture (décision commune).
- Conséquences : tâche NOISE-060 ; changement de schéma (unicité du numéro) pour l'option A ; comptes existants à deux rôles à traiter ; tests de session et de redirection à revoir.
- Personnes : Yannis, Orias (décision commune : métier et schéma).
