# Compte démo Gleba — « Ferme du Bois Joli » (scénario v3, 2026-11-03)

> Fiche scénario pour les démonstrations, les captures et les visiteurs.
> Toutes les données de `demo@gleba.fr` doivent rester cohérentes avec ce document.
> **Le scénario est l'autorité ; le code (`prisma/seed-demo.ts` et `prisma/demo/`) est l'implémentation.**

La v3 remplace la v2 (2026-07-26). Celle-ci posait toutes les dates par
rapport au jour du reseed (« récolte dans 5 jours ») : relancée en novembre,
elle montrait des tomates plantées en août en pleine récolte. Les écritures
étaient faites à la main, si bien qu'une partie des écrans (déclarations
d'élevage, cave, banque, stock d'œufs) ne correspondait à aucune saisie
possible dans l'application.

---

## Principes

1. **Calendrier réel.** Chaque culture, mise-bas, miellée ou récolte de fruits
   tombe à sa vraie date de saison en Vendée (zone océanique). Seul son
   **état** dépend du jour du reseed : un jalon passé est fait, une fenêtre de
   récolte close est terminée, rien n'est jamais « fait » dans le futur.
2. **Deux saisons d'historique.** L'année en cours `Y` (du 1er janvier à
   aujourd'hui) et l'année `Y-1` complète, générées de la même façon, plus les
   cultures d'hiver de `Y-2` récoltées en `Y-1`. Les comparatifs N/N-1 sont
   donc réels, avec une ferme qui progresse d'environ 10 %.
3. **Mêmes écritures que l'application.** Le seed appelle les fonctions de
   `src/lib` partout où elles existent : dates des itinéraires
   (`datesDepuisItp`), récoltes (`ecrireRecoltesPreparees`), miroirs
   comptables (`src/lib/auto-compta.ts`), récoltes, ventes et transformations
   du verger, calendrier d'entretien des arbres, règlements, documents
   commerciaux, commandes de la boutique. Un écran du compte démo montre donc
   un état qu'un utilisateur aurait pu atteindre.
4. **Un accueil calme et crédible.** Le jour du reseed : quelques actions de
   la semaine, aucun retard, aucune ligne « Urgent », aucune déclaration hors
   délai, des KPI cohérents entre l'accueil, la comptabilité et les modules.
5. **Identifiants fictifs vérifiés.** SIREN, SIRET et TVA sont valides
   (Luhn, clé TVA) mais **vérifiés non attribués** dans l'annuaire des
   entreprises ; banque fictive (code 19999) ; numéro EDE sur une commune
   inexistante (85999) ; téléphones dans la plage que l'ARCEP réserve à la
   fiction (02 61 91, 06 39 98) ; courriels en `example.com`, `.org`.
   Les anciens numéros « fictifs » de la v2 appartenaient à de vraies
   entreprises : ne jamais reprendre un identifiant sans le vérifier.

---

## Identité

| Champ | Valeur |
|---|---|
| **Ferme** | EARL Ferme du Bois Joli (capital 7 500 €) |
| **Exploitants** | Camille et Thomas Lefèvre (personnages fictifs) |
| **Localisation** | Le Bois Joli, 85600 La Boissière-de-Montaigu (Vendée) |
| **Régime** | Réel simplifié agricole, assujettie à la TVA (réel simplifié) |
| **SIREN / SIRET** | `012223996` / `01222399600013` |
| **TVA intracommunautaire** | `FR83012223996` |
| **Numéro EDE** | `85999001` |
| **Certification** | AB, Ecocert FR-BIO-01 |
| **Compte** | `demo@gleba.fr` (mot de passe : constante de `prisma/seed-demo.ts`) |
| **Modules actifs** | maraîchage, verger, élevage, comptabilité, boutique |
| **Ateliers d'élevage** | rente, chiens et chats, équins, NAC |

Clients : AMAP du Bois Joli (type `amap`), Restaurant La Table du Bocage,
Épicerie Bio du Bocage, Cantine scolaire du SIVU du Bocage, quelques
particuliers. Tous fictifs.

---

## Terrain et plan (`prisma/demo/terrain.ts`)

Repère du plan : mètres, x vers l'est, y vers le sud, origine au coin
nord-ouest. Les polygones des parcelles reprennent ce repère converti en
coordonnées : la carte et le plan montrent la même ferme.

| Parcelle | Surface | Contenu |
|---|---|---|
| Verger | 0,08 ha | 16 fruitiers, rucher de 6 ruches |
| Serre | 0,02 ha | serre froide de 96 m², 3 planches de 10 m |
| Tunnel | 0,04 ha | tunnel 8 × 25 m, 4 planches de 23 m, compostage |
| Plein champ | 0,17 ha | 16 planches de 40 m |
| Pâture du Grand Pré | 0,34 ha | chèvrerie, poulailler, paddocks |
| Prairie de fauche | 0,90 ha | foin autoproduit |

Objets : haies, allées, chemin d'exploitation, serre, tunnel, récupérateur
d'eau, compost, mare, hangar et chambre froide, clôture, chèvrerie,
poulailler, rucher. Aucun fond de plan : le rendu par défaut (herbe, grille)
reste propre et n'expose aucune photo aérienne réelle.

---

## Maraîchage (`prisma/demo/maraichage.ts`)

- **Rotations du référentiel commun** sur onze planches de plein champ :
  `Rotation-4ans-A` (B1-B4), `Rotation-3ans-Courges` (B5-B7), `Potager`
  (B8-B11). `Planche.annee` est recalculé à chaque reseed pour que chaque
  planche soit à la même étape l'année en cours ; elle y porte l'itinéraire de
  l'étape. Le hub Planification affiche donc « Plan prêt ».
- **Successions** hors familles de rotation (mâche, épinard, courgette,
  carotte de garde, phacélie) ; planches hors rotation pour les poireaux,
  les choux d'hiver, l'ail, l'échalote, les pommes de terre et les fèves.
- **Serre et tunnel** : tomates, aubergines, poivrons, basilic, concombres,
  courgettes, laitues, radis, petits pois, épinards et mâche d'hiver.
- Dates des itinéraires Gleba dérivées par l'application (calage océanique),
  dates INRAE choisies dans leur fenêtre d'implantation : **aucune alerte de
  saison** (contrôlé à chaque reseed) et aucun chevauchement sur une planche.
- **Récoltes** hebdomadaires sur la fenêtre de chaque culture, vendues à
  l'AMAP (chèque) ou au marché du samedi (espèces) : chaque vente porte son
  miroir comptable, et les marges par culture sont alimentées. Les légumes
  de garde restent en partie en stock pour l'hiver et les bons de livraison.
- Arrosages notés la veille sous abri, fumures de la ferme (fumier de mouton
  et de poules, lombricompost), interventions tracées (dont un traitement
  conforme au registre phyto), analyses de sol, stock de semences.

Ordres de grandeur : environ 3,8 t récoltées et 18 k€ de légumes par an.

## Verger (`prisma/demo/verger.ts`)

16 fruitiers plantés de `Y-8` à `Y-5` : pommiers (Reine des Reinettes,
Golden Delicious, Belle de Boskoop), poiriers (Williams, Conférence),
pruniers (Mirabelle de Nancy, Reine Claude Dorée), cerisiers (Burlat,
Napoléon), figuier, noyers. Pollinisations croisées, calendrier d'entretien
de l'application sur deux saisons (passé fait, à venir planifié), tavelure et
pucerons observés puis résolus, récoltes à la semaine de chaque variété,
ventes directes réglées, pommes de garde en stock, jus de pomme (pressoir
d'octobre) et confiture de mirabelle, bois d'élagage des noyers.

## Élevage (`prisma/demo/elevage.ts`)

Chèvres alpines laitières (cœur de la vitrine : deux groupes de mises-bas
pour du lait toute l'année, contrôles qualité, fromagerie, cave, ventes),
brebis Solognote (agnelage de printemps, agneaux vendus à l'automne),
cochons gascons, poules Marans (ponte quotidienne, ventes en FIFO), lapins,
rucher. Déclarations d'entrée et de sortie transmises puis acceptées, registre
complet, statuts sanitaires, soins tracés avec leurs produits et délais.

## Chiens et chats, équins, NAC (`prisma/demo/compagnie.ts`)

Nala et Oslo (golden retrievers) avec une portée de cinq chiots et des
réservations, Plume et Moka (maine coon), Étoile et Sirocco (équidés),
Pixel, Noisette et Kiwi (NAC). Identifiants au format exigé par
l'application, aucun achat sur l'année.

## Commerce, comptabilité et banque (`prisma/demo/commerce*.ts`, `banque.ts`)

Boutique en ligne (commandes passées par le vrai cycle de l'application),
devis, bons de livraison et factures adossés aux stocks réels, avoir, charges
d'une EARL au réel (MSA, fermage, aliments, semences, énergie…), compte
bancaire avec opérations rapprochées. Marge annuelle visée : 30 à 40 %.

---

## Règles d'invariance (contrôlées par `prisma/verify-demo.ts`)

| # | Invariant |
|---|---|
| 1 | Aucune alerte de saison, aucun chevauchement sur une planche |
| 2 | « Plan prêt » : aucune culture de rotation à créer ni étape non suivie |
| 3 | CA identique sur l'accueil, les rapports et les modules ; FEC équilibré |
| 4 | Aucune ligne « Urgent » sur l'accueil le jour du reseed |
| 5 | Aucune déclaration d'élevage hors délai ou à compléter |
| 6 | Aucun jalon fait dans le futur, aucune vente ni dépense datée après aujourd'hui |
| 7 | Aucun nom de test, aucun identifiant réel (SIREN, téléphone, courriel) |
| 8 | Préférence `modesElevage` = compagnie, équin, NAC |

---

## Remise à zéro et reconstruction

```bash
npx tsx prisma/reset-demo.ts    # purge toutes les tables rattachées au compte (schéma réel)
npx tsx prisma/seed-demo.ts     # reconstruit la ferme, ancrée au jour
npx tsx prisma/verify-demo.ts   # invariants
```

- `reset-demo.ts` part du schéma : toute table avec une colonne `user_id` est
  purgée pour le compte démo, sauf les signalements, les retours et les
  mesures d'audience. `RESET_DEMO_SIMULATION=1` compte sans rien effacer.
- Les fichiers du compte (fonds de plan, envois, justificatifs, registres)
  vivent dans les volumes du conteneur : la procédure de production les
  archive puis les efface à part.
- `DEMO_EMAIL_OVERRIDE` vise un autre compte ; `DEMO_MODULES=terrain,verger`
  ne joue qu'une partie ; `DEMO_DATE=AAAA-MM-JJ` simule un autre jour (base
  d'essai seulement).
- Pour toute évolution du scénario, modifier ce document AVANT le code.
