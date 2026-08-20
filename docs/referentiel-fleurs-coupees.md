# Référentiel des fleurs coupées — rendement en tiges/m²

Les 25 espèces florales du catalogue Gleba portaient un rendement en **kg/m²**
(dahlia à 4 kg/m², zinnia à 2,5 kg/m²). Personne ne vend de dahlias au kilo :
une ferme florale dimensionne en **tiges par mètre carré**. La migration
`20260818140000_referentiel_fleurs_coupees` le disait déjà en commentaire
(« la vente à la TIGE reste un écart produit ouvert »).
`20260820180000_fleurs_coupees_tiges_m2` le ferme.

## Comment ces valeurs sont obtenues

Le calcul est explicite et vérifiable :

```
rendement (tiges/m²) = densité (plants/m²) × tiges par plant sur la saison
```

La **densité** n'est pas nouvelle : elle vient du référentiel, posée par la
migration du 2026-08-18 sur ses propres sources (ITAB, SNHF/semencemag, fiches
techniques de semenciers de fleurs coupées, Collectif de la Fleur Française).
Le seul facteur ajouté ici est le **nombre de tiges par plant**, dont la base
est donnée espèce par espèce ci-dessous. Trois bases seulement :

| Base | Ce que ça veut dire |
| --- | --- |
| `mesuré` | Un chiffre publié pour cette espèce, cité en fin de page. |
| `botanique` | Un bulbe ou un corme qui donne **un seul épi** : ce n'est pas une estimation, c'est la plante. |
| `classe` | Défaut de la classe de conduite, **ancré sur une espèce mesurée de la même classe**, et volontairement tiré vers le bas. |

Trois classes de conduite : *annuelle remontante pincée* (ancrée sur le zinnia,
15 tiges/plant mesurées), *corme remontant* (ancré sur la renoncule, 5,3 tiges
relevées en ferme), *tige unique* (1, par botanique).

**Ce que ces valeurs ne sont pas.** Un rendement dépend du sol, du climat, de
l'abri et de la conduite ; le catalogue ne donne qu'un ORDRE DE GRANDEUR, et une
valeur `classe` en est un plus grossier qu'une valeur `mesuré`. C'est exactement
ce à quoi sert le bloc « Chez moi » de la fiche espèce : chaque ferme déclare son
propre rendement, qui prime sur le catalogue (`UserStockEspece.rendement`, cf.
`src/lib/recolte/rendement-effectif.ts`). Une valeur `classe` est un point de
départ, pas une promesse.

## Table

| Espèce | Densité (plants/m²) | Tiges/plant | Base | Rendement (tiges/m²) |
| --- | --- | --- | --- | --- |
| Amarante queue-de-renard | 6 | 5 | classe | 30 |
| Ammi élevé | 9 | 5 | classe | 45 |
| Anémone | 25 | 6 | classe (corme remontant) | 150 |
| Cosmos | 10 | 15 | classe (annuelle remontante) | 150 |
| Célosie | 11 | 6 | classe | 66 |
| Dahlia | 2 | 10 | mesuré | 20 |
| Giroflée ravenelle | 25 | 3 | classe | 75 |
| Glaïeul | 36 | 1 | botanique (un épi par corme) | 36 |
| Gypsophile annuelle | 40 | 3 | classe (semis dense) | 120 |
| Immortelle | 9 | 8 | classe | 72 |
| Muflier | 16 | 6 | mesuré | 96 |
| Narcisse | 50 | 1 | botanique | 50 |
| Nigelle de Damas | 40 | 3 | classe (semis dense) | 120 |
| Phlox de Drummond | 16 | 6 | classe | 96 |
| Pivoine | 1 | 10 | mesuré (touffe adulte) | 10 |
| Pois de senteur | 8 | 20 | mesuré | 160 |
| Reine-marguerite | 16 | 5 | classe | 80 |
| Renoncule | 16 | 5 | mesuré | 80 |
| Rudbeckie | 9 | 8 | classe | 72 |
| Scabieuse | 9 | 10 | classe | 90 |
| Statice | 9 | 6 | classe | 54 |
| Tagètes | 10 | 10 | classe | 100 |
| Tournesol ornemental | 12 | 1 | botanique (variétés à tige unique) | 12 |
| Tulipe | 60 | 1 | botanique (un bouton par bulbe) | 60 |
| Zinnia | 9 | 15 | mesuré | 135 |

Bilan des bases : **7 mesuré**, **4 botanique**, **14 classe**.

## Sources des valeurs « mesuré »

- **Zinnia — 15 à 25 tiges/plant sur la durée de vie du plant**, « 1-2
  harvestable stems per week during peak production. That can amount to 15-25
  stems per plant over its lifetime » — [Bootstrap Farmer, *Maximizing Zinnia
  Production*](https://www.bootstrapfarmer.com/blogs/growing-flowers/maximizing-zinnia-production-strategies-for-flower-farmers).
  Concordant avec les essais de plein champ (21,6 / 10,8 / 14,5 tiges par plant
  selon un semis de mai, juin ou juillet) — [Utah State University Extension,
  *Zinnia Cut Flower Production in
  Utah*](https://extension.usu.edu/productionhort/files/Zinnia-Cut-Flower-Production-in-Utah.pdf).
  Retenu : **15**, la borne basse.
- **Muflier — 5 à 6 tiges/plant en moyenne, jusqu'à 12** (jusqu'à 30 en plein
  champ sur variétés précoces) — [essais de variétés ASCFG / Cornell
  University](https://cutflowers.ces.ncsu.edu/wp-content/uploads/2013/05/2010-ASCFG-Seed-Trials.pdf).
  Retenu : **6**.
- **Dahlia — 4 tiges/plant relevées sur 1 700 pieds en ferme**, l'autrice
  qualifiant elle-même ce chiffre de faible face à la référence « yields of 20
  flowers per plant are not uncommon » — [Artemis Flower Farm, *Our Cut Flower
  Harvest and Yields in
  2022*](https://www.artemisflowerfarm.com/blog/cut-flower-harvest-record-keeping-yields).
  Retenu : **10**, entre le relevé et la référence.
- **Renoncule — 5,3 tiges par corme**, mesurées sur 2 450 cormes (13 040 tiges
  récoltées) — même source. Retenu : **5**.
- **Pois de senteur — 20 tiges/plant en moyenne, jusqu'à 34** (Cornell
  University) — [Utah State University Extension, *Sweet Pea Cut Flower
  Production in
  Utah*](https://digitalcommons.usu.edu/cgi/viewcontent.cgi?article=3079&context=extension_curall).
  Retenu : **20**.
- **Pivoine — 10 à 30 tiges/an sur une touffe adulte** (1 à 2 la première
  année, 5 à 7 la deuxième) — [Farmer Bailey, *Peonies in Year
  1-3*](https://farmerbailey.com/blogs/farmer-bailey-blog/peonies-in-year-1-3).
  Retenu : **10**, borne basse d'une touffe adulte.
- **Tulipe — une fleur par bulbe** pour les hybrides standard (Darwin, Triumph),
  les variétés multiflores faisant exception — [Longfield Gardens, *How Many
  Flowers Does 1 Tulip Bulb
  Produce*](https://www.longfield-gardens.com/blogs/tulip-care/how-many-flowers-does-1-tulip-bulb-produce).
  Retenu : **1**. Même raisonnement pour le narcisse et le glaïeul (un épi par
  corme), et pour le tournesol ornemental à tige unique.

## Ce qui reste à faire

Les 14 valeurs `classe` méritent d'être remplacées, espèce par espèce, par des
chiffres publiés ou par des relevés de fermes utilisatrices — c'est précisément
ce que le bloc « Chez moi » permet désormais de collecter. Priorité aux plus
cultivées : cosmos, statice, célosie, reine-marguerite.
