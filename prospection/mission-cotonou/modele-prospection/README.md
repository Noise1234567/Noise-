# Classeur de prospection

Classeur `NOISE_Prospection_Cotonou.xlsx` (Excel, importable dans Google Sheets).

## Onglets

| Onglet            | Rôle                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Lisez-moi         | Mode d'emploi du classeur                                                                                        |
| Prospects         | Une ligne par prospect ; colonne AE : observations publiques collées ; colonne AF : À analyser, À jour ou Erreur |
| Scores            | Notes des critères, score et priorité calculés par formules                                                      |
| Prospection       | Suivi des contacts et de leurs résultats                                                                         |
| Tableau de bord   | Indicateurs calculés par formules                                                                                |
| Simulation funnel | Taux de conversion supposés (hypothèses), à remplacer par les taux observés                                      |
| Économie          | Simulation des revenus (volume de ventes, organisateur, Noise)                                                   |
| Paramètres        | Pondérations, seuils, listes de valeurs                                                                          |
| Configuration IA  | Réglages de l'analyse automatique                                                                                |

## Règles

- Liaison entre Prospects, Scores et Prospection par un ID prospect identique.
- Les lignes dont l'ID commence par `EX-` sont des exemples fictifs, exclus des comptages.
- Score, priorité et tableau de bord sont calculés par formules : ne pas les saisir à la main.

## Versionnement

Le modèle vide (lignes `EX-` uniquement) peut être versionné ici. La copie de travail remplie contient des données personnelles (noms, pseudonymes, observations) : elle reste hors de Git, sur un espace de stockage privé partagé entre Yannis et Orias.
