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

Règles (DEC-021) : commission Noise 10 % du prix du billet ; frais de l'agrégateur payés par le client en plus du prix ; affiliation (1 %, prise sur la part de l'organisateur) après le MVP. Chaque commission est arrondie au FCFA inférieur et l'organisateur reçoit le reste. La répartition de chaque commande est calculée par `splitSale` (`packages/shared/src/revenue-split.ts`) et enregistrée à la confirmation du paiement (NOISE-019).

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
