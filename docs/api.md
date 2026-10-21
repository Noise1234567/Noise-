# API REST

État : conventions en vigueur ; endpoints = cible (seul `GET /health` existe).

## 1. Conventions

| Sujet       | Règle                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| Préfixe     | `/api/v1` pour tous les endpoints métier ; `/health` et `/health/ready` hors préfixe  |
| Format      | JSON, `camelCase`, dates ISO 8601 UTC, montants en entiers FCFA                       |
| Auth        | `Authorization: Bearer <accessToken>` (15 min) ; refresh 30 jours via `/auth/refresh` |
| Scanner     | `Authorization: Bearer <scannerJwt>`, accepté uniquement sur `/scanner/validate`      |
| Pagination  | `?cursor=<id>&limit=20` ; réponse `{ data: [...], nextCursor: string \| null }`       |
| Validation  | Zod sur body, query et params ; échec → 400 `VALIDATION_ERROR` avec `details`         |
| Idempotence | En-tête `Idempotency-Key` facultatif (section Idempotence ci-dessous)                 |
| Traçabilité | Chaque réponse d'erreur contient `requestId` (même valeur que dans les logs)          |

### Idempotence (NOISE-053)

En 3G, une réponse peut se perdre alors que le serveur a bien créé la commande. Le mobile envoie alors la même requête avec la même clé `Idempotency-Key` (8 à 128 caractères : lettres, chiffres, `-`, `_` ; un identifiant aléatoire par intention d'achat) :

- même clé, même corps, réponse connue : la réponse déjà donnée est renvoyée telle quelle (même statut, même corps, y compris une erreur 4xx), avec l'en-tête `Idempotent-Replayed: true` ; rien n'est recréé ;
- même clé avec un autre corps ou sur une autre route : 409 `CONFLICT` ;
- même clé pendant que la première requête est en cours : 409 `CONFLICT`, à réessayer un peu plus tard ;
- erreur serveur (5xx) : rien n'est gardé, un nouvel essai est traité normalement ;
- clé au mauvais format : 400 `VALIDATION_ERROR`.

Les clés sont propres à chaque compte (table `idempotency_keys`) et gardées 24 heures. Sans en-tête, la requête est traitée comme avant.

## 2. Format d'erreur

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le prix doit être un entier positif",
    "details": [{ "path": "price", "message": "..." }],
    "requestId": "7f1c..."
  }
}
```

| HTTP | code                                                 |
| ---- | ---------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                                   |
| 401  | `UNAUTHENTICATED`                                    |
| 403  | `FORBIDDEN`                                          |
| 403  | `IDENTITY_REQUIRED` (pièce d'identité à envoyer)     |
| 404  | `NOT_FOUND`                                          |
| 409  | `CONFLICT` (stock épuisé, commande expirée, doublon) |
| 429  | `RATE_LIMITED`                                       |
| 500  | `INTERNAL_ERROR` (aucun détail technique renvoyé)    |

Les codes sont définis dans `packages/shared/src/errors.ts` ; le mobile affiche ses propres messages en fonction du `code`.

## 3. Endpoints cibles

Base : CDC section 7, complétée par les décisions.

| Méthode   | Endpoint                    | Accès                     | Tâche                |
| --------- | --------------------------- | ------------------------- | -------------------- |
| GET       | `/health`                   | Public                    | NOISE-000 (existe)   |
| GET       | `/health/ready`             | Public                    | NOISE-006            |
| POST      | `/auth/register`            | Public                    | NOISE-007 (existe)   |
| POST      | `/auth/login`               | Public                    | NOISE-007            |
| POST      | `/auth/refresh`             | Public (refresh token)    | NOISE-007            |
| POST      | `/auth/logout`              | Auth                      | NOISE-007            |
| GET       | `/me`                       | Auth                      | NOISE-007            |
| PATCH     | `/me/roles`                 | Auth                      | NOISE-015            |
| GET       | `/events`                   | Auth                      | NOISE-011 (existe)   |
| GET       | `/events/:id`               | Auth                      | NOISE-011 (existe)   |
| POST      | `/events`                   | Organisateur              | NOISE-011 (existe)   |
| PUT       | `/events/:id`               | Organisateur propriétaire | NOISE-011 (existe)   |
| POST      | `/events/:id/ticket-types`  | Organisateur propriétaire | NOISE-011 (existe)   |
| POST      | `/events/:id/poster`        | Organisateur propriétaire | NOISE-012            |
| POST      | `/events/:id/cancel`        | Organisateur propriétaire | NOISE-029            |
| GET       | `/organizer/events`         | Organisateur              | NOISE-013            |
| GET       | `/events/:id/stats`         | Organisateur propriétaire | NOISE-027            |
| POST      | `/orders`                   | Participant               | NOISE-018            |
| GET       | `/orders/:id`               | Participant propriétaire  | NOISE-018            |
| GET       | `/orders/:id/status`        | Participant propriétaire  | NOISE-019            |
| POST      | `/payments/initiate`        | Participant propriétaire  | NOISE-019            |
| POST      | `/payments/webhook`         | Fournisseur (signature)   | NOISE-019            |
| GET       | `/tickets/mine`             | Participant               | NOISE-020 (existe)   |
| POST      | `/scanner/links`            | Organisateur propriétaire | NOISE-024 (existe)   |
| GET       | `/events/:id/scanner-links` | Organisateur propriétaire | NOISE-024 (existe)   |
| DELETE    | `/scanner/links/:id`        | Organisateur propriétaire | NOISE-024 (existe)   |
| POST      | `/scanner/validate`         | Scanner JWT               | NOISE-025            |
| POST      | `/me/push-token`            | Auth                      | NOISE-028            |
| GET, POST | `/me/identity`              | Organisateur              | NOISE-048            |
| *         | `/admin/*`                  | Admin                     | NOISE-037, NOISE-039 |

Écart avec le CDC : un seul endpoint webhook (`/payments/webhook`) car l'agrégateur envoie MTN et Moov au même endroit (DEC-005).

Chaque endpoint, une fois implémenté, est documenté ici avec : corps de requête, réponse, erreurs possibles.

### Authentification (NOISE-007)

Format des numéros : toute écriture béninoise est acceptée (`01 97 45 45 47`, `+229…`, ancien format à 8 chiffres) et convertie en E.164 (`+2290197454547`). Réponse de session (`AuthSession`) : `{ accessToken, refreshToken, user: { id, name, phone, email, roles } }` (`email` est nul pour un compte créé avant DEC-026). Contrats partagés : `packages/shared/src/schemas/auth.ts`.

| Endpoint                     | Corps                                                                                 | Réponse                                                                    | Erreurs                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register` | `name`, `phone`, `email`, `password` (8 à 128), `role` (`PARTICIPANT` ou `ORGANIZER`) | 201 `AuthSession`                                                          | 400 ; 409 numéro ou e-mail déjà utilisé ; 429 (5 essais / 15 min par IP et numéro)                                   |
| `POST /api/v1/auth/login`    | `phone`, `password`                                                                   | 200 `AuthSession`                                                          | 400 ; 401 « Numéro ou mot de passe incorrect » (même message dans les deux cas) ; 403 compte suspendu ; 429          |
| `POST /api/v1/auth/refresh`  | `refreshToken`                                                                        | 200 `AuthSession` (nouveaux jetons)                                        | 401 jeton inconnu, expiré ou déjà utilisé (dans ce dernier cas, toutes les sessions de l'utilisateur sont révoquées) |
| `POST /api/v1/auth/logout`   | `refreshToken` ; access token requis                                                  | 204                                                                        | 401                                                                                                                  |
| `GET /api/v1/me`             | access token requis                                                                   | 200 `{ user }`                                                             | 401                                                                                                                  |
| `PATCH /api/v1/me/roles`     | `role` (`PARTICIPANT` ou `ORGANIZER`)                                                 | 200 `{ accessToken, user }` : nouvel access token contenant le rôle ajouté | 400 (ADMIN refusé) ; 401                                                                                             |

À l'attention du mobile (NOISE-008) : ne jamais lancer deux `refresh` en parallèle avec le même jeton. Le second est traité comme une réutilisation et déconnecte l'utilisateur partout. L'intercepteur Axios doit mettre les requêtes en attente pendant un rafraîchissement.

### Export des ventes (NOISE-039, rôle ADMIN)

| Endpoint                                      | Réponse                                                                                                                                                         | Erreurs                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/admin/events/:eventId/sales`     | 200 `{ eventTitle, lines: [{ ticketTypeName, unitPriceXof, ticketsSold, grossXof }], totals: { ticketsSold, grossXof, noiseXof, affiliateXof, organizerXof } }` | 400 identifiant invalide ; 401 ; 403 (pas ADMIN) ; 404 événement inconnu ; 409 commande payée sans répartition enregistrée |
| `GET /api/v1/admin/events/:eventId/sales.csv` | 200 `text/csv; charset=utf-8`, fichier `ventes-<titre>-<date>.csv` (voir docs/payments.md section 7.1)                                                          | idem                                                                                                                       |

Seules les commandes PAID sont comptées, à partir de la répartition enregistrée à la confirmation du paiement (DEC-022). Chaque appel laisse une ligne d'audit `SALES_EXPORTED` (administrateur, événement, format).

### Administration minimale (NOISE-037, rôle ADMIN)

| Endpoint                                        | Corps / réponse                                                                                            | Erreurs                                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST /api/v1/admin/users/:userId/suspend`      | `{ reason }` (5 à 500 caractères) → 200 `{ userId, status, affectedEvents }`                               | 400 ; 401 ; 403 (pas ADMIN, ou cible ADMIN) ; 404 ; 409 (déjà suspendu, ou pas organisateur) |
| `POST /api/v1/admin/users/:userId/reactivate`   | idem                                                                                                       | idem, 409 si le compte n'est pas suspendu                                                    |
| `POST /api/v1/admin/events/:eventId/suspend`    | `{ reason }` → 200 `{ eventId, status }`                                                                   | 400 ; 401 ; 403 ; 404 ; 409 (seul un événement publié se suspend)                            |
| `POST /api/v1/admin/events/:eventId/reactivate` | idem                                                                                                       | 409 si l'événement n'est pas suspendu ou si son organisateur l'est                           |
| `GET /api/v1/admin/orders`                      | Filtres `status`, `eventId`, `from`, `to`, `limit` (défaut 20, max 50), `cursor` → `{ items, nextCursor }` | 400 filtre invalide ; 401 ; 403                                                              |
| `GET /api/v1/admin/payments`                    | Mêmes filtres + `operator` → `{ items, nextCursor }`                                                       | idem                                                                                         |

Effets de la suspension d'un organisateur : connexion et refresh refusés, sessions révoquées, événements publiés passés en SUSPENDED (et remis en vente à la réactivation, seuls ceux-là), écritures organisateur refusées (403 « Compte suspendu », même avec un jeton encore valide). Un événement SUSPENDED n'accepte plus de commande ni d'initiation de paiement (409) ; un paiement déjà lancé reste confirmé par le webhook, et les billets déjà vendus restent valides. Les listes sont triées du plus récent au plus ancien et ne renvoient que des numéros masqués.

Chaque action (suspension, réactivation, export des ventes) écrit une ligne dans `admin_audit_logs` (admin, action, cible, motif), dans la même transaction que l'action.

### Vérification d'identité des organisateurs (NOISE-048, DEC-018)

Règle : pour créer un événement ou le publier, l'organisateur doit avoir envoyé sa pièce d'identité. Statuts : non soumis (aucune ligne), `PENDING` (envoyée, en attente de décision), `VERIFIED`, `REFUSED` (avec motif). En attente ou vérifiée : il peut créer et publier sans attendre la décision. Non soumis ou refusé : `POST /events` et le passage en `PUBLISHED` répondent 403 `IDENTITY_REQUIRED` ; le mobile s'appuie sur ce code pour afficher l'écran d'envoi.

Côté organisateur (rôle ORGANIZER) :

| Endpoint                   | Corps / réponse                                                                                                                                          | Erreurs                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/me/identity`  | 200 `{ status, canOrganize, submittedAt, refusalReason, resubmitDeadline, eventsPulled }` (`status` : `NOT_SUBMITTED`, `PENDING`, `VERIFIED`, `REFUSED`) | 401 ; 403 (pas organisateur)                                                                                                |
| `POST /api/v1/me/identity` | `multipart/form-data`, champ `document` (JPEG, PNG ou WebP, 5 Mo maximum, type reconnu par le contenu) → 201, même réponse que le GET                    | 400 fichier absent, trop lourd ou d'un autre type ; 401 ; 403 ; 409 déjà en attente ou vérifiée ; 429 (10 envois par heure) |

L'image n'est jamais renvoyée à l'organisateur. Un nouvel envoi n'est possible que s'il n'a encore rien envoyé ou si la pièce a été refusée.

Côté administrateur (rôle ADMIN) :

| Endpoint                                                    | Corps / réponse                                                                                                               | Erreurs                                               |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/v1/admin/identity-verifications`                  | Filtres `status` (défaut `PENDING`), `limit` (défaut 20, max 50), `cursor` ; plus anciennes d'abord → `{ items, nextCursor }` | 400 ; 401 ; 403                                       |
| `GET /api/v1/admin/identity-verifications/:userId/document` | 200 `{ url, expiresAt }` : lien signé valable 5 minutes ; la consultation est tracée                                          | 400 ; 401 ; 403 ; 404 sans demande ou pièce supprimée |
| `POST /api/v1/admin/identity-verifications/:userId/approve` | 200 `{ userId, status, affectedEvents }` ; les événements retirés faute de pièce sont remis en vente                          | 401 ; 403 ; 404 ; 409 déjà décidée                    |
| `POST /api/v1/admin/identity-verifications/:userId/refuse`  | `{ reason, immediate? }` (motif 5 à 500 caractères) → 200 `{ userId, status, affectedEvents }`                                | 400 ; 401 ; 403 ; 404 ; 409 déjà décidée              |

Refus avec avertissement : l'organisateur voit le motif et dispose de 72 heures (`resubmitDeadline`) pour renvoyer une pièce ; pendant ce délai ses événements publiés restent en vente mais il ne peut plus créer ni publier. Le délai écoulé sans nouvel envoi, une tâche horaire retire ses événements publiés de la vente (statut `SUSPENDED`, `eventsPulled: true`) ; ils reviennent si une pièce est ensuite validée. Avec `immediate: true`, les événements sont retirés tout de suite (fraude évidente). Les billets déjà vendus restent valides dans tous les cas. Chaque consultation, validation et refus écrit une ligne dans `admin_audit_logs`.

Conservation : la pièce est stockée en privé chez Cloudinary (type `authenticated`, aucune URL publique). Une pièce refusée est supprimée tout de suite ; une pièce validée est supprimée 12 mois après la validation (le statut reste `VERIFIED`).

### Paiement et suivi de commande (NOISE-019)

| Endpoint                         | Accès                    | Corps / réponse                                                                    | Erreurs                                                                                                                                                                                   |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/payments/initiate` | participant propriétaire | `{ orderId, operator: MTN \| MOOV, phone }` → 201 `{ paymentId, status: PENDING }` | 400 ; 401 ; 404 commande introuvable ou d'un autre ; 409 commande expirée, déjà réglée ou paiement en cours (moins de 2 min) ; 429 (5 / 10 min par compte) ; 502 fournisseur indisponible |
| `POST /api/v1/payments/webhook`  | fournisseur (signature)  | corps brut du fournisseur → 200 `{ received: true }`                               | 401 signature invalide ; 400 corps illisible                                                                                                                                              |
| `GET /api/v1/orders/:id/status`  | participant propriétaire | 200 `{ orderId, status, expiresAt, paidAt, payment: { status } \| null }`          | 400 ; 401 ; 404                                                                                                                                                                           |

Le mobile interroge `GET /orders/:id/status` (backoff 2 → 5 s). Si une tentative est en attente depuis plus de 15 s, l'API redemande le statut au fournisseur : un webhook perdu ne bloque pas le client. Contrats partagés : `packages/shared/src/schemas/payments.ts`.

## 4. Événements et types de billets (NOISE-011)

Tous les endpoints exigent un access token. Création, modification et ajout de types de billets exigent en plus le rôle `ORGANIZER`, et la propriété de l'événement pour la modification (403 sinon).

### Liste : `GET /api/v1/events`

| Paramètre | Règle                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `styles`  | Styles séparés par des virgules (`Rap,Concert`) : événements ayant au moins un de ces styles (liste fermée, 400 si un style est inconnu) |
| `city`    | Égalité, sans tenir compte de la casse                                                                                                   |
| `date`    | `AAAA-MM-JJ`, jour en heure du Bénin (UTC+1) : événements qui commencent ce jour-là                                                      |
| `cursor`  | Identifiant du dernier événement de la page précédente (`nextCursor`)                                                                    |
| `limit`   | 1 à 50, 20 par défaut                                                                                                                    |

La liste ne contient que les événements `PUBLISHED` qui ne sont pas terminés, triés par date de début croissante. Réponse : `{ data: EventDto[], nextCursor: string | null }`.

### Mes événements : `GET /api/v1/events/mine`

Réservé au rôle `ORGANIZER`. Renvoie les événements de l'organisateur connecté, tous statuts confondus (brouillon, publié, annulé, terminé), triés par date de début croissante. Paramètres : `cursor` et `limit` (1 à 50, 20 par défaut), comme la liste publique. Réponse : `{ data: EventDto[], nextCursor: string | null }`, avec `quantityTotal` et `quantitySold` sur chaque type de billet. Le classement « à venir / passés / annulés » se fait côté mobile à partir de `status` et `endsAt`.

### Détail, création, modification

- `GET /events/:id` : un événement `PUBLISHED` ou `CANCELLED` est lisible par tout utilisateur connecté (les détenteurs de billets doivent voir une annulation) ; un brouillon n'est visible que de son organisateur (404 pour les autres).
- `POST /events` : crée l'événement en `DRAFT`. Début dans le futur, fin après le début, `capacity` obligatoire (nombre de participants attendus, entier de 1 à 100 000).
- `PUT /events/:id` : mise à jour partielle (au moins un champ). `status: "PUBLISHED"` publie le brouillon, à condition qu'il ait au moins un type de billet et qu'il ne soit pas terminé (409 sinon). Aucune autre valeur de statut n'est acceptée : l'annulation aura sa propre route (NOISE-029). Un événement annulé ne se modifie plus (409). Dès qu'un billet est vendu, `startsAt`, `endsAt` et `venue` ne peuvent plus changer (409) : les acheteurs ne seraient pas prévenus tant que les notifications (NOISE-028) n'existent pas. `capacity` peut être modifiée, sans descendre sous la somme des billets déjà créés (400). Les autres champs restent modifiables. La publication est conditionnée au statut lu : deux publications simultanées n'en font qu'une (l'autre reçoit 409), et l'équipe Noise reçoit un seul e-mail « Nouvelle soirée publiée » (NOISE-059 : titre, organisateur, date, lieu, capacité, prix). Un échec d'envoi est journalisé et n'empêche pas la publication.
- `POST /events/:id/ticket-types` : `name` (unique par événement, 409 sinon), `priceXof` (entier de 0 à 1 000 000, 0 = billet gratuit), `quantityTotal` (entier de 1 à 100 000), `salesEndAt` facultatif (au plus tard la fin de l'événement). La somme des `quantityTotal` des types de billets ne peut pas dépasser la `capacity` de l'événement (409, le message indique combien de places restent).

### Capacité et frais d'organisation

L'organisateur déclare la capacité à la création et peut l'augmenter ensuite. Les frais d'organisation suivent une règle de trois à 40 FCFA par participant déclaré : 0 FCFA jusqu'à 50 participants inclus, puis 40 FCFA × capacité (51 → 2 040, 60 → 2 400, 100 → 4 000). Ils ne dépendent pas du prix des billets. À chaque augmentation, le reste dû est le total du nouveau niveau moins ce qui est déjà payé (40 → 60 : 2 400 ; 50 → 100 : 4 000). Baisser la capacité ne rembourse rien. La règle vit dans `packages/shared/src/organizer-fee.ts`, partagée avec le mobile.

Le propriétaire reçoit `capacity` et `organizerFee: { totalXof, paidXof, dueXof }` dans l'événement ; les autres utilisateurs ne les voient pas. Le paiement des frais et le blocage de la publication tant qu'ils ne sont pas réglés arrivent avec NOISE-044 : pour l'instant l'API calcule et expose le montant.

### Disponibilité

Chaque type de billet renvoie `available` = quantité totale − billets vendus − billets réservés par des commandes `PENDING` non expirées (DEC-007), jamais négatif. `onSale` indique que l'événement est publié et que la date de fin de vente n'est pas dépassée. `quantityTotal` et `quantitySold` ne sont renvoyés qu'à l'organisateur propriétaire.

« Presque complet » (NOISE-014) est calculé par l'API pour que tous les clients affichent la même chose. `lowStock` (par type de billet) vaut `true` quand il reste 20 % des places ou moins (`LOW_STOCK_RATIO` dans `@noise/shared`), arrondi vers le bas, sans être épuisé : sur 100 billets, 20 restants = vrai, 21 = faux, 0 = faux (c'est « Complet »). `almostFull` (par événement) applique la même règle au total des types encore en vente (ceux dont `onSale` est vrai) ; faux sans type de billet ou quand tout est vendu.

`organizerName` est le nom du compte organisateur, affiché « par <organisateur> » sur le détail. Aucune autre donnée de l'organisateur n'est exposée (ni téléphone, ni e-mail).

Styles : un événement porte `styles`, de 1 à 5 valeurs choisies par l'organisateur dans la liste fermée `EVENT_STYLES` : Afrobeat, Amapiano, Rap, Électro, Concert, Soirée, Gospel, Zouk, Coupé-décalé, Dancehall, Jazz, R&B, Festival, Autre. Pas de doublon. Ce champ remplace l'ancien `genre` (texte libre) à la création et à la modification ; la migration reporte les anciens genres connus et met `Autre` pour les autres.

### `POST /api/v1/events/:id/poster` (NOISE-012)

- Accès : organisateur propriétaire de l'événement. La propriété et le statut sont vérifiés avant la réception du fichier : l'identifiant Cloudinary est celui de l'événement et chaque envoi remplace l'affiche, un autre organisateur ne doit donc jamais pouvoir écrire dessus.
- Requête : `multipart/form-data`, un seul fichier dans le champ `poster`.
- Règles : identifiant d'événement au format UUID ; 5 Mo maximum ; JPEG, PNG ou WebP, reconnus à partir des premiers octets du fichier (le nom et le Content-Type annoncés ne comptent pas). Un événement annulé ne change plus d'affiche.
- Traitement : l'API envoie le fichier à Cloudinary (dossier `noise/posters`, identifiant = id de l'événement, remplacé à chaque envoi), puis enregistre l'URL sur l'événement. Le mobile ne détient aucun identifiant Cloudinary.
- Réponse : 200 `{ event: EventDto }` ; `posterUrl` est une URL HTTPS limitée à 1080 px de large, qualité et format automatiques (WebP ou AVIF selon le téléphone), avec la version dans l'URL pour qu'une affiche remplacée ne reste pas en cache.
- Erreurs : 400 `VALIDATION_ERROR` (identifiant invalide, aucun fichier, mauvais champ, format refusé, plus de 5 Mo) ; 401 ; 403 (pas organisateur, ou événement d'un autre) ; 404 ; 409 événement annulé ; 500 `INTERNAL_ERROR` si Cloudinary est indisponible (l'affiche existante est conservée).
- Configuration : `CLOUDINARY_URL` (obligatoire en staging et en production). Sans elle, en développement, les affiches sont simulées : l'URL renvoyée ne pointe vers aucune image.

### Annulation par l'organisateur (NOISE-029, DEC-025)

Organisateur propriétaire uniquement (403 sinon) ; 404 si l'événement n'existe pas ; 409 s'il est déjà annulé ou terminé.

- `GET /api/v1/events/:id/cancellation` : calcul affiché avant la confirmation, sans rien modifier. Réponse `{ cancellation }` (`CancellationSummaryDto`, `packages/shared/src/schemas/cancellation.ts`) : billets vendus, ventes, remboursements (100 % du prix, hors frais de paiement), frais d'annulation (la commission de 10 %), sommes déjà reversées (0 tant que les virements de DEC-027 n'existent pas), part retenue, montant dû par l'organisateur (frais + sommes reversées), échéance (annulation + 10 jours).
- `POST /api/v1/events/:id/cancel`, corps `{ reason? }` (3 à 500 caractères) : en une transaction, l'événement passe `CANCELLED`, ses billets aussi, les commandes payées passent `CANCELLED` (à rembourser), celles en attente `EXPIRED` (places libérées) et les liens scanner sont révoqués ; les montants sont figés dans `event_cancellations`. Réponse `{ cancellation }` (`CancellationResultDto`) avec en plus les nombres de billets, commandes et liens touchés. Les types de billets sont verrouillés comme lors d'une commande : une commande en cours de création est expirée, jamais laissée en attente. Les acheteurs seront prévenus par notification avec NOISE-028 ; un échec d'envoi n'annule pas l'annulation.
- `GET /api/v1/admin/events/:eventId/refunds` (rôle ADMIN) : `EventRefundsResponse`, la liste des remboursements à effectuer (nom, numéro complet pour le transfert, montant), le total, le montant dû par l'organisateur et l'échéance ; 404 si l'événement n'a pas été annulé. Chaque consultation est journalisée.

## 5. Commandes (NOISE-018)

Une commande réserve des places d'un type de billet pour 15 minutes. Elle est réservée au rôle `PARTICIPANT`, et chaque participant ne voit que ses propres commandes.

### Création : `POST /api/v1/orders`

Corps : `{ ticketTypeId, quantity }`, avec `quantity` entier de 1 à 5 (DEC-008). Réponse 201 : `{ order }` (`OrderDto`, `packages/shared/src/schemas/orders.ts`).

- Le prix est figé à la création : `totalXof` = `unitPriceXof` × `quantity`.
- La commande est `PENDING` et `expiresAt` vaut la création + 15 minutes. Les places sont réservées, mais `quantitySold` n'augmente qu'à la confirmation du paiement (NOISE-019).
- Contrôle du stock : disponible = total − vendus − réservés par des commandes `PENDING` non expirées (DEC-007). Il est fait dans une transaction qui verrouille le type de billet (`SELECT ... FOR UPDATE`) : si plusieurs personnes visent la dernière place en même temps, une seule réussit.
- Billet gratuit (prix 0) : rien à payer, la commande est créée directement `PAID` (`paidAt` renseigné, répartition 0 / 0 / 0) et `quantitySold` augmente aussitôt. Ses billets et leurs QR sont créés dans la même transaction (NOISE-020, section 6).
- Erreurs : 400 (quantité hors de 1 à 5, identifiant invalide) ; 401 ; 403 (rôle participant manquant) ; 404 (type de billet inconnu ou événement en brouillon) ; 409 (événement annulé ou terminé, date limite de vente dépassée, « Ce billet est épuisé » ou « Il ne reste que N place(s) pour ce billet »).

### Suivi : `GET /api/v1/orders/:id`

Réponse 200 : `{ order }`. 404 si la commande n'existe pas ou appartient à un autre participant. Une commande `PENDING` dont l'heure est passée est renvoyée `EXPIRED` (et enregistrée comme telle) sans attendre le job.

### Expiration

Un job passe toutes les minutes (`startOrderExpiryJob`, lancé par `server.ts`) et met en `EXPIRED` les commandes `PENDING` dont `expiresAt` est passé. La réservation est libérée dès l'heure dépassée : le calcul de disponibilité ignore les commandes expirées, avant même le passage du job. Le job peut tourner sur plusieurs instances sans risque (mise à jour conditionnelle).

Le suivi côté paiement (`GET /api/v1/orders/:id/status`, NOISE-019) reste distinct : il rattrape en plus un webhook perdu.

## 6. Billets (NOISE-020)

Un billet est créé pour chaque place d'une commande confirmée, au nom de l'acheteur, avec son QR signé (format et sécurité : `docs/qr-scanner.md`). Pour une commande gratuite, la création se fait dans la transaction de la commande. Pour une commande payée, elle se fait dans la transaction de confirmation du paiement, via le point d'accroche `issueTickets` de NOISE-019 (`createTicketIssuer` dans `modules/tickets/ticket-issuer.ts`).

### Mes billets : `GET /api/v1/tickets/mine`

Réservé au rôle `PARTICIPANT`. Réponse 200 : `{ tickets: TicketDto[] }` (`packages/shared/src/schemas/tickets.ts`), les événements les plus proches d'abord. Chaque billet porte `qrPayload`, le contenu exact du QR à afficher, qui reste le même à chaque appel. Un participant ne reçoit jamais les billets d'un autre. Erreurs : 401, 403.

Configuration : `QR_SIGNING_SECRET` (32 caractères minimum, distinct des autres secrets) est obligatoire hors tests.

## 7. Liens scanner (NOISE-024)

Un lien donne accès au scanner d'un seul événement, sans compte (conception : `docs/qr-scanner.md` section 2). Les trois routes sont réservées au rôle `ORGANIZER`, puis à l'organisateur propriétaire de l'événement : 403 pour celui d'un autre, 404 si l'événement ou le lien n'existe pas.

### Création : `POST /api/v1/scanner/links`

Corps : `{ eventId, label?, durationHours? }` (`packages/shared/src/schemas/scanner-links.ts`). `label` : 1 à 60 caractères ; `durationHours` : entier de 1 à 48. Réponse 201 : `{ link, token, url }`. `link` est un `ScannerLinkDto` (`status` : `ACTIVE`, `EXPIRED` ou `REVOKED`). `token` est le JWT, montré une seule fois. `url` vaut `<SCANNER_URL>#<token>`, ou `null` si `SCANNER_URL` n'est pas configurée.

Erreurs : 400 (corps invalide) ; 401 ; 403 ; 404 ; 409 (événement en brouillon, annulé ou terminé).

### Liste : `GET /api/v1/events/:id/scanner-links`

Réponse 200 : `{ links: ScannerLinkDto[] }`, le plus récent d'abord. Le jeton n'y figure jamais.

### Révocation : `DELETE /api/v1/scanner/links/:id`

Réponse 200 : `{ link }` avec `status: REVOKED`. Rejouer la révocation renvoie le même résultat, sans changer la date.

Configuration : `SCANNER_JWT_SECRET` (32 caractères minimum, différent de `JWT_ACCESS_SECRET`) est obligatoire hors tests ; `SCANNER_URL` est facultative. La partie mobile (générer et partager le lien) reste à faire.

## 8. Validation des QR à l'entrée (NOISE-025)

### `POST /api/v1/scanner/validate`

Appelé par le scanner web du staff. Authentification : `Authorization: Bearer <jeton du lien scanner>` ; un lien absent, expiré, révoqué ou falsifié renvoie 401. Corps : `{ qrCode }` (contenu brut lu dans le QR, 512 caractères au plus ; 400 sinon). Contrat partagé : `packages/shared/src/schemas/scanner.ts`.

Réponse 200 `{ result, holderName?, ticketTypeName?, usedAt? }`, quel que soit le résultat :

| `result`       | Cas                                                            | Champs ajoutés                   |
| -------------- | -------------------------------------------------------------- | -------------------------------- |
| `ACCEPTED`     | Billet valable : il passe à `USED`, l'heure d'entrée est notée | nom, type de billet              |
| `ALREADY_USED` | Billet déjà scanné (capture d'écran, deuxième passage)         | nom, type, `usedAt` (1re entrée) |
| `INVALID`      | QR falsifié, abîmé ou billet inconnu                           | aucun                            |
| `CANCELLED`    | Billet annulé (événement annulé, remboursement)                | nom, type de billet              |
| `WRONG_EVENT`  | Billet d'un autre événement que celui du lien                  | nom, type de billet              |

Le billet est verrouillé (`SELECT ... FOR UPDATE`) puis mis à jour dans la même transaction : plusieurs téléphones qui scannent le même QR au même instant ne laissent entrer qu'une personne. Chaque tentative est inscrite dans `ScanLog`. Ordre exact des contrôles : `docs/qr-scanner.md` section 3.

Limitation : 60 validations par minute et par lien (429 au-delà). La route n'est pas soumise à la limite globale par IP, car tout le staff d'une soirée partage souvent la même connexion. Configuration : `SCANNER_JWT_SECRET` et `QR_SIGNING_SECRET`.
