# Tests d’intégration PostgreSQL

`TEST_DATABASE_URL=… node scripts/tests-integration.mjs` lance les fichiers
présents correspondant à `src/**/*.integration.test.ts`,
`src/**/integration.test.ts` (nom historique de la caisse) et
`src/**/*.postgres.test.ts` (occupation des planches, désactivation des
associations). Aucun inventaire de fichiers privés n’est nécessaire au dépôt public.
La base doit être migrée avant le lancement ; le script ne crée ni ne réinitialise
aucune base. Il refuse une `TEST_DATABASE_URL` absente ou différente d’une base
PostgreSQL locale (`localhost` ou `127.0.0.1`) nommée exactement `gleba_tests`.

Le script fixe `DATABASE_URL=TEST_DATABASE_URL`, `CAISSE_TEST_DB=oui` et
`TZ=Europe/Paris`. Vitest exécute les fichiers successivement dans un seul thread,
avec 30 secondes par test et par hook. Les options Vitest supplémentaires sont
transmises, par exemple `--reporter=json --outputFile=/chemin/preuve.json`.
Le singleton Prisma global est déconnecté et effacé entre les fichiers : les
espions posés sur ses délégués proxy ne doivent pas contaminer une autre suite.
Les gardes propres aux suites restent actives. La suite unitaire `npm test`
continue d’ignorer les tests PostgreSQL sans leurs variables d’activation.

La CI (`base-neuve`, étape « Integration tests on the shared PostgreSQL base ») crée et migre
`gleba_tests`, puis appelle ce script ; elle exécute ensuite l’attente lait sur
sa base dédiée. Avant le 2026-11-19, la CI ne lançait que l’attente lait et les
suites `*.postgres.test.ts` dépendaient d’une variable définie nulle part : elles
n’avaient jamais tourné. Aucun accès externe ni donnée réelle n’est requis.

Le rejeu sous fuseau UTC (`scripts/test-tz.mjs`) n’est branché ni en CI ni dans
un script npm : il se lance à la main.

## Suites ignorées sur la base commune

Ces suites sont découvertes par les globs, mais restent ignorées sans leur
variable dédiée. Ne pas faire pointer ces variables vers `gleba_tests` : leurs
gardes de nom refusent volontairement cette substitution. Avant un rejeu dédié,
créer et migrer la base correspondante, puis utiliser `DATABASE_URL` identique
à la variable indiquée et lancer Vitest directement sous `lourd`.

| Suite (sous `src/lib/`) | Condition d’activation et garde | Raison du maintien hors base commune |
| --- | --- | --- |
| `elevage/__tests__/attente-lait.integration.test.ts` | `GLEBA_ATTENTE_LAIT_QA_DATABASE_URL`, base `gleba_attente_lait_qa_<6 hex>` | Banc historique isolé du SQL lait ; exécuté séparément en CI. |
| `elevage/__tests__/chaine-kpi.integration.test.ts` | `GLEBA_ELEVAGE_QA_DATABASE_URL`, base `gleba_reglements_qa_<lettres/chiffres/underscores>` | Parcours élevage/comptabilité avec horloge figée et fixtures spécifiques. |
| `comptabilite/__tests__/reglements.integration.test.ts` | `GLEBA_BANQUE_QA_DATABASE_URL`, base `gleba_reglements_qa_banque_20261027_<6 hex>` | Banc dédié aux règlements, rapprochements et simulations Stripe. Fichier éventuellement absent du public. |
| `capteurs/postgres.integration.test.ts` | `CAPTEURS_TEST_DATABASE_URL=DATABASE_URL`, hôte `127.0.0.1`, base `gleba_capteurs_regression` | Agrégation/purge et contrôle des séquences sur un banc isolé. |
| `verger/__tests__/parcours.integration.test.ts` | `GLEBA_VERGER_QA_DATABASE_URL=DATABASE_URL`, base `gleba_verger_qa_corrige_20261028_<8 hex>` | Parcours complet exigeant une base QA dédiée. |
| `verger/__tests__/six-points.integration.test.ts` | Même variable et même garde que le parcours verger | Contre-vérification sur les fixtures du banc verger dédié. |
| `verger/__tests__/transformation.integration.test.ts` | Même variable et même garde que le parcours verger | Transformations et stocks sur le banc verger dédié. |
| `verger/__tests__/raccords.integration.test.ts` | `GLEBA_VERGER_RACCORDS_QA_DATABASE_URL=DATABASE_URL`, base `gleba_verger_qa_raccords_<8 hex>` | Raccords entre modules sur un banc synthétique distinct. |
| `../app/api/associations/migration-famille.postgres.test.ts` | `DATABASE_URL` vers une base `gleba_jetable_*` | Rejoue un SQL qui nettoie le référentiel global des associations. |
| `../app/api/associations/desactivation.postgres.test.ts` (bloc « base peuplée ») | `GLEBA_PR73_REFERENTIEL_PEUPLE=1` et base `gleba_jetable_*` | Exige le référentiel d’associations de production chargé. |
| `verger/__tests__/suivi-commercial.integration.test.ts` | `GLEBA_VERGER_BL_QA_DATABASE_URL=DATABASE_URL`, base `gleba_verger_bl_qa_20261028_<8 hex>` | Documents commerciaux et stocks sur un banc distinct. |

Les suites de caisse présentes dans l’arbre privé sont activées par
`CAISSE_TEST_DB=oui` et gardées par `baseTestCaisseAcceptee` : en local, elles
acceptent notamment la base du banc d’équipe `gleba_tests`, rôle `banc`, port
55434. Elles sont absentes de la CI publique ; l’activation ne contourne pas
leur garde fermée. Les suites DAR, boutique/reprise, cultures, session et
traçabilité compatibles avec `gleba_tests` sont activées par les deux URL
identiques. Les suites utilisant `estBaseTestJetable` acceptent aussi les noms
`gleba_tests_<suffixe>` ; le lanceur commun reste volontairement sur le nom exact,
compatible avec toutes les autres gardes.

La suite DOM `socle-clavier-palette-taches.test.ts` n’a plus de condition
facultative : `jsdom` et `@testing-library/dom` sont des devDependencies ; une
installation incomplète doit faire échouer le test plutôt que masquer sa recette.

## Dépendances DOM dans la livraison publique

`package.json` est une surcharge privée : la livraison publique doit reporter
uniquement le script `test:integration` et les deux devDependencies nécessaires
au socle DOM, `@testing-library/dom: ^10.4.1` et `jsdom: ^26.1.0`, dans le manifeste
public. Ne pas publier le manifeste privé complet. Le verrou public contient déjà
ces deux dépendances ; leur présence dans le verrou seul ne les fait pas installer
par `npm ci` si le manifeste les omet.

Vérifier ce report dans un arbre public avec une installation neuve (`npm ci
--legacy-peer-deps` comme en CI), puis lancer
`npm test -- src/components/__tests__/socle-clavier-palette-taches.test.ts
--pool=threads --poolOptions.threads.singleThread`. Les quatre tests doivent
passer sans ignorer de suite. Les `node_modules` partagés ne prouvent pas que les
dépendances sont installées par le manifeste public.
