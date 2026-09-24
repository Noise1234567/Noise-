# Documentation technique

| Document                                 | Contenu                                                    | Tâches liées             |
| ---------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| [architecture.md](architecture.md)       | Vue d'ensemble, modules, flux principaux                   | toutes                   |
| [api.md](api.md)                         | Conventions REST, format d'erreur, endpoints cibles        | NOISE-007 → NOISE-029    |
| [database.md](database.md)               | Modèle de données cible, contraintes, règles métier        | NOISE-006                |
| [security.md](security.md)               | Menaces, règles, checklist avant release                   | NOISE-030                |
| [payments.md](payments.md)               | Flux de paiement, webhooks, idempotence, remboursements    | NOISE-010, 017, 019, 034 |
| [qr-scanner.md](qr-scanner.md)           | Format du QR, validation atomique, comportement du scanner | NOISE-020, 024–026       |
| [testing.md](testing.md)                 | Stratégie et commandes de test                             | toutes                   |
| [environments.md](environments.md)       | Local, test, staging, production ; déploiement             | NOISE-016, 035           |
| [android-release.md](android-release.md) | Builds APK / AAB, signature, versioning, Google Play       | NOISE-009, 032, 033, 038 |
| [git-workflow.md](git-workflow.md)       | Branches, commits, PR, revues, merge, releases             | NOISE-005                |
| [notion-model.md](notion-model.md)       | Structure de l'espace Notion et import                     | NOISE-004                |

Règle : un document est mis à jour dans la même PR que le code qu'il décrit. Les sections marquées « cible » décrivent ce qui est prévu, pas ce qui existe.
