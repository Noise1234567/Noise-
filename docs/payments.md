# Paiements

État : conception. Fournisseur retenu : FedaPay (DEC-005, acceptée le 2026-10-01). Flux vérifié en sandbox par des scripts d'exploration (section 2.1) ; rien n'est implémenté dans l'API.

## 1. Principe

Un paiement n'est réussi que lorsque le backend l'a confirmé. Ni l'app, ni l'URL de retour, ni un webhook seul ne suffisent :

1. webhook reçu et signature valide ;
2. statut revérifié par un appel serveur à l'API du fournisseur ;
3. montant et devise identiques à la commande ;
4. commande encore PENDING et non expirée ;
5. traitement dans une transaction idempotente.

## 2. Fournisseurs envisagés

| Critère                        | FedaPay                         | KKiaPay                         | MTN + Moov en direct                               |
| ------------------------------ | ------------------------------- | ------------------------------- | -------------------------------------------------- |
| MTN Bénin / Moov Bénin         | Documentés                      | Documentés                      | Deux intégrations séparées                         |
| Sandbox                        | Oui (`sandbox-api.fedapay.com`) | Oui                             | Oui pour MTN (devise de test EUR), Moov à vérifier |
| Devise XOF                     | Oui                             | Oui                             | Oui                                                |
| Webhook et signature           | HMAC-SHA256 (voir 2.1)          | Secret partagé (voir 2.2)       | Oui (MTN callback)                                 |
| Paiement initié par le serveur | Oui (voir 2.1)                  | Non documenté (voir 2.2)        | Oui                                                |
| Frais                          | 4 % (observé en sandbox)        | Non publiés dans la FAQ         | Aucun intermédiaire, mais deux contrats            |
| KYC production                 | À relever                       | Vérification annoncée sous 24 h | Deux processus                                     |

Le tableau est complété par des preuves dans NOISE-010, puis la décision DEC-005 est mise à jour.

### 2.1 FedaPay : relevé documentaire (NOISE-010, 2026-09-27) et essais sandbox (2026-10-01)

- Flux : création d'une transaction (`amount` entier, `description`, `currency` `XOF`) puis paiement direct sans redirection via `POST /v1/{methode}` avec le token de la transaction. Opérateurs listés pour ce mode : MTN Bénin, Moov Bénin, Celtiis Bénin. Une ancienne page de la même doc indique « MTN uniquement » : à trancher en sandbox.
- Statuts : `pending`, `approved`, `declined`, `canceled`, `refunded`, `transferred`.
- Revérification serveur : `GET /v1/transactions/{id}`. La doc demande explicitement de ne pas se fier au statut renvoyé dans l'URL de retour.
- Webhook : en-tête `X-FEDAPAY-SIGNATURE`, HMAC-SHA256 calculé avec le secret du webhook (tableau de bord). Format vérifié en sandbox le 2026-10-01 : voir l'essai ci-dessous.
- Numéros de test (doc v1) : MTN `66000001` succès, `66000000` échec ; Moov `64000001` succès, `64000000` échec. Remplacés en pratique par le format à 10 chiffres (`0166000001`, voir l'essai sandbox ci-dessous).
- Clés : `pk_sandbox_…` / `sk_sandbox_…` dans Paramètres → Clés API du compte sandbox.

Essai sandbox du 2026-10-01 (script `scripts/spikes/payment/fedapay-sandbox.mjs`, compte sandbox de Yannis) :

- `POST /v1/transactions` (100 XOF) : HTTP 200, statut `pending`. La réponse est enveloppée sous la clé `v1/transaction` et contient déjà un `payment_token` et une `payment_url` (page de paiement hébergée).
- `POST /v1/transactions/{id}/token` : HTTP 200 (`token` + `url`).
- `POST /v1/mtn_open`, `/v1/moov` et `/v1/mtn` avec ce token : HTTP 400 « Opération non autorisée » pour les trois. Même résultat avec les numéros au format 8 chiffres, `01…` (10 chiffres) et `+229…`, et sans `phone_number` dans le corps : le format du numéro n'est pas en cause. La référence API indique le chemin `/transactions/{mode}`, qui répond 404 : le chemin du SDK (`/{mode}`) est le bon. La doc affirme qu'un compte sandbox fonctionne sans activation, mais le tableau de bord affiche « Compte: Account.Null ». Cause non identifiée : question posée au support FedaPay.
- La liste des modes renvoyée pour la devise XOF contient `momo_test`. `POST /v1/momo_test` avec le token fonctionne en sandbox (HTTP 200, réponse sous la clé `v1/payment_intent`) et le statut final est relu par `GET /v1/transactions/{id}` (pas d'état `pending` observé après 3 s) :

  | Numéro (format béninois à 10 chiffres) | Résultat   |
  | -------------------------------------- | ---------- |
  | `0166000001`                           | `approved` |
  | `0164000001`                           | `approved` |
  | `0166000000`                           | `declined` |
  | `0164000000`                           | `declined` |

  Les anciens numéros à 8 chiffres (`66000001`, `64000001`, etc.) et le format `+229…` donnent tous `declined`.

- Frais observés : pour une transaction de 100 XOF, le montant débité au client est 104 XOF. Par défaut, les 4 % de frais semblent donc ajoutés à la charge du client ; réglage à vérifier dans le tableau de bord (DEC-009).
- Webhook vérifié (récepteur `scripts/spikes/payment/webhook-receiver.mjs` derrière un tunnel cloudflared) :
  - en-tête `X-FEDAPAY-SIGNATURE: t=<horodatage unix>,s=<signature>` ;
  - `s` = HMAC-SHA256 en hexadécimal de la chaîne `<t>.<corps brut>`, avec le secret du webhook. Le corps doit donc être lu brut, avant tout parsing JSON ; la comparaison se fait en temps constant ; l'horodatage permet de refuser les webhooks trop anciens (rejeu) ;
  - événements reçus pour un paiement : `transaction.created` (`pending`) puis `transaction.approved` ou `transaction.declined`, environ 1 s après le paiement ; la transaction est sous la clé `entity` ;
  - 4 webhooks reçus sur 4 attendus (1 paiement approuvé, 1 refusé), tous avec une signature valide.
- Conclusion provisoire : en sandbox, le paiement direct passe par `momo_test` ; les modes réels (`mtn_open`, `moov`) restent refusés. À confirmer auprès du support : s'ils sont utilisables en production une fois le compte activé (KYC).

### 2.2 KKiaPay : relevé documentaire (NOISE-010, 2026-09-27, non testé en sandbox)

- Intégration centrée sur un widget et des SDK côté client (JS, Android, Flutter, React Native) ; SDK serveur (Node.js, PHP) pour vérifier une transaction et rembourser. Aucune API publique trouvée pour qu'un serveur déclenche lui-même la demande de paiement sur le téléphone du client. Impact : le mobile devrait ouvrir le widget, ce qui s'écarte de notre flux où le backend initie le paiement (section 1). À confirmer auprès du support ou en sandbox.
- Webhook : événements `transaction.success` et `transaction.failed` ; authentification par un secret partagé envoyé tel quel dans l'en-tête `x-kkiapay-secret` (pas de HMAC du corps). Moins robuste : un secret intercepté permet de forger des webhooks, d'où l'importance de la revérification serveur. Renvoi 5 fois si la réponse n'est pas 2xx.
- Numéros de test : MTN `61000000` / `97000000` succès, `…01` erreur de traitement, `…02` fonds insuffisants, `…03` refusé ; Moov `68000000` / `95000000` succès, mêmes suffixes pour les échecs.
- Numéro au format international obligatoire (`+229…`).
- Reversement : gratuit vers un compte Mobile Money, 7 000 FCFA vers un compte bancaire.

### 2.2 bis FeexPay : essais du 2026-10-04 et doc du 2026-10-07 (NOISE-042, close : FedaPay conservé)

Comparaison des frais relevés sur les pages officielles le 2026-10-04 : FeexPay 1,5 % (MTN, Moov), KKiaPay 1,5 % à la charge du client plus 9 900 FCFA HT par mois (offre Intégration), FedaPay 1,8 % d'après une source indirecte (4 % observé en sandbox avec `momo_test`). Page de tarifs FedaPay inaccessible lors de la vérification.

Essais (script `scripts/spikes/payment/feexpay-sandbox.mjs`, compte d'un tiers, clé « de test ») :

- API : `https://api-v2.feexpay.me`, en-tête `Authorization: Bearer <clé>`, identifiant de boutique `shop` dans le corps.
- `POST /api/transactions/public/requesttopay/{mtn|moov|celtiis_bj}` (numéro au format `229` + 10 chiffres, montant, nom, description) : HTTP 202, `status: PENDING`, `reference` (UUID). Paiement déclenché par le serveur : conforme à notre architecture.
- `GET /api/transactions/public/single/status/{reference}` : statuts `PENDING` puis `FAILED`, avec un champ `reason`.
- Numéro inexistant `0166000001` : `FAILED`, `PAYEE_NOT_FOUND`. Numéro de test de la sandbox MTN `46733123450` (succès attendu en sandbox MTN) : `FAILED`, `PAYER_NOT_FOUND`. Le mode test de FeexPay ne passe donc pas par la sandbox MTN ; il est possible que les demandes partent vers le vrai réseau. Aucun paiement réussi, personne n'a été débité.
- Non vérifié : existence de numéros de test, format et authentification des webhooks, KYC, délais de reversement. La clé a cessé d'être acceptée (HTTP 401) ; essais suspendus faute d'accès au compte.

Relevé de la documentation officielle le 2026-10-07 (docs.feexpay.me, section API REST) :

- La sandbox a sa propre adresse : `https://sandbox-api.feexpay.me`. Les essais du 2026-10-04 visaient `https://api-v2.feexpay.me`, l'API de production : les échecs `PAYEE_NOT_FOUND` / `PAYER_NOT_FOUND` venaient donc du vrai réseau.
- Les clés API commencent par `fp_` (environ 66 caractères) ; la clé disponible le 2026-10-07 n'avait pas ce format et était refusée (401) en sandbox comme en production.
- Numéros de test : le résultat dépend des 2 derniers chiffres (00 succès, 01 solde insuffisant, 02 erreur 503, 03 délai dépassé, 04 numéro invalide, 05 en attente puis succès, 06 en attente puis refus du client).
- Webhook : POST JSON (référence, montant, statut, `callback_info`) vers une URL configurée dans le tableau de bord. Aucune signature ni secret documentés : impossible de prouver qu'un webhook vient de FeexPay, seule la revérification du statut par l'API protège.

Conclusion (Yannis, 2026-10-07) : FedaPay est conservé (DEC-005 inchangée). FeexPay est 0,3 point moins cher (1,5 % contre 1,8 %) mais ses webhooks ne sont pas signés et aucun paiement n'a pu être validé en sandbox. Réévaluable plus tard grâce à l'interface PaymentProvider (NOISE-017).

### 2.3 Choix retenu : FedaPay (DEC-005, acceptée le 2026-10-01)

FedaPay correspond à l'architecture prévue, et c'est vérifié en sandbox : paiement initié par le serveur, revérification par l'API, webhook signé en HMAC avec horodatage. KKiaPay est écarté sur la documentation (widget côté mobile obligatoire, webhook protégé par un simple secret partagé), sans essai sandbox. Points ouverts : modes réels en production, frais exacts, délais de KYC (voir DEC-005).

Sources : [FedaPay, transactions](https://docs-v1.fedapay.com/paiements/transactions), [FedaPay, tests](https://docs-v1.fedapay.com/paiements/test), [FedaPay, webhooks](https://docs.fedapay.com/integration-api/en/webhooks-en), [KKiaPay, webhook](https://docs.kkiapay.me/v1/tableau-de-bord/webhook), [KKiaPay, sandbox](https://docs.kkiapay.me/v1/compte/kkiapay-sandbox-guide-de-test), [KKiaPay, FAQ](https://kkiapay.me/faq/?lang=en).

## 3. États

```
Order :   PENDING ──paiement confirmé──► PAID ──annulation événement──► CANCELLED
             │ 15 min sans paiement
             ├──────────────────────────► EXPIRED
             └── échec définitif ───────► FAILED

Payment : INITIATED ─► PENDING ─► SUCCEEDED
                              └─► FAILED
```

## 4. Environnements

| Environnement | Fournisseur                                      | Clés                                    | Webhook                                      |
| ------------- | ------------------------------------------------ | --------------------------------------- | -------------------------------------------- |
| Local         | FakeProvider par défaut ; sandbox ponctuellement | Sandbox dans `.env`                     | Tunnel (ngrok ou cloudflared) vers localhost |
| Test (CI)     | FakeProvider uniquement                          | Aucune                                  | Simulé dans les tests                        |
| Staging       | Sandbox du fournisseur                           | Sandbox dans Railway staging            | URL staging                                  |
| Production    | Live                                             | Live dans Railway production uniquement | URL production                               |

## 5. Implémentation (NOISE-017, NOISE-019)

Implémenté dans NOISE-017 : `apps/api/src/modules/payments/providers/`.

- Interface `PaymentProvider` (`payment-provider.ts`) :
  - `initiate(input)` : crée la transaction chez le fournisseur et déclenche la demande sur le téléphone ; renvoie toujours `PENDING`. `input.paymentId` (identifiant de notre tentative) est envoyé comme `merchant_reference`, unique chez FedaPay : une même tentative ne peut pas être créée deux fois.
  - `getStatus(providerTransactionId)` : revérification serveur ; renvoie le statut converti, le montant hors frais et le statut brut.
  - `verifyWebhookSignature(headers, rawBody)` : en-tête `x-fedapay-signature`, format `t=…,s=…`, comparaison en temps constant, webhook refusé si l'horodatage s'écarte de plus de 5 minutes.
  - `parseWebhook(rawBody)` : événements `transaction.*` convertis, les autres ignorés ; corps validé par Zod.
- Conversion des statuts FedaPay : `approved` et `transferred` → SUCCEEDED ; `declined`, `canceled` et `refunded` → FAILED ; `pending` et tout statut inconnu → PENDING (un statut inattendu ne confirme jamais un paiement).
- Mode de paiement direct : `momo_test` en sandbox (seul accepté), `mtn_open` (MTN) et `moov` (Moov) en production, à confirmer par le support FedaPay.
- Le client FedaPay est créé avec nom et téléphone seulement (pas d'email, vérifié en sandbox). Les frais (4 %) sont ajoutés au montant payé par le client : `amount` reste le montant de la commande, c'est lui qu'on contrôle.
- Sélection par `PAYMENT_PROVIDER` (`createPaymentProvider` dans `index.ts`). `loadEnv` refuse le FakeProvider en production, une clé absente, et une clé `sk_live_` en sandbox (ou l'inverse).
- FakeProvider (`fake-provider.ts`), pour le local et les tests : même format de webhook et de signature que FedaPay. Scénario selon le numéro : `0166000001` succès, `0166000000` échec, `0166000002` reste PENDING jusqu'à `settle()` ; `buildWebhook()` produit un webhook signé, rejouable.
- Le webhook lit le corps brut (nécessaire au calcul de la signature) avant le parsing JSON.
- Le webhook répond 200 rapidement dès que l'événement est enregistré ou déjà traité, pour éviter les renvois inutiles ; il répond 4xx si la signature est invalide.
- Toutes les transitions sont journalisées (sans numéro complet).
- Paiement reçu sur une commande expirée : Payment SUCCEEDED, Order reste EXPIRED, alerte admin, remboursement manuel.

## 6. Tests obligatoires

- Signature invalide → rejet, aucune modification.
- Webhook rejoué → une seule confirmation.
- Deux webhooks simultanés → une seule confirmation (test de concurrence).
- Webhook « succès » mais `getStatus` renvoie « échec » → pas de confirmation.
- Montant différent → pas de confirmation, alerte.
- Commande expirée → pas de billet, alerte de remboursement.

## 7. Frais, reversements et remboursements (DEC-023, DEC-024, DEC-025)

Règles décidées en réunion d'équipe le 2026-10-08. Montants en FCFA entiers.

- Frais d'organisation (DEC-023) : 40 FCFA par participant déclaré (capacité de l'événement) si la capacité dépasse 50, gratuit jusqu'à 50 ; en cas d'augmentation, l'organisateur paie la différence entre les frais du nouveau total et ce qu'il a déjà payé ; offerts aux premiers organisateurs prospectés. Ils s'ajoutent à la commission.
- Commission (DEC-024) : 10 % du prix de chaque billet vendu. Les frais du fournisseur sont payés par l'acheteur en plus du billet et n'entrent pas dans ce calcul.
- Paiement des frais d'organisation (DEC-023) : avant publication, par Mobile Money via FedaPay, même parcours que l'achat d'un billet.
- Reversement (DEC-024) : automatique, par transfert FedaPay vers le Mobile Money de l'organisateur ; 90 % des ventes, versés le lendemain de chaque journée de vente (journée en heure de Cotonou). Transferts vers Mobile Money annoncés gratuits par FedaPay, fonction activée sur demande au support (à confirmer, NOISE-045). Chaque reversement est tracé (date, montant, identifiant de transfert) : l'annulation en dépend.
- Annulation par l'organisateur (DEC-025) :
  - frais d'annulation = ventes totales × 10 % ;
  - l'organisateur renvoie sous 10 jours les sommes déjà reversées ; la part non encore reversée est retenue ;
  - après le retour des fonds, chaque acheteur est remboursé de 100 % du prix de ses billets, hors frais de paiement, par transfert automatique si l'API FedaPay le permet (NOISE-045), sinon manuellement ;
  - sans paiement sous 10 jours : e-mail et SMS, relance deux à trois jours après avec un délai de 48 à 72 h, puis bannissement définitif et poursuites ; les acheteurs sont informés d'une enquête de 7 jours au plus, puis remboursés sous 10 jours sur la trésorerie de Noise si l'enquête est concluante (NOISE-046).

Exemple d'annulation : 200 billets à 5 000 FCFA (1 000 000 FCFA de ventes), 700 000 FCFA déjà reversés. L'organisateur paie 100 000 FCFA de frais et renvoie 700 000 FCFA ; Noise retient 200 000 FCFA, rembourse 1 000 000 FCFA aux acheteurs et conserve sa commission de 100 000 FCFA.

Points ouverts (voir decisions.md) : remboursement des frais d'organisation en cas d'annulation ou de baisse de capacité, seuil minimum de reversement, critères d'une enquête « concluante », montant maximal avancé par la trésorerie. Réglés le 2026-10-08 : e-mail demandé à l'inscription (DEC-026), identité de l'organisateur vérifiée avant d'organiser (DEC-018).

## 8. Mise en production (NOISE-034)

- [ ] Titulaire du compte marchand décidé (DEC-016) et KYC validé
- [x] Taux de commission fixé (10 %, DEC-024)
- [ ] Taux réel des frais FedaPay en production confirmé
- [ ] Clés live uniquement dans Railway production
- [ ] URL de webhook production enregistrée chez le fournisseur
- [ ] Transaction réelle de faible montant réussie, puis remboursée
