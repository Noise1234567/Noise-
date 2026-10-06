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

| Critère                | FedaPay                         | KKiaPay                   | MTN + Moov en direct                               |
| ---------------------- | ------------------------------- | ------------------------- | -------------------------------------------------- |
| MTN Bénin / Moov Bénin | Documentés                      | À vérifier dans NOISE-010 | Deux intégrations séparées                         |
| Sandbox                | Oui (`sandbox-api.fedapay.com`) | À vérifier                | Oui pour MTN (devise de test EUR), Moov à vérifier |
| Devise XOF             | Oui                             | À vérifier                | Oui                                                |
| Webhook et signature   | À vérifier                      | À vérifier                | Oui (MTN callback)                                 |
| Frais                  | À relever                       | À relever                 | Aucun intermédiaire, mais deux contrats            |
| KYC production         | À relever                       | À relever                 | Deux processus                                     |

Le tableau est complété par des preuves dans NOISE-010, puis la décision DEC-005 est mise à jour.

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

À détailler dans NOISE-039 : export CSV par événement (ventes, commission Noise, net organisateur), calendrier de reversement, preuve de virement, procédure de remboursement en cas d'annulation. Taux de commission et prise en charge des frais : en attente (DEC-009).

## 8. Mise en production (NOISE-034)

- [ ] Titulaire du compte marchand décidé (DEC-016) et KYC validé
- [ ] Taux de commission fixé
- [ ] Clés live uniquement dans Railway production
- [ ] URL de webhook production enregistrée chez le fournisseur
- [ ] Transaction réelle de faible montant réussie, puis remboursée
