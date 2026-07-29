# Audits agronomiques ITP

## Import INRAE Pépinière-Mesclun — 2026-07-29

- `itp-before-inrae-2026-07-29.csv` : 218 ITP officiels avant import.
- `itp-after-inrae-2026-07-29.csv` : 747 ITP officiels après import.
- apport INRAE : 529 scénarios, dont 525 actifs avec fenêtres complètes.
- 4 scénarios désactivés : la source publie au moins une semaine hors de
  l’intervalle ISO 1–52. Les valeurs brutes restent dans
  `prisma/data/itp-inrae-mesclun-v1.1.json`.
- 76 catégories source sont reliées à 65 espèces Gleba.
- climat de calage : Nord-Ouest, représenté par la zone `oceanique`.

Source : INRAE, **Pépinière-Mesclun v1.1**,
<https://doi.org/10.57745/IQVM2I>, Licence Ouverte Etalab 2.0.

Contrôles exécutés sur une copie de la production et sur une base PostGIS
vierge : migration complète, unicité des identifiants source, présence des
espèces, provenance, licence et bornes de semaines.
