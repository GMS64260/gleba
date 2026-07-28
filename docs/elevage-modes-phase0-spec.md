# Élevage — Modes d'élevage (compagnie / équin / NAC) — Spécification Phase 0

> Statut : proposition, prête à coder. Rédigé le 2026-07-24.
> Origine : demande client (élevage canin/félin, cf. WeBreed) + cadrage produit
> « module optionnel activable en Paramètres » (chien, chat, chevaux, cochon, dinde, NAC).
> Contexte et analyse : voir la note vault `Projets/gleba/Produit.md`.

## 1. Objectif et parti-pris

Permettre à un utilisateur d'activer, depuis **Paramètres**, un ou plusieurs **modes d'élevage** qui débloquent des familles d'espèces et adaptent l'UI, **sans dupliquer** le module Élevage. La Phase 0 est le **socle activateur** : elle rend l'existant (fiches, soins/vaccins/rappels, saillies/gestation, portées, généalogie, factures) utilisable proprement pour un chien/chat/cheval, et **règle le mélange des listes** multi-espèces.

Parti-pris structurant : introduire une dimension **`filière`** portée par l'espèce.

- `rente` — bétail/volaille/lapins existants (**défaut, toujours actif**).
- `compagnie` — chiens, chats (et NAC de compagnie).
- `equin` — chevaux, ânes (régime SIRE/IFCE distinct — d'où sa propre filière).
- `nac` — nouveaux animaux de compagnie (furets, rongeurs, oiseaux d'ornement, reptiles…).

La filière est **orthogonale** à `EspeceAnimale.type` (morphologie) et à `categorieReglementaire`. C'est elle qui pilote l'UI conditionnelle et le regroupement des listes.

### Dans le périmètre Phase 0
- Case(s) à cocher « Modes d'élevage » en Paramètres (réutilise le mécanisme `modulesActifs`).
- Champ `filiere` sur `EspeceAnimale` + jeu d'espèces `compagnie`/`equin`/`nac` au référentiel Gleba.
- Taxonomie d'espèce : `production` devient facultative pour les filières non-`rente` ; params de repro (gestation chien ≈ 63 j, chat ≈ 65 j, jument ≈ 340 j).
- Regroupement des listes Animaux/Lots par **atelier** (voir §4) au lieu d'une liste à plat.
- UI conditionnelle : masquer les colonnes/onglets/KPI de rente (lait, ponte, tarissement, abattage, cellules) pour un animal de filière compagnie/équin/NAC, et présenter un **dashboard adapté**.
- Vocabulaire : « mise-bas » reste générique ; libellés d'onglets neutres.

### Hors périmètre (Phases 1-2, listées pour cadrer)
- Identité I-CAD / affixe, numéro de portée, déclarations SCC/LOOF. → **Phase 1**
- Réservations / liste d'attente / acompte. → **Phase 1**
- Documents légaux : contrat de réservation, certificat d'engagement (+ délai 7 j), attestation de cession, certificat vétérinaire. → **Phase 1**
- Tests santé/génétiques cotés (dysplasie A-E, coude 0-3, panels ADN), cotation, pedigree LOF/LOOF PDF, COI % + simulateur d'accouplement. → **Phase 2**

## 2. Activation en Paramètres (réutilise l'existant)

Aucune nouvelle API : `/api/user/preferences` accepte déjà des clés arbitraires (`PUT { key: value }`).

- **Nouvelle préférence** : clé `modesElevage`, valeur = JSON `string[]` parmi `["compagnie","equin","nac"]` (les modes *optionnels* ; `rente` est implicite et toujours actif). Défaut = `[]`.
- **`src/lib/elevage-modes.ts`** (miroir de `src/lib/modules.ts`) :
  ```ts
  export const ELEVAGE_MODES = {
    compagnie: { id: "compagnie", label: "Chiens & chats", description: "Élevage canin/félin : portées, généalogie, carnet de santé, cession", filieres: ["compagnie"] },
    equin:     { id: "equin",     label: "Équins",         description: "Chevaux, ânes : suivi SIRE, reproduction, soins", filieres: ["equin"] },
    nac:       { id: "nac",       label: "NAC",            description: "Nouveaux animaux de compagnie : furets, rongeurs, oiseaux, reptiles", filieres: ["nac"] },
  } as const
  export type ElevageModeId = keyof typeof ELEVAGE_MODES
  export const ELEVAGE_MODE_IDS: ElevageModeId[] = ["compagnie", "equin", "nac"]
  export function sanitizeModesElevage(input: unknown): ElevageModeId[] { /* cf. sanitizeModulesActifs */ }
  ```
- **`src/hooks/use-elevage-modes.ts`** : calqué sur `use-modules.ts` (lecture/écriture `modesElevage`, optimistic update).
- **UI** : nouveau composant `ElevageModesSection` (calqué sur `ModulesSection`) rendu dans `src/app/parametres/page.tsx`, **affiché uniquement si le module `elevage` est actif**. Un `Switch` par mode. Copie explicite : « Active des familles d'animaux supplémentaires et adapte les écrans Élevage. »
- **Effet** : les modes actifs déterminent (a) quelles filières d'espèces sont proposées au référentiel, (b) quels onglets/colonnes/dashboards s'affichent. Un mode désactivé **n'efface aucune donnée** ; il masque simplement (cohérent avec la règle `modulesActifs` : « restent accessibles par URL »).

## 3. Schéma Prisma (migration additive)

Migration `prisma/migrations/20260725xxxxxx_elevage_filieres/` (additive, cf. convention `Technique`).

```prisma
model EspeceAnimale {
  // …existant…
  filiere String @default("rente") @map("filiere") // 'rente' | 'compagnie' | 'equin' | 'nac'
  @@index([filiere])
}
```

- **Backfill** : `UPDATE especes_animales SET filiere='rente'` (toutes les espèces existantes = rente). Les espèces `equin` existantes du catalogue (Chevaux) passent à `filiere='equin'` par une clause ciblée.
- **`production` facultative pour non-rente** : pas de changement de colonne (déjà `String`, non-null avec défaut applicatif). En pratique, la validation `elevage-espece` rend `production` optionnelle si `filiere != 'rente'` et accepte une valeur `compagnie` neutre. Décision : ajouter `'compagnie'` à l'enum applicatif de `production` plutôt que de rendre la colonne nullable (migration plus légère, pas de NULL à gérer partout).

### Regroupement : atelier

Deux options, livrables dans l'ordre :

- **0.a (défaut, zéro setup)** : « atelier automatique » = regroupement calculé `filière → espèce`. Aucune table. La liste Animaux/Lots s'affiche en sections repliables (une par espèce, groupées par filière). Règle immédiatement le mélange vu sur le compte démo (chèvres + cochons entrelacés).
- **0.b (optionnel, nommage utilisateur)** : entité additive `Atelier` pour les libellés maison (« Chenil de la Source », « Troupeau laitier »), demandée par le client.
  ```prisma
  model Atelier {
    id        String   @id @default(cuid())
    userId    String   @map("user_id")
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    nom       String   @map("nom")
    filiere   String   @map("filiere")
    couleur   String?  @map("couleur")
    ordre     Int      @default(0) @map("ordre")
    createdAt DateTime @default(now()) @map("created_at")
    @@index([userId])
    @@map("ateliers")
  }
  // + Animal.atelierId Int?  et  LotAnimaux.atelierId Int?  (FK SetNull, additifs)
  ```
  Rattachement **facultatif** : un animal/lot sans atelier retombe sur l'atelier automatique 0.a. Pas de migration de données obligatoire.

**Recommandation** : livrer 0.a d'abord (impact maximal, coût minimal), 0.b ensuite si le besoin de nommage est confirmé.

## 4. UI conditionnelle par filière

L'affichage d'un animal (fiche, colonnes de liste, onglets, dashboard) dépend de la **filière de son espèce**. Helper central `src/lib/elevage/filiere-ui.ts` exposant `capacites(filiere)` → flags booléens consommés par les composants.

| Surface | `rente` (inchangé) | `compagnie` / `equin` / `nac` |
|---|---|---|
| Liste Animaux — colonnes | Espèce, Race, Sexe, Lot, **Poids** | Espèce, Race, Sexe, **Atelier**, Puce/ID, Âge (poids optionnel) |
| Onglet **Production** | visible (lait/œufs/viande) | **masqué** (pas de production de rente) |
| Onglet **Alimentation** — délais d'attente lait/viande | visible | **masqué** (pas de délai denrées) |
| Onglet **Reproduction** | Saillies + colonne **Tarissement** | Saillies **sans** tarissement ; « portée » au lieu de « mise-bas » optionnel |
| **Soins** | tous types (dont Parage, Tonte, Tarissement) | types recentrés (Vaccination, Vermifuge, Antiparasitaire, Chirurgie, Puçage…) |
| **Dashboard** | KPI lait/œufs/abattages | **variante** : nb portées, petits en cours, vaccinations/rappels dus, sevrages à venir |
| **Économie / atelier** | marges par atelier (existant) | idem, revenu = ventes d'animaux |

Principe : **masquer, pas supprimer**. Le socle repro/soins/généalogie/pesées reste le même code, seules les surfaces de rente disparaissent.

### Dashboard compagnie/équin (variante)
Nouveau composant `DashboardCompagnie` (ou branche conditionnelle dans `DashboardTab`) : bandeau « Aujourd'hui » (rappels vaccins/vermifuges dus, portées attendues via `Saillie.dateMiseBasAttendue`, sevrages), KPI = effectif par atelier, portées de l'année, petits vivants, ventes. Réutilise `/api/elevage/agenda` (déjà agrégateur d'échéances) et `/api/elevage/stats` (à étendre d'un `profil.filiere`).

## 5. Référentiel espèces (EspecesTab)

- Ajouter le filtre de filière au-dessus du filtre de type ; n'exposer que les filières dont le **mode est actif** (+ `rente` toujours).
- Formulaire d'espèce : champ **Filière** ; si `filiere != rente`, masquer les champs de rente (ponte, rendement carcasse, conso/jour) et afficher les champs pertinents (gestation, taille de portée moyenne, âge de maturité).
- **Seed Gleba** (`filiere` renseignée) — contenu dans `src/lib/elevage/catalogue-compagnie.ts` (module partagé et testé), écrit par `prisma/seed-especes-compagnie.ts` puis `prisma/seed-races-compagnie.ts`. **29 espèces / 410 races** :
  - *compagnie* : Chien, Chat ;
  - *équin* : Cheval, Poney, Âne, Mulet/Bardot ;
  - *nac* : Furet, Lapin nain, Cochon d'Inde, Hamster, Rat, Souris, Gerbille, Chinchilla, Octodon, Cochon nain, Perruche, Calopsitte, Inséparable, Perroquet, Canari, Diamant mandarin, Tortue terrestre, Gecko léopard, Gecko à crête, Agame barbu, Serpent des blés, Python royal, Axolotl.
- **Races/variétés** via `RaceAnimale` (`origine`, `aptitudes`, `description`) : races LOF/LOOF/SIRE pour chien/chat/équins, variétés et morphs pour les NAC — le niveau que l'éleveur saisit réellement sur une fiche. `description` porte les mentions réglementaires utiles (catégories 1/2 canines, CITES, déclaration EDE du cochon nain) et les alertes de sélection (morphs létaux/à handicap). L'utilisateur complète ; le référentiel communautaire existant s'applique.
- **Cloisonnement des seeds** : `prisma/seed-races.ts` (rente) ne traite plus que `filiere='rente'`. Sans ce filtre sa déduction par mots-clés contaminait le catalogue NAC (« Cochon d'Inde » → races porcines, constaté en base et nettoyé).

## 6. Séparation des listes (AnimauxTab)

- `AnimauxTab` charge déjà espèces + lots ; ajouter le regroupement par atelier automatique (§3.0.a) : sections `filière → espèce`, chacune repliable, avec compteur.
- Conserver le filtre espèce existant (compat deep-links / alias d'URL).
- Sur mobile : mêmes sections, cartes existantes (`lg:hidden`).

## 7. Backfill, rollout, non-régression

1. Migration additive appliquée ; backfill `filiere='rente'` pour tout l'existant → **comportement identique** pour les comptes actuels (aucun mode optionnel actif par défaut).
2. `modesElevage` absent = `[]` = UI de rente inchangée. Zéro impact tant qu'un mode n'est pas coché.
3. Activer un mode = les familles d'espèces apparaissent au référentiel + les surfaces s'adaptent pour ces animaux uniquement.
4. Désactiver = masquage sans perte.

## 8. Tests à ajouter
- `elevage-modes` : sanitize/round-trip de la préférence, au moins `rente` toujours effectif.
- `filiere-ui` : `capacites(filiere)` retourne les bons flags (rente vs compagnie).
- Régression `EspecesTab`/`AnimauxTab` : un compte sans mode optionnel voit exactement l'UI actuelle (snapshot des colonnes).
- Repro : `dateMiseBasAttendue` calculée pour une espèce `compagnie` (gestation 63 j) ; absence de tarissement.
- Stats : `profil.filiere` exposé ; dashboard compagnie ne réclame pas de KPI lait.

## 9. Effort & risques

- **Effort** : ~2-4 semaines dev pour 0.a (préférence + filière + seed + UI conditionnelle + regroupement) ; +~1 semaine pour 0.b (entité `Atelier` + rattachement + gestion). Taille **L**, essentiellement du câblage conditionnel sur du code existant, peu de logique neuve.
- **Risques** :
  - *Surcharge d'UI* (deux modèles mentaux) → mitigé par le masquage strict piloté par `capacites(filiere)` et les principes Produit (états vides explicites).
  - *Régression comptes de rente* → garde-fou : défaut `rente` + `modesElevage=[]`, snapshots de non-régression.
  - *Fuite de surfaces de rente* dans un atelier compagnie (délais d'attente, cellules) → checklist §4 à couvrir par tests.
  - *Attentes réglementaires* : la Phase 0 ne prétend **pas** couvrir I-CAD/LOF/documents ; à communiquer pour ne pas laisser croire à une conformité canine complète dès l'activation.

## 10. Enchaînement
Phase 0 (ce document) → Phase 1 (identité I-CAD/affixe, portées, réservations, documents de cession + délai 7 j) → Phase 2 (tests santé cotés, cotation, pedigree PDF, COI + simulateur). Voir la note vault `Produit.md`.
