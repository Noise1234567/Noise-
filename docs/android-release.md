# Android : builds, signature, versioning, publication

État : profils EAS définis (`apps/mobile/eas.json`) ; aucun build réalisé.

## 1. Profils de build

| Profil        | Sortie                          | Usage                                              | Pointe vers                                | Tâche                |
| ------------- | ------------------------------- | -------------------------------------------------- | ------------------------------------------ | -------------------- |
| `development` | APK avec dev client             | Développement sur appareil, rechargement via Metro | API locale                                 | NOISE-009            |
| `preview`     | APK signé, distribution interne | Recette, tests terrain, sideloading                | Staging (puis production pour les pilotes) | NOISE-032            |
| `production`  | AAB                             | Google Play                                        | Production                                 | NOISE-033, NOISE-038 |

Commandes (depuis `apps/mobile`, compte Expo connecté) :

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform android
```

Repli si EAS est indisponible : `npx expo prebuild --platform android` puis build Gradle local (Android Studio). Le dossier `android/` généré n'est jamais commité.

## 2. Identité de l'application

| Champ       | Valeur                       | Remarque                                                              |
| ----------- | ---------------------------- | --------------------------------------------------------------------- |
| Nom         | Noise                        | `app.json` → `name`                                                   |
| Identifiant | `com.noise.app` (provisoire) | Définitif après publication Play — DEC-015 à trancher avant NOISE-009 |
| Plateforme  | Android uniquement           | iOS hors scope                                                        |

## 3. Versioning

- `version` (visible) = version SemVer de la release (`0.1.0` pour la première release).
- `android.versionCode` (entier) : incrémenté à chaque build distribué, jamais réutilisé. Source : `app.json` (`appVersionSource: local`).
- Chaque build distribué est enregistré dans la base Notion « Releases » (version, versionCode, profil, date, lien, validation).

## 4. Signature

- Keystore généré et stocké par EAS (credentials gérés à distance). Aucun keystore dans Git (`.gitignore`).
- Une copie de sauvegarde du keystore est téléchargée (`eas credentials`) et conservée hors du dépôt par le titulaire du compte Expo ; son emplacement (pas son contenu) est noté dans Notion « Services & accès ».
- Perdre le keystore d'une app publiée hors Play App Signing empêche toute mise à jour : avec Google Play, activer Play App Signing.

## 5. Distribution MVP (sideloading)

- Lien de téléchargement de l'APK preview + page d'instructions illustrée : autoriser l'installation depuis Chrome / le gestionnaire de fichiers, installer, ouvrir.
- Test sur au moins 3 modèles Android milieu de gamme (2–4 Go RAM), dont un Android ancien supporté.
- Mise à jour : nouvel APK avec `versionCode` supérieur, même signature.

## 6. Google Play (après le MVP, NOISE-038)

Dépendances externes et validations humaines :

| Étape                                                                                                        | Qui                    | Délai                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------- | -------------------------- |
| Décider le titulaire du compte (personnel ou organisation)                                                   | Yannis et Orias        | —                          |
| Créer le compte développeur (frais unique 25 $), vérification d'identité                                     | Titulaire              | Quelques jours             |
| Compte organisation : numéro D-U-N-S requis                                                                  | Titulaire              | Jusqu'à plusieurs semaines |
| Compte personnel récent : test fermé avec 12 testeurs pendant 14 jours consécutifs                           | Les deux + 12 testeurs | 14 jours minimum           |
| Fiche store, captures, politique de confidentialité (URL), formulaire Data safety, classification du contenu | Les deux               | 1–2 jours                  |
| Demande d'accès à la production puis examen de Google                                                        | Google                 | Variable                   |

Préparation technique déjà prévue : AAB (NOISE-033), Play App Signing, politique de confidentialité, suppression de compte possible depuis l'app (exigence Data safety).
