# Processus de révision agronomique

Le référentiel ITP (Itinéraires Techniques Précis) et les calendriers
d'entretien Verger contiennent des données agronomiques qui doivent rester
**vérifiables, datées et traçables**. Toute proposition de modification doit
suivre le processus ci-dessous.

## Quand ouvrir une révision

- Une donnée d'ITP (semaine de semis/plantation/récolte, durée, densité, nb
  rangs, espacement, dose, mode de démarrage) est suspecte ou contredite
  par une source de référence.
- Le calendrier Verger d'une espèce contient une opération à une période
  agronomiquement incohérente (taille hivernale sur Prunus, par exemple).
- Une famille botanique est mal renseignée (cf. cas du Tournesol classé
  Apiaceae au lieu d'Asteraceae).

## Comment proposer une révision

1. **Branche dédiée** : `feat/agronomic-<scope>` (ex. `feat/agronomic-ail`).
2. **Source citée** : indiquer dans le message de PR la source
   bibliographique exacte : MSV, J.-M. Fortier (Le jardinier-maraîcher),
   INRAE, ITAB, CTIFL, etc. Pas de "source : web" ou "source : ChatGPT".
3. **Migration SQL séparée** dans `prisma/migrations/<timestamp>_<scope>/`.
   Renseigner les colonnes :
   - `commentaire_agronome` : entrée datée avec la justification courte.
   - `source_reference`     : nom + édition + page si applicable.
   - `derniere_revision`    : `NOW()`.
4. **Export CSV avant / après** : regénérer `audit/itp-current.csv` via
   `npx tsx scripts/export-itp.ts > audit/itp-current.csv` et commiter le
   diff. Ça permet à n'importe qui de relire l'impact sans ouvrir la base.
5. **PR taguée** :
   - `needs-agronomic-review` (obligatoire).
   - Marquer la PR en **draft** tant qu'aucun mainteneur agronome n'a validé.
6. **Revue** : un mainteneur identifié comme agronome référent (cf.
   `CODEOWNERS` ou le fichier `MAINTAINERS.md` s'il existe) doit approuver
   avant merge. À défaut, deux relecteurs non-agronomes consultent au moins
   deux sources convergentes.

## Anti-patterns à éviter

- Modifier un ITP **sans** mettre à jour `derniere_revision` et
  `commentaire_agronome` : la donnée devient impossible à auditer plus tard.
- Mélanger plusieurs cultures différentes dans une seule migration (sauf
  audit massif explicitement nommé `itp_agronomic_fixes_<vague>`).
- Réintroduire une valeur précédemment corrigée sans citer une nouvelle
  source.

## Hiérarchie des sources

Du plus fiable au moins :

1. INRAE, ITAB, CTIFL (publications scientifiques ou techniques).
2. J.-M. Fortier — *Le jardinier-maraîcher* (référence MSV maraîchage).
3. Manuels MSV / agroécologie reconnus (Bourguignon, Coleman, Bonfils…).
4. Catalogues semenciers (Bingenheimer, Essembio, Kokopelli) pour les
   variétés.
5. **Jamais** : forums, blogs sans source, IA générative.

## Champs structurés disponibles

Le modèle `ITP` (cf. `prisma/schema.prisma`) expose désormais :

| Champ                  | Rôle                                              |
|------------------------|---------------------------------------------------|
| `mode_demarrage`       | Plein champ / Sous abri / Pépinière               |
| `type_planche`         | Plein champ / Sous abri (où grandit la culture)   |
| `commentaire_agronome` | Notes datées des révisions successives            |
| `source_reference`     | Référence bibliographique                         |
| `derniere_revision`    | Timestamp de la dernière revue d'agronome         |

Le modèle `Variete` expose en plus `unifere_bifere` pour les figuiers, à
renseigner sur les variétés bifères afin de déclencher la taille bifère
post-récolte d'été (cf. `src/lib/tree-care-calendar.ts`).
