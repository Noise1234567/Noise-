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

## 7. Reversements et remboursements (manuels, DEC-009 / DEC-010)

Règles (DEC-022) : commission Noise 10 % du prix du billet ; frais de l'agrégateur payés par le client en plus du prix ; affiliation (1 %, prise sur la part de l'organisateur) après le MVP. Chaque commission est arrondie au FCFA inférieur et l'organisateur reçoit le reste. La répartition de chaque commande est calculée par `splitSale` (`packages/shared/src/revenue-split.ts`) et enregistrée à la confirmation du paiement (NOISE-019).

Exemple, billet à 5 000 FCFA : le client paie 5 000 FCFA plus les frais de l'agrégateur ; Noise 500 ; partageur 50 si la vente vient d'un lien de partage ; organisateur 4 450 (4 500 sans partageur).

### 7.1 Export des ventes (NOISE-039)

- Rapport par événement : `buildSalesReport` (`apps/api/src/modules/admin/sales-report.ts`), à partir des seules commandes PAID du registre ; un registre incohérent bloque l'export.
- CSV : `salesReportToCsv` (`apps/api/src/modules/admin/sales-csv.ts`), lisible dans Excel en français : une ligne par type de billet (prix, billets vendus, montant), puis total, commission Noise, commission des partageurs et net à reverser. Les formules saisies par un organisateur (=, +, -, @) sont neutralisées.
- Route d'export réservée au rôle ADMIN : étape 2, avec NOISE-006, NOISE-019 et NOISE-037.

### 7.2 Procédure de reversement à l'organisateur (MVP, manuel)

1. Le lendemain de l'événement (J+1), si l'événement n'a pas été annulé et qu'aucun litige n'est en cours, un administrateur exporte le CSV de l'événement.
2. Il vérifie que le total des ventes correspond aux transactions approuvées dans le tableau de bord FedaPay pour cet événement.
3. Il envoie le montant « Net à reverser à l'organisateur » sur le numéro Mobile Money ou le compte bancaire enregistré par l'organisateur (virement depuis le tableau de bord FedaPay, ou par l'API payouts quand elle sera branchée).
4. Il archive la preuve du virement (référence FedaPay ou bancaire) et le CSV, et note le reversement (date, montant, référence) dans le suivi des reversements.
5. Il envoie le CSV à l'organisateur comme relevé.

Les commissions des partageurs (après le MVP) seront versées de façon groupée, au-delà d'un seuil à fixer, le coût d'un virement (150 FCFA minimum) dépassant 1 % d'un petit billet.

### 7.3 Procédure de remboursement (événement annulé, DEC-010)

1. L'annulation (NOISE-029) passe les billets et commandes à CANCELLED et fournit la liste des commandes à rembourser.
2. Si l'organisateur n'a pas encore été payé (cas normal, reversement après l'événement), un administrateur rembourse chaque acheteur du prix du billet sur son numéro Mobile Money (remboursement de la transaction ou virement depuis FedaPay), puis note la référence.
3. Les frais de l'agrégateur payés par le client ne sont pas récupérables auprès de FedaPay : leur remboursement au client est une décision commerciale à prendre (non tranchée).
4. Si l'organisateur avait déjà été payé (annulation tardive), Noise lui réclame les sommes reversées avant de rembourser ; ce cas doit rester exceptionnel, d'où le reversement après l'événement.

## 8. Mise en production (NOISE-034)

- [ ] Titulaire du compte marchand décidé (DEC-016) et KYC validé
- [ ] Taux de commission fixé
- [ ] Clés live uniquement dans Railway production
- [ ] URL de webhook production enregistrée chez le fournisseur
- [ ] Transaction réelle de faible montant réussie, puis remboursée
