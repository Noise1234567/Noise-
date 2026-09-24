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
