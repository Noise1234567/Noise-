# Paiements

État : conception. Fournisseur à choisir dans NOISE-010 (DEC-005). Rien n'est implémenté ni testé.

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
| Frais                          | 4 % annoncés (source tierce)    | Non publiés dans la FAQ         | Aucun intermédiaire, mais deux contrats            |
| KYC production                 | À relever                       | Vérification annoncée sous 24 h | Deux processus                                     |

Le tableau est complété par des preuves dans NOISE-010, puis la décision DEC-005 est mise à jour.

### 2.1 FedaPay : relevé documentaire (NOISE-010, 2026-09-27, non testé en sandbox)

- Flux : création d'une transaction (`amount` entier, `description`, `currency` `XOF`) puis paiement direct sans redirection via `POST /v1/{methode}` avec le token de la transaction. Opérateurs listés pour ce mode : MTN Bénin, Moov Bénin, Celtiis Bénin. Une ancienne page de la même doc indique « MTN uniquement » : à trancher en sandbox.
- Statuts : `pending`, `approved`, `declined`, `canceled`, `refunded`, `transferred`.
- Revérification serveur : `GET /v1/transactions/{id}`. La doc demande explicitement de ne pas se fier au statut renvoyé dans l'URL de retour.
- Webhook : en-tête `X-FEDAPAY-SIGNATURE`, HMAC-SHA256 calculé avec le secret du webhook (tableau de bord). Format exact de l'en-tête et chaîne signée (corps brut seul ou avec horodatage) à confirmer sur un vrai webhook : un projet tiers a rencontré cette incertitude.
- Numéros de test (doc v1) : MTN `66000001` succès, `66000000` échec ; Moov `64000001` succès, `64000000` échec. D'autres sources citent d'autres numéros : à confirmer dans le tableau de bord sandbox.
- Clés : `pk_sandbox_…` / `sk_sandbox_…` dans Paramètres → Clés API du compte sandbox.

### 2.2 KKiaPay : relevé documentaire (NOISE-010, 2026-09-27, non testé en sandbox)

- Intégration centrée sur un widget et des SDK côté client (JS, Android, Flutter, React Native) ; SDK serveur (Node.js, PHP) pour vérifier une transaction et rembourser. Aucune API publique trouvée pour qu'un serveur déclenche lui-même la demande de paiement sur le téléphone du client. Impact : le mobile devrait ouvrir le widget, ce qui s'écarte de notre flux où le backend initie le paiement (section 1). À confirmer auprès du support ou en sandbox.
- Webhook : événements `transaction.success` et `transaction.failed` ; authentification par un secret partagé envoyé tel quel dans l'en-tête `x-kkiapay-secret` (pas de HMAC du corps). Moins robuste : un secret intercepté permet de forger des webhooks, d'où l'importance de la revérification serveur. Renvoi 5 fois si la réponse n'est pas 2xx.
- Numéros de test : MTN `61000000` / `97000000` succès, `…01` erreur de traitement, `…02` fonds insuffisants, `…03` refusé ; Moov `68000000` / `95000000` succès, mêmes suffixes pour les échecs.
- Numéro au format international obligatoire (`+229…`).
- Reversement : gratuit vers un compte Mobile Money, 7 000 FCFA vers un compte bancaire.

### 2.3 Premier constat (à confirmer en sandbox, décision commune)

FedaPay correspond mieux à l'architecture prévue : paiement initié par le serveur, revérification par l'API, webhook signé en HMAC. KKiaPay reste possible mais impose un widget côté mobile et un webhook moins bien protégé. Reste à obtenir les frais exacts des deux fournisseurs et les délais de KYC, puis à valider en sandbox avant de compléter DEC-005.

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

- Interface `PaymentProvider` : `initiate(order, operator, phone)`, `getStatus(providerTransactionId)`, `verifyWebhookSignature(headers, rawBody)`, `parseWebhook(body)`.
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

À détailler dans NOISE-039 : export CSV par événement (ventes, commission Noise, net organisateur), calendrier de reversement, preuve de virement, procédure de remboursement en cas d'annulation. Taux de commission et prise en charge des frais : en attente (DEC-009).

## 8. Mise en production (NOISE-034)

- [ ] Titulaire du compte marchand décidé (DEC-016) et KYC validé
- [ ] Taux de commission fixé
- [ ] Clés live uniquement dans Railway production
- [ ] URL de webhook production enregistrée chez le fournisseur
- [ ] Transaction réelle de faible montant réussie, puis remboursée
