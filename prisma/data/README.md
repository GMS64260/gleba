# Données ITP INRAE

`itp-inrae-mesclun-v1.1.json` est la transcription normalisée de l’onglet
`Cycles_culture` du jeu **Pépinière-Mesclun v1.1** publié par INRAE :

- DOI du jeu : <https://doi.org/10.57745/IQVM2I>
- DOI du fichier XLSX : <https://doi.org/10.57745/JTGSLL>
- licence : Licence Ouverte / Open Licence Etalab 2.0
- SHA-256 du XLSX original :
  `6683312252516f1341b5cb551a46c09849d2ab5678a264e7aff0d7bd48795a15`

La copie JSON conserve les libellés source, les références de cycle, les
valeurs de semaine publiées (`sourceWeeks`) et leur correspondance explicite
avec le référentiel d’espèces Gleba. Elle ne contient pas les autres onglets du
classeur, non utilisés par les ITP.

## Normalisation

- `Nord-Ouest` est calé sur la zone Gleba `oceanique`.
- `Abri froid` devient le type de planche `Sous abri`.
- les semaines de début historiques restent des repères de compatibilité ;
  les fenêtres complètes vivent dans `s_implantation_debut`,
  `s_implantation_fin`, `s_recolte` et `s_recolte_fin`.
- les quatre lignes qui publient une semaine supérieure à 52 sont conservées,
  normalisées modulo 52 pour respecter le schéma, marquées `a_revoir` et
  désactivées. Leur valeur brute reste dans `sourceWeeks`.
- aucune durée de pépinière n’est inventée : la source décrit l’implantation
  au champ, pas le début du semis en pépinière.

La migration SQL est régénérée de façon déterministe avec :

```bash
node scripts/generate-itp-inrae-migration.mjs
```
