# Analyse automatique des profils

Script Python qui pré-note les prospects à partir de leurs observations publiques, avec une IA gratuite exécutée en local (Ollama). Aucune API payante, aucune donnée ne quitte le PC. Les notes de l'IA sont des propositions : elles sont toujours relues.

État : implémenté et testé avec un faux modèle (54 tests). Essai réel le 2026-10-15 avec Ollama 0.40.4 et qwen3:8b sur une RTX 3050 (6 Go, 70 % GPU) : environ 1 min 30 par prospect, réponse valide, sur un texte fictif. Pas encore essayé sur de vrais prospects.

## Fonctionnement

1. Le script ouvre le classeur avec openpyxl et lit les lignes de l'onglet Prospects dont le statut (colonne « Statut analyse IA », AF) vaut « À analyser ». Les exemples fictifs (`EX-` ou « Exemple fictif » à oui) sont ignorés.
2. Il masque e-mails et numéros de téléphone dans les observations (colonne « Observations publiques collées », AE).
3. Il envoie le texte masqué au modèle local avec une consigne fixe et un schéma JSON imposé.
4. Il valide la réponse et applique les garde-fous (ci-dessous).
5. Il écrit les résultats dans l'onglet Scores et passe la ligne à « À jour » ou « Erreur ».
6. Les formules du classeur recalculent score, priorité et tableau de bord.

Les colonnes sont repérées par le nom de leur en-tête (ligne 4), pas par leur lettre : ajouter une colonne ne casse pas le script.

| Onglet    | Colonnes lues ou écrites                                                                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prospects | ID prospect, Exemple fictif, Observations publiques collées, Statut analyse IA                                                                                         |
| Scores    | ID prospect, Pc, I, R, N, F, Pe, G, Justification du classement, Inconnues à vérifier, Persona, Citation du persona, Avantages, Inconvénients, Confiance IA, Relecture |

## Garde-fous

- Valeur inconnue ou invalide (hors limites, mauvais type) : cellule vide, jamais une valeur par défaut. Une nouvelle analyse efface aussi une ancienne note devenue inconnue.
- Persona (P1 à P7) ou hors cible accepté seulement si sa citation (8 caractères au moins) est retrouvée dans le texte, à la casse, aux espaces et aux apostrophes près ; sinon `INDETERMINE` et Pc plafonné à 40.
- Code de persona inconnu ou réponse non JSON : réponse rejetée, ligne en Erreur.
- Avantage ou inconvénient sans citation retrouvée : supprimé. Au-delà de 3 par liste : ignoré.
- Avantages et inconvénients limités à l'activité événementielle publique : aucun jugement sur la personne (consigne du modèle).
- Confiance forcée à Faible si le texte fait moins de 200 caractères.
- Lignes peu fiables : colonne Relecture remplie avec « À RELIRE » et les raisons.
- Le texte collé est une donnée, jamais une instruction : il est placé entre deux marqueurs, retirés du texte s'il les contient, et la réponse est contrôlée quoi qu'elle dise.
- E-mails et numéros masqués avant l'envoi ; ni le nom ni le contact du prospect ne sont envoyés.
- Une copie de sauvegarde du classeur est faite avant chaque enregistrement.

## Installation (une fois)

1. Installer Ollama : `winget install Ollama.Ollama` (ou l'installateur de ollama.com), puis vérifier avec `ollama --version`.
2. Télécharger le modèle (5,2 Go) : `ollama pull qwen3:8b`. Choix fait le 2026-10-14 sur le catalogue Ollama : plus récent de la famille Qwen dans cette taille, multilingue, tient presque entièrement dans 6 Go de VRAM (RTX 3050). Alternative : `llama3.1:8b`.
3. Dans ce dossier : `python -m venv .venv`, `.venv\Scripts\activate`, puis `pip install -e ".[test]"`.

## Utilisation

```bash
# Ajouter au classeur les colonnes manquantes (à faire une fois, classeur fermé dans Excel)
python analyze.py ../modele-prospection/NOISE_Prospection_Cotonou.xlsx --preparer

# Essai sur 2 lignes, sans enregistrer
python analyze.py ../modele-prospection/NOISE_Prospection_Cotonou.xlsx --essai --limite 2

# Analyse de toutes les lignes « À analyser »
python analyze.py ../modele-prospection/NOISE_Prospection_Cotonou.xlsx

# Autre modèle
python analyze.py CLASSEUR.xlsx --modele llama3.1:8b
```

Le classeur doit être fermé dans Excel pendant l'enregistrement. Les copies de sauvegarde (`*.sauvegarde-*.xlsx`) sont ignorées par Git.

## Tests

```bash
python -m pytest
```

Aucun test n'appelle Ollama : un faux modèle renvoie des réponses écrites à l'avance. Cas couverts : formules (cas de contrôle 79, bornes 14 et 100, priorité, Q), persona avec citation valide ou inventée, hors cible, persona inconnu, réponse non JSON, avantage sans citation, plus de 3 inconvénients, note hors limites, texte court, masquage des données privées, texte piégé, Ollama injoignable, colonnes manquantes puis ajoutées.

## Structure

| Fichier                       | Rôle                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `analyze.py`                  | Commande à lancer                                      |
| `noise_scoring/config.py`     | Réglages : modèle, en-têtes, seuils, personas          |
| `noise_scoring/scoring.py`    | Formules S, priorité, Q (référence, comme le classeur) |
| `noise_scoring/text.py`       | Masquage, comparaison des citations, en-têtes          |
| `noise_scoring/validation.py` | Garde-fous appliqués à la réponse du modèle            |
| `noise_scoring/model.py`      | Consigne, schéma JSON, appel à Ollama                  |
| `noise_scoring/workbook.py`   | Lecture et écriture du classeur                        |
| `noise_scoring/pipeline.py`   | Enchaînement d'une analyse                             |
| `tests/`                      | Tests avec faux modèle et classeur de test             |

## Limites connues

- Les formules du classeur ne connaissent pas encore Q ni les règles « Hors cible » et `INDETERMINE` sur la priorité (brief, section 5.6) : à ajouter dans le classeur.
- Le masquage peut cacher à tort un grand nombre (par exemple 12 000 000) : défaut accepté.
- La qualité des notes dépend du modèle : à mesurer sur les premières lignes en comparant avec une notation humaine.

## Option

Une version Google Apps Script (`Code.gs`) qui appelle une API existe et reste une option, non retenue par défaut à cause de son coût.
