# Noise

Plateforme de billetterie événementielle pour Cotonou (Bénin) : les organisateurs créent leurs événements et vendent leurs billets, les participants paient en Mobile Money (MTN MoMo, Moov Money) et présentent un QR code à l'entrée, le staff valide les billets depuis un simple lien.

Statut : fondations du projet (aucune fonctionnalité métier livrée). État détaillé : [progress.md](progress.md).

## Contenu du repository

| Dossier           | Contenu                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `apps/api`        | API REST — Node 24, Express 5, TypeScript, Prisma 7, PostgreSQL             |
| `apps/mobile`     | App Android — Expo SDK 57 / React Native (vues participant et organisateur) |
| `apps/scanner`    | Scanner web du staff — Vite + TypeScript, servi par l'API                   |
| `packages/shared` | Contrats partagés : statuts, constantes métier, codes d'erreur              |
| `docs/`           | Documentation technique                                                     |

## Prérequis

- Node.js 24 (`nvm use`) et pnpm 10 (`corepack enable`)
- Docker (PostgreSQL local)
- Pour le mobile : un téléphone Android ou un émulateur Android Studio ; un compte Expo pour les builds EAS

## Démarrage local

```bash
pnpm install
pnpm db:up                                  # PostgreSQL 17 sur localhost:5432 (bases noise_dev et noise_test)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @noise/shared build           # à relancer après toute modification de packages/shared
pnpm dev:api                                # http://localhost:3000/health
pnpm dev:mobile                             # Expo / Metro
pnpm dev:scanner                            # http://localhost:5173/scan/
```

Avant chaque PR :

```bash
pnpm check    # format + lint + typecheck + tests
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — règles de développement (à lire en premier)
- [roadmap.md](roadmap.md) — tâches NOISE-xxx, dépendances, critères d'acceptation
- [progress.md](progress.md) — état factuel du projet
- [decisions.md](decisions.md) — décisions techniques et produit
- [CHANGELOG.md](CHANGELOG.md) — historique des versions
- [docs/](docs/README.md) — architecture, API, base de données, sécurité, paiements, QR/scanner, tests, environnements, Android, Git, Notion

## Équipe

Yannis et Orias — développement full stack (API et mobile), revue croisée systématique.
