# Compte démo Gleba — « Ferme du Bois Joli »

> Fiche scénario pour démos commerciales, captures marketing et tests utilisateurs.
> Toutes les données de l'utilisateur `demo@gleba.fr` doivent rester cohérentes avec ce document.

---

## Identité fictive

| Champ | Valeur |
|---|---|
| **Nom de la ferme** | Ferme du Bois Joli |
| **Exploitants** | Camille & Thomas Lefèvre |
| **Localisation** | La Boissière-de-Montaigu, Vendée (85) |
| **Installation** | 2022 (5e saison en 2026) |
| **Statut juridique** | EARL micro-BA, exonérée TVA (régime art. 293 B) |
| **Surface totale** | 1,5 ha (cadastrale) |
| **Modèle économique** | AMAP hebdomadaire (12 paniers/sem) · Marché du samedi (Montaigu) · Boutique en ligne |
| **Compte démo** | `demo@gleba.fr` / `demo2026` |

---

## Découpage des surfaces

| Parcelle | Surface | Usage | Couches d'activité |
|---|---|---|---|
| Demo-A — Serre | 200 m² | Cultures abritées (tomate, aubergine, basilic, salades hâtives) | `MARAICHAGE` |
| Demo-B — Plein champ | 800 m² | Légumes racines et de plein vent (carotte, oignon, courge, haricot, pomme de terre) | `MARAICHAGE` |
| Demo-C — Tunnel | 200 m² | Mi-saison (fraise, salade, concombre, mâche) | `MARAICHAGE` |
| Demo-V — Verger | 800 m² | 20 arbres fruitiers diversifiés + haie bocagère 30 m | `VERGER` |
| Demo-E — Bâtiments & enclos | 200 m² | Poulailler + chèvrerie + porcherie | `ELEVAGE` |
| Demo-P — Pâture | 4 000 m² | Brebis Solognote, rotation chèvres | `PATURAGE`, `ELEVAGE` |

Total cultivé en 2026 (KPI surface) : **1 200 m²** (Demo-A + Demo-B + Demo-C). Cette valeur doit apparaître à l'identique sur :

- Maraîchage › Calendrier (carte « Surface cultivée »)
- Maraîchage › Planification (carte « Surface planifiée »)
- Maraîchage › Cultures (somme des `surface` des cultures actives)

---

## Cheptel

| Lot | Espèce | Effectif | Race | Démarrage |
|---|---|---|---|---|
| Pondeuses 2026 | Poule | 30 | Marans noir cuivré | 2026-01-15 (poulettes 18 sem.) |
| Solognote 2025 | Brebis | 15 | Solognote | 2025-04-10 (gardées pour reproduction) |
| Alpines lait | Chèvre | 4 (animaux individuels) | Alpine chamoisée | 2024-06-20 |
| Gascons | Cochon | 2 (animaux individuels) | Gascon | 2026-02-05 |
| (Lapins) | Lapin | 6 femelles + 1 mâle | Géant des Flandres | 2026-03-01 |

**Production attendue 2026 (au 14 mai, S20) :**

- 1 250 œufs collectés YTD (taux de ponte ~ 35 % cohérent avec hiver vendéen)
- 60 L lait de chèvre / semaine — tarir une des 4 chèvres fin août pour la rotation
- 0 abattage Solognote en 2026 (toutes en reproduction, vente prévue agneaux en juin)
- 4 mises-bas lapines simulées (12 lapereaux nés à terme)

---

## Verger

20 arbres fruitiers répartis sur Demo-V :

| Variété | Quantité | Porte-greffe | Plantation | Note |
|---|---|---|---|---|
| Pommier Reine des Reinettes | 5 | M106 | 2022 | Production 2026 attendue : ~ 80 kg/arbre |
| Pommier Golden | 4 | MM106 | 2022 | Tavelure observée — gravité moyenne sur 1 arbre |
| Poirier Williams | 3 | Cognassier BA29 | 2023 | Première récolte 2026 |
| Prunier Mirabelle | 3 | Saint-Julien A | 2023 | |
| Cerisier Burlat | 2 | Sainte-Lucie | 2024 | Récolte mi-juin |
| Figuier Brown Turkey | 1 | Franc | 2022 | |
| Noyer Franquette | 2 | Franc | 2022 | |

**Haie bocagère** : 30 m linéaires (cornouiller, noisetier, charme, sureau, prunellier).

**Observations 2026 :**

- S2-S6 : 3 opérations de taille (Pommier x3, Poirier x1)
- S14 : 1 observation sanitaire — tavelure Pommier Golden, gravité moyenne
- 8 traitements bio (bouillie bordelaise + huile blanche) programmés sur la saison

**Récoltes** : 0 kg au 14 mai (saison non commencée — cerises à partir de mi-juin).

---

## Maraîchage — état au 14 mai 2026 (S20)

| Indicateur | Valeur cible |
|---|---|
| Cultures actives | 18 |
| Cultures à semer/planter sous 4 semaines | 12 |
| Récoltes en cours (S18-S20) | 4 (radis, salade beurre, épinard, fève) |
| Cumul récolté YTD | ~ 85 kg |
| Surface utilisée | 1 200 m² (identique sur tous les écrans) |

Variétés représentatives (à piocher dans le référentiel existant) :

- Tomate : Saint-Pierre, Coeur de Bœuf, Pineapple
- Salade : Reine de Mai, Batavia Reine des Glaces, Mâche Verte de Cambrai
- Radis : 18 jours, Rave de Pâques
- Carotte : Nantaise, Touchon, Chantenay
- Oignon : Mulhouse, Stuttgart
- Courge : Butternut, Potimarron, Spaghetti
- Aubergine : Violetta di Firenze
- Concombre : Marketmore
- Haricot : Cargo, Cobra
- Pomme de terre : Charlotte, Bintje

Toutes les variétés DOIVENT avoir un nom non-vide. **Pas de variété `-`, pas de doublon `Nantaise` / `-Nantaise`, pas de culture orpheline (sans planche), pas d'arbre fantôme planche 54.**

---

## Comptabilité — état au 14 mai 2026

| Indicateur | Valeur cible |
|---|---|
| CA YTD | ~ 8 400 € |
| Répartition CA | 60 % AMAP (5 040 €), 25 % marché (2 100 €), 15 % boutique en ligne (1 260 €) |
| Dépenses YTD | ~ 3 100 € |
| Principales dépenses | Semences (450 €), aliment poules (380 €), gasoil (280 €), MSA (1 200 €), assurance (290 €), divers (500 €) |
| Marge brute YTD | ~ 5 300 € |
| Régime TVA | Non applicable (art. 293 B) — aucune ligne TVA |
| Numérotation factures | Continue (F-2026-001, F-2026-002, …) — PAS de saut |

**Le CA doit être strictement identique** sur les écrans suivants :

- Comptabilité › Accueil (KPI haut)
- Comptabilité › Rapports (graphique annuel)
- Comptabilité › Coûts de production (sous-total par espèce)

---

## Boutique en ligne

- 14 commandes passées en 2026
- 3 commandes en cours de préparation (statut `EN_PREPARATION`)
- Panier moyen : 42 €
- CA boutique YTD : 588 € (soit ~ 7 % du CA total, cohérent avec le mix Compta)
- Catalogue : 8 produits actifs (paniers AMAP, panier découverte, œufs, miel, confitures, herbes aromatiques)

Les 14 commandes doivent générer des `VenteManuelle` (ou équivalent) qui remontent dans Compta › CA boutique en ligne.

---

## Règles d'invariance

Ces invariants doivent être **vérifiés à chaque rebuild du seed** :

| # | Invariant | Pourquoi |
|---|---|---|
| 1 | Surface 1 200 m² identique sur Calendrier, Planification, Cultures | Bug récurrent A1 |
| 2 | CA YTD identique sur Accueil, Rapports, Coûts | Bug récurrent A4 |
| 3 | Lot « Pondeuses 2026 » (pas 2024) | Bug audit AP |
| 4 | Année active = 2026 partout dans l'UI | Bug audit AP |
| 5 | 0 variété nommée `-`, 0 doublon | Bug A1 |
| 6 | 0 culture orpheline (sans planche assignée) | Bug A1 |
| 7 | 0 rotation associée à 0 planche | Bug A1 |
| 8 | Boutique 14 cmd ⇒ Compta inclut leur CA | Bug A4 / chaîne câblée |
| 9 | Pas d'arbre référencé sur planche 54 fantôme | Bug A5 |
| 10 | Pas de % de variation N/N-1 absurde (>500 %) en accueil | Bug audit AP |

---

## Workflow de reset

```bash
# 1. Wipe les données du compte démo (cascade contrôlée)
npx tsx prisma/reset-demo.ts

# 2. Rejouer le seed du scénario
npx tsx prisma/seed-demo.ts

# 3. Vérification manuelle UI sur les 7 écrans clés :
#    - Maraîchage › Calendrier
#    - Maraîchage › Planification
#    - Maraîchage › Cultures
#    - Verger › Calendrier
#    - Verger › Arbres
#    - Élevage › Dashboard
#    - Comptabilité › Accueil + Rapports
```

---

## Personne-ressource

Pour toute évolution du scénario (changement de campagne, ajout de gamme, etc.), modifier ce document **AVANT** de toucher `prisma/seed-demo.ts`. Le scénario est l'autorité, le code est l'implémentation.
