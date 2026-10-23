# Prospection

Espace de travail commercial de Noise : trouver, qualifier et activer des organisateurs d'événements. Ce dossier ne contient aucun code de l'application (`apps/`, `packages/`, `scripts/` ne sont pas concernés).

## Contenu

| Dossier                              | Rôle                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [mission-cotonou/](mission-cotonou/) | Première mission : prospects organisateurs à Cotonou, sur 20 à 60 jours |

Chaque nouvelle mission (autre ville, autre segment) aura son propre dossier `mission-<nom>/` avec la même structure.

## Règles communes

1. Séparer strictement quatre niveaux d'information : vérifié, observé, hypothèse, simulation. Chaque chiffre ou fait porte son niveau.
2. Ne jamais inventer une donnée. Une information manquante reste vide ou vaut « inconnu ».
3. Aucun persona n'est attribué sans preuve observée (publication, affiche, page publique citée).
4. Collecte manuelle, sur des pages publiques uniquement, dans le respect des conditions d'utilisation des plateformes. Aucune donnée privée, aucun outil d'extraction automatique (scraping).
5. Ne jamais promettre à un prospect un accès illimité aux réseaux sociaux ni un résultat de ventes.
6. Aucune donnée personnelle dans Git : noms, numéros, pseudonymes et observations restent dans le classeur de travail, hors du repository. Seuls des exports anonymisés peuvent être versionnés (voir `mission-cotonou/donnees/`).
7. Les règles métier citées (commission, frais) suivent `decisions.md`. En cas d'écart, `decisions.md` fait foi et l'écart est signalé.

## État d'avancement

| Élément                              | État                                                       |
| ------------------------------------ | ---------------------------------------------------------- |
| Arborescence et README               | Créés le 2026-10-14, non commités                          |
| Brief de mission (`docs/brief.md`)   | Rédigé le 2026-10-14, à relire                             |
| Présentation (20 slides)             | Produite précédemment, à déposer dans `deck/`              |
| Classeur `NOISE_Prospection_Cotonou` | Produit précédemment, à déposer                            |
| Script d'analyse IA locale           | Implémenté, testé avec un faux modèle ; Ollama à installer |
| Collecte de prospects                | Non démarrée                                               |

Tâche associée : NOISE-049 (`roadmap.md`).
