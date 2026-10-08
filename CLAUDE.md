# CLAUDE.md — Contrat de développement de Noise

Ce fichier est la référence permanente pour tout développement sur Noise, qu'il soit fait par Yannis, par Orias ou par Claude. En cas de conflit entre ce fichier et une habitude, ce fichier gagne. Toute modification de ce fichier passe par une PR relue par les deux développeurs.

---

## 1. Contexte

Noise est une application mobile de billetterie événementielle pour Cotonou (Bénin), inspirée de Shotgun.

- Participants : découvrent des événements, achètent un billet en Mobile Money (MTN MoMo, Moov Money), présentent un QR code disponible hors ligne.
- Organisateurs : créent des événements et des types de billets, suivent les ventes et les scans, génèrent un lien scanner pour leur staff.
- Staff : valide les QR à l'entrée depuis un navigateur, sans compte, via un lien tokenisé limité à un événement.
- Administrateur Noise : support, suivi des paiements, reversements manuels, suspension.

Contraintes du marché : 3G dominante, Android milieu de gamme (2–4 Go RAM), paiement Mobile Money en XOF/FCFA, distribution APK par lien direct pour le MVP, français uniquement, thème sombre exclusif.

Référence fonctionnelle : cahier des charges v1.0 (projet Claude « NOISE », fichier `noise_cdc_final.pdf`). Les écarts validés avec le cahier des charges sont listés dans `decisions.md`.

## 2. Fichiers de pilotage

| Fichier        | Rôle                                                | Qui le met à jour             |
| -------------- | --------------------------------------------------- | ----------------------------- |
| `CLAUDE.md`    | Règles permanentes                                  | PR commune uniquement         |
| `roadmap.md`   | Toutes les tâches NOISE-xxx, dépendances, critères  | Claude, validé par vous       |
| `progress.md`  | État factuel à l'instant T                          | Auteur de chaque PR           |
| `decisions.md` | Décisions (format ADR)                              | Celui qui porte la décision   |
| `CHANGELOG.md` | Changements par version                             | Release manager de la version |
| `docs/`        | Documentation technique versionnée                  | Avec le code concerné         |
| Notion         | Pilotage (tâches, sprints, bugs, risques, releases) | Tout le monde                 |

Répartition des sources de vérité : le repository fait foi pour le code, la configuration, les tests et la documentation technique ; Notion fait foi pour le pilotage. Un statut de tâche doit être identique dans `progress.md` et dans Notion ; en cas d'écart, le plus récent est corrigé dans l'autre le jour même.

## 3. Architecture

Monolithe modulaire + client mobile + scanner web, dans un monorepo pnpm.

```
App mobile (Expo/React Native) ──HTTPS REST──┐
                                             ├──► API Express/TS ──Prisma──► PostgreSQL
Scanner web (Vite/TS, servi par l'API) ──────┘         │
                                                       ├──► Agrégateur Mobile Money (API + webhooks)
                                                       ├──► Cloudinary (affiches)
                                                       └──► Expo Push / FCM
```

Principes non négociables :

1. Le backend est la seule source de vérité. Un paiement n'est réussi que lorsque le backend l'a confirmé via webhook signé ET revérification auprès du fournisseur. Le mobile ne fait qu'interroger le backend.
2. Le QR token est généré une seule fois par le serveur à la confirmation du paiement, signé (HMAC), jamais calculable côté client.
3. Le scan est atomique : `SELECT ... FOR UPDATE` + `UPDATE` dans une même transaction PostgreSQL.
4. Le stock est réservé à la création de la commande (statut PENDING) et libéré à l'expiration ou à l'échec (DEC-007).
5. Toute opération déclenchée par un tiers (webhook) est idempotente.

Détails : `docs/architecture.md`.

## 4. Structure du repository

```
apps/api        API Express (src/modules/<domaine>/{routes,controller,service,schemas}.ts)
apps/mobile     App Expo (src/features/<participant|organizer|auth>, src/shared)
apps/scanner    Scanner web (build servi par l'API sous /scan)
packages/shared Constantes métier, énumérations, codes d'erreur, schémas Zod partagés
docs/           Documentation technique
scripts/        Scripts utilitaires (base locale, etc.)
```

Règle de dépendance : `apps/*` peut importer `packages/shared`. `packages/shared` n'importe rien de `apps/*`. Le mobile n'importe jamais de code serveur.

Découpage d'un module API : `routes` (HTTP, auth, validation d'entrée) → `controller` (adaptation requête/réponse) → `service` (règles métier, transactions) → Prisma. Aucune règle métier dans les routes ou les controllers.

## 5. Stack

| Couche         | Choix                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime        | Node 24 LTS (`.nvmrc`), pnpm 10 (workspaces, `node-linker=hoisted` pour Metro)                                 |
| Langage        | TypeScript strict partout                                                                                      |
| API            | Express 5, Zod 4, pino, helmet, express-rate-limit                                                             |
| Base           | PostgreSQL 17, Prisma 7 (adaptateur `pg`)                                                                      |
| Mobile         | Expo SDK 57, React Native, Zustand, Axios, SecureStore, navigation : voir DEC-011                              |
| Scanner        | Vite + TypeScript sans framework, BarcodeDetector + repli jsQR                                                 |
| Tests          | Vitest + Supertest (API), jest-expo + RN Testing Library (mobile), Maestro (E2E Android), Playwright (scanner) |
| Paiement       | Agrégateur béninois, FedaPay ou KKiaPay (choix final dans NOISE-010)                                           |
| Hébergement    | Railway (API + Postgres), environnements staging et production                                                 |
| Builds Android | EAS Build (APK preview, AAB production)                                                                        |
| Monitoring     | Sentry, UptimeRobot                                                                                            |

Ne pas ajouter de dépendance sans justification dans la PR. Côté mobile, toujours installer avec `npx expo install <paquet>` (versions compatibles avec le SDK).

## 6. Conventions de code

- Nommage : fichiers en `kebab-case.ts`, composants React en `PascalCase.tsx`, variables et fonctions en `camelCase`, constantes en `UPPER_SNAKE_CASE`, tables Prisma en `PascalCase` avec `@@map` en `snake_case`.
- Langue : code, noms de variables et commits en anglais ; textes affichés à l'utilisateur, documentation et commentaires métier en français.
- Montants : entiers en FCFA (XOF n'a pas de décimales). Jamais de `float` pour l'argent.
- Dates : stockées en UTC, affichées en heure de Cotonou (Africa/Porto-Novo, UTC+1).
- Validation : toute entrée externe (body, query, params, webhooks, variables d'environnement) passe par un schéma Zod.
- Erreurs API : format unique `{ error: { code, message, details?, requestId } }` (voir `packages/shared/src/errors.ts`).
- Pas de `any` non justifié ; pas de `console.log` dans le code livré (utiliser le logger).
- Formatage et lint automatiques : `pnpm format`, `pnpm lint:fix`.

## 7. Git

Détails et exemples : `docs/git-workflow.md`.

- `main` est protégée : pas de push direct, PR obligatoire, CI verte, une approbation de l'autre développeur.
- Branches courtes (1 à 3 jours) depuis `main` : `feat/NOISE-012-poster-upload`, `fix/NOISE-045-...`, `chore/`, `docs/`, `test/`.
- Commits au format Conventional Commits : `feat(api): add ticket types endpoint`. Le titre de PR suit le même format (vérifié par la CI) et contient l'ID : `feat(api): NOISE-011 events CRUD`.
- Merge en squash uniquement. La branche est supprimée après merge.
- Pas de branche `develop`. `main` se déploie en staging ; un tag `vX.Y.Z` déclenche la production après approbation manuelle.
- Jamais de `--force` sur `main`. Rebase de sa propre branche autorisé.

## 8. Tests

Une tâche n'est pas terminée parce que le code fonctionne en local.

| Niveau          | Outil                                   | Obligatoire pour                                                |
| --------------- | --------------------------------------- | --------------------------------------------------------------- |
| Unitaire        | Vitest / Jest                           | Toute règle métier (calculs, statuts, expiration, signature QR) |
| Intégration API | Vitest + Supertest + Postgres de test   | Tout endpoint : cas nominal, validation, 401, 403, 404          |
| Concurrence     | Vitest + requêtes parallèles            | Réservation de stock, confirmation de paiement, scan            |
| Webhook         | Vitest                                  | Signature invalide, rejeu, ordre inversé, montant incohérent    |
| UI mobile       | RN Testing Library                      | Écrans avec logique (tunnel d'achat, QR hors ligne)             |
| E2E             | Maestro (Android), Playwright (scanner) | Parcours critique avant chaque release                          |

Règles :

- Les tests d'intégration utilisent la base `noise_test`, jamais `noise_dev`.
- Un bug corrigé = un test de non-régression.
- Les tests ne dépendent jamais d'un service externe réel : le fournisseur de paiement est simulé (fake provider) sauf dans les tests sandbox manuels documentés.
- Commande unique avant toute PR : `pnpm check`.

## 9. Sécurité

Détails : `docs/security.md`.

- Aucun secret dans Git, dans Notion, dans les captures d'écran ou dans les variables `EXPO_PUBLIC_*` (elles sont embarquées dans l'APK).
- Secrets stockés dans : `.env` local (ignoré), Railway (API), EAS secrets (mobile), GitHub Secrets (CI).
- Mots de passe hachés (argon2id). Refresh tokens stockés hachés et révocables. Tokens mobiles dans SecureStore.
- Autorisation vérifiée côté serveur sur chaque route (rôle ET propriété de la ressource : un organisateur ne modifie que ses événements).
- Rate limiting sur auth, paiement et scanner.
- Webhooks : signature vérifiée, idempotence, revérification du statut auprès du fournisseur.
- Logs : jamais de mot de passe, token, QR token ou numéro de téléphone complet (masquage configuré dans `apps/api/src/lib/logger.ts`).
- Données personnelles minimales : nom, téléphone et e-mail (DEC-026) ; pour les organisateurs, pièce d'identité pour la vérification (DEC-018), accès restreint aux administrateurs.

## 10. Workflow d'une tâche

1. Prendre une tâche « À faire » dont les dépendances sont terminées (`roadmap.md` / Notion), la passer « En cours » dans Notion et `progress.md`.
2. Créer la branche `type/NOISE-xxx-description`.
3. Développer avec les tests. Mettre à jour la documentation concernée.
4. `pnpm check` en local.
5. Ouvrir la PR avec le template, lier la tâche Notion, passer la tâche « En revue ».
6. Revue par l'autre développeur (section 12). Corrections.
7. Squash merge. Tâche « Implémentée » puis « Testée » / « Validée » / « Déployée » selon les étapes réellement franchies.

Statuts (ne jamais sauter une étape ni l'affirmer sans preuve) : `À faire` → `En cours` → `En revue` → `Implémenté` (mergé) → `Testé` (tests automatisés + vérification manuelle sur staging) → `Validé` (critères d'acceptation vérifiés par l'autre développeur) → `Déployé` (en production). `Bloqué` peut intervenir à tout moment, avec la raison.

## 11. Yannis et Orias

Il n'y a pas de séparation permanente backend / frontend. Chacun intervient sur l'API, le mobile, la base, les tests, la CI et le debugging.

Règles de répartition :

- Sur une même fonctionnalité, celui qui fait l'API ne fait pas l'écran associé : chacun doit lire et comprendre le travail de l'autre.
- Chaque tâche a un responsable et un reviewer ; le reviewer est toujours l'autre développeur.
- Les sujets critiques se font en binôme (pair programming) : schéma de base, paiement, déploiement, sécurité, release.
- À chaque rétrospective de sprint, on compare la charge et les domaines de chacun (vue Notion « Équilibre ») et on corrige le sprint suivant si un écart dépasse 20 %.

Responsabilités transverses (tournantes par milestone) :

| Rôle                                | M0–M1  | M2–M3          |
| ----------------------------------- | ------ | -------------- |
| Gardien de la CI et des dépendances | Orias  | Yannis         |
| Tenue de Notion et `progress.md`    | Yannis | Orias          |
| Release manager                     | —      | Orias (v0.1.0) |

Décisions communes obligatoires : métier (prix, commission, remboursements), sécurité, choix de fournisseur, schéma de base, release.

## 12. Code review

Le reviewer vérifie, dans cet ordre :

1. La tâche : les critères d'acceptation sont-ils remplis ?
2. La correction : cas limites, erreurs, concurrence, transactions.
3. La sécurité : autorisation, validation, secrets, logs.
4. Les tests : présents, pertinents, ils échouent si le code est cassé.
5. La lisibilité : noms, découpage, respect de la structure.
6. La documentation et `progress.md`.

Règles : une PR doit rester relisible (idéalement moins de 400 lignes hors fichiers générés). Commentaires préfixés `bloquant:`, `question:`, `suggestion:`, `détail:`. Réponse à une demande de revue sous 24 h. On critique le code, pas la personne. Le reviewer lance la branche en local pour toute PR qui touche paiement, scan ou auth.

Revue automatique par IA (NOISE-041, DEC-021) : à l'ouverture de chaque PR non brouillon, Claude Code GitHub Actions commente le diff (bugs, sécurité, respect de ce fichier). Cette revue est consultative, jamais bloquante : le workflow n'a que des permissions de lecture, Claude ne peut ni approuver ni merger. Elle s'ajoute à la revue humaine (CODEOWNERS, approbation obligatoire), elle ne la remplace pas. Traiter ses remarques comme celles d'un reviewer junior : utiles à trier, jamais à appliquer sans comprendre.

## 13. Définition de terminé

Une tâche est terminée (statut Validé) seulement si :

- [ ] tous les critères d'acceptation de la tâche sont vérifiés ;
- [ ] les tests requis (section 8) existent et passent en CI ;
- [ ] la PR est relue, approuvée et mergée ;
- [ ] le comportement est vérifié sur staging lorsque la tâche touche l'API ou le mobile (à partir de NOISE-016) ;
- [ ] la documentation concernée est à jour ;
- [ ] aucune dette introduite sans ticket « Dette technique » associé ;
- [ ] `progress.md` et Notion sont à jour.

Une fonctionnalité n'est « Déployée » que lorsqu'elle tourne en production et a été vérifiée après déploiement.

## 14. Règles de communication avec Claude

Pour Claude, à chaque intervention :

- Lire d'abord `progress.md`, puis uniquement les fichiers nécessaires à la tâche. Ne pas relire tout le repository.
- Ne jamais affirmer qu'une chose est faite, testée, validée ou déployée sans l'avoir vérifiée (exécution des tests, sortie de commande, URL). Distinguer toujours : prévu, en cours, implémenté, testé, validé, déployé.
- Ne jamais prétendre avoir modifié un service externe (Notion, GitHub, Railway, Play Console) sans y avoir réellement accès.
- Réponses courtes : ce qui a été fait, ce qui reste, les blocages, la prochaine tâche. Pas de résumé du projet, pas de fichier recopié.
- Mettre à jour `progress.md` (et `roadmap.md` / `decisions.md` si besoin) à la fin de chaque intervention.
- Proposer des options et demander une validation uniquement pour les décisions qui l'exigent (section 11). Pour le reste, décider et le consigner.
- Si une tâche manque, la créer avec un nouvel ID ; si une dépendance manque, la signaler.
- Approche pédagogique : sur les tâches attribuées à Yannis ou Orias, Claude guide (explications, pistes, revue) plutôt que de livrer le code complet, sauf demande explicite.
- Jamais de secret dans une réponse, un fichier ou un commit.
- Pas de texte en gras dans la documentation produite.

## 15. Commandes utiles

```bash
pnpm install                 # installer tout le monorepo
pnpm db:up                   # Postgres local (Docker)
cp apps/api/.env.example apps/api/.env
pnpm --filter @noise/shared build
pnpm --filter @noise/api db:generate   # client Prisma
pnpm --filter @noise/api db:deploy     # migrations sur noise_dev
pnpm --filter @noise/api db:seed       # données de démo
pnpm dev:api                 # API sur http://localhost:3000
pnpm dev:mobile              # Metro / Expo
pnpm dev:scanner             # scanner sur http://localhost:5173/scan/
pnpm check                   # format + lint + types + tests (avant chaque PR)
```
