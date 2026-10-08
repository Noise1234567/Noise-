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
| Idempotence | En-tête `Idempotency-Key` accepté sur `POST /orders` et `POST /payments/initiate`     |
| Traçabilité | Chaque réponse d'erreur contient `requestId` (même valeur que dans les logs)          |

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
| 404  | `NOT_FOUND`                                          |
| 409  | `CONFLICT` (stock épuisé, commande expirée, doublon) |
| 429  | `RATE_LIMITED`                                       |
| 500  | `INTERNAL_ERROR` (aucun détail technique renvoyé)    |

Les codes sont définis dans `packages/shared/src/errors.ts` ; le mobile affiche ses propres messages en fonction du `code`.

## 3. Endpoints cibles

Base : CDC section 7, complétée par les décisions.

| Méthode | Endpoint                    | Accès                     | Tâche                |
| ------- | --------------------------- | ------------------------- | -------------------- |
| GET     | `/health`                   | Public                    | NOISE-000 (existe)   |
| GET     | `/health/ready`             | Public                    | NOISE-006            |
| POST    | `/auth/register`            | Public                    | NOISE-007 (existe)   |
| POST    | `/auth/login`               | Public                    | NOISE-007            |
| POST    | `/auth/refresh`             | Public (refresh token)    | NOISE-007            |
| POST    | `/auth/logout`              | Auth                      | NOISE-007            |
| GET     | `/me`                       | Auth                      | NOISE-007            |
| PATCH   | `/me/roles`                 | Auth                      | NOISE-015            |
| GET     | `/events`                   | Auth                      | NOISE-011 (existe)   |
| GET     | `/events/:id`               | Auth                      | NOISE-011 (existe)   |
| POST    | `/events`                   | Organisateur              | NOISE-011 (existe)   |
| PUT     | `/events/:id`               | Organisateur propriétaire | NOISE-011 (existe)   |
| POST    | `/events/:id/ticket-types`  | Organisateur propriétaire | NOISE-011 (existe)   |
| POST    | `/events/:id/poster`        | Organisateur propriétaire | NOISE-012            |
| POST    | `/events/:id/cancel`        | Organisateur propriétaire | NOISE-029            |
| GET     | `/organizer/events`         | Organisateur              | NOISE-013            |
| GET     | `/events/:id/stats`         | Organisateur propriétaire | NOISE-027            |
| POST    | `/orders`                   | Participant               | NOISE-018            |
| GET     | `/orders/:id`               | Participant propriétaire  | NOISE-018            |
| GET     | `/orders/:id/status`        | Participant propriétaire  | NOISE-019            |
| POST    | `/payments/initiate`        | Participant propriétaire  | NOISE-019            |
| POST    | `/payments/webhook`         | Fournisseur (signature)   | NOISE-019            |
| GET     | `/tickets/mine`             | Participant               | NOISE-020            |
| POST    | `/scanner/links`            | Organisateur propriétaire | NOISE-024            |
| GET     | `/events/:id/scanner-links` | Organisateur propriétaire | NOISE-024            |
| DELETE  | `/scanner/links/:id`        | Organisateur propriétaire | NOISE-024            |
| POST    | `/scanner/validate`         | Scanner JWT               | NOISE-025            |
| POST    | `/me/push-token`            | Auth                      | NOISE-028            |
| *       | `/admin/*`                  | Admin                     | NOISE-037, NOISE-039 |

Écart avec le CDC : un seul endpoint webhook (`/payments/webhook`) car l'agrégateur envoie MTN et Moov au même endroit (DEC-005).

Chaque endpoint, une fois implémenté, est documenté ici avec : corps de requête, réponse, erreurs possibles.

### Authentification (NOISE-007)

Format des numéros : toute écriture béninoise est acceptée (`01 97 45 45 47`, `+229…`, ancien format à 8 chiffres) et convertie en E.164 (`+2290197454547`). Réponse de session (`AuthSession`) : `{ accessToken, refreshToken, user: { id, name, phone, roles } }`. Contrats partagés : `packages/shared/src/schemas/auth.ts`.

| Endpoint                     | Corps                                                                        | Réponse                                                                    | Erreurs                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register` | `name`, `phone`, `password` (8 à 128), `role` (`PARTICIPANT` ou `ORGANIZER`) | 201 `AuthSession`                                                          | 400 ; 409 numéro déjà utilisé ; 429 (5 essais / 15 min par IP et numéro)                                             |
| `POST /api/v1/auth/login`    | `phone`, `password`                                                          | 200 `AuthSession`                                                          | 400 ; 401 « Numéro ou mot de passe incorrect » (même message dans les deux cas) ; 403 compte suspendu ; 429          |
| `POST /api/v1/auth/refresh`  | `refreshToken`                                                               | 200 `AuthSession` (nouveaux jetons)                                        | 401 jeton inconnu, expiré ou déjà utilisé (dans ce dernier cas, toutes les sessions de l'utilisateur sont révoquées) |
| `POST /api/v1/auth/logout`   | `refreshToken` ; access token requis                                         | 204                                                                        | 401                                                                                                                  |
| `GET /api/v1/me`             | access token requis                                                          | 200 `{ user }`                                                             | 401                                                                                                                  |
| `PATCH /api/v1/me/roles`     | `role` (`PARTICIPANT` ou `ORGANIZER`)                                        | 200 `{ accessToken, user }` : nouvel access token contenant le rôle ajouté | 400 (ADMIN refusé) ; 401                                                                                             |

À l'attention du mobile (NOISE-008) : ne jamais lancer deux `refresh` en parallèle avec le même jeton. Le second est traité comme une réutilisation et déconnecte l'utilisateur partout. L'intercepteur Axios doit mettre les requêtes en attente pendant un rafraîchissement.

## 4. Événements et types de billets (NOISE-011)

Tous les endpoints exigent un access token. Création, modification et ajout de types de billets exigent en plus le rôle `ORGANIZER`, et la propriété de l'événement pour la modification (403 sinon).

### Liste : `GET /api/v1/events`

| Paramètre | Règle                                                                               |
| --------- | ----------------------------------------------------------------------------------- |
| `genre`   | Égalité, sans tenir compte de la casse                                              |
| `city`    | Égalité, sans tenir compte de la casse                                              |
| `date`    | `AAAA-MM-JJ`, jour en heure du Bénin (UTC+1) : événements qui commencent ce jour-là |
| `cursor`  | Identifiant du dernier événement de la page précédente (`nextCursor`)               |
| `limit`   | 1 à 50, 20 par défaut                                                               |

La liste ne contient que les événements `PUBLISHED` qui ne sont pas terminés, triés par date de début croissante. Réponse : `{ data: EventDto[], nextCursor: string | null }`.

### Détail, création, modification

- `GET /events/:id` : un événement `PUBLISHED` ou `CANCELLED` est lisible par tout utilisateur connecté (les détenteurs de billets doivent voir une annulation) ; un brouillon n'est visible que de son organisateur (404 pour les autres).
- `POST /events` : crée l'événement en `DRAFT`. Début dans le futur, fin après le début, `capacity` obligatoire (nombre de participants attendus, entier de 1 à 100 000).
- `PUT /events/:id` : mise à jour partielle (au moins un champ). `status: "PUBLISHED"` publie le brouillon, à condition qu'il ait au moins un type de billet et qu'il ne soit pas terminé (409 sinon). Aucune autre valeur de statut n'est acceptée : l'annulation aura sa propre route (NOISE-029). Un événement annulé ne se modifie plus (409). `capacity` peut être modifiée, sans descendre sous la somme des billets déjà créés (400). Dès qu'un billet est vendu, `startsAt` et `venue` ne changent plus (409).
- `POST /events/:id/ticket-types` : `name` (unique par événement, 409 sinon), `priceXof` (entier de 0 à 1 000 000, 0 = billet gratuit), `quantityTotal` (entier de 1 à 100 000), `salesEndAt` facultatif (au plus tard la fin de l'événement). La somme des `quantityTotal` des types de billets ne peut pas dépasser la `capacity` de l'événement (409, le message indique combien de places restent).

### Capacité et frais d'organisation

L'organisateur déclare la capacité à la création et peut l'augmenter ensuite. Les frais d'organisation suivent une règle de trois à 40 FCFA par participant déclaré : 0 FCFA jusqu'à 50 participants inclus, puis 40 FCFA × capacité (51 → 2 040, 60 → 2 400, 100 → 4 000). Ils ne dépendent pas du prix des billets. À chaque augmentation, le reste dû est le total du nouveau niveau moins ce qui est déjà payé (40 → 60 : 2 400 ; 50 → 100 : 4 000). Baisser la capacité ne rembourse rien. La règle vit dans `packages/shared/src/organizer-fee.ts`, partagée avec le mobile.

Le propriétaire reçoit `capacity` et `organizerFee: { totalXof, paidXof, dueXof }` dans l'événement ; les autres utilisateurs ne les voient pas. Le paiement des frais et le blocage de la publication tant qu'ils ne sont pas réglés arrivent avec NOISE-044 : pour l'instant l'API calcule et expose le montant.

### Disponibilité

Chaque type de billet renvoie `available` = quantité totale − billets vendus − billets réservés par des commandes `PENDING` non expirées (DEC-007), jamais négatif. `onSale` indique que l'événement est publié et que la date de fin de vente n'est pas dépassée. `quantityTotal` et `quantitySold` ne sont renvoyés qu'à l'organisateur propriétaire.
