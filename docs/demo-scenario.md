# Compte démo Gleba — « Ferme du Bois Joli » (scénario v2, 2026-07-20)

> Fiche scénario pour démos commerciales, captures marketing et tests prospects.
> Toutes les données de `demo@gleba.fr` doivent rester cohérentes avec ce document.
> **Le scénario est l'autorité ; le code (`prisma/seed-demo.ts`) est l'implémentation.**

Refonte v2 : jeu de données **complet et evergreen** couvrant tous les modules ayant
évolué (plan 2D vivant, caprin laitier pro P20-P27, comptabilité régime réel + TVA +
factures + FEC). Remplace le scénario figé « au 14 mai » devenu obsolète et pollué par
les tests utilisateurs.

---

## Principe evergreen (dates relatives)

Le seed **ne fige aucune date en dur**. Tout est calculé par rapport à la **date de
reseed** (`now`) :

- **Année courante `Y`** = année de reseed. Campagne de l'année en cours, activité
  **YTD (1er janvier → aujourd'hui)** : un visiteur voit toujours une ferme vivante.
- **Historique `Y-1`** = année complète précédente (synthèses mensuelles) pour alimenter
  les comparatifs N/N-1 des tableaux de bord.
- Le **cycle** cultural reste agronomiquement juste (semis → +6 sem. plantation →
  +8 sem. récolte) ; seule l'ancre calendaire suit `now`. Rejouer le seed suffit à
  « rafraîchir » la démo — c'est la réponse durable à l'obsolescence.

Conséquence : les chiffres exacts (CA, kg récoltés) **dépendent du jour de reseed**.
Les cibles ci-dessous sont des ordres de grandeur pour un reseed en pleine saison.

---

## Identité

| Champ | Valeur |
|---|---|
| **Ferme** | Ferme du Bois Joli |
| **Exploitants** | Camille & Thomas Lefèvre |
| **Localisation** | La Boissière-de-Montaigu, Vendée (85600) |
| **Installation** | ~6 saisons (polyculture-élevage bio) |
| **Forme juridique** | EARL |
| **Régime** | **Réel simplifié agricole**, **assujettie TVA** (réel simplifié) |
| **SIRET / SIREN** | `40483304800006` / `404833048` (fictifs mais **Luhn-valides** pour FEC) |
| **TVA intracom.** | `FR83404833048` |
| **Certification** | AB — Ecocert FR-BIO-01 |
| **Compte** | `demo@gleba.fr` / `demo2026` |
| **Modules actifs** | maraîchage, verger, élevage, comptabilité (+ boutique) |

---

## Surfaces (5 parcelles, toutes AB)

| Parcelle | Surface | Usage | Couches |
|---|---|---|---|
| Demo-A · Serre | 200 m² (0,02 ha) | Cultures abritées (tomate, aubergine, poivron, basilic, salades hâtives) | `MARAICHAGE` |
| Demo-B · Plein champ | 800 m² (0,08 ha) | Racines & plein vent (carotte, oignon, courge, haricot, PDT) | `MARAICHAGE` |
| Demo-C · Tunnel maraîcher | 200 m² (0,02 ha) | Mi-saison (concombre, salade, radis, mâche) | `MARAICHAGE` |
| Demo-V · Verger | 800 m² (0,08 ha) | ~20 fruitiers diversifiés | `VERGER` |
| Demo-P · Pâture | 4 000 m² (0,4 ha) | Brebis + chèvres, pâturage tournant | `PATURAGE`, `ELEVAGE` |

Planches : **A1-A3** (serre 8×1,2), **B1-B6** (plein champ 25×1,2), **C1-C4** (tunnel 10×1,2).
Rotations globales assignées : A→`Rotation-4ans-A`, B→`Rotation-4ans-B`, C→`Rotation-3ans-Courges`.
Surface cultivée courante ≈ **1 200 m²** (A+B+C) — identique sur Calendrier / Planification / Cultures.

---

## Maraîchage (campagne `Y`, YTD)

~20 cultures réparties en trois états, toujours vivantes quel que soit le jour de reseed :

- **Récoltées** (terminées, `recolteFaite`) : radis, épinard, laitue de printemps, fève, petit pois.
- **En cours de récolte** (centrées sur `now`) : tomate, aubergine, poivron, concombre, courgette, carotte, oignon, haricot vert, pomme de terre, basilic.
- **À venir** : courge butternut/potimarron, poireau, chou, haricot sec, mâche.

Chaque culture porte `especeId` + `varieteId` **nommée** (jamais « — Non spécifiée ») + `itpId`
(pour la croissance du plan 2D vivant) + `aIrriguer` sur les espèces exigeantes. Étalement
présent (référentiel) → rendu à l'échelle sur le plan.

Récoltes : mix `en_stock` / `vendu` (avec `prixKg`+`prixTotal`+`dateVente`). Les récoltes
vendues génèrent une VenteManuelle « auto » (voir Comptabilité).

---

## Verger (Demo-V)

~20 arbres **plantés en années passées** (2018-2023, verger établi → aucun achat n'impacte
la compta de `Y`) : Pommier (Reine des Reinettes, Golden), Poirier (Williams, Conférence),
Prunier (Mirabelle, Reine-Claude), Cerisier (Burlat, Napoléon), Figuier (Brown Turkey),
Noyer (Franquette). `envergureAdulte` renseignée (projection houppier), `etat`, `formeTaille`.

- **Récoltes fruits** `Y` : cerises (juin), premières prunes (juillet) — vendues (dont facture).
- **Opérations** : tailles d'hiver (janv-fév), traitement bio bouillie bordelaise (printemps) → dépenses auto.
- **Observation sanitaire** : tavelure Pommier Golden, gravité moyenne, traitement cuivre **saisi
  canoniquement** (`produit` + `methodeTraitement`) pour le registre phyto.

---

## Élevage — vitrine complète (dont caprin laitier pro)

| Lot / animaux | Espèce | Effectif | Détail |
|---|---|---|---|
| Pondeuses `Y` | Poule Marans | ~30 | Arrivée janv. `Y` (poulettes) — **seul achat animal de l'année** |
| Solognote | Brebis Solognote | ~15 | Troupeau viande, arrivé années passées |
| Agnelles | Brebis Solognote | ~10 | Renouvellement |
| Chèvres laitières | Chèvre Alpine | 4 (individuelles) | **Cœur de la vitrine caprine** |
| Gascons | Cochon Gascon | 2 | Engraissement |
| Lapins | Géant des Flandres | 6 F + 1 M | Mises-bas |

**Poules** : `ProductionOeuf` hebdomadaire sur ~18 mois (tendance) ; ventes œufs mensuelles (VenteProduit type `oeufs`).

**Caprin laitier pro (P20-P27)** — les 4 Alpines (Bergère, Clochette, Vanille, Praline) rattachées au lot laitier :

- **Reproduction (P23/P24)** : `Saillie` reliée à une `CampagneReproduction` (« Lutte automne `Y-1` — désaisonnement »), mise-bas → `NaissanceAnimale`, tarissement prévu. Une chèvre en **`lactationLongue`** (ne plus suggérer le tarissement).
- **Lactation en cours** : `CollecteLait` biquotidienne (matin/soir) de la mise-bas (~5 mois avant `now`) à aujourd'hui → courbe 305 j, palmarès des chèvres.
- **Qualité / cellules (P20)** : analyses ~mensuelles (MG/MP/cellules). Clochette et Vanille en **alerte cellules** (mammite subclinique) pour démontrer l'alerte.
- **Alimentation / ration (P25)** : `Aliment` avec valeurs INRA (UFL/PDIN/PDIE/UEL) — foin de prairie + granulés chèvre ; `ConsommationAliment` mensuelle sur le lot → dépenses auto.
- **Fromagerie (P27)** : 3 `LotFromage` (Tomme, Crottin, Bûche cendrée) numérotés `L-Y-Www-NN`, DLC/DLUO, agrément, traçabilité lait→lot→vente.
- **Sanitaire** : `SoinAnimal` (vermifuge, parage, prophylaxie) avec coûts → dépenses auto.

**Ventes élevage** : fromages, lait cru, œufs → `VenteProduit` (dont une facture restaurant + une cantine).

---

## Comptabilité — régime réel simplifié + TVA + factures + FEC

**Modèle monétaire (contrat SSOT, cf. `src/lib/kpi/compta.ts`)** :

- **Revenus** = Σ `VenteManuelle.montant` + Σ `Facture.totalTTC` (non annulées).
- **Dépenses** = Σ `DepenseManuelle.montant`.
- Chaque vente issue d'un autre module (récolte, vente produit, récolte arbre) produit une
  VenteManuelle **`auto`** miroir (mapping `src/lib/auto-compta.ts`), SAUF si elle est
  **facturée** (alors comptée via la `Facture`, pas d'écriture auto).
- La ventilation par module (écran Rapports) lit les tables sources ; le **contrôle de
  cohérence** SSOT ↔ somme des modules doit rester à 0 (aucun bandeau d'alerte).

**TVA** : produits alimentaires **5,5 %**, services/bois **10 %**, matériel/véto **20 %**.
Chaque écriture respecte **TTC = HT + TVA au centime** → export **FEC équilibré** (débit = crédit).

**Factures B2B** (~4) : restaurant, épicerie bio, cantine — adossées 1:1 à une vente source
(`factureId` posé, pas d'écriture auto). Mix payée / émise. Numérotation continue `F-Y-0001…`.

**Répartition CA `Y` (ordre de grandeur, ferme bio 1,5 ha)** : ~55 % maraîchage (AMAP + marché),
~20 % élevage (fromages/lait/œufs), ~10 % verger, ~15 % boutique + divers. Dépenses ~50-60 % du CA.

**Historique `Y-1`** : synthèses mensuelles VenteManuelle + DepenseManuelle → comparatif N-1.

---

## Boutique en ligne

Boutique « Ferme du Bois Joli » (slug `ferme-du-bois-joli`), ~8-10 produits (paniers AMAP &
découverte, œufs, fromages, confitures, légumes à l'unité), ~15 commandes réparties sur `Y`
(livrées + quelques en préparation/nouvelles). Chaque commande **livrée** → `VenteManuelle`
(module `boutique`) remontant en compta. Les commandes non livrées sont comptées à part
(compteur), pas en revenus.

---

## Règles d'invariance (vérifiées à chaque rebuild)

| # | Invariant | Pourquoi |
|---|---|---|
| 1 | Surface ~1 200 m² identique Calendrier / Planification / Cultures | cohérence maraîchage |
| 2 | CA identique Accueil / Rapports / Coûts (SSOT `getKpiCompta`) | bug récurrent A4 |
| 3 | **coherenceCheck = 0** (aucun bandeau d'incohérence compta) | contrat SSOT ↔ modules |
| 4 | Export FEC **équilibré** (débit = crédit) + SIRET/SIREN valides | régime réel |
| 5 | Année active = `Y` partout ; historique `Y-1` présent pour N-1 | evergreen |
| 6 | 0 variété `— Non spécifiée`, 0 nom de test (`Test-Bug`, `cc`, `Fff`…) | dé-pollution |
| 7 | 0 culture orpheline (sans planche), 0 rotation sur 0 planche | intégrité |
| 8 | Boutique : commandes livrées ⇒ CA compta ; non livrées = compteur | chaîne câblée |
| 9 | Achats arbres en années passées (verger établi) ⇒ pas de fuite compta `Y` | cohérence |
| 10 | Caprin : lait/collectes/cellules/palmarès/fromagerie/économie tous peuplés | vitrine pro |

---

## Workflow de reset

```bash
# 1. Purge exhaustive des données métier du compte démo (cascade contrôlée)
npx tsx prisma/reset-demo.ts
# 2. Rejoue le scénario complet, evergreen (ancré à la date du jour)
npx tsx prisma/seed-demo.ts
# 3. Vérification : npx tsx prisma/verify-demo.ts (invariants + cohérence + FEC)
```

Pour toute évolution du scénario, **modifier ce document AVANT** de toucher `prisma/seed-demo.ts`.
