# Brief — Mission de prospection Cotonou

Version : 1.0 du 2026-10-14. Tâche : NOISE-049. Statut : à relire par Yannis et Orias (les objectifs commerciaux et l'économie sont des décisions communes, CLAUDE.md section 11).

## 1. Contexte

Noise est une billetterie mobile pour Cotonou : l'organisateur crée son événement, le participant paie en Mobile Money (MTN MoMo, Moov Money) et présente un QR code à l'entrée, le staff scanne depuis un simple lien. Sur une plateforme à deux faces, les organisateurs amènent les participants : la conquête du marché commence donc par eux.

Profil cible de référence (cahier des charges, persona « Kofi ») : DJ ou promoteur de 28 ans, 3 à 4 soirées par mois dans des clubs, gère tout depuis un smartphone Android. Frustrations : ventes en cash impossibles à tracer, aucune visibilité sur les entrées. Frein principal : méfiance envers les nouvelles applications.

Arguments produit disponibles (sources : `decisions.md`) :

| Argument                                                    | Source             | Statut dans le produit                                  |
| ----------------------------------------------------------- | ------------------ | ------------------------------------------------------- |
| Reversement de 90 % le lendemain de chaque journée de vente | DEC-024            | Décidé, reversement automatique à confirmer (NOISE-045) |
| QR valable une seule fois, scan sans compte pour le staff   | DEC-014, NOISE-026 | Scanner implémenté, pas encore en production            |
| Commission de 10 %, sans abonnement                         | DEC-022, DEC-024   | Décidé                                                  |
| Frais d'organisation offerts au lancement                   | DEC-023            | Décidé, mécanisme encore ouvert                         |
| Identité de l'organisateur vérifiée                         | DEC-018            | Décidé (NOISE-048)                                      |

Point de vigilance : à la date du brief, Noise n'a pas d'environnement de production et l'encaissement réel est bloqué par le KYC FedaPay (DEC-016). Aucun prospect ne peut donc publier un événement payant avant la mise en production (NOISE-034). La mission doit en tenir compte dans la définition d'un organisateur « activé » (section 3.2).

## 2. Objectifs

### 2.1 Volume de qualification

Objectif minimal : 3 nouveaux prospects qualifiés par jour de collecte, sur 5 jours de collecte par semaine.

| Horizon          | Jours de collecte | Prospects qualifiés (minimum) |
| ---------------- | ----------------- | ----------------------------- |
| 1 jour           | 1                 | 3                             |
| 1 semaine        | 5                 | 15                            |
| Première phase   | 20                | 60                            |
| Mission complète | 60                | 180                           |

Un prospect est « qualifié » lorsque sa ligne Prospects est complète pour les champs observables, que ses critères sont notés dans l'onglet Scores et que sa priorité est calculée. Un prospect simplement repéré mais non noté ne compte pas.

### 2.2 Objectifs de résultat

La mission ne se juge pas au nombre de lignes du classeur mais à ce qui devient un événement publié. Le tableau de bord suit donc toute la chaîne : qualifié, contacté, réponse, rendez-vous, organisateur activé, événement publié, billets vendus.

## 3. Règle d'or et règles de collecte

### 3.1 Quatre niveaux d'information, jamais mélangés

| Niveau     | Définition                                                                            | Exemple                                                                           |
| ---------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Vérifié    | Confirmé par une source directe et fiable (la personne, un contrat, un paiement reçu) | L'organisateur confirme lors du rendez-vous qu'il organise 2 soirées par mois     |
| Observé    | Vu sur une page publique, avec la preuve notée (lien, date, citation)                 | Une affiche publique annonce une soirée « organisée par » ce compte le 2026-10-03 |
| Hypothèse  | Supposition de travail, non mesurée, à confirmer                                      | Les pondérations du score ; « ce compte semble organiser régulièrement »          |
| Simulation | Calcul à partir d'hypothèses                                                          | Le funnel 60 → 3, les revenus pour 100 billets                                    |

Règles associées :

1. Ne jamais inventer une donnée. Une information manquante reste vide ou vaut « inconnu ».
2. Aucun persona n'est attribué sans preuve observée. Sans preuve, le persona vaut « Indéterminé ».
3. Chaque observation collée en colonne AE garde sa source (plateforme, date de consultation).
4. Une hypothèse ou une simulation ne devient jamais un résultat dans un rapport : elle est remplacée par la valeur observée dès qu'elle existe.

### 3.2 Définitions des étapes

| Étape               | Définition (proposition à valider)                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repéré              | Profil public identifié, pas encore noté                                                                                                             |
| Qualifié            | Ligne complète pour les champs observables, critères notés, priorité calculée                                                                        |
| Contacté            | Premier message envoyé ou rencontre faite                                                                                                            |
| Réponse             | Le prospect a répondu, quel que soit le sens de la réponse                                                                                           |
| Rendez-vous         | Échange de démonstration réalisé (en personne ou en appel)                                                                                           |
| Organisateur activé | Avant la production : accord écrit pour un événement pilote sur Noise. Après la production : compte organisateur créé et identité vérifiée (DEC-018) |
| Événement publié    | Événement visible et en vente sur Noise (possible seulement après NOISE-034)                                                                         |

### 3.3 Collecte

| Autorisé                                                                                  | Interdit                                                                                 |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Pages et publications publiques (pages, comptes publics, affiches, annonces d'événements) | Groupes privés, messages privés, contenus réservés aux abonnés                           |
| Collecte manuelle, un profil à la fois                                                    | Extraction automatique (scraping), robots, contournement des limites des plateformes     |
| Informations professionnelles utiles à la prospection                                     | Données sensibles (santé, religion, opinions), adresse personnelle, documents d'identité |
| Contact par les canaux publics que la personne affiche pour ses événements                | Achat de fichiers de contacts, relances insistantes après un refus                       |

Promesses interdites : un accès illimité aux réseaux sociaux, un volume de ventes garanti, une date de lancement non confirmée par l'équipe.

### 3.4 Données personnelles

Une information publique sur une personne reste une donnée personnelle. Au Bénin, la protection des données relève du Code du numérique et de l'Autorité de protection des données à caractère personnel (APDP) : le cadre exact applicable à la prospection est à faire confirmer par un juriste (risque R16 de l'étude de risques).

En pratique :

1. Ne collecter que ce qui sert à qualifier et contacter.
2. Retirer un prospect qui demande à ne plus être contacté, et le noter comme tel sans garder d'autre information.
3. Garder le classeur rempli hors de Git, sur un espace privé partagé entre Yannis et Orias.
4. Supprimer les prospects inactifs à la fin de la mission (durée de conservation à fixer).

## 4. Déroulé de la prospection

### 4.1 Une journée de collecte

1. Rechercher des événements récents ou annoncés à Cotonou sur les pages publiques (affiches, annonces de soirées, concerts, événements étudiants).
2. Pour chaque événement, identifier qui l'organise, preuve à l'appui (mention « organisé par », compte qui publie l'affiche, billetterie citée).
3. Créer la ligne dans Prospects avec un nouvel ID (format proposé : `P-0001`), coller les observations publiques en colonne AE, passer AF à « À analyser ».
4. Noter les critères dans Scores, à la main ou par le script `ia-scoring/` suivi d'une relecture humaine.
5. Vérifier en fin de journée : au moins 3 prospects qualifiés, aucune ligne sans source, aucun persona sans preuve.
6. Noter dans le journal de bord le nombre de prospects ajoutés et les difficultés, sans nom.

### 4.2 Contact et suivi

1. Contacter en priorité les prospects de priorité très élevée et élevée.
2. Enregistrer chaque contact dans l'onglet Prospection : date, canal, message utilisé, résultat.
3. Relancer une seule fois après un délai fixe (proposition : 3 jours), puis classer sans réponse.
4. Proposer un rendez-vous de démonstration aux prospects qui répondent.
5. Après le rendez-vous, noter ce qui a été vérifié et mettre à jour les critères (le niveau passe d'observé à vérifié).

### 4.3 Revue hebdomadaire

Chaque semaine : comparer le funnel observé au funnel simulé, relire les lignes « À RELIRE », ajuster les messages de contact, et noter les décisions dans le journal.

## 5. Scoring

Statut : hypothèse de travail, à réviser quand des données réelles seront disponibles (par exemple après les 30 premiers contacts).

### 5.1 Formule

```
S = 30 × Pc / 100 + 25 × I / 5 + 20 × R / 5 + 15 × N / 5 + 10 × F / 5
```

| Variable | Définition                                                                | Échelle   | Poids max dans S |
| -------- | ------------------------------------------------------------------------- | --------- | ---------------- |
| Pc       | Probabilité de convertir le prospect en client payant ou partenaire actif | 0 à 100 % | 30               |
| I        | Impact commercial potentiel si le client est acquis                       | 1 à 5     | 25               |
| R        | Probabilité de réutilisation et de fidélisation                           | 1 à 5     | 20               |
| N        | Potentiel de recommandation et d'accès à d'autres organisateurs           | 1 à 5     | 15               |
| F        | Facilité et rapidité d'acquisition                                        | 1 à 5     | 10               |

La probabilité de conversion pèse plus que la taille du client : Noise doit d'abord réussir à signer ses premiers partenaires. Le score sert à comparer les prospects avec une méthode cohérente ; il ne mesure pas un chiffre d'affaires.

R porte sur l'avenir (le prospect réutilisera-t-il Noise ?) et non sur les événements passés : un débutant (P1, P2) peut donc être noté, à partir de ses intentions observées.

Bornes : avec des critères notés de 1 à 5, S va de 14 (Pc 0, tous les critères à 1) à 100 (Pc 100, tous les critères à 5). Un critère inconnu reste vide : le score n'est alors pas calculé et la ligne n'est pas qualifiée.

### 5.2 Exemple de contrôle

Pc 70, I 4, R 5, N 4, F 3 :

| Terme         | Calcul        | Valeur |
| ------------- | ------------- | ------ |
| 30 × Pc / 100 | 30 × 70 / 100 | 21     |
| 25 × I / 5    | 25 × 4 / 5    | 20     |
| 20 × R / 5    | 20 × 5 / 5    | 20     |
| 15 × N / 5    | 15 × 4 / 5    | 12     |
| 10 × F / 5    | 10 × 3 / 5    | 6      |
| S             |               | 79     |

Résultat : 79, soit une priorité élevée (juste sous le seuil de 80). Ce cas sert de test pour les formules du classeur et pour le script.

### 5.3 Seuils de priorité (provisoires)

| Score S          | Priorité    |
| ---------------- | ----------- |
| 80 et plus       | Très élevée |
| 65 à moins de 80 | Élevée      |
| 45 à moins de 65 | Moyenne     |
| Moins de 45      | Basse       |

### 5.4 Grille de notation proposée (hypothèse)

| Note | I — Impact commercial    | R — Réutilisation et fidélisation (signes observés ou annoncés) | N — Recommandation et réseau                   | F — Facilité et rapidité d'acquisition    |
| ---- | ------------------------ | --------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------- |
| 1    | Moins de 50 participants | Événement unique, sans suite annoncée                           | Aucun lien visible avec d'autres organisateurs | Aucun canal de contact public             |
| 2    | 50 à 100                 | Quelques événements par an, ou intention vague de recommencer   | Quelques collaborations visibles               | Canal public peu actif                    |
| 3    | 100 à 300                | Environ un par mois, ou projet régulier annoncé                 | Collabore régulièrement                        | Canal public actif                        |
| 4    | 300 à 1 000              | Deux à trois par mois                                           | Figure centrale d'un collectif                 | Contact via une connaissance commune      |
| 5    | Plus de 1 000            | Chaque semaine, ou programmation régulière d'un lieu            | Référence du milieu, prescripteur              | Rencontre en personne possible rapidement |

Cette grille sera détaillée et ajustée dans `scoring.md`.

### 5.5 Confiance dans les données

La confiance (Faible, Moyenne, Élevée) mesure la solidité des informations, pas le potentiel du prospect. Un prospect peut avoir un score de 85 avec une confiance Faible : il faut alors vérifier avant d'investir du temps.

| Confiance | Condition (proposition)                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| Faible    | Moins de 200 caractères d'observations, ou une seule source, ou persona indéterminé |
| Moyenne   | Plusieurs observations publiques concordantes, persona observé                      |
| Élevée    | Informations vérifiées lors d'un échange direct                                     |

### 5.6 Règles qui priment sur les seuils

Validées par Yannis le 2026-10-14. Elles s'appliquent dans cet ordre, avant les seuils de la section 5.3 :

| Ordre | Condition              | Priorité                              | Raison                                                                                                           |
| ----- | ---------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | Score S non calculable | Vide                                  | Une information manquante reste vide                                                                             |
| 2     | Persona `HORS_CIBLE`   | Hors cible                            | Valeur à part plutôt que « Basse » : le prospect est exclu des contacts et des comptages de priorité             |
| 3     | Persona `INDETERMINE`  | Seuils appliqués, plafonnés à Moyenne | Avec Pc plafonné à 40, S peut encore atteindre 82 (12 + 25 + 20 + 15 + 10) : sans preuve, pas de priorité élevée |
| 4     | Tous les autres cas    | Seuils de la section 5.3              |                                                                                                                  |

Formule du classeur, en supposant S en colonne H et le persona en colonne S (lettres à remplacer par les vraies colonnes) :

```
=SI(H2="";"";
 SI(S2="HORS_CIBLE";"Hors cible";
 SI(H2>=80;SI(S2="INDETERMINE";"Moyenne";"Très élevée");
 SI(H2>=65;SI(S2="INDETERMINE";"Moyenne";"Élevée");
 SI(H2>=45;"Moyenne";"Basse")))))
```

Il n'y a pas de champ « rôle » distinct : seule compte l'appartenance à l'un des personas, prouvée par une citation (décision de Yannis du 2026-10-14). Un débutant P1 ou P2 dont le persona est prouvé n'est donc pas plafonné.

### 5.7 Risque d'un prospect

Le risque est noté à part, sans entrer dans le score S. Formule retenue par Yannis le 2026-10-14 :

```
Q = Pe / 100 × G
```

| Variable | Définition                                           | Échelle   |
| -------- | ---------------------------------------------------- | --------- |
| Pe       | Probabilité d'échec du partenariat ou de l'événement | 0 à 100 % |
| G        | Gravité des conséquences en cas d'échec              | 1 à 5     |

Q varie de 0 à 5 ; plus il est élevé, plus le risque est important. Exemples d'échec : événement annulé après la vente des billets, organisateur qui disparaît après les reversements (DEC-024, DEC-025), réputation publique négative, activité incompatible avec les CGU.

Seuils proposés (hypothèse, à valider), obtenus en ramenant ceux de l'étude de risques du projet (sur 25) à une échelle sur 5 :

| Q              | Niveau   |
| -------------- | -------- |
| 3 et plus      | Critique |
| 2 à moins de 3 | Élevé    |
| 1 à moins de 2 | Moyen    |
| Moins de 1     | Faible   |

Exemple : Pe 40 %, G 4 donnent Q = 0,4 × 4 = 1,6, soit un risque moyen.

Évolution possible pour les risques opérationnels : ajouter un troisième facteur, la difficulté à détecter le problème avant qu'il ne se produise.

Les risques de la mission elle-même (section 8) restent notés comme l'étude de risques du projet (probabilité et gravité de 1 à 5), pour rester comparables avec elle.

### 5.8 Personas cibles

Chaque prospect est rattaché à un persona, ou classé hors cible. Le persona sert à choisir l'argumentaire et à mesurer quels profils deviennent réellement des organisateurs actifs.

Statut : liste définie par l'équipe le 2026-10-14. Elle complète le persona « Kofi » du cahier des charges, qui correspond à P4. Les exemples cités sont des illustrations données par l'équipe, pas des prospects qualifiés : chacun devra être observé comme les autres.

Les personas suivent un parcours de maturité, du débutant au festival :

| Code | Persona                         | Définition                                                                                              | Exemples cités                            |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| P1   | Débutant                        | N'a jamais organisé de soirée ni d'événement ; veut se lancer dans l'événementiel ou gagner de l'argent | —                                         |
| P2   | Débutant avec notoriété         | N'a jamais organisé, mais dispose d'une audience ou d'une position reconnue                             | Délégué d'université                      |
| P3   | Organisateur de petites soirées | A déjà organisé des soirées de petite taille                                                            | House parties                             |
| P4   | Organisateur confirmé           | Personne qui a déjà organisé des soirées qui ont bien marché                                            | Koffi Nation                              |
| P5   | Organisme organisateur          | Structure, collectif ou marque qui a déjà organisé des soirées                                          | West Coast                                |
| P6   | Lieu d'événements               | Club, lounge, bar ou salle qui accueille ou organise des événements                                     | —                                         |
| P7   | Festival                        | Événement d'envergure, souvent annuel ou par éditions                                                   | We Love Eya, Chill and Groove, Festichill |

#### Signes observables et argumentaire

| Code | Signes observables à citer (preuve exigée)                                                                | Argument Noise principal                                                                                        | Point d'attention                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| P1   | Intention explicite et publique de se lancer (« je prépare ma première soirée », appel à partenaires)     | Démarrage sans frais : gratuit jusqu'à 50 participants (DEC-023), billetterie et paiement prêts à l'emploi      | Rarement repérable sur des pages publiques ; risque d'annulation plus élevé (R03) : accompagnement nécessaire |
| P2   | Rôle public ou audience visible (délégué, président d'association, compte suivi), sans événement organisé | Transformer son audience en événement payant, sans avance de frais                                              | Notoriété ne veut pas dire capacité d'organisation                                                            |
| P3   | Annonce de soirées privées ou en appartement, avec participation payante ou réservation                   | Gratuit jusqu'à 50 participants, fin de la caisse en cash, entrées contrôlées                                   | Petits volumes : faible revenu par événement pour Noise                                                       |
| P4   | Plusieurs soirées passées avec affluence visible (complet, éditions successives, photos de foule)         | Argent reçu le lendemain de chaque journée de vente (DEC-024), scan par le staff, ventes en temps réel          | Peut déjà avoir ses habitudes ou un autre outil                                                               |
| P5   | Nom de structure ou de marque qui signe plusieurs événements                                              | Un outil pour toute l'équipe : liens scanner du staff, export des ventes (NOISE-039)                            | Décision collective : identifier le bon interlocuteur                                                         |
| P6   | Lieu qui annonce des événements récurrents dans ses murs                                                  | Un seul outil pour tous les événements du lieu ; le lieu peut recommander Noise à ses organisateurs (critère N) | Le lieu n'est pas toujours l'organisateur des soirées qu'il accueille                                         |
| P7   | Événement avec éditions numérotées ou annuelles, programmation, partenaires                               | Volume de billets, contrôle anti-fraude à l'entrée                                                              | Voir la limite produit ci-dessous ; réseau saturé sur un grand site (R02)                                     |

#### Règles de classement

1. P1 et P2 se définissent par l'absence d'événement organisé : l'absence de publication ne suffit pas. Il faut une citation qui montre l'intention (P1) ou la notoriété (P2). Sinon, le prospect est indéterminé.
2. P3 ou P4 : P4 exige une preuve de succès (affluence, complet, éditions répétées). En son absence, un organisateur de soirées est classé P3.
3. P4 ou P5 : P4 est une personne, P5 une structure ou une marque.
4. Un prospect qui correspond à plusieurs personas reçoit le plus avancé dans le parcours, et le second est noté en commentaire.

#### Écarts avec le produit et le scoring à signaler

1. Festivals (P7) : le scan accepte un billet une seule fois (scan atomique). Un pass valable plusieurs jours n'est donc pas géré aujourd'hui ; il faut un type de billet par jour. À vérifier avant de démarcher un festival sur plusieurs jours.
2. Scoring : la formule favorise les organisateurs expérimentés (Pc, récurrence R). Un P1 ou un P2 aura presque toujours une priorité basse, même avec une forte notoriété (N). Si l'équipe veut aussi recruter des débutants, il faudra un objectif séparé par persona plutôt qu'un seul classement.

#### Hors persona

Deux classements, à ne pas confondre :

| Classement  | Sens                                                                   | Exemples                                                                                                                      |
| ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Hors cible  | Les observations montrent que le prospect ne correspond à aucune cible | Événements familiaux sur invitation sans entrée payante (mariage, anniversaire), revendeur de billets, activité hors du Bénin |
| Indéterminé | Les observations ne suffisent pas pour trancher                        | Texte trop court, aucune citation qui montre une intention, une notoriété ou un événement                                     |

Un prospect hors cible n'est pas contacté. Un prospect indéterminé est complété par une nouvelle observation avant d'être noté.

### 5.9 Avantages et inconvénients

Pour chaque prospect, l'analyse liste au plus 3 avantages et 3 inconvénients pour Noise, c'est-à-dire ce qui rend le prospect intéressant ou difficile à convertir.

Exemples :

| Type         | Exemple                                                         | Observation qui le justifie (exemple fictif)          |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------- |
| Avantage     | Vend déjà ses places par WhatsApp : le besoin de Noise est fort | « Réservez vos places en message privé »              |
| Avantage     | Organise chaque semaine : récurrence élevée                     | Affiches datées de 4 samedis consécutifs              |
| Inconvénient | Événements gratuits : peu ou pas de commission pour Noise       | « Entrée libre »                                      |
| Inconvénient | Déjà équipé d'une autre billetterie                             | Lien vers une autre plateforme de vente sur l'affiche |

Règles :

1. Chaque avantage ou inconvénient s'appuie sur une observation précise de la colonne AE, citée mot pour mot. Sans citation retrouvée, le point est supprimé.
2. Ils portent uniquement sur l'activité événementielle publique et l'adéquation avec Noise. Interdit : tout jugement sur la personne elle-même (physique, vie privée, origine, religion, opinions, santé).
3. Une liste vide est une réponse valable : elle vaut mieux qu'un point inventé.

## 6. Funnel de simulation

Statut : simulation, aucun taux n'est mesuré. À remplacer par les taux observés dans le tableau de bord.

| Étape                 | Nombre (20 jours) | Taux depuis l'étape précédente | Taux depuis les qualifiés | Extrapolation 60 jours |
| --------------------- | ----------------- | ------------------------------ | ------------------------- | ---------------------- |
| Qualifiés             | 60                | —                              | 100 %                     | 180                    |
| Contactés             | 30                | 50 %                           | 50 %                      | 90                     |
| Réponses              | 12                | 40 %                           | 20 %                      | 36                     |
| Rendez-vous           | 6                 | 50 %                           | 10 %                      | 18                     |
| Organisateurs activés | 3                 | 50 %                           | 5 %                       | 9                      |

Lecture : il faudrait qualifier environ 20 prospects pour activer un organisateur. L'extrapolation à 60 jours suppose des taux constants, ce qui est rarement vrai (les meilleurs prospects sont souvent contactés en premier).

Remplacement par les taux observés :

1. Chaque taux observé = nombre à l'étape / nombre à l'étape précédente, sur la même période.
2. Un taux calculé sur moins de 20 cas est très incertain : l'afficher avec son effectif (par exemple « 3 sur 12 »).
3. Garder dans le tableau de bord la colonne simulée à côté de la colonne observée, pour voir l'écart.

## 7. Économie

Statut : simulation, à confirmer par contrat avec chaque organisateur.

### 7.1 Paramètres

| Paramètre            | Valeur                                            | Source    |
| -------------------- | ------------------------------------------------- | --------- |
| Prix du billet       | 5 000 FCFA                                        | Hypothèse |
| Commission Noise     | 10 % du prix                                      | DEC-024   |
| Frais d'organisation | 40 FCFA par participant déclaré                   | DEC-023   |
| Frais FedaPay        | Payés par l'acheteur en plus du prix, hors calcul | DEC-024   |

### 7.2 Scénarios de contrôle

Hypothèse de calcul : capacité déclarée = billets vendus, un seul type de billet.

| Scénario             | Billets | Volume de ventes | Commission Noise | Frais d'organisation | Revenu brut Noise | Revenu organisateur |
| -------------------- | ------- | ---------------- | ---------------- | -------------------- | ----------------- | ------------------- |
| 1 événement          | 50      | 250 000          | 25 000           | 2 000 (voir 7.3)     | 27 000            | 223 000             |
| 1 événement          | 100     | 500 000          | 50 000           | 4 000                | 54 000            | 446 000             |
| 1 événement          | 200     | 1 000 000        | 100 000          | 8 000                | 108 000           | 892 000             |
| 10 événements de 100 | 1 000   | 5 000 000        | 500 000          | 40 000               | 540 000           | 4 460 000           |

Montants en FCFA. Revenu organisateur = volume − commission − frais d'organisation. Les trois grandeurs sont toujours présentées séparément : le volume de ventes n'est pas un revenu de Noise.

### 7.3 Écarts avec decisions.md à trancher

1. Seuil des frais : le brief initial applique les frais « dès 50 billets ». DEC-023 dit « gratuit jusqu'à 50 participants », donc dès 51. Selon DEC-023, le scénario à 50 billets donne 0 FCFA de frais, un revenu Noise de 25 000 FCFA et un revenu organisateur de 225 000 FCFA. Les autres scénarios ne changent pas. decisions.md fait foi tant qu'une nouvelle décision ne le modifie pas ; le classeur et la présentation sont à vérifier sur ce point.
2. Base des frais : DEC-023 calcule les frais sur la capacité déclarée, pas sur les billets vendus. Un organisateur qui déclare 100 places et en vend 60 paie 4 000 FCFA, pas 2 400.
3. Lancement : DEC-023 prévoit d'offrir les frais d'organisation aux premiers organisateurs prospectés. Pour eux, le revenu Noise se limite à la commission : 25 000, 50 000, 100 000 et 500 000 FCFA pour les quatre scénarios.

## 8. Risques de la mission

| Risque                                                                              | P   | G   | Criticité | Réponse                                                                                        |
| ----------------------------------------------------------------------------------- | --- | --- | --------- | ---------------------------------------------------------------------------------------------- |
| Prospects activés mais aucun événement publiable faute de production (KYC, DEC-016) | 4   | 4   | 16        | Définir l'activation avant production (3.2) ; informer les prospects honnêtement du calendrier |
| Données personnelles conservées ou diffusées hors cadre                             | 3   | 5   | 15        | Classeur hors de Git, minimisation, avis juridique (3.4)                                       |
| Persona attribué à tort (faux positif, y compris par l'IA)                          | 3   | 3   | 9         | Preuve obligatoire, citation exacte, relecture humaine                                         |
| Taux de réponse bien plus bas que simulé                                            | 3   | 3   | 9         | Revue hebdomadaire, tests de plusieurs messages                                                |
| Promesse excessive faite à un prospect                                              | 2   | 4   | 8         | Liste des promesses interdites (3.3), argumentaire commun                                      |
| Temps de collecte supérieur au temps disponible (équipe de deux, DEC-019)           | 3   | 2   | 6         | Objectif minimal de 3 par jour, script d'aide au scoring                                       |

## 9. Organisation

| Élément        | Choix                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Responsables   | À définir entre Yannis et Orias (collecte, contacts, relecture)       |
| Outil de suivi | Classeur `NOISE_Prospection_Cotonou.xlsx` (copie de travail hors Git) |
| Pré-notation   | Script local `ia-scoring/` (étape 3), toujours relu                   |
| Rythme         | Collecte quotidienne, revue hebdomadaire, bilan à 20 et à 60 jours    |
| Traçabilité    | Journal de bord `docs/journal.md`, sans nom ni numéro                 |

## 10. Livrables

| Livrable                                  | Emplacement                                    | État                                  |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| Brief de mission                          | `docs/brief.md`                                | Ce document                           |
| Présentation de 20 slides (.pptx, .pdf)   | `deck/`                                        | Produite, à déposer                   |
| Archive des scripts de régénération       | `deck/sources/`                                | Produite, à déposer                   |
| Classeur `NOISE_Prospection_Cotonou.xlsx` | `modele-prospection/` (modèle vide uniquement) | Produit, à déposer                    |
| Script d'analyse IA locale et tests       | `ia-scoring/`                                  | Implémenté, testé avec un faux modèle |
| Version Google Apps Script (`Code.gs`)    | `ia-scoring/` (option)                         | Existe, option                        |

## 11. Questions ouvertes

1. Seuil des frais d'organisation dans les simulations : 50 ou 51 participants (section 7.3) ?
2. Définition d'un organisateur activé avant la mise en production (section 3.2) ?
3. Réglée le 2026-10-14 : priorité plafonnée à Moyenne si le persona est indéterminé, valeur « Hors cible » pour les prospects hors cible (section 5.6).
4. Qui collecte, qui contacte, qui relit ?
5. Durée de conservation des données des prospects et lieu de stockage du classeur rempli ?
6. Segment de départ à privilégier (soirées et clubs, événements étudiants, concerts) ?
7. Faut-il un objectif de recrutement séparé pour les débutants (P1, P2), que le score place presque toujours en priorité basse (section 5.8) ?
8. Colonnes du classeur où écrire persona, avantages et inconvénients (à fixer à l'ouverture du classeur) ?
