# Android et Google Play

Gleba est empaqueté en **Trusted Web Activity (TWA)** : l’application Android
ouvre la PWA `https://gleba.fr` en plein écran et reçoit les évolutions du
produit depuis le serveur web.

## Identité

- Application ID : `fr.gleba.app`
- Projet Android : `android/gleba-twa`
- Version initiale : code `3`, nom `1.1.0`
- Android minimum : API 21
- Android cible : API 36
- Origine de confiance : `https://gleba.fr`

La cible API 36 est volontaire : Google Play l’exige pour les nouvelles
applications et mises à jour à partir du 2026-08-31.

## Livrables

- `app-release-signed.apk` : installation directe sur un appareil Android.
- `app-release-bundle.aab` : publication dans Google Play Console.

Les copies publiées pour téléchargement vivent dans `dl/`, dossier privé
ignoré par Git. Les artefacts de compilation Android sont également ignorés.

## Signature

La clé d’upload et son mot de passe vivent uniquement dans
`.android-signing/`, avec des permissions `0600`. Ce dossier est ignoré par
Git. Ne jamais copier leur contenu dans le dépôt ou dans le Brain.

Emplacements :

- `.android-signing/gleba-upload.keystore`
- `.android-signing/keystore-password`

Cette clé doit être sauvegardée dans le coffre de secrets habituel avant la
première publication. Toutes les mises à jour Play devront être signées avec
la même clé d’upload.

## Construire

Bubblewrap nécessite JDK 17 et le SDK Android. Depuis le dossier
`android/gleba-twa` :

```bash
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(tr -d '\n' < ../../.android-signing/keystore-password)"
export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
npx --yes @bubblewrap/cli build
```

Après un `bubblewrap update`, vérifier impérativement que
`app/build.gradle` conserve `targetSdkVersion 36` : Bubblewrap 1.24.1
regénère encore la valeur `35`.

Avant livraison :

```bash
apksigner verify --verbose --print-certs app-release-signed.apk
aapt dump badging app-release-signed.apk
jarsigner -verify app-release-bundle.aab
unzip -t app-release-bundle.aab
```

## Liaison avec gleba.fr

Le certificat d’upload est déclaré dans
`public/.well-known/assetlinks.json`. Caddy sert directement
`/manifest.json` et `/.well-known/assetlinks.json` avant Next, afin qu’aucun
middleware d’authentification ne bloque la validation Android.

Avec **Play App Signing**, Google crée un certificat de signature de
l’application différent de la clé d’upload. Dès qu’il est affiché dans Play
Console, ajouter aussi son empreinte SHA-256 à `assetlinks.json`, conserver
l’empreinte d’upload pour l’APK distribué directement, puis vérifier l’URL
publique.

## Publication Play Console

1. Créer l’application avec l’ID `fr.gleba.app`.
2. Activer Play App Signing et téléverser le fichier `.aab`.
3. Récupérer l’empreinte SHA-256 du certificat de signature Play et l’ajouter
   à `assetlinks.json`.
4. Compléter la fiche Store, la politique de confidentialité, la sécurité des
   données, l’audience et les déclarations relatives à la localisation et aux
   notifications.
5. Tester d’abord sur la piste interne.
6. Pour un compte personnel créé après le 2023-11-13, mener le test fermé
   exigé par Google avant l’accès à la production.

La TWA n’est pas destinée aux enfants de moins de 13 ans ; ne pas sélectionner
une audience enfant dans Play Console.
