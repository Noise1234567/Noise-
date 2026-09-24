# Modèle Notion — Noise

État : espace créé par Claude via le connecteur Notion le 2026-09-24 : page « Noise — Pilotage » (https://app.notion.com/p/3e5274f6f39281ec9bced9e7910e15b7), privée pour l'instant. 11 bases, 41 tâches avec dépendances, milestones, sprints, 20 décisions, 11 risques, 2 releases, services, documentation, idées, vues et tableau de bord. Reste à faire à la main : déplacer la page dans un espace partagé et inviter Yannis. Les sections ci-dessous décrivent le modèle ; les CSV restent utiles pour une réimportation.

## 1. Deux façons de le mettre en place

Option A — par Claude (recommandée) :

1. Sur claude.ai, dans Paramètres → Connecteurs, ajouter le connecteur Notion et autoriser l'espace de travail cible (le compte qui s'authentifie doit pouvoir créer des pages dans cet espace).
2. Dans Notion, créer une page vide « Noise — Pilotage » et, si le connecteur le demande, partager cette page avec l'intégration.
3. Dans la conversation du projet NOISE, activer le connecteur pour la conversation puis demander à Claude : « Construis l'espace Notion ». Claude créera les bases, relations, formules, vues et importera les tâches à partir de ce document et de `docs/notion/*.csv`.

Option B — manuelle (environ 45 minutes) :

1. Créer la page « Noise — Pilotage ».
2. Pour chaque fichier de `docs/notion/`, dans la page : `…` → Importer → CSV. Cela crée une base par fichier.
3. Ajuster les types de propriétés (section 3), créer les relations, formules et vues (sections 3 et 4).
4. Construire le tableau de bord (section 2) avec des vues liées.

Dans les deux cas : inviter Yannis et Orias comme membres de la page.

## 2. Arborescence

```
Noise — Pilotage                      (page d'accueil = Dashboard)
├── Dashboard (contenu de la page d'accueil)
├── Tasks                              base
├── Milestones                         base
├── Sprints                            base
├── Bugs                               base
├── Decisions                          base
├── Releases                           base
├── Risks                              base
├── Technical Debt                     base
├── Documentation                      base (index des docs du repo)
├── Services & accès                   base
├── Ideas                              base (améliorations futures, hors MVP)
└── Wiki
    ├── Environnements (local, test, staging, production)
    ├── Architecture (résumé + liens vers docs/ du repo)
    └── Rituels (planification jeudi, rétrospective mercredi, revues)
```

Dashboard (vues liées, de haut en bas) :

| Bloc                | Source     | Vue                                                                        |
| ------------------- | ---------- | -------------------------------------------------------------------------- |
| Progression globale | Milestones | Tableau : milestone, % terminé (rollup), date prévue, statut               |
| Sprint actuel       | Sprints    | Filtre Statut = En cours : objectif, dates, charges                        |
| Tâches en cours     | Tasks      | Kanban par Statut, filtre Sprint = sprint en cours, groupé par Responsable |
| Tâches bloquées     | Tasks      | Liste, filtre Statut = Bloqué, colonnes Blocage et Externe                 |
| Prochaines tâches   | Tasks      | Liste, filtre Statut = À faire et Prête = Oui, tri Priorité                |
| Bugs ouverts        | Bugs       | Liste, filtre Statut ≠ Corrigé/Fermé, tri Sévérité                         |
| Milestones          | Milestones | Chronologie                                                                |
| Prochaines releases | Releases   | Liste, filtre Statut ≠ Publiée                                             |
| Risques             | Risks      | Filtre Niveau ≥ 6                                                          |
| Décisions récentes  | Decisions  | 5 dernières par Date                                                       |
| Équilibre           | Tasks      | Voir section 5                                                             |

## 3. Bases et propriétés

Types : T = texte, S = select, MS = multi-select, N = nombre, D = date, R = relation, RU = rollup, F = formule, C = case à cocher, U = URL, P = personne.

### Tasks

| Propriété                  | Type                                                         | Valeurs / formule                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID                         | T (titre possible)                                           | NOISE-001…                                                                                                                                                                                                                                              |
| Titre                      | Titre                                                        |                                                                                                                                                                                                                                                         |
| Description / Objectif     | T                                                            |                                                                                                                                                                                                                                                         |
| Type                       | S                                                            | Feature, Bug-fix, Chore, Test, Doc, Spike, Revue, Décision, Sécurité, Release, Dette technique                                                                                                                                                          |
| Statut                     | S                                                            | À faire, En cours, En revue, Implémenté, Testé, Validé, Déployé, Bloqué                                                                                                                                                                                 |
| Priorité                   | S                                                            | P0, P1, P2, P3                                                                                                                                                                                                                                          |
| Responsable                | S                                                            | Yannis, Orias, Commun, Claude                                                                                                                                                                                                                           |
| Reviewer                   | S                                                            | Yannis, Orias, Yannis + Orias, —                                                                                                                                                                                                                        |
| Assignés                   | P                                                            | personnes Notion (pour les notifications)                                                                                                                                                                                                               |
| Sprint                     | R → Sprints                                                  |                                                                                                                                                                                                                                                         |
| Milestone                  | R → Milestones                                               |                                                                                                                                                                                                                                                         |
| Domaine                    | S                                                            | Backend, Mobile, Scanner, Paiement, Base de données, Full stack, Android, DevOps, CI/CD, Infra, Sécurité, Pilotage, Produit, Externe                                                                                                                    |
| Dépend de                  | R → Tasks (auto-relation, avec propriété inverse « Bloque ») |                                                                                                                                                                                                                                                         |
| Estimation (h)             | N                                                            |                                                                                                                                                                                                                                                         |
| Temps passé (h)            | N                                                            | facultatif                                                                                                                                                                                                                                              |
| Date de début / Date cible | D                                                            |                                                                                                                                                                                                                                                         |
| Critères d'acceptation     | T                                                            | une ligne par critère                                                                                                                                                                                                                                   |
| Tests                      | T                                                            |                                                                                                                                                                                                                                                         |
| Fichiers                   | T                                                            |                                                                                                                                                                                                                                                         |
| PR GitHub                  | U                                                            |                                                                                                                                                                                                                                                         |
| Branche                    | T                                                            | `feat/NOISE-xxx-…`                                                                                                                                                                                                                                      |
| Documentation              | R → Documentation                                            |                                                                                                                                                                                                                                                         |
| Notes                      | T                                                            |                                                                                                                                                                                                                                                         |
| Blocage                    | T                                                            | raison si Statut = Bloqué                                                                                                                                                                                                                               |
| Externe                    | C                                                            | dépend d'un service ou d'une validation externe                                                                                                                                                                                                         |
| Revue faite                | C                                                            | cochée par le reviewer à l'approbation de la PR                                                                                                                                                                                                         |
| Prête                      | F                                                            | `if(prop("Statut") == "À faire" and prop("Dépend de").filter(current.prop("Statut") != "Validé" and current.prop("Statut") != "Déployé" and current.prop("Statut") != "Implémenté" and current.prop("Statut") != "Testé").length() == 0, "Oui", "Non")` |
| Charge Yannis (h)          | F                                                            | `if(prop("Responsable") == "Yannis", prop("Estimation (h)"), if(prop("Responsable") == "Commun", prop("Estimation (h)") / 2, 0))`                                                                                                                       |
| Charge Orias (h)           | F                                                            | même formule avec « Orias »                                                                                                                                                                                                                             |
| Catégorie de domaine       | F                                                            | `if(["Backend","Paiement","Base de données"].includes(prop("Domaine")), "Backend", if(["Mobile","Scanner","Android"].includes(prop("Domaine")), "Frontend", if(prop("Domaine") == "Full stack", "Full stack", "Transverse")))`                          |

### Milestones

ID, Nom, Objectif, Fonctionnalités (T), Tâches (R → Tasks), Progression (RU : % des tâches au statut Validé ou Déployé), Statut (À venir, En cours, Atteint, En retard), Date prévue (D), Date réelle (D), Dépendances (R → Milestones), Critères de sortie (T).

### Sprints

Sprint, Début, Fin, Objectif, Milestone (R), Tâches (R → Tasks), Charge Yannis (RU somme de « Charge Yannis (h) »), Charge Orias (RU somme), Écart de charge (F : `abs(prop("Charge Yannis") - prop("Charge Orias"))`), Reviews Yannis / Reviews Orias (RU : nombre de tâches avec Reviewer = X et Revue faite), Résultats (T), Rétrospective (T : ce qui a marché / ce qui a bloqué / actions), Problèmes rencontrés (T), Statut (À venir, En cours, Terminé).

### Bugs

Titre, Description, Reproduction, Sévérité (S1 bloquant, S2 majeur, S3 mineur, S4 cosmétique), Priorité (P0–P3), Environnement (Local, Staging, Production), Version (R → Releases), Responsable (S), Statut (Nouveau, Confirmé, En cours, Corrigé, Vérifié, Fermé, Ne sera pas corrigé), Correctif (U : PR), Test associé (T : nom du test de non-régression), Tâche liée (R → Tasks).

### Decisions

ID (DEC-xxx), Décision, Contexte, Alternatives, Choix, Raison, Date, Personnes concernées (MS : Yannis, Orias), Statut (Proposée, Acceptée, En attente, Remplacée), Remplacée par (R → Decisions), Référence (lien vers decisions.md).

### Releases

Version, Statut (Planifiée, En recette, Validée, Publiée, Retirée), Date, Environnement (Staging, Production, Google Play), Build (S : APK dev, APK preview, AAB), versionCode (N), Fonctionnalités (R → Tasks), Bugs corrigés (R → Bugs), Changelog (T), Validation (checklist : tests E2E, checklist sécurité, test sur 3 appareils, validation des deux développeurs), Lien de téléchargement (U).

### Risks

Risque, Probabilité (N 1–3), Impact (N 1–3), Niveau (F : `prop("Probabilité") * prop("Impact")`), Mitigation, Responsable, Statut (Ouvert, Surveillé, Clos), Tâches liées (R → Tasks).

### Technical Debt

Titre, Description, Impact, Effort (Faible, Moyen, Élevé), Priorité, Responsable, Statut (Identifiée, Planifiée, Résolue), Origine (PR ou tâche), Échéance, Tâche de résolution (R → Tasks).

### Documentation

Document, Chemin dans le repo (le repo fait foi), Domaine, Responsable, Statut (Cible, En vigueur, Obsolète), Dernière revue (D).

### Services & accès

Service, Usage, Propriétaire du compte, Environnements, Emplacement des secrets, Coût, Statut, Tâche. Règle absolue : aucune valeur de secret, aucun mot de passe dans Notion.

### Ideas

Idée, Valeur (Faible/Moyenne/Forte), Effort, Statut (Nouvelle, Retenue post-MVP, Rejetée), Source.

## 4. Vues de la base Tasks

| Vue                       | Type        | Filtre / regroupement                                                                   |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Kanban sprint             | Board       | Sprint = en cours, groupé par Statut                                                    |
| Mes tâches — Yannis       | Liste       | Responsable = Yannis ou Commun, Statut ≠ Validé/Déployé                                 |
| Mes tâches — Orias        | Liste       | Responsable = Orias ou Commun, Statut ≠ Validé/Déployé                                  |
| À relire — Yannis / Orias | Liste       | Reviewer = X et Statut = En revue                                                       |
| Partagées                 | Liste       | Responsable = Commun                                                                    |
| Bloquées                  | Liste       | Statut = Bloqué                                                                         |
| Prêtes                    | Liste       | Prête = Oui, tri Priorité                                                               |
| Externe                   | Liste       | Externe = coché, Statut ≠ Validé                                                        |
| Roadmap                   | Chronologie | par Date de début / Date cible, groupé par Milestone                                    |
| Équilibre                 | Tableau     | groupé par Responsable puis Catégorie de domaine, somme de Estimation et de Temps passé |
| Dette technique           | Liste       | Type = Dette technique                                                                  |

## 5. Suivi de l'équilibre Yannis / Orias

- Charge approximative : rollups « Charge Yannis » et « Charge Orias » par sprint ; écart visible dans Sprints.
- Domaines travaillés : vue Équilibre (Responsable × Catégorie de domaine).
- Reviews effectuées : rollups « Reviews Yannis / Orias » par sprint, basés sur Reviewer + Revue faite.
- Tâches partagées : vue Partagées.
- Règle (CLAUDE.md section 11) : si l'écart de charge ou de domaine dépasse 20 % sur un sprint, le sprint suivant est rééquilibré lors de la planification.

## 6. Synchronisation avec GitHub

- L'ID de tâche est dans le nom de branche et le titre de PR ; la PR contient le lien Notion ; la tâche contient le lien de la PR.
- Mise à jour manuelle du statut au moment de la revue et du merge (celui qui merge met à jour Notion et `progress.md`).
- Évolution possible : GitHub Action qui passe la tâche en « Implémenté » au merge via l'API Notion (à créer comme tâche si le manuel devient pénible).

## 7. Fichiers d'import

| Fichier                     | Base                      |
| --------------------------- | ------------------------- |
| `notion/tasks.csv`          | Tasks (41 tâches)         |
| `notion/milestones.csv`     | Milestones                |
| `notion/sprints.csv`        | Sprints                   |
| `notion/decisions.csv`      | Decisions                 |
| `notion/risks.csv`          | Risks                     |
| `notion/releases.csv`       | Releases                  |
| `notion/services.csv`       | Services & accès          |
| `notion/technical-debt.csv` | Technical Debt            |
| `notion/documentation.csv`  | Documentation             |
| `notion/bugs.csv`           | Bugs (en-têtes seulement) |

Après import, les colonnes Dépendances, Sprint et Milestone sont du texte : les convertir en relations (Notion propose la conversion lorsqu'on change le type de propriété).
