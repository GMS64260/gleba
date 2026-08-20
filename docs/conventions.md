# Conventions Gleba

## Référentiel — Espèces

### Type d'espèce (`Espece.type`)

Stocké en `snake_case` en base, mappé vers un label français à l'affichage via
`ESPECE_TYPE_LABELS` (`src/lib/validations/espece.ts`).

| Valeur DB        | Label affiché    | Exemples                         |
| ---------------- | ---------------- | -------------------------------- |
| `legume`         | Maraîchage       | Carotte, Tomate, Aubergine       |
| `aromatique`     | Aromatique       | Basilic, Thym, Sauge             |
| `fleur`          | Fleur            | Zinnia, Cosmos, Dahlia           |
| `engrais_vert`   | Engrais vert     | Trèfle incarnat, Tournesol       |
| `arbre_fruitier` | Arbre fruitier   | Pommier, Poirier, Amandier       |
| `petit_fruit`    | Petit fruit      | Cassissier, Argousier, Groseille |
| `ornement`       | Ornement         | Bambou, Albizia                  |

Le contrôle d'intégrité est posé via un `CHECK` SQL (`especes_type_check`) et un
`z.enum(ESPECE_TYPES)` côté validation. **Les deux doivent bouger ensemble** :
ajouter une valeur au `z.enum` sans reprendre le `CHECK` fait échouer la création
en 500 côté base.

**Trois règles pour ajouter un type** (ticket FB-E33FAA, 2026-08-18 — trois des
quatre écrans du référentiel affichaient le slug brut `ornement`, et l'écran de
création rendait une option vide, parce que chacun portait sa propre carte de
libellés recopiée) :

1. un libellé dans `ESPECE_TYPE_LABELS` et une description dans
   `ESPECE_TYPE_DESCRIPTIONS` — les deux `Record` sont exhaustifs sur
   `ESPECE_TYPES`, donc un oubli casse la compilation ;
2. aucun écran ne réénumère ces libellés : ils passent par `libelleTypeEspece()`,
   qui tolère une valeur héritée hors canon en l'affichant sous son slug ;
3. décider si le type se conduit sur planche, c'est-à-dire s'il rejoint
   `ESPECE_TYPES_MARAICHAGE` (stocks de semences, plants et récoltes).

Le registre d'affichage diffère sur un point : une colonne ou une option nomme la
PLANTE (`legume` → « Légume »), là où le référentiel nomme le MODULE
(« Maraîchage »). Ce delta d'une ligne vit dans `libelleTypeEspece`, jamais
recopié dans un écran.

### Unité de rendement (`Espece.uniteRendement`)

| Valeur DB        | Label affiché | Quand                                          |
| ---------------- | ------------- | ---------------------------------------------- |
| `kg_m2`          | kg/m²         | Maraîchage, aromatique, petit fruit, ornement  |
| `kg_arbre`       | kg/arbre      | Arbre fruitier                                 |
| `biomasse_t_ha`  | t/ha          | Engrais vert                                   |
| `tiges_m2`       | tiges/m²      | Fleur coupée (défaut du type `fleur`)          |
| `pieces_m2`      | pièces/m²     | Vendu à l'unité : salade, laitue, chou         |
| `bottes_m2`      | bottes/m²     | Vendu en bottes : radis, aromates, oignon      |

L'unité est un CHOIX de l'utilisateur, porté par l'espèce et saisi sur les deux
écrans de rendement ; `uniteRendementParType()` ne fournit plus que le défaut le
plus probable. Cette correspondance est du CODE, pas de la prose. L'unité
STOCKÉE fait toujours foi à l'affichage (`formatRendement(val, unite)`) ; la
dérivation par type ne sert qu'à la création et au repli sur une ligne héritée
sans unité.

Les trois unités en pièces (2026-08-20) sont surfaciques mais **non pondérales**,
ce qui coupe la chaîne des kilos en deux :

- `rendementParM2()` rend la densité dans son unité, `projectionRecolte()` la
  quantité AVEC son unité (`kg | tige | piece | botte`) ;
- `rendementKgParM2()` et `projectionRecolteKg()` rendent `null`/`0` pour ces
  unités. C'est volontaire : il faudrait un poids unitaire que le référentiel ne
  porte pas, et l'inventer ferait entrer 1 300 tiges de dahlia dans un total de
  kilos. Les agrégats en kg (KPI « récoltes attendues », graphique mensuel,
  planification, assistant) les ignorent donc au lieu de les additionner à tort.

L'objectif annuel (`Espece.objectifAnnuel`) se lit dans l'unité de QUANTITÉ
dérivée du rendement : `libelleUniteObjectif()`. Il était étiqueté « kg » en dur,
ce qui rendait la planification inutilisable pour une production en tiges. Ne pas réintroduire de ternaire local
`type === 'arbre_fruitier' ? 'kg/arbre' : 'kg/m²'` : il étiquette les engrais
verts en kg/m² alors qu'ils sont stockés en t/ha.

Le plafond de plausibilité du rendement dépend de l'unité (`kg/m²` ≤ 100,
`kg/arbre` ≤ 1000, `t/ha` ≤ 100, `tiges/m²` et `pièces/m²` ≤ 1000,
`bottes/m²` ≤ 500) : une borne uniforme à 100 interdisait de
déclarer un fruitier au-delà de 100 kg/arbre, alors que le catalogue en contient
(arbre à pain 150). Sur un PATCH partiel qui n'établit aucune unité, seule la
borne absolue s'applique — refuser vaudrait rejeter une correction légitime.

La vente à la TIGE (fleurs coupées) n'est pas modélisée : les récoltes florales
sont pesées comme le reste. Écart produit ouvert, à trancher avec une ferme
florale pilote.

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
