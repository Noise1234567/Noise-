# Environnements et déploiement

État : seul l'environnement local existe (non vérifié sous Windows, voir NOISE-003).

## 1. Environnements

|            | Local                               | Test (CI)                              | Staging                                     | Production                                           |
| ---------- | ----------------------------------- | -------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| But        | Développer                          | Vérifier chaque PR                     | Intégration et recette                      | Utilisateurs réels                                   |
| API        | `pnpm dev:api` (localhost:3000)     | Démarrée dans les tests                | Railway, déployée à chaque merge sur `main` | Railway, déployée sur tag `vX.Y.Z` après approbation |
| Base       | Docker `noise_dev`                  | Service Postgres éphémère `noise_test` | Postgres Railway staging                    | Postgres Railway production, sauvegardes             |
| Paiement   | FakeProvider ou sandbox             | FakeProvider                           | Sandbox                                     | Live                                                 |
| Mobile     | Dev build (EAS development) + Metro | —                                      | APK profil `preview`                        | APK puis AAB profil `production`                     |
| Scanner    | `pnpm dev:scanner`                  | Build vérifié                          | Servi par l'API staging `/scan`             | Servi par l'API production `/scan`                   |
| Données    | Seed                                | Fabriques de test                      | Données de démonstration                    | Réelles                                              |
| Monitoring | Logs console                        | —                                      | Sentry + UptimeRobot                        | Sentry + UptimeRobot + alertes                       |
| Tâche      | NOISE-000/003                       | NOISE-000/005                          | NOISE-016                                   | NOISE-035                                            |

Un environnement « test » séparé en ligne n'est pas nécessaire : la CI couvre les tests automatisés, staging couvre la recette.

## 2. Variables d'environnement de l'API

| Variable                                    | Local                 | Staging / Production                                 | Introduite par |
| ------------------------------------------- | --------------------- | ---------------------------------------------------- | -------------- |
| `NODE_ENV`                                  | development           | staging / production                                 | NOISE-000      |
| `PORT`                                      | 3000                  | fourni par Railway                                   | NOISE-000      |
| `LOG_LEVEL`                                 | debug                 | info                                                 | NOISE-000      |
| `DATABASE_URL`                              | Docker                | fourni par Railway                                   | NOISE-000      |
| `CORS_ORIGINS`                              | http://localhost:5173 | URL du scanner                                       | NOISE-000      |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`   | valeurs locales       | secrets distincts par environnement                  | NOISE-007      |
| `CLOUDINARY_URL`                            | compte de dev         | compte Noise                                         | NOISE-012      |
| `PAYMENT_PROVIDER` (`fake` ou `fedapay`)    | fake                  | fedapay (`fake` refusé en production)                | NOISE-017      |
| `PAYMENT_ENVIRONMENT` (`sandbox` ou `live`) | sandbox               | sandbox (staging) / live (production)                | NOISE-017      |
| `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET` | vides (fake)          | clé `sk_sandbox_` / `sk_live_` vérifiée au démarrage | NOISE-017      |
| `QR_SIGNING_SECRET`                         | valeur locale         | secret distinct                                      | NOISE-020      |
| `SCANNER_JWT_SECRET`                        | valeur locale         | secret distinct                                      | NOISE-024      |
| `SENTRY_DSN`                                | vide                  | projet Sentry                                        | NOISE-030      |

Chaque nouvelle variable est ajoutée à la fois dans `apps/api/src/config/env.ts`, `apps/api/.env.example` et ce tableau.

Mobile : `EXPO_PUBLIC_API_URL` (public, embarqué dans l'APK). Par profil EAS : development → API locale, preview → staging, production → production.

## 3. Déploiement (cible)

Staging (NOISE-016) : merge sur `main` → CI verte → Railway déploie → `prisma migrate deploy` → smoke test `/health/ready`.

Production (NOISE-035) :

1. PR de release (CHANGELOG, version) mergée.
2. Tag `vX.Y.Z` sur `main`.
3. Workflow de déploiement : approbation manuelle (GitHub Environments « production »).
4. Migrations, déploiement, smoke test.
5. Rollback : redéployer le tag précédent ; les migrations doivent rester compatibles avec la version N-1.

Aucun déploiement production le vendredi soir ni la veille d'un événement pilote.
