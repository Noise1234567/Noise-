# Base de données

État : modèle cible, à implémenter dans NOISE-006. PostgreSQL 17, Prisma 7.

## 1. Entités

Base : CDC section 6, complétée (Payment, ScanLog, révocation des liens, rôles multiples, réservation de stock).

| Table        | Champs principaux                                                                                                                 | Notes                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| User         | id (uuid), name, phone (unique, E.164 : +229 puis 10 chiffres commençant par 01), passwordHash, roles (enum[]), status, createdAt | `roles` : PARTICIPANT, ORGANIZER, ADMIN                                |
| RefreshToken | id, userId, tokenHash (unique), expiresAt, revokedAt, replacedById                                                                | Rotation : l'ancien est révoqué à chaque refresh                       |
| Event        | id, organizerId, title, description, genre, venue, city, startsAt, endsAt, posterUrl, status, cancelledAt                         | status : DRAFT, PUBLISHED, CANCELLED ; « à venir / passé » est calculé |
| TicketType   | id, eventId, name, priceXof (Int), quantityTotal, quantitySold, salesEndAt                                                        | Contrainte : quantitySold ≤ quantityTotal                              |
| Order        | id, participantId, ticketTypeId, quantity (1–5), unitPriceXof, totalXof, status, expiresAt, paidAt                                | Prix figé à la création                                                |
| Payment      | id, orderId, provider, operator (MTN/MOOV), phoneMasked, amountXof, status, providerTransactionId (unique), rawStatus, createdAt  | Une commande peut avoir plusieurs tentatives                           |
| Ticket       | id, orderId, ticketTypeId, eventId, holderName, qrTokenHash (unique), status, usedAt                                              | Créé uniquement à la confirmation du paiement                          |
| ScannerLink  | id, eventId, createdById, jti (unique), expiresAt, revokedAt                                                                      | Le JWT lui-même n'est pas stocké                                       |
| ScanLog      | id, scannerLinkId, ticketId (nullable), result, scannedAt                                                                         | Journal de toutes les tentatives                                       |
| PushToken    | id, userId, token (unique), platform, updatedAt                                                                                   | NOISE-028                                                              |

Conventions : noms Prisma en PascalCase / camelCase, tables et colonnes mappées en snake_case (`@@map`, `@map`). Identifiants UUID. Toutes les dates en `timestamptz` UTC. Montants en `Int` (FCFA).

## 2. Règles métier portées par la base

| Règle                                 | Mise en œuvre                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pas de survente (DEC-007)             | Transaction : verrou `FOR UPDATE` sur TicketType, disponible = total − vendus − réservés (commandes PENDING non expirées) |
| Expiration 15 min                     | `Order.expiresAt` ; job d'expiration toutes les minutes + contrôle à chaque lecture                                       |
| `quantitySold` incrémenté au paiement | Dans la transaction de confirmation, jamais à la création de commande (CDC 6.2)                                           |
| Paiement confirmé une seule fois      | `Payment.providerTransactionId` unique + vérification du statut de la commande dans la transaction                        |
| QR unique et non recalculable         | `Ticket.qrTokenHash` unique ; seul le hash est stocké                                                                     |
| Scan unique                           | `SELECT ... FOR UPDATE` sur Ticket puis `UPDATE status = 'USED'` dans la même transaction                                 |
| Propriété des ressources              | Filtre systématique sur `organizerId` / `participantId` dans les services                                                 |

## 3. Index prévus

- Event(status, startsAt), Event(organizerId), Event(genre, city)
- Order(status, expiresAt) pour le job d'expiration
- Ticket(eventId, status) pour les statistiques
- ScanLog(scannerLinkId, scannedAt)

## 4. Migrations

- Création : `pnpm --filter @noise/api db:migrate --name <description>` (local uniquement).
- Application : `db:deploy` en CI, staging et production (jamais `migrate dev` hors local).
- Une migration par PR qui modifie le schéma, relue par les deux développeurs (zone critique).
- Jamais de modification d'une migration déjà mergée : on en ajoute une nouvelle.
- Les migrations destructives (suppression de colonne) se font en deux temps.
