# Tests

## 1. Commandes

```bash
pnpm check                              # format + lint + typecheck + tests (avant chaque PR)
pnpm test                               # tous les tests
pnpm --filter @noise/api test           # tests API
pnpm --filter @noise/api test:watch     # mode watch
```

Les tests d'intégration de l'API utilisent `DATABASE_URL` pointant vers `noise_test` (créée par `pnpm db:up`, ou service Postgres en CI).

## 2. Pyramide

| Niveau           | Outil                          | Où                              | État                                                           |
| ---------------- | ------------------------------ | ------------------------------- | -------------------------------------------------------------- |
| Unitaire API     | Vitest                         | `apps/api/src/**/*.test.ts`     | En place                                                       |
| Intégration API  | Vitest + Supertest + Postgres  | `apps/api/tests/`               | En place (4 tests du socle) ; base à brancher dans NOISE-006   |
| Concurrence      | Vitest + `Promise.all`         | `apps/api/tests/concurrency/`   | NOISE-018, 019, 025                                            |
| UI mobile        | jest-expo + RN Testing Library | `apps/mobile/src/**/*.test.tsx` | NOISE-008                                                      |
| E2E mobile       | Maestro                        | `apps/mobile/e2e/`              | NOISE-031                                                      |
| E2E scanner      | Playwright                     | `apps/scanner/e2e/`             | En place (NOISE-026) : `pnpm --filter @noise/scanner test:e2e` |
| Sandbox paiement | Manuel, checklist              | Staging                         | NOISE-023                                                      |

## 3. Règles

- Chaque règle métier du CDC (6.2) et chaque décision (DEC-007, DEC-008) a au moins un test.
- Un test doit échouer si le comportement testé est cassé (vérifier en le cassant volontairement lors de l'écriture).
- Aucun appel réseau réel en test automatique (FakeProvider, Cloudinary simulé, push simulé).
- Données de test créées par des fabriques (`tests/factories/`), base nettoyée entre les fichiers.
- Un bug corrigé = un test de non-régression référencé dans la base Notion « Bugs ».

## 4. Checklist manuelle de bout en bout (NOISE-023, NOISE-032)

1. Installer l'APK preview sur un téléphone propre.
2. S'inscrire comme organisateur, créer un événement avec deux types de billets.
3. Sur un second téléphone, s'inscrire comme participant, acheter 2 billets (MTN sandbox).
4. Vérifier : commande PAID, 2 billets, push reçu, QR visible en mode avion.
5. Recommencer avec Moov ; puis laisser expirer une commande ; puis refuser un paiement.
6. Générer un lien scanner, l'ouvrir dans Chrome sur un troisième téléphone.
7. Scanner un billet (vert), le rescanner (rouge « déjà utilisé »), scanner un QR modifié (rouge).
8. Vérifier les statistiques organisateur.
9. Consigner les preuves (captures sans donnée sensible, IDs de transaction sandbox) dans la tâche Notion.
