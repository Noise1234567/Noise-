# QR codes et scanner

État : NOISE-020 (billets et QR) implémenté ; liens scanner (NOISE-024) et validation (NOISE-025) restent à faire.

## 1. QR token (NOISE-020)

- Créé par le serveur, dans la transaction qui confirme la commande (paiement confirmé, ou commande gratuite créée directement `PAID`). Si la création échoue, la confirmation est annulée. Rejouer la confirmation (webhook reçu deux fois) ne crée pas de second jeu de billets.
- Contenu encodé dans le QR : `NOISE1.<ticketId>.<random>.<signature>`
  - `random` : 128 bits, en hexadécimal, calculés par HMAC-SHA256 de `ticketId` avec `QR_SIGNING_SECRET` : imprévisibles sans le secret ;
  - `signature` : HMAC-SHA256 de `ticketId.random` avec `QR_SIGNING_SECRET`, tronqué à 128 bits et encodé en base64url.
- Écart avec la conception initiale (random tiré au hasard) : le QR se déduit de l'identifiant du billet et du secret. Un tirage aléatoire non conservé empêcherait de redonner son QR au participant qui change de téléphone, puisque la base ne garde que l'empreinte. La sécurité est la même : sans le secret, aucun QR valide ne peut être fabriqué. Changer le secret invalide tous les billets déjà émis.
- En base : seul `sha256(token)` est stocké (`Ticket.qrTokenHash`). Une fuite de la base ne permet pas de reconstituer les QR, car le secret n'y est pas.
- Le préfixe `NOISE1` permet de changer de format plus tard sans casser les anciens billets.
- Côté mobile : le payload est reçu via `GET /tickets/mine`, stocké localement, affiché en plein écran hors ligne.

## 2. Liens scanner (NOISE-024)

- JWT signé avec `SCANNER_JWT_SECRET` (différent des secrets d'auth), contenant `eventId`, `jti`, `exp`.
- Durée configurable par l'organisateur (par défaut : jusqu'à la fin de l'événement + 2 h, maximum 48 h).
- Révocable : `ScannerLink.revokedAt`. Le serveur vérifie le `jti` en base à chaque validation.
- URL partagée : `https://<api>/scan/#<jwt>` — le fragment n'est pas transmis au serveur ni journalisé.

## 3. Validation (NOISE-025)

Ordre des contrôles dans `POST /scanner/validate`, dans une transaction :

1. JWT scanner valide, non expiré, non révoqué → sinon 401.
2. Format et signature HMAC du QR → sinon `INVALID`.
3. Billet trouvé par `qrTokenHash`, verrouillé (`SELECT ... FOR UPDATE`) → sinon `INVALID`.
4. `ticket.eventId` = `eventId` du lien → sinon `WRONG_EVENT`.
5. `status = CANCELLED` → `CANCELLED`.
6. `status = USED` → `ALREADY_USED` (avec `usedAt`).
7. Sinon : `UPDATE status = USED, usedAt = now()` → `ACCEPTED` (avec nom et type de billet).
8. Toute tentative est inscrite dans ScanLog.

| Cas classique                   | Couvert par                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Duplication (capture d'écran)   | Étape 6                                                                           |
| Réutilisation                   | Étape 6                                                                           |
| Falsification                   | Étape 2                                                                           |
| Validation multiple simultanée  | Verrou de l'étape 3                                                               |
| Billet annulé / remboursé       | Étape 5 (le remboursement passe le billet à CANCELLED)                            |
| Billet expiré (événement passé) | Étape 1 (le lien expire après l'événement) ; contrôle de date à ajouter si besoin |

## 4. Comportement du scanner (NOISE-026)

| Situation             | Affichage                                                                     |
| --------------------- | ----------------------------------------------------------------------------- |
| ACCEPTED              | Plein écran vert, « Entrée validée », nom, type de billet, vibration courte   |
| ALREADY_USED          | Plein écran rouge, « Billet déjà utilisé à HH:MM »                            |
| INVALID               | Rouge, « Billet invalide »                                                    |
| CANCELLED             | Rouge, « Billet annulé »                                                      |
| WRONG_EVENT           | Rouge, « Billet d'un autre événement »                                        |
| Lien expiré / révoqué | Écran d'erreur, « Demandez un nouveau lien à l'organisateur »                 |
| Pas de réseau         | Orange, « Pas de connexion — réessayez » ; aucune validation locale (DEC-014) |

Après chaque résultat, retour automatique à la caméra après 2 s. Un même QR lu deux fois de suite dans les 3 s n'est envoyé qu'une fois.

## 5. Tests obligatoires

Un test par ligne du tableau de la section 3, plus : 10 validations simultanées du même billet → exactement un ACCEPTED.
