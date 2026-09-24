# Stratégie Git

Décisions : DEC-012, DEC-013.

## 1. Branches

| Branche                                        | Rôle                                                                     | Règles                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `main`                                         | Code intégré, déployé automatiquement en staging (à partir de NOISE-016) | Protégée : pas de push direct, PR obligatoire, CI verte, 1 approbation, branche à jour avant merge |
| `feat/NOISE-xxx-description`                   | Nouvelle fonctionnalité                                                  | Créée depuis `main`, durée de vie 1 à 3 jours                                                      |
| `fix/NOISE-xxx-description`                    | Correction de bug                                                        | Idem                                                                                               |
| `chore/`, `docs/`, `test/`, `ci/`, `refactor/` | Maintenance, documentation, tests, CI                                    | Idem                                                                                               |
| `hotfix/vX.Y.Z-description`                    | Correction urgente de production                                         | Depuis le tag concerné, puis PR vers `main`                                                        |

Nom de branche : minuscules, tirets, ID de tâche obligatoire. Exemple : `feat/NOISE-018-order-reservation`.

## 2. Commits

Format Conventional Commits : `type(scope): description à l'impératif, en anglais`.

Types : `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `perf`.
Scopes : `api`, `mobile`, `scanner`, `shared`, `db`, `auth`, `events`, `orders`, `payments`, `tickets`, `notifications`, `ci`, `docs`, `release`.

Exemples :

```
feat(orders): reserve stock when creating an order
fix(scanner): reject cancelled tickets
test(payments): cover replayed webhook
docs(api): document /orders errors
```

Les commits intermédiaires d'une branche peuvent être libres : seul le titre de la PR compte, car il devient le message du commit squashé sur `main`. La CI vérifie ce titre.

## 3. Pull requests

- Titre : `type(scope): NOISE-xxx description` — exemple : `feat(api): NOISE-011 events and ticket types CRUD`.
- Description : template `.github/PULL_REQUEST_TEMPLATE.md` (tâche, contenu, comment tester, checklist).
- Taille : une tâche par PR, idéalement moins de 400 lignes modifiées hors fichiers générés et lockfile.
- Draft PR autorisée tôt pour demander un avis.
- La PR met à jour `progress.md` (statut de la tâche).

## 4. Reviews

- Reviewer : l'autre développeur (indiqué dans la tâche).
- Délai : moins de 24 h.
- Préfixes : `bloquant:` (doit être corrigé), `question:`, `suggestion:`, `détail:`.
- Les PR paiement, scan, auth et schéma de base sont testées en local par le reviewer.
- Grille de revue : CLAUDE.md section 12.

## 5. Merge

- Squash and merge uniquement (historique linéaire, un commit par tâche).
- Branche supprimée automatiquement après merge.
- Après merge : tâche « Implémenté » dans Notion et `progress.md`.

## 6. Releases

- Version : SemVer. `v0.1.0` = premier APK complet (achat → paiement → QR → scan) sur staging.
- Tag annoté `vX.Y.Z` créé sur `main` par le release manager après validation de la checklist de release (base Notion « Releases »).
- Le tag déclenche le déploiement production avec approbation manuelle (NOISE-035).
- `CHANGELOG.md` mis à jour dans la PR de release.

## 7. Configuration GitHub à faire (NOISE-005)

Settings → Branches → règle sur `main` :

- Require a pull request before merging — 1 approbation — dismiss stale approvals.
- Require status checks to pass — `Format, lint, types, tests, build` et `Titre de PR (Conventional Commits)`.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Do not allow bypassing the above settings.
- Block force pushes et deletions.

Settings → General → Pull Requests : autoriser uniquement « Squash merging », titre par défaut = titre de la PR, « Automatically delete head branches ».

## 8. Première mise en place du socle

Le socle (NOISE-000) a été déposé dans le dossier local, non commité. Procédure :

```bash
git switch -c chore/NOISE-000-project-bootstrap
pnpm install            # génère pnpm-lock.yaml, à commiter
pnpm check
git add -A
git commit -m "chore: NOISE-000 project bootstrap"
git push -u origin chore/NOISE-000-project-bootstrap
# ouvrir la PR "chore: NOISE-000 project bootstrap", revue croisée, squash merge
```
