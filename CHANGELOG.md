# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).
Le numéro de version de l'app (`apps/mobile/app.json` → `version`) suit la version de release ; `android.versionCode` est incrémenté à chaque build distribué.

## [Non publié]

### Ajouté

- Socle du monorepo pnpm : `apps/api`, `apps/mobile`, `apps/scanner`, `packages/shared` (NOISE-000).
- API : application Express avec `/health`, validation des variables d'environnement, format d'erreur standard, logger avec masquage des données sensibles, 4 tests.
- Mobile : app Expo SDK 57 minimale (thème sombre), profils EAS `development`, `preview` (APK), `production` (AAB).
- Scanner : squelette Vite + TypeScript.
- Contrats partagés : rôles, statuts d'événement, de commande, de paiement, de billet, résultats de scan, codes d'erreur.
- Outillage : TypeScript strict, ESLint, Prettier, PostgreSQL local (Docker), CI GitHub Actions.
- Documentation : CLAUDE.md, roadmap, progress, decisions, docs techniques, modèle Notion.

Aucune fonctionnalité métier n'est encore implémentée.
