# Contribuer à Gleba

## Conventions générales

- **Langue de l'interface** : français. Toutes les chaînes affichées à l'utilisateur (labels, placeholders, messages toast, descriptions, en-têtes de tableaux) doivent être rédigées en français avec orthographe correcte.
- **Diacritiques** : les accents, cédilles et autres signes diacritiques doivent toujours être présents quand l'orthographe les exige. Ne JAMAIS substituer un caractère sans accent à sa forme correcte. Exemples :
  - `Variete` → **`Variété`**
  - `Espece` → **`Espèce`**
  - `Recolte` → **`Récolte`**
  - `Maraichage` → **`Maraîchage`**
  - `Itineraire` → **`Itinéraire`**
  - `Parametre` → **`Paramètre`**
- **Identifiants techniques** : les noms de variables, types, interfaces, propriétés et clés d'enum restent en ASCII sans accent (ex: `interface Espece`, `const [varietes, setVarietes]`). Seules les chaînes destinées à l'affichage sont accentuées.

## Garde-fou ESLint

Un linter contrôle les régressions d'encodage. Les chaînes JSX ou string literals contenant les formes sans accents les plus courantes (`Variete`, `Espece`, `Recolte`, `Maraichage`, etc.) sont signalées par `no-restricted-syntax` en niveau `warn`.

Lancer la vérification :

```bash
npm run lint
```

Si le linter remonte un faux positif (par exemple une clé technique légitime), discuter dans la PR avant de désactiver la règle ligne par ligne.

## Audit en lot

Pour ré-auditer l'ensemble du référentiel :

```bash
npx tsx scripts/encoding-audit.ts           # rapport seul
npx tsx scripts/encoding-audit.ts --apply   # corrections appliquées
```

Le rapport est généré dans `audit/encoding-report.md`.

## Workflow de modification frontend

Voir [CLAUDE.md](./CLAUDE.md) pour la procédure standard (suppression du cache `.next/`, gestion des process orphelins sur le port 3000, rebuild Docker).
