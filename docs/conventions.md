# Conventions Gleba

## Référentiel — Espèces

### Type d'espèce (`Espece.type`)

Stocké en `snake_case` en base, mappé vers un label français à l'affichage via
`ESPECE_TYPE_LABELS` (`src/lib/validations/espece.ts`).

| Valeur DB        | Label affiché    | Exemples                         |
| ---------------- | ---------------- | -------------------------------- |
| `legume`         | Maraîchage       | Carotte, Tomate, Aubergine       |
| `aromatique`     | Aromatique       | Basilic, Thym, Sauge             |
| `engrais_vert`   | Engrais vert     | Trèfle incarnat, Tournesol       |
| `arbre_fruitier` | Arbre fruitier   | Pommier, Poirier, Amandier       |
| `petit_fruit`    | Petit fruit      | Cassissier, Argousier, Groseille |
| `ornement`       | Ornement         | Bambou, Albizia                  |

Le contrôle d'intégrité est posé via un `CHECK` SQL (`especes_type_check`) et un
`z.enum(ESPECE_TYPES)` côté validation.

### Unité de rendement (`Espece.uniteRendement`)

| Valeur DB        | Label affiché | Quand                                          |
| ---------------- | ------------- | ---------------------------------------------- |
| `kg_m2`          | kg/m²         | Maraîchage, aromatique, petit fruit, ornement  |
| `kg_arbre`       | kg/arbre      | Arbre fruitier                                 |
| `biomasse_t_ha`  | t/ha          | Engrais vert                                   |

### Familles botaniques

**Convention : noms latins** (Linné). Évite les doublons FR/latin du type
`Fabaceae` vs `Fabacées`. Si une famille FR doit être ajoutée, créer plutôt
l'équivalent latin et migrer les espèces.

Mapping de référence (extrait) :

| Latin           | Français usuel | Espèces typiques               |
| --------------- | -------------- | ------------------------------ |
| Solanaceae      | Solanacées     | Tomate, Aubergine, Poivron     |
| Brassicaceae    | Brassicacées   | Chou, Radis, Navet             |
| Fabaceae        | Fabacées       | Haricot, Pois, Trèfle          |
| Asteraceae      | Astéracées     | Tournesol, Laitue, Artichaut   |
| Apiaceae        | Apiacées       | Carotte, Persil, Fenouil       |
| Rosaceae        | Rosacées       | Pommier, Poirier, Amandier     |
| Elaeagnaceae    | Élæagnacées    | Argousier, Olivier de Bohême   |
| Poaceae         | Poacées        | Bambou, Maïs, Blé              |
| Fagaceae        | Fagacées       | Châtaignier, Chêne, Hêtre      |

## Référentiel — Variétés

`Variete.id` est aussi le nom affiché (TEXT PK). `Variete.nomNormalise` est
calculé par `normalizeVarieteName(id)` :

```
trim → tirets/_underscores en espace → collapse whitespace → NFD → drop accents → lowercase
```

Un index unique composite `(especeId, nomNormalise)` empêche la recréation de
doublons type *"Carotte Nantaise"* vs *"Carotte-Nantaise"*. La même formule est
appliquée côté SQL (`unaccent` + `regexp_replace`) — voir migration
`20260514000000_add_variete_nom_normalise`.

### Variété placeholder

Une Culture sans variété explicite reçoit automatiquement le placeholder
`<Espèce> — Non spécifiée` (Variete avec `isPlaceholder=true`). L'UI affiche un
bandeau « À renseigner » au lieu de `-`.
