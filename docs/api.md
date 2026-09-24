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
| POST    | `/auth/register`            | Public                    | NOISE-007            |
| POST    | `/auth/login`               | Public                    | NOISE-007            |
| POST    | `/auth/refresh`             | Public (refresh token)    | NOISE-007            |
| POST    | `/auth/logout`              | Auth                      | NOISE-007            |
| GET     | `/me`                       | Auth                      | NOISE-007            |
| PATCH   | `/me/roles`                 | Auth                      | NOISE-015            |
| GET     | `/events`                   | Auth                      | NOISE-011            |
| GET     | `/events/:id`               | Auth                      | NOISE-011            |
| POST    | `/events`                   | Organisateur              | NOISE-011            |
| PUT     | `/events/:id`               | Organisateur propriétaire | NOISE-011            |
| POST    | `/events/:id/ticket-types`  | Organisateur propriétaire | NOISE-011            |
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
