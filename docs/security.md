# Sécurité

État : règles en vigueur dès maintenant ; checklist à valider dans NOISE-030 avant la release v0.1.0.

## 1. Menaces principales

| Menace                               | Conséquence                      | Parade                                                                                       |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| Faux webhook de paiement             | Billets obtenus sans payer       | Signature vérifiée + revérification du statut via l'API du fournisseur + contrôle du montant |
| Webhook rejoué                       | Double confirmation              | Idempotence (`providerTransactionId` unique), transaction                                    |
| QR copié / capture d'écran partagée  | Double entrée                    | Scan atomique : le deuxième scan renvoie ALREADY_USED avec l'heure du premier                |
| QR falsifié                          | Entrée frauduleuse               | Token aléatoire + HMAC serveur, hash stocké, jamais calculé côté client                      |
| Lien scanner fuité                   | Scans par un tiers               | JWT limité à un événement, durée courte, révocable, rate limit                               |
| Accès aux ressources d'autrui (IDOR) | Fuite ou modification de données | Contrôle de propriété dans chaque service, tests dédiés                                      |
| Force brute sur la connexion         | Prise de compte                  | Rate limiting, hachage argon2id, messages d'erreur génériques                                |
| Vol du refresh token                 | Session volée                    | Stockage SecureStore, hash en base, rotation, révocation au logout                           |
| Secret dans l'APK                    | Compromission des services       | Aucun secret dans `EXPO_PUBLIC_*` ni dans le code mobile                                     |
| Données personnelles dans les logs   | Fuite de téléphones              | Masquage pino (`apps/api/src/lib/logger.ts`), numéros masqués en base pour les paiements     |

## 2. Règles

Authentification et autorisation :

- Toutes les routes sont protégées sauf `/health*`, `/auth/register`, `/auth/login`, `/auth/refresh` et le webhook (protégé par signature).
- Vérification du rôle ET de la propriété côté serveur, jamais uniquement dans l'interface.
- Access token : JWT HS256 de 15 min (émetteur `noise-api`, audience `noise-app`, rôles dans le jeton). Refresh token : chaîne aléatoire opaque de 32 octets (et non un JWT : rien à décoder côté client, révocable en base), valable 30 jours, stocké haché en SHA-256, rotation à chaque usage, réutilisation d'un ancien token = révocation de toute la chaîne. Code : `apps/api/src/modules/auth/tokens.ts`.
- Connexion : un numéro inconnu déclenche quand même une vérification argon2 (temps de réponse identique, on ne peut pas deviner quels numéros ont un compte).
- Mots de passe : argon2id, minimum 8 caractères.

Entrées et sorties :

- Validation Zod de toutes les entrées, y compris webhooks et variables d'environnement.
- Limite de taille des corps JSON (100 ko) et des fichiers (5 Mo).
- Jamais de stack trace ni de message d'erreur interne renvoyé au client.

Secrets :

| Où                                      | Quoi                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| `apps/api/.env` (local, ignoré par Git) | Secrets de développement uniquement                             |
| Railway (staging, production)           | Secrets serveur, distincts par environnement                    |
| EAS (secrets de build)                  | Variables de build mobile ; aucun secret serveur                |
| GitHub Secrets                          | Jetons de déploiement CI                                        |
| Notion                                  | Uniquement le nom du secret, son emplacement et son responsable |

- Un secret exposé (commit, capture, message) est considéré compromis : rotation immédiate.
- Les clés de paiement live n'existent que dans Railway production.

Limitation de débit (valeurs initiales) :

| Route                           | Limite                        |
| ------------------------------- | ----------------------------- |
| `/auth/login`, `/auth/register` | 5 / 15 min par IP + téléphone |
| `/payments/initiate`            | 5 / 10 min par utilisateur    |
| `/scanner/validate`             | 60 / min par lien             |
| Global                          | 300 / 15 min par IP           |

Implémentation : `apps/api/src/middlewares/rate-limit.ts` (express-rate-limit). Sur `/auth`, le compteur est par IP et numéro normalisé, et les connexions réussies ne sont pas comptées. Limite globale active sur toute l'API depuis NOISE-007. Compteurs en mémoire : valables pour une seule instance de l'API ; prévoir un stockage partagé avant de passer à plusieurs instances. Erreur renvoyée : 429 `RATE_LIMITED`.

Données personnelles : collecte minimale (nom, téléphone). Numéro masqué dans les paiements (`97****12`). Pas de donnée personnelle dans Sentry. Suppression de compte à prévoir avant Google Play (Data safety).

## 3. Checklist avant release (NOISE-030)

- [ ] Aucun secret dans le dépôt (recherche dans l'historique Git)
- [ ] Variables `EXPO_PUBLIC_*` relues : aucune valeur sensible
- [ ] Tests d'autorisation sur chaque endpoint (401, 403, IDOR)
- [ ] Webhook : signature, rejeu, montant incohérent testés
- [ ] Scan : concurrence, billet annulé, mauvais événement testés
- [ ] Rate limiting actif en staging
- [ ] HTTPS uniquement, en-têtes helmet présents
- [ ] Logs de staging relus : aucun téléphone, token ou QR en clair
- [ ] `pnpm audit` : aucune vulnérabilité haute non traitée
- [ ] Sauvegardes de la base production activées (NOISE-035)
