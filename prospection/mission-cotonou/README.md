# Mission Cotonou

Trouver et qualifier au moins 3 nouveaux prospects organisateurs par jour à Cotonou, les classer, suivre la prospection et mesurer combien deviennent réellement un événement publié sur Noise.

Le détail (objectifs, règles, scoring, funnel, économie) est dans [docs/brief.md](docs/brief.md).

## Structure

| Dossier                                    | Rôle                                                                |
| ------------------------------------------ | ------------------------------------------------------------------- |
| [docs/](docs/)                             | Brief, méthode de scoring, règles de collecte, journal de bord      |
| [deck/](deck/)                             | Présentation de la mission : sources de génération et exports       |
| [modele-prospection/](modele-prospection/) | Classeur Excel / Google Sheets de suivi des prospects               |
| [ia-scoring/](ia-scoring/)                 | Script d'analyse automatique des profils par une IA locale (Ollama) |
| [donnees/](donnees/)                       | Exports anonymisés éventuels ; rien de privé                        |

## Circuit d'un prospect

1. Repérage d'un profil public (page, compte, affiche d'événement).
2. Saisie dans l'onglet Prospects du classeur, avec ses observations publiques collées en colonne AE.
3. Notation dans l'onglet Scores (à la main, ou par le script `ia-scoring/` puis relecture).
4. Suivi des contacts dans l'onglet Prospection.
5. Mesure dans le Tableau de bord : contacté, réponse, rendez-vous, organisateur activé, événement publié.

## Règles

Les règles communes de [../README.md](../README.md) s'appliquent : vérifié, observé, hypothèse et simulation toujours séparés ; aucune donnée inventée ; aucune donnée privée ; aucune donnée personnelle dans Git.
