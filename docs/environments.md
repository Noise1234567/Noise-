# Environnements et déploiement

État : l'environnement local existe (non vérifié sous Windows, voir NOISE-003). Le staging est préparé (NOISE-016, DEC-028) : serveur Hetzner, déploiement automatique à chaque fusion sur `main`, mise en place décrite à la section 4.

## 1. Environnements

|            | Local                               | Test (CI)                              | Staging                                              | Production                                           |
| ---------- | ----------------------------------- | -------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| But        | Développer                          | Vérifier chaque PR                     | Intégration et recette                               | Utilisateurs réels                                   |
| API        | `pnpm dev:api` (localhost:3000)     | Démarrée dans les tests                | Hetzner (Docker), déployée à chaque merge sur `main` | Railway, déployée sur tag `vX.Y.Z` après approbation |
| Base       | Docker `noise_dev`                  | Service Postgres éphémère `noise_test` | Postgres (Docker) sur le serveur de staging          | Postgres Railway production, sauvegardes             |
| Paiement   | FakeProvider ou sandbox             | FakeProvider                           | Sandbox                                              | Live                                                 |
| Mobile     | Dev build (EAS development) + Metro | —                                      | APK profil `preview`                                 | APK puis AAB profil `production`                     |
| Scanner    | `pnpm dev:scanner`                  | Build vérifié                          | Servi par l'API staging `/scan`                      | Servi par l'API production `/scan`                   |
| Données    | Seed                                | Fabriques de test                      | Données de démonstration                             | Réelles                                              |
| Monitoring | Logs console                        | —                                      | Sentry + UptimeRobot                                 | Sentry + UptimeRobot + alertes                       |
| Tâche      | NOISE-000/003                       | NOISE-000/005                          | NOISE-016                                            | NOISE-035                                            |

Un environnement « test » séparé en ligne n'est pas nécessaire : la CI couvre les tests automatisés, staging couvre la recette.

## 2. Variables d'environnement de l'API

| Variable                                                                                                | Local                   | Staging / Production                                 | Introduite par |
| ------------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------- | -------------- |
| `NODE_ENV`                                                                                              | development             | staging / production                                 | NOISE-000      |
| `PORT`                                                                                                  | 3000                    | fourni par Railway                                   | NOISE-000      |
| `LOG_LEVEL`                                                                                             | debug                   | info                                                 | NOISE-000      |
| `DATABASE_URL`                                                                                          | Docker                  | fourni par Railway                                   | NOISE-000      |
| `CORS_ORIGINS`                                                                                          | http://localhost:5173   | URL du scanner                                       | NOISE-000      |
| `JWT_ACCESS_SECRET` (32 caractères minimum ; obligatoire hors tests)                                    | valeur locale aléatoire | secret distinct par environnement                    | NOISE-007      |
| `CLOUDINARY_URL`                                                                                        | compte de dev           | compte Noise                                         | NOISE-012      |
| `PAYMENT_PROVIDER` (`fake` ou `fedapay`)                                                                | fake                    | fedapay (`fake` refusé en production)                | NOISE-017      |
| `PAYMENT_ENVIRONMENT` (`sandbox` ou `live`)                                                             | sandbox                 | sandbox (staging) / live (production)                | NOISE-017      |
| `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`                                                             | vides (fake)            | clé `sk_sandbox_` / `sk_live_` vérifiée au démarrage | NOISE-017      |
| `QR_SIGNING_SECRET` (32 caractères minimum ; obligatoire hors tests)                                    | valeur locale           | secret distinct                                      | NOISE-020      |
| `SCANNER_JWT_SECRET` (32 caractères minimum, différent de `JWT_ACCESS_SECRET` ; obligatoire hors tests) | valeur locale           | secret distinct                                      | NOISE-024      |
| `SMTP_USER`, `SMTP_PASSWORD`, `TEAM_EMAIL` (les trois ensemble, ou aucun)                               | vides (envoi simulé)    | Gmail de l'équipe, mot de passe d'application        | NOISE-059      |
| `SMTP_HOST`, `SMTP_PORT`                                                                                | smtp.gmail.com, 465     | idem (valeurs par défaut)                            | NOISE-059      |
| `SENTRY_DSN`                                                                                            | vide                    | projet Sentry                                        | NOISE-030      |

Chaque nouvelle variable est ajoutée à la fois dans `apps/api/src/config/env.ts`, `apps/api/.env.example` et ce tableau.

Mobile : `EXPO_PUBLIC_API_URL` (public, embarqué dans l'APK). Par profil EAS : development → API locale, preview → staging, production → production.

## 3. Déploiement (cible)

Staging (NOISE-016, DEC-028) : merge sur `main` → CI verte → le workflow « Deploy staging » envoie le code au serveur par SSH → `docker compose up --build` → `prisma migrate deploy` au démarrage de l'API → test de fumée sur `/health/ready` et `/scan/`.

Production (NOISE-035) :

1. PR de release (CHANGELOG, version) mergée.
2. Tag `vX.Y.Z` sur `main`.
3. Workflow de déploiement : approbation manuelle (GitHub Environments « production »).
4. Migrations, déploiement, smoke test.
5. Rollback : redéployer le tag précédent ; les migrations doivent rester compatibles avec la version N-1.

Aucun déploiement production le vendredi soir ni la veille d'un événement pilote.

## 4. Mettre en place le staging (une seule fois)

Serveur : Hetzner Cloud `cax11` (ARM, 2 vCPU, 4 Go de RAM, 40 Go), Ubuntu, Helsinki, adresse `77.42.37.145`. Il est réservé à Noise : il n'héberge aucune autre application (DEC-028). Sans nom de domaine, le nom public est `77-42-37-145.sslip.io`, qui pointe sur l'adresse IP ; Caddy y obtient tout seul un certificat HTTPS.

Ce qui tourne sur le serveur, sous Docker Compose (`deploy/staging/docker-compose.yml`) :

| Service | Rôle                                                    | Exposé sur internet |
| ------- | ------------------------------------------------------- | ------------------- |
| `caddy` | Point d'entrée HTTPS (ports 80 et 443), certificats     | Oui                 |
| `api`   | API Noise et scanner web (`/scan`), migrations au début | Non (via Caddy)     |
| `db`    | PostgreSQL 17, volume `pgdata`                          | Non                 |

### 4.1 Préparer le serveur (en root, une fois)

1. Mises à jour et Docker :

   ```
   apt update && apt upgrade -y
   curl -fsSL https://get.docker.com | sh
   ```

2. Utilisateur de déploiement et dossier de travail :

   ```
   adduser --disabled-password --gecos "" deploy
   usermod -aG docker deploy
   install -d -o deploy -g deploy -m 750 /opt/noise-staging
   ```

   Appartenir au groupe `docker` revient à pouvoir administrer le serveur : acceptable ici parce que le serveur est dédié au staging.

3. Clé SSH de déploiement, propre à ce serveur. Sur ton ordinateur (sans phrase de passe, car c'est GitHub qui s'en sert) :

   ```
   ssh-keygen -t ed25519 -f noise-staging-deploy -C "github-actions-deploy" -N '""'
   ```

   Ajoute le contenu de `noise-staging-deploy.pub` dans `/home/deploy/.ssh/authorized_keys` sur le serveur (dossier `.ssh` en droits 700, fichier en 600, propriétaire `deploy`). Le fichier privé `noise-staging-deploy` va dans un secret GitHub (4.2), puis il est supprimé de l'ordinateur.

4. Pare-feu : seuls SSH, HTTP et HTTPS sont ouverts.

   ```
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```

5. Connexion SSH par clé uniquement (après avoir vérifié qu'une connexion par clé fonctionne, depuis une seconde fenêtre) :

   ```
   printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-noise.conf
   systemctl reload ssh
   ```

6. Fichier de secrets `/opt/noise-staging/.env`, créé à partir de `deploy/staging/env.example` et protégé (`chmod 600`, propriétaire `deploy`). Chaque secret est généré sur le serveur, jamais collé dans une discussion :

   ```
   openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48   # un secret de 48 caractères
   openssl rand -hex 24                                      # mot de passe Postgres
   ```

### 4.2 Configurer GitHub

Dans le dépôt : Settings, Environments, New environment, nom `staging`.

| Type     | Nom                   | Valeur                                                                   |
| -------- | --------------------- | ------------------------------------------------------------------------ |
| Secret   | `STAGING_SSH_KEY`     | contenu du fichier privé `noise-staging-deploy`                          |
| Secret   | `STAGING_KNOWN_HOSTS` | résultat de `ssh-keyscan -t ed25519 77.42.37.145` (empreinte du serveur) |
| Variable | `STAGING_SSH_HOST`    | `77.42.37.145`                                                           |
| Variable | `STAGING_SSH_USER`    | `deploy`                                                                 |
| Variable | `STAGING_HOST`        | `77-42-37-145.sslip.io`                                                  |

### 4.3 Premier déploiement et vérification

1. Onglet Actions, workflow « Deploy staging », « Run workflow » sur `main`.
2. Vérifier `https://77-42-37-145.sslip.io/health/ready` : la réponse doit contenir `"database":"up"`.
3. Journaux en cas de problème, sur le serveur :

   ```
   cd /opt/noise-staging/app/deploy/staging && docker compose logs --tail 100 api
   ```

Les déploiements suivants sont automatiques : chaque fusion sur `main` dont la CI est verte déclenche le workflow.

### 4.4 Exploitation

- Webhook FedaPay (sandbox) : `https://77-42-37-145.sslip.io/api/v1/payments/webhook`, avec le secret placé dans `PAYMENT_WEBHOOK_SECRET`.
- Application mobile : le profil EAS `preview` pointe sur `https://77-42-37-145.sslip.io` (`apps/mobile/eas.json`).
- Données de démonstration : le script `db:seed` refuse toute base autre que `noise_dev`. Au staging, les comptes se créent par l'application ; le premier compte administrateur sera créé par la commande de NOISE-055.
- Sauvegarde de la base (à planifier avec cron, en plus des sauvegardes Hetzner si elles sont activées) :

  ```
  cd /opt/noise-staging/app/deploy/staging
  docker compose exec -T db pg_dump -U noise noise_staging | gzip > ~/noise-staging-$(date +%F).sql.gz
  ```

- Changer un secret : modifier `/opt/noise-staging/.env`, puis relancer le workflow à la main (Run workflow) ou, sur le serveur, `docker compose up -d`.
- Retour en arrière : annuler la fusion fautive sur `main` (revert) ; le workflow redéploie la version précédente.
