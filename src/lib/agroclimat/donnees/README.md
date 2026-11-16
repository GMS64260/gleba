# Grille SAFRAN

`grille-safran.json` est la liste des 9 892 mailles de la grille SAFRAN de
Météo-France (France métropolitaine, Corse comprise, pas de 8 km), tirée du
fichier `coordonnees_grille_safran_lambert-2-etendu.csv` du jeu **Données
changement climatique - SIM quotidienne** :

- jeu : <https://www.data.gouv.fr/datasets/donnees-changement-climatique-sim-quotidienne>
- producteur : Météo-France
- licence : Licence Ouverte / Open Licence Etalab 2.0
- fichier relevé le 2026-11-15 (publié le 2026-08-04)
- SHA-256 du CSV original :
  `b02181e808c384ff4d713d46c584977ef4feada4509e72d5351d6a2fc29d6379`

## Format

Un seul tableau de nombres, quatre par maille, mailles triées par `LAMBX` puis
`LAMBY` :

1. `LAMBX` : abscisse du centre, Lambert II étendu, en hectomètres ;
2. `LAMBY` : ordonnée du centre, mêmes unités ;
3. latitude du centre, degrés WGS84, quatre décimales ;
4. longitude du centre, mêmes unités.

`LAMBX` et `LAMBY` sont repris tels quels : ce sont les deux premières colonnes
des fichiers quotidiens `QUOT_SIM2_*.csv.gz`, donc la clé de lecture de
`src/lib/agroclimat/safran.ts`. Les coordonnées géographiques, publiées avec
cinq décimales et une virgule, sont arrondies à quatre (11 m).

Le fichier n'est lu que côté serveur (`grille-safran.ts`).
