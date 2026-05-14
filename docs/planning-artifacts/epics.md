---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - docs/planning-artifacts/prd.md
  - docs/architecture.md
---

# Gleba - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Gleba, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

#### Gestion des Parcelles
- **FR1:** L'utilisateur peut creer une parcelle en dessinant un contour GeoJSON avec un nom et des couches d'activite assignables
- **FR2:** L'utilisateur peut modifier les proprietes d'une parcelle (nom, couches, contour)
- **FR3:** L'utilisateur peut supprimer une parcelle
- **FR4:** Le systeme calcule automatiquement la surface d'une parcelle a partir de son contour GeoJSON
- **FR5:** L'utilisateur peut attribuer des couches d'activite a une parcelle (maraichage, verger, elevage, paturage)
- **FR6:** L'utilisateur peut rattacher des planches existantes a une parcelle
- **FR7:** L'utilisateur peut rattacher des arbres existants a une parcelle
- **FR8:** L'utilisateur peut rattacher un lot d'animaux a une parcelle
- **FR9:** L'utilisateur peut deplacer un lot d'animaux d'une parcelle a une autre avec historique de deplacement
- **FR10:** L'utilisateur peut consulter l'historique des deplacements de lots par parcelle

#### Carte Globale
- **FR11:** L'utilisateur peut visualiser toutes ses parcelles sur une carte interactive
- **FR12:** L'utilisateur peut activer/desactiver des couches d'activite sur la carte (maraichage, verger, elevage)
- **FR13:** L'utilisateur peut naviguer depuis une parcelle sur la carte vers les cultures, arbres ou lots qu'elle contient
- **FR14:** L'utilisateur peut dessiner de nouvelles parcelles directement sur la carte
- **FR15:** L'utilisateur peut acceder au plan 2D jardin depuis une parcelle maraichage sur la carte
- **FR16:** Le systeme synchronise en temps reel les modifications de parcelles entre utilisateurs connectes simultanement

#### Comptabilite Unifiee
- **FR17:** Le systeme genere automatiquement une ecriture comptable pour chaque evenement de vente (recolte maraichage, recolte arbre, vente oeufs, vente produit elevage, production bois, abattage)
- **FR18:** L'utilisateur peut visualiser l'ensemble de ses revenus et depenses dans une vue unifiee tous modules confondus
- **FR19:** L'utilisateur peut enregistrer une auto-consommation comme mouvement interne (pas de vente, pas de revenu)
- **FR20:** Le systeme maintient les ecritures comptables auto-generees synchronisees avec leurs evenements sources (modification/suppression cascade)
- **FR21:** L'utilisateur peut consulter le cout de revient par culture/production

#### Facturation & Conformite
- **FR22:** Le systeme genere des factures avec numerotation legale (F-YYYY-NNNN) a partir des ventes
- **FR23:** L'utilisateur peut exporter ses parcelles au format Telepac (PAC)
- **FR24:** L'utilisateur peut consulter le registre de tracabilite phytosanitaire (interventions avec numAMM, DAR, doses)
- **FR25:** Le systeme calcule les declarations TVA selon les 3 taux (5.5%, 10%, 20%)

#### Integrations Externes
- **FR26:** L'utilisateur peut synchroniser ses ventes avec Cagette.net (publication disponibilites, remontee commandes)
- **FR27:** Le systeme expose les nouvelles entites (parcelles, transactions) via des outils MCP
- **FR28:** Les outils MCP existants (39) continuent de fonctionner sans regression
- **FR29:** Un agent IA peut effectuer des requetes transversales sur le modele unifie (parcelles + cultures + elevage + compta)

#### Calendrier & Taches
- **FR30:** L'utilisateur peut visualiser un calendrier unifie multi-modules (semis, plantations, recoltes, soins, operations verger, irrigations)
- **FR31:** L'utilisateur peut filtrer le calendrier par type d'activite (maraichage, verger, elevage)
- **FR32:** L'utilisateur peut consulter un dashboard "ma journee" regroupant les taches de tous les modules par parcelle
- **FR33:** Le systeme genere automatiquement des taches a partir des ITPs, cycles elevage et calendriers verger

#### Administration & Multi-tenancy
- **FR34:** L'admin peut gerer les referentiels globaux (especes, varietes, ITPs, aliments, fertilisants)
- **FR35:** Le systeme filtre toutes les donnees metier par userId (multi-tenancy)
- **FR36:** L'admin peut consulter les logs de connexion et metriques systeme
- **FR37:** Le systeme separe architecturalement le code open source (AGPL) du code proprietary (IA, ITPs)

#### PWA & Accessibilite
- **FR38:** L'utilisateur peut installer l'application comme PWA sur son appareil
- **FR39:** L'application fonctionne en mode desktop-first avec responsive tablette et mobile

### NonFunctional Requirements

#### Performance
- **NFR1:** Les actions utilisateur (navigation, saisie, enregistrement) completent en moins de 1 seconde
- **NFR2:** La carte multi-couches avec 50+ parcelles se charge en moins de 3 secondes
- **NFR3:** Le First Contentful Paint est inferieur a 2 secondes
- **NFR4:** Les ecritures comptables auto-generees sont creees en moins de 500ms apres l'evenement source
- **NFR5:** Le build Docker de production complete en moins de 5 minutes

#### Securite
- **NFR6:** Toutes les donnees metier sont filtrees par userId — aucun utilisateur ne peut acceder aux donnees d'un autre
- **NFR7:** Les mots de passe sont hashes avec bcrypt — jamais stockes en clair
- **NFR8:** Les sessions utilisent JWT avec expiration geree par NextAuth
- **NFR9:** Les routes API sensibles sont protegees par rate limiting
- **NFR10:** Le code proprietary (couche IA, ITPs) est separe du code AGPL dans des repositories distincts a terme
- **NFR11:** L'API MCP utilise un bearer token separe pour l'authentification
- **NFR12:** Les objets Prisma incluant le modele User ne retournent jamais le hash du mot de passe au client

#### Integration
- **NFR13:** Les outils MCP repondent en moins de 2 secondes par appel
- **NFR14:** L'integration Cagette.net tolere les indisponibilites du service externe (retry + fallback gracieux)
- **NFR15:** L'export Telepac genere un fichier conforme au format attendu par la plateforme PAC

#### Fiabilite
- **NFR16:** Zero regression : chaque phase deployee passe la checklist de verification (build, curl endpoints, logs) avant d'etre consideree stable
- **NFR17:** Les migrations BDD sont non-destructives — les FK optionnelles permettent un rollback sans perte de donnees
- **NFR18:** Les operations comptables (ventes, factures, ecritures auto) utilisent des transactions Prisma atomiques

#### Maintenabilite
- **NFR19:** Le code respecte les conventions existantes : TypeScript strict, path alias `@/`, validations Zod, composants Shadcn/UI
- **NFR20:** Chaque nouvelle entite (Parcelle, transactions) est documentee dans le schema Prisma et exposee via les outils MCP

### Additional Requirements

#### Exigences techniques issues de l'Architecture

- **Projet brownfield** : pas de starter template — evolution du systeme existant en production
- **Modele Prisma `Parcelle`** a creer avec contour GeoJSON, surface auto-calculee, couches d'activite, et FK optionnelles vers Planche, Arbre, LotAnimaux
- **PostGIS 3.4** deja installe — utiliser les fonctions spatiales natives (ST_Area, ST_Within, etc.)
- **Migration BDD non-destructive** : FK optionnelles (`parcelleId?`) pour livraisons incrementales
- **Multi-tenancy** : champ `userId` obligatoire sur Parcelle, coherent avec les 51 modeles existants
- **Auto-compta existante** (`auto-compta.ts`) : etendre le pattern `sourceType/sourceId` au modele de transaction unifie
- **Pattern API existant** : routes dans `src/app/api/`, validation Zod, `requireAuthApi()`, reponse JSON
- **Leaflet + React-Leaflet** deja integres : utiliser pour la carte parcellaire (couches IGN/OSM/satellite existantes)
- **Outils MCP** : 39 outils existants a preserver, nouveaux outils pour Parcelle et transactions
- **Caddy reverse proxy** : aucune modification requise (proxifie deja le port 3000)
- **Docker multi-stage** : build standalone Next.js, cache `.next/` a supprimer avant rebuild
- **Composants Shadcn/UI + Radix UI** : respecter le design system existant pour les nouvelles UI
- **TanStack React Table** : utiliser pour les nouveaux tableaux (coherence avec existant)
- **NextAuth v5** avec JWT : authentification deja en place, pas de modification requise
- **Rate limiting** existant sur les API sensibles
- **Separation Open Core** : code IA dans `src/lib/chat/` et `mcp-server/` — ne pas mixer avec le code AGPL

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Creer une parcelle avec contour GeoJSON, nom et couches d'activite |
| FR2 | Epic 1 | Modifier les proprietes d'une parcelle |
| FR3 | Epic 1 | Supprimer une parcelle |
| FR4 | Epic 1 | Calcul automatique de la surface depuis le contour GeoJSON |
| FR5 | Epic 1 | Attribuer des couches d'activite a une parcelle |
| FR6 | Epic 1 | Rattacher des planches existantes a une parcelle |
| FR7 | Epic 1 | Rattacher des arbres existants a une parcelle |
| FR8 | Epic 1 | Rattacher un lot d'animaux a une parcelle |
| FR9 | Epic 1 | Deplacer un lot d'animaux entre parcelles avec historique |
| FR10 | Epic 1 | Consulter l'historique des deplacements de lots par parcelle |
| FR11 | Epic 3 | Visualiser toutes les parcelles sur une carte interactive |
| FR12 | Epic 3 | Activer/desactiver des couches d'activite sur la carte |
| FR13 | Epic 3 | Naviguer depuis une parcelle vers les entites qu'elle contient |
| FR14 | Epic 3 | Dessiner de nouvelles parcelles directement sur la carte |
| FR15 | Epic 3 | Acceder au plan 2D jardin depuis une parcelle maraichage |
| FR16 | Epic 3 | Synchronisation temps reel des modifications entre utilisateurs |
| FR17 | Epic 2 | Auto-generation d'ecritures comptables pour chaque vente |
| FR18 | Epic 2 | Vue unifiee revenus et depenses tous modules confondus |
| FR19 | Epic 2 | Enregistrer une auto-consommation comme mouvement interne |
| FR20 | Epic 2 | Synchronisation ecritures auto avec evenements sources |
| FR21 | Epic 2 | Cout de revient par culture/production |
| FR22 | Epic 4 | Factures avec numerotation legale F-YYYY-NNNN |
| FR23 | Epic 4 | Export parcelles au format Telepac (PAC) |
| FR24 | Epic 4 | Registre tracabilite phytosanitaire |
| FR25 | Epic 4 | Declarations TVA selon 3 taux |
| FR26 | Epic 6 | Synchronisation ventes avec Cagette.net |
| FR27 | Epic 6 | Nouveaux outils MCP pour parcelles et transactions |
| FR28 | Epic 6 | Outils MCP existants (39) sans regression |
| FR29 | Epic 6 | Requetes IA transversales sur modele unifie |
| FR30 | Epic 5 | Calendrier unifie multi-modules |
| FR31 | Epic 5 | Filtrer le calendrier par type d'activite |
| FR32 | Epic 5 | Dashboard "ma journee" par parcelle |
| FR33 | Epic 5 | Generation automatique de taches depuis ITPs/cycles |
| FR34 | Epic 7 | Gestion des referentiels globaux |
| FR35 | Epic 7 | Filtrage multi-tenancy par userId |
| FR36 | Epic 7 | Logs de connexion et metriques systeme |
| FR37 | Epic 7 | Separation architecturale AGPL / proprietary |
| FR38 | Epic 7 | Application installable en PWA |
| FR39 | Epic 7 | Desktop-first avec responsive tablette et mobile |

## Epic List

### Epic 1 : Organisation spatiale de la ferme
L'utilisateur peut structurer sa ferme en parcelles georeferenciees et y rattacher ses planches, arbres et lots d'animaux pour unifier la vision spatiale de l'exploitation.
**FRs couverts :** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10

### Epic 2 : Comptabilite transversale automatisee
Chaque evenement de vente (recolte, oeufs, bois, abattage) genere automatiquement les ecritures comptables. L'utilisateur visualise revenus et depenses dans une vue unifiee tous modules confondus.
**FRs couverts :** FR17, FR18, FR19, FR20, FR21

### Epic 3 : Carte globale multi-couches
L'utilisateur visualise toutes ses parcelles sur une carte interactive avec des couches d'activite activables, dessine de nouvelles parcelles, et navigue directement vers les entites qu'elles contiennent.
**FRs couverts :** FR11, FR12, FR13, FR14, FR15, FR16

### Epic 4 : Facturation & Conformite reglementaire
L'utilisateur genere des factures legales, exporte ses parcelles au format Telepac pour la PAC, consulte la tracabilite phytosanitaire et calcule ses declarations TVA.
**FRs couverts :** FR22, FR23, FR24, FR25

### Epic 5 : Calendrier unifie & Pilotage quotidien
L'utilisateur consulte un calendrier unique regroupant tous les modules (semis, soins, verger, elevage) et un dashboard "ma journee" avec les taches auto-generees par parcelle.
**FRs couverts :** FR30, FR31, FR32, FR33

### Epic 6 : Integrations externes & IA transversale
L'utilisateur synchronise ses ventes avec Cagette.net, les nouvelles entites sont exposees via MCP, et l'agent IA peut raisonner sur l'ensemble du modele unifie.
**FRs couverts :** FR26, FR27, FR28, FR29

### Epic 7 : Administration, Multi-tenancy & PWA
L'admin gere les referentiels globaux, consulte les logs et metriques, le code open/proprietaire est separe architecturalement, et l'application est installable en PWA responsive.
**FRs couverts :** FR34, FR35, FR36, FR37, FR38, FR39

---

## Epic 1 : Organisation spatiale de la ferme

L'utilisateur peut structurer sa ferme en parcelles georeferenciees et y rattacher ses planches, arbres et lots d'animaux pour unifier la vision spatiale de l'exploitation.

### Story 1.1 : Modele Parcelle et API CRUD

As a utilisateur de Gleba,
I want creer, modifier et supprimer des parcelles avec un contour GeoJSON, un nom et des couches d'activite,
So that je puisse structurer spatialement mon exploitation et organiser mes activites par zone.

**Acceptance Criteria:**

**Given** l'utilisateur est connecte et accede a l'API parcelles
**When** il envoie un POST /api/parcelles avec un nom, un contour GeoJSON valide et des couches d'activite
**Then** une parcelle est creee avec le userId de la session, la surface est calculee automatiquement a partir du contour GeoJSON via PostGIS (ST_Area), et la parcelle est retournee avec son id et sa surface
**And** le contour est stocke en GeoJSON (type Polygon) et les couches sont un tableau de valeurs parmi [MARAICHAGE, VERGER, ELEVAGE, PATURAGE]

**Given** une parcelle existante appartenant a l'utilisateur
**When** il envoie un PUT /api/parcelles/[id] avec des proprietes modifiees (nom, contour, couches)
**Then** la parcelle est mise a jour, la surface est recalculee si le contour a change, et la parcelle mise a jour est retournee

**Given** une parcelle existante appartenant a l'utilisateur
**When** il envoie un DELETE /api/parcelles/[id]
**Then** la parcelle est supprimee et les FK optionnelles parcelleId sur Planche, Arbre et LotAnimaux rattaches sont mises a null

**Given** un utilisateur A et un utilisateur B
**When** l'utilisateur A liste ses parcelles via GET /api/parcelles
**Then** seules les parcelles avec userId = A sont retournees (multi-tenancy)

**Given** un contour GeoJSON invalide (moins de 3 points, polygon non ferme)
**When** l'utilisateur tente de creer une parcelle
**Then** la validation Zod rejette la requete avec un message d'erreur explicite

**Technical Notes:**
- Modele Prisma `Parcelle` : id, nom, contour (Json), surface (Float, auto-calcule), couches (enum array CoucheActivite), userId (FK User), timestamps
- Migration non-destructive : ajout champ optionnel `parcelleId` sur Planche, Arbre, LotAnimaux
- Validation Zod dans `src/lib/validations/parcelle.ts`
- Routes API : `src/app/api/parcelles/route.ts` et `src/app/api/parcelles/[id]/route.ts`
- Calcul surface via raw SQL PostGIS : `SELECT ST_Area(ST_GeomFromGeoJSON($1)::geography)`

### Story 1.2 : Page de gestion des parcelles

As a utilisateur de Gleba,
I want visualiser la liste de mes parcelles et pouvoir en creer, modifier et supprimer depuis une interface,
So that je puisse gerer mes parcelles sans passer par l'API directement.

**Acceptance Criteria:**

**Given** l'utilisateur est connecte et navigue vers /parcelles
**When** la page se charge
**Then** un tableau liste toutes ses parcelles avec colonnes : nom, surface (m²), couches d'activite, nombre d'entites rattachees, et actions (modifier, supprimer)

**Given** l'utilisateur clique sur "Nouvelle parcelle"
**When** le formulaire de creation s'affiche
**Then** il peut saisir un nom, selectionner des couches d'activite (checkboxes multi-select), et dessiner un contour sur une mini-carte Leaflet
**And** la surface calculee s'affiche en temps reel apres le dessin du contour

**Given** l'utilisateur clique sur "Modifier" sur une parcelle existante
**When** le formulaire d'edition s'affiche
**Then** les champs sont pre-remplis avec les donnees actuelles, le contour est affiche sur la mini-carte et modifiable

**Given** l'utilisateur clique sur "Supprimer" une parcelle
**When** il confirme la suppression
**Then** la parcelle est supprimee et disparait de la liste

**Given** l'utilisateur est sur mobile ou tablette
**When** la page /parcelles se charge
**Then** le tableau est responsive (cards sur mobile, tableau sur desktop)

**Technical Notes:**
- Page : `src/app/parcelles/page.tsx` (client component)
- Composant mini-carte Leaflet pour le dessin de contour (Leaflet Draw)
- Design Shadcn/UI + TanStack Table coherent avec les pages existantes
- Navigation ajoutee dans le menu principal

### Story 1.3 : Rattachement des planches aux parcelles

As a utilisateur de Gleba,
I want rattacher mes planches existantes a une parcelle,
So that je puisse voir quelles planches appartiennent a quelle zone de mon exploitation.

**Acceptance Criteria:**

**Given** l'utilisateur edite une planche existante (page /planches/[id] ou formulaire planche)
**When** il voit le champ "Parcelle" (select optionnel)
**Then** il peut choisir parmi ses parcelles existantes ou laisser vide

**Given** l'utilisateur selectionne une parcelle et sauvegarde la planche
**When** la requete PUT /api/planches/[id] est envoyee avec parcelleId
**Then** la planche est mise a jour avec le parcelleId et la parcelle est retournee dans les donnees de la planche

**Given** l'utilisateur consulte la page d'une parcelle
**When** la section "Planches rattachees" s'affiche
**Then** toutes les planches avec parcelleId = cette parcelle sont listees avec liens vers leurs pages respectives

**Given** l'utilisateur retire le rattachement (select vide) et sauvegarde
**When** la requete est envoyee avec parcelleId = null
**Then** la planche n'est plus rattachee a aucune parcelle

**Technical Notes:**
- Ajout select Parcelle dans le formulaire planche existant
- Ajout section "Planches" dans la page parcelle /parcelles/[id]
- API planches modifiee pour accepter parcelleId optionnel

### Story 1.4 : Rattachement des arbres aux parcelles

As a utilisateur de Gleba,
I want rattacher mes arbres existants a une parcelle,
So that je puisse organiser mon verger spatialement par zone.

**Acceptance Criteria:**

**Given** l'utilisateur edite un arbre existant (page /arbres ou formulaire arbre)
**When** il voit le champ "Parcelle" (select optionnel)
**Then** il peut choisir parmi ses parcelles existantes ou laisser vide

**Given** l'utilisateur selectionne une parcelle et sauvegarde l'arbre
**When** la requete PUT est envoyee avec parcelleId
**Then** l'arbre est mis a jour avec le parcelleId

**Given** l'utilisateur consulte la page d'une parcelle
**When** la section "Arbres rattaches" s'affiche
**Then** tous les arbres avec parcelleId = cette parcelle sont listes avec espece, variete et lien vers la page arbre

**Given** l'utilisateur retire le rattachement et sauvegarde
**When** la requete est envoyee avec parcelleId = null
**Then** l'arbre n'est plus rattache a aucune parcelle

**Technical Notes:**
- Ajout select Parcelle dans le formulaire arbre existant
- Ajout section "Arbres" dans la page parcelle /parcelles/[id]
- API arbres modifiee pour accepter parcelleId optionnel

### Story 1.5 : Rattachement des lots d'animaux aux parcelles

As a utilisateur de Gleba,
I want rattacher mes lots d'animaux a une parcelle,
So that je puisse savoir ou se trouvent mes animaux sur l'exploitation.

**Acceptance Criteria:**

**Given** l'utilisateur edite un lot d'animaux existant
**When** il voit le champ "Parcelle" (select optionnel)
**Then** il peut choisir parmi ses parcelles existantes ou laisser vide

**Given** l'utilisateur selectionne une parcelle et sauvegarde le lot
**When** la requete PUT est envoyee avec parcelleId
**Then** le lot est mis a jour avec le parcelleId

**Given** l'utilisateur consulte la page d'une parcelle
**When** la section "Lots d'animaux" s'affiche
**Then** tous les lots avec parcelleId = cette parcelle sont listes avec espece, effectif et lien vers la page lot

**Given** l'utilisateur retire le rattachement et sauvegarde
**When** la requete est envoyee avec parcelleId = null
**Then** le lot n'est plus rattache a aucune parcelle

**Technical Notes:**
- Ajout select Parcelle dans le formulaire lot existant
- Ajout section "Lots d'animaux" dans la page parcelle /parcelles/[id]
- API lots modifiee pour accepter parcelleId optionnel

### Story 1.6 : Deplacement de lots entre parcelles avec historique

As a utilisateur de Gleba,
I want deplacer un lot d'animaux d'une parcelle a une autre et consulter l'historique des deplacements,
So that je puisse suivre la rotation de paturage et savoir ou etaient mes animaux a chaque moment.

**Acceptance Criteria:**

**Given** un lot d'animaux rattache a une parcelle A
**When** l'utilisateur clique sur "Deplacer" et selectionne la parcelle B comme destination
**Then** le lot est rattache a la parcelle B, et un enregistrement DeplacementLot est cree avec : lotId, parcelleOrigineId (A), parcelleDestinationId (B), dateHeure (now), et note optionnelle

**Given** l'utilisateur consulte la page d'un lot
**When** la section "Historique des deplacements" s'affiche
**Then** tous les deplacements sont listes chronologiquement avec parcelle d'origine, parcelle de destination, date et note

**Given** l'utilisateur consulte la page d'une parcelle
**When** la section "Historique des deplacements" s'affiche
**Then** tous les deplacements impliquant cette parcelle (en tant qu'origine ou destination) sont affiches chronologiquement

**Given** l'utilisateur deplace un lot vers une parcelle alors que le lot n'est rattache a aucune parcelle
**When** le deplacement est enregistre
**Then** parcelleOrigineId est null et le deplacement est enregistre normalement (premier placement)

**Given** l'utilisateur tente de deplacer un lot vers la meme parcelle ou il se trouve deja
**When** la validation s'execute
**Then** une erreur indique que la parcelle de destination est identique a la parcelle actuelle

**Technical Notes:**
- Nouveau modele Prisma `DeplacementLot` : id, lotId (FK LotAnimaux), parcelleOrigineId (FK Parcelle nullable), parcelleDestinationId (FK Parcelle), dateHeure (DateTime), note (String optional), userId
- API : POST /api/elevage/lots/[id]/deplacements + GET /api/elevage/lots/[id]/deplacements
- Bouton "Deplacer" sur la page lot et sur la section lots de la page parcelle
- Dialog de deplacement avec select parcelle destination + note optionnelle

---

## Epic 2 : Comptabilite transversale automatisee

Chaque evenement de vente (recolte, oeufs, bois, abattage) genere automatiquement les ecritures comptables. L'utilisateur visualise revenus et depenses dans une vue unifiee tous modules confondus.

### Story 2.1 : Modele Transaction unifie et migration

As a utilisateur de Gleba,
I want que mes revenus et depenses soient stockes dans un modele unique plutot que dans des tables separees (VenteManuelle, DepenseManuelle),
So that je puisse avoir une comptabilite coherente et unifiee quel que soit le module source.

**Acceptance Criteria:**

**Given** le schema Prisma actuel avec VenteManuelle et DepenseManuelle
**When** la migration est executee
**Then** un nouveau modele `Transaction` est cree avec : id, type (enum REVENU/DEPENSE/MOUVEMENT_INTERNE), montant (Decimal), description, categorie, date, auto (Boolean), sourceType (String nullable), sourceId (String nullable), userId (FK User), timestamps
**And** les tables VenteManuelle et DepenseManuelle restent en place pour la coexistence pendant la migration progressive

**Given** le nouveau modele Transaction existe
**When** l'API GET /api/comptabilite/transactions est appelee
**Then** elle retourne les transactions de l'utilisateur connecte, filtrees par userId

**Given** l'utilisateur cree manuellement une transaction (revenu ou depense)
**When** il envoie un POST /api/comptabilite/transactions avec type, montant, description, categorie et date
**Then** la transaction est creee avec auto=false et sans sourceType/sourceId

**Given** une transaction existante appartenant a l'utilisateur
**When** il envoie un PUT /api/comptabilite/transactions/[id]
**Then** la transaction est mise a jour (sauf si auto=true, auquel cas seule la description est modifiable)

**Given** une transaction auto-generee (auto=true)
**When** l'utilisateur tente de la supprimer manuellement
**Then** la suppression est refusee avec un message indiquant que les ecritures auto sont gerees par le systeme

**Technical Notes:**
- Modele Prisma `Transaction` avec enum `TypeTransaction` (REVENU, DEPENSE, MOUVEMENT_INTERNE)
- Migration non-destructive : les anciennes tables restent le temps de la migration progressive
- Validation Zod dans `src/lib/validations/transaction.ts`
- Routes API : `src/app/api/comptabilite/transactions/route.ts` et `[id]/route.ts`

### Story 2.2 : Auto-generation d'ecritures pour tous les evenements de vente

As a utilisateur de Gleba,
I want que chaque vente (recolte maraichage, recolte arbre, vente oeufs, vente produit elevage, production bois, abattage) genere automatiquement une ecriture comptable,
So that je n'aie plus jamais a saisir manuellement une ecriture de vente.

**Acceptance Criteria:**

**Given** l'utilisateur enregistre une recolte maraichage avec un prix de vente
**When** la recolte est sauvegardee
**Then** une Transaction de type REVENU est creee automatiquement avec auto=true, sourceType="RECOLTE", sourceId=id de la recolte, montant=prix de vente, et description generee

**Given** l'utilisateur enregistre une recolte d'arbre fruitier vendue
**When** la recolte arbre est sauvegardee
**Then** une Transaction REVENU est creee avec sourceType="RECOLTE_ARBRE" et sourceId correspondant

**Given** l'utilisateur enregistre une vente d'oeufs
**When** la vente est sauvegardee
**Then** une Transaction REVENU est creee avec sourceType="VENTE_OEUFS"

**Given** l'utilisateur enregistre une vente de produit d'elevage
**When** la vente est sauvegardee
**Then** une Transaction REVENU est creee avec sourceType="VENTE_ELEVAGE"

**Given** l'utilisateur enregistre une production de bois vendue
**When** la production est sauvegardee
**Then** une Transaction REVENU est creee avec sourceType="PRODUCTION_BOIS"

**Given** l'utilisateur enregistre un abattage
**When** l'abattage est sauvegarde
**Then** une Transaction REVENU est creee avec sourceType="ABATTAGE"

**Given** l'utilisateur modifie le montant d'une recolte vendue
**When** la recolte est mise a jour
**Then** la Transaction auto associee est mise a jour avec le nouveau montant (synchronisation cascade)

**Given** l'utilisateur supprime une recolte vendue
**When** la recolte est supprimee
**Then** la Transaction auto associee est supprimee egalement (suppression cascade)

**Given** le systeme genere une ecriture auto
**When** l'ecriture est creee
**Then** elle est creee en moins de 500ms apres l'evenement source (NFR4)
**And** l'operation utilise une transaction Prisma atomique (NFR18)

**Technical Notes:**
- Etendre `src/lib/auto-compta.ts` pour creer des Transaction au lieu de VenteManuelle
- Hook dans chaque API de vente : recoltes, recoltes arbres, ventes elevage, production bois, abattages
- Pattern existant : sourceType/sourceId pour le lien bidirectionnel
- Transaction Prisma atomique : evenement source + Transaction creees dans le meme $transaction

### Story 2.3 : Vue unifiee revenus et depenses

As a utilisateur de Gleba,
I want visualiser l'ensemble de mes revenus et depenses dans une seule page tous modules confondus,
So that j'aie une vision globale de ma situation financiere sans naviguer entre les modules.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /comptabilite/transactions
**When** la page se charge
**Then** un tableau affiche toutes les transactions (revenus, depenses, mouvements internes) triees par date decroissante avec colonnes : date, type, description, categorie, montant, source (module), auto/manuel

**Given** la page transactions est affichee
**When** l'utilisateur utilise les filtres
**Then** il peut filtrer par : type (revenu/depense/mouvement), periode (dates debut/fin), module source (maraichage/verger/elevage/manuel), et categorie

**Given** la page transactions est affichee
**When** l'utilisateur regarde le resume en haut de page
**Then** il voit : total revenus, total depenses, solde net, pour la periode filtree

**Given** l'utilisateur clique sur une transaction auto-generee
**When** la source est affichee
**Then** un lien permet de naviguer directement vers l'evenement source (recolte, vente, abattage, etc.)

**Given** les transactions incluent des anciennes VenteManuelle/DepenseManuelle non migrees
**When** la page affiche les donnees
**Then** les anciennes ecritures sont egalement incluses dans la vue (compatibilite retroactive pendant la transition)

**Technical Notes:**
- Page : `src/app/comptabilite/transactions/page.tsx` (refonte de l'existante)
- TanStack Table avec filtres colonnes
- Resume calcule cote client a partir des donnees filtrees
- API GET /api/comptabilite/transactions avec query params : type, dateDebut, dateFin, sourceType

### Story 2.4 : Auto-consommation comme mouvement interne

As a utilisateur de Gleba,
I want enregistrer une auto-consommation (produit consomme sur la ferme) comme mouvement interne,
So that je puisse tracer l'utilisation de mes productions sans fausser mes revenus.

**Acceptance Criteria:**

**Given** l'utilisateur est sur la page transactions ou lors de la saisie d'une recolte
**When** il selectionne "Auto-consommation" comme destination au lieu de "Vente"
**Then** une Transaction de type MOUVEMENT_INTERNE est creee avec montant=0, description auto-generee, et sourceType/sourceId lies a l'evenement

**Given** une auto-consommation est enregistree
**When** l'utilisateur consulte la vue unifiee
**Then** le mouvement apparait dans la liste mais n'est pas comptabilise dans les revenus ni les depenses

**Given** l'utilisateur consulte les statistiques comptables
**When** les totaux sont calcules
**Then** les mouvements internes sont exclus des totaux revenus/depenses mais apparaissent dans une section separee "Auto-consommation"

**Given** l'utilisateur cree une auto-consommation depuis la page recolte
**When** il marque la recolte comme "auto-consommee"
**Then** le systeme cree un MOUVEMENT_INTERNE au lieu d'un REVENU

**Technical Notes:**
- Ajout option "Auto-consommation" dans les formulaires de recolte (maraichage + verger)
- Type MOUVEMENT_INTERNE dans l'enum TypeTransaction
- Modification auto-compta.ts pour gerer le cas auto-consommation
- Section dediee dans le resume de la page transactions

### Story 2.5 : Cout de revient par culture et production

As a utilisateur de Gleba,
I want consulter le cout de revient de chaque culture ou production,
So that je puisse identifier les productions rentables et optimiser mes choix.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /comptabilite/couts-production
**When** la page se charge
**Then** un tableau affiche chaque culture/production avec : nom, depenses totales (semences, plants, intrants, main d'oeuvre), quantite produite, cout unitaire (EUR/kg ou EUR/unite), revenu total, marge brute

**Given** des depenses sont rattachees a une culture via categorie ou saisie manuelle
**When** le cout de revient est calcule
**Then** le systeme additionne toutes les depenses liees (transactions avec sourceType lie ou categorie associee) et divise par la quantite recoltee

**Given** une culture n'a aucune depense rattachee
**When** le cout de revient est affiche
**Then** le cout unitaire affiche "N/A" et une indication que des depenses peuvent etre rattachees

**Given** l'utilisateur clique sur une ligne du tableau
**When** le detail s'affiche
**Then** il voit la ventilation des postes de cout : semences, plants, fertilisants, traitements, et autres depenses manuelles rattachees

**Given** l'utilisateur filtre par type de production
**When** il selectionne maraichage, verger ou elevage
**Then** seules les productions du module selectionne sont affichees

**Technical Notes:**
- Page : `src/app/comptabilite/couts-production/page.tsx` (existe deja en partie)
- Calcul cote serveur via API aggregation Prisma
- Rattachement depenses → culture via sourceType ou categorie manuelle
- Ventilation par poste de cout basee sur les categories de transactions

---

## Epic 3 : Carte globale multi-couches

L'utilisateur visualise toutes ses parcelles sur une carte interactive avec des couches d'activite activables, dessine de nouvelles parcelles, et navigue directement vers les entites qu'elles contiennent.

### Story 3.1 : Page carte avec affichage des parcelles

As a utilisateur de Gleba,
I want visualiser toutes mes parcelles sur une carte interactive,
So that j'aie une vue d'ensemble geographique de mon exploitation.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /carte
**When** la page se charge
**Then** une carte Leaflet pleine page s'affiche avec les couches de fond existantes (IGN, OSM, satellite) et tous les contours GeoJSON de ses parcelles sont dessines en polygones colores

**Given** l'utilisateur a des parcelles avec differentes couches d'activite
**When** la carte affiche les parcelles
**Then** chaque parcelle est coloree selon sa couche d'activite principale : vert pour maraichage, orange pour verger, brun pour elevage, jaune pour paturage
**And** le nom de la parcelle est affiche en label sur le contour

**Given** l'utilisateur survole une parcelle
**When** le tooltip s'affiche
**Then** il voit le nom, la surface, les couches d'activite et le nombre d'entites rattachees (planches, arbres, lots)

**Given** l'utilisateur a plus de 50 parcelles
**When** la carte se charge
**Then** l'affichage est complet en moins de 3 secondes (NFR2)

**Given** l'utilisateur n'a aucune parcelle
**When** la carte se charge
**Then** un message invite a creer sa premiere parcelle avec un bouton vers /parcelles

**Technical Notes:**
- Page : `src/app/jardin/carte/page.tsx` ou `src/app/carte/page.tsx`
- Reutiliser les composants Leaflet existants dans `src/components/carte/`
- API GET /api/parcelles retourne les contours GeoJSON
- Couches de fond IGN/OSM/satellite deja configurees
- Navigation ajoutee dans le menu principal

### Story 3.2 : Couches d'activite activables sur la carte

As a utilisateur de Gleba,
I want activer et desactiver des couches d'activite sur la carte,
So that je puisse me concentrer sur un type d'activite a la fois.

**Acceptance Criteria:**

**Given** la carte est affichee avec des parcelles de differentes couches
**When** l'utilisateur voit le panneau de controle des couches
**Then** des toggles sont disponibles pour chaque type : Maraichage, Verger, Elevage, Paturage, chacun avec sa couleur et le nombre de parcelles correspondantes

**Given** l'utilisateur desactive la couche "Verger"
**When** le toggle est off
**Then** toutes les parcelles ayant la couche verger disparaissent de la carte
**And** les compteurs du panneau se mettent a jour

**Given** l'utilisateur reactive une couche
**When** le toggle repasse on
**Then** les parcelles reapparaissent avec une animation fluide

**Given** une parcelle a plusieurs couches d'activite (ex: maraichage + verger)
**When** l'utilisateur desactive "maraichage" mais garde "verger" active
**Then** la parcelle reste visible car elle a au moins une couche active

**Given** l'utilisateur desactive toutes les couches
**When** aucun toggle n'est actif
**Then** la carte est vide avec un message "Aucune couche active"

**Technical Notes:**
- Panneau de controle en overlay sur la carte (position top-right)
- Etat des toggles gere en local state React
- Filtrage cote client (pas de re-fetch API)
- Legende dynamique coherente avec les couleurs des polygones

### Story 3.3 : Navigation depuis une parcelle vers ses entites

As a utilisateur de Gleba,
I want cliquer sur une parcelle et voir les planches, arbres et lots qu'elle contient avec des liens vers leurs pages,
So that je puisse naviguer intuitivement depuis la carte vers le detail de chaque element.

**Acceptance Criteria:**

**Given** l'utilisateur clique sur une parcelle sur la carte
**When** le panneau de detail s'ouvre (sidebar ou popup)
**Then** il affiche : nom de la parcelle, surface, couches d'activite, et trois sections listant les planches rattachees, les arbres rattaches et les lots rattaches

**Given** le panneau de detail affiche des planches
**When** l'utilisateur clique sur une planche
**Then** il est redirige vers /planches/[id]

**Given** le panneau de detail affiche des arbres
**When** l'utilisateur clique sur un arbre
**Then** il est redirige vers la page correspondante dans /arbres

**Given** le panneau de detail affiche des lots d'animaux
**When** l'utilisateur clique sur un lot
**Then** il est redirige vers la page correspondante dans /elevage

**Given** une parcelle n'a aucune entite rattachee
**When** le panneau s'ouvre
**Then** un message indique "Aucune entite rattachee" avec des liens pour en ajouter

**Technical Notes:**
- Panneau lateral slide-in ou popup Leaflet enrichi
- Donnees chargees a la demande au clic (GET /api/parcelles/[id] avec include planches, arbres, lots)
- Liens de navigation vers les pages existantes

### Story 3.4 : Dessin de nouvelles parcelles sur la carte

As a utilisateur de Gleba,
I want dessiner de nouvelles parcelles directement sur la carte,
So that je puisse creer mes parcelles visuellement en suivant les contours reels de mon terrain.

**Acceptance Criteria:**

**Given** l'utilisateur est sur la page /carte
**When** il clique sur le bouton "Dessiner une parcelle"
**Then** le mode dessin Leaflet Draw s'active et il peut tracer un polygone point par point

**Given** l'utilisateur a termine de dessiner le polygone
**When** il double-clique pour fermer le contour
**Then** un formulaire s'affiche avec le contour pre-rempli, la surface calculee, et des champs pour le nom et les couches d'activite

**Given** l'utilisateur remplit le formulaire et valide
**When** il clique sur "Creer"
**Then** la parcelle est creee via POST /api/parcelles et apparait immediatement sur la carte avec sa couleur

**Given** l'utilisateur est en mode dessin
**When** il clique sur "Annuler"
**Then** le dessin en cours est abandonne et la carte revient a l'etat normal

**Given** l'utilisateur dessine un polygone invalide (moins de 3 points)
**When** il tente de valider
**Then** un message d'erreur indique que le contour est invalide

**Technical Notes:**
- Integration Leaflet Draw pour le dessin de polygones
- Conversion du polygone Leaflet en GeoJSON pour l'API
- Dialog de creation avec les memes champs que le formulaire /parcelles
- Rafraichissement de la couche parcelles apres creation

### Story 3.5 : Lien vers le plan 2D jardin depuis la carte

As a utilisateur de Gleba,
I want acceder au plan 2D de mon jardin depuis une parcelle maraichage sur la carte,
So that je puisse passer de la vue geographique a la vue detaillee de mes planches en un clic.

**Acceptance Criteria:**

**Given** l'utilisateur clique sur une parcelle avec la couche MARAICHAGE
**When** le panneau de detail s'ouvre
**Then** un bouton "Voir le plan du jardin" est visible en haut du panneau

**Given** l'utilisateur clique sur "Voir le plan du jardin"
**When** la navigation s'effectue
**Then** il est redirige vers /jardin et la vue est centree sur les planches rattachees a cette parcelle

**Given** une parcelle sans couche MARAICHAGE
**When** le panneau de detail s'ouvre
**Then** le bouton "Voir le plan du jardin" n'est pas affiche

**Given** une parcelle maraichage sans planches rattachees
**When** l'utilisateur clique sur "Voir le plan du jardin"
**Then** il est redirige vers /jardin avec un message indiquant qu'aucune planche n'est rattachee a cette parcelle

**Technical Notes:**
- Bouton conditionnel dans le panneau de detail (Story 3.3)
- Navigation avec query param : /jardin?parcelleId=[id]
- Page jardin existante doit gerer le parametre pour filtrer/centrer la vue

### Story 3.6 : Synchronisation temps reel multi-utilisateurs

As a utilisateur de Gleba,
I want voir les modifications de parcelles des autres utilisateurs en temps reel,
So that nous puissions travailler simultanement sur la carte sans conflits.

**Acceptance Criteria:**

**Given** deux utilisateurs sont connectes sur /carte simultanement
**When** l'utilisateur A cree une nouvelle parcelle
**Then** l'utilisateur B voit la parcelle apparaitre sur sa carte sans recharger la page

**Given** deux utilisateurs sont connectes sur /carte
**When** l'utilisateur A modifie le contour d'une parcelle
**Then** l'utilisateur B voit le contour mis a jour en temps reel

**Given** deux utilisateurs sont connectes sur /carte
**When** l'utilisateur A supprime une parcelle
**Then** la parcelle disparait de la carte de l'utilisateur B

**Given** l'utilisateur perd sa connexion SSE
**When** la connexion est retablie
**Then** le client effectue un rechargement complet des parcelles pour se resynchroniser

**Given** un seul utilisateur est connecte
**When** il utilise la carte normalement
**Then** le flux SSE est ouvert mais n'impacte pas les performances

**Technical Notes:**
- Server-Sent Events (SSE) via route API : GET /api/carte/events (stream)
- Evenements emis : parcelle:created, parcelle:updated, parcelle:deleted
- Cote serveur : les mutations API parcelles emettent un evenement apres persistance
- Cote client : hook useParcelleEvents() ecoute le flux SSE et met a jour le state local
- Filtrage par userId pour le multi-tenancy (seuls les evenements de la meme ferme sont envoyes)
- Reconnexion automatique avec EventSource API native

---

## Epic 4 : Facturation & Conformite reglementaire

L'utilisateur genere des factures legales, exporte ses parcelles au format Telepac pour la PAC, consulte la tracabilite phytosanitaire et calcule ses declarations TVA.

### Story 4.1 : Generation de factures depuis les ventes

As a utilisateur de Gleba,
I want generer des factures legales a partir de mes ventes,
So that je puisse fournir des documents conformes a mes clients et a l'administration.

**Acceptance Criteria:**

**Given** l'utilisateur a des transactions de type REVENU non facturees
**When** il navigue vers /comptabilite/factures et clique sur "Nouvelle facture"
**Then** il peut selectionner un client, choisir des transactions a inclure comme lignes de facture, et generer une facture avec numerotation legale F-YYYY-NNNN

**Given** l'utilisateur valide la creation d'une facture
**When** la facture est creee
**Then** un numero sequentiel F-YYYY-NNNN est attribue automatiquement (incrementant le dernier numero de l'annee en cours), les lignes de facture sont creees avec designation, quantite, prix unitaire, taux TVA, et montant TTC
**And** les transactions incluses sont marquees comme facturees

**Given** une facture existante
**When** l'utilisateur clique sur "Voir" ou "Telecharger"
**Then** un PDF est genere avec les mentions legales obligatoires : numero, date, identite vendeur/acheteur, detail des lignes, sous-totaux HT par taux TVA, total TTC

**Given** l'utilisateur tente de creer une facture sans client
**When** la validation s'execute
**Then** une erreur indique qu'un client est obligatoire

**Given** une facture a ete emise
**When** l'utilisateur tente de la modifier
**Then** seul l'ajout d'un avoir (facture d'avoir) est possible — la facture originale reste intacte (conformite legale)

**Technical Notes:**
- Modeles Facture et LigneFacture existants — les enrichir avec lien vers Transaction
- Numerotation : query MAX sur numero pour l'annee en cours + increment
- Generation PDF cote serveur (existant ou a creer via puppeteer/react-pdf)
- Page existante /comptabilite/factures a enrichir

### Story 4.2 : Export parcelles au format Telepac

As a utilisateur de Gleba,
I want exporter mes parcelles au format Telepac,
So that je puisse declarer mes surfaces a la PAC sans ressaisie.

**Acceptance Criteria:**

**Given** l'utilisateur a des parcelles avec contours GeoJSON
**When** il navigue vers /parcelles et clique sur "Exporter Telepac"
**Then** un fichier est genere contenant les parcelles avec : identifiant, contour geographique, surface declaree, code culture PAC

**Given** l'export est demande
**When** le fichier est genere
**Then** le format est conforme aux specifications Telepac (GeoJSON avec proprietes attendues : numero_ilot, numero_parcelle, code_culture, surface_admissible)
**And** le fichier est telecharge automatiquement (NFR15)

**Given** une parcelle n'a pas de code culture PAC attribue
**When** l'export est genere
**Then** la parcelle est incluse avec le champ code_culture vide et un avertissement est affiche a l'utilisateur

**Given** l'utilisateur veut attribuer des codes culture PAC a ses parcelles
**When** il edite une parcelle
**Then** un champ optionnel "Code culture PAC" est disponible avec une liste deroulante des codes officiels

**Technical Notes:**
- Ajout champ optionnel `codeCulturePAC` (String) sur le modele Parcelle
- Route API : GET /api/parcelles/export-telepac (genere le fichier)
- Format GeoJSON FeatureCollection avec proprietes Telepac
- Bouton d'export sur la page /parcelles
- Liste des codes culture PAC en constante ou referentiel

### Story 4.3 : Registre de tracabilite phytosanitaire

As a utilisateur de Gleba,
I want consulter un registre complet de mes interventions phytosanitaires,
So that je puisse repondre aux controles DRAAF et respecter mes obligations reglementaires.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /tracabilite
**When** la page se charge
**Then** un tableau liste toutes les interventions phytosanitaires avec colonnes : date, parcelle/planche, culture, produit utilise, numero AMM, dose appliquee, DAR (delai avant recolte), operateur, conditions meteo

**Given** le tableau est affiche
**When** l'utilisateur utilise les filtres
**Then** il peut filtrer par : periode, parcelle, culture, produit, et type d'intervention

**Given** l'utilisateur veut exporter le registre
**When** il clique sur "Exporter CSV"
**Then** un fichier CSV est telecharge avec toutes les colonnes du tableau, conforme au format attendu par la DRAAF

**Given** une intervention a un DAR renseigne
**When** la date de recolte prevue est avant la fin du DAR
**Then** un indicateur d'alerte est affiche sur la ligne de l'intervention

**Given** l'utilisateur clique sur une intervention
**When** le detail s'affiche
**Then** il voit toutes les informations detaillees : produit, composition, numero AMM, dose/ha, surface traitee, volume de bouillie, conditions meteo, observations

**Technical Notes:**
- Page : `src/app/tracabilite/page.tsx` (existe deja en partie)
- Donnees issues du modele Intervention existant
- Enrichir les API interventions pour inclure les donnees parcelle
- Export CSV cote client (conversion tableau → CSV)
- Calcul alerte DAR : dateIntervention + DAR_jours vs dateRecoltePrevue

### Story 4.4 : Declarations TVA selon 3 taux

As a utilisateur de Gleba,
I want calculer automatiquement mes declarations TVA ventilees par taux,
So that je puisse remplir mes declarations fiscales rapidement et sans erreur.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /comptabilite/tva (page existante)
**When** la page se charge avec une periode selectionnee
**Then** un recapitulatif affiche pour chaque taux (5.5%, 10%, 20%) : base HT, montant TVA collectee, montant TVA deductible, TVA nette

**Given** les transactions ont un taux TVA attribue
**When** le calcul est effectue
**Then** les revenus sont ventiles par taux TVA (5.5% pour produits alimentaires bruts, 10% pour produits transformes, 20% pour services et autres), et les depenses deductibles sont ventilees de la meme maniere

**Given** l'utilisateur selectionne une periode trimestrielle
**When** le recapitulatif s'affiche
**Then** il voit : TVA collectee totale, TVA deductible totale, TVA nette a payer (ou credit de TVA), avec detail par taux

**Given** l'utilisateur clique sur un taux
**When** le detail s'affiche
**Then** il voit la liste des transactions concernees par ce taux avec montant HT et TVA pour chacune

**Given** l'utilisateur veut exporter la declaration
**When** il clique sur "Exporter"
**Then** un recapitulatif PDF ou CSV est genere avec les montants par taux, pret pour la declaration fiscale

**Technical Notes:**
- Page existante /comptabilite/tva a enrichir avec les nouvelles Transaction
- Ajout champ `tauxTVA` (Decimal) sur le modele Transaction (defaut selon categorie)
- Calcul serveur : aggregation Prisma groupBy tauxTVA avec SUM
- Taux par defaut attribues automatiquement selon la categorie de transaction
- Export PDF/CSV du recapitulatif

---

## Epic 5 : Calendrier unifie & Pilotage quotidien

L'utilisateur consulte un calendrier unique regroupant tous les modules (semis, soins, verger, elevage) et un dashboard "ma journee" avec les taches auto-generees par parcelle.

### Story 5.1 : Calendrier unifie multi-modules

As a utilisateur de Gleba,
I want voir tous mes evenements agricoles dans un seul calendrier,
So that j'aie une vision complete de mes activites sans naviguer entre les modules.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers la page calendrier
**When** la page se charge
**Then** un calendrier (vue mois/semaine/jour) affiche les evenements agreges de tous les modules : semis et plantations (maraichage), recoltes prevues, operations verger (taille, greffe, traitement), soins animaux (vaccination, vermifuge), irrigations, et interventions phytosanitaires

**Given** le calendrier affiche des evenements de differents modules
**When** l'utilisateur regarde les evenements
**Then** chaque evenement est visuellement identifiable par module : couleur verte pour maraichage, orange pour verger, brune pour elevage, bleue pour irrigation, rouge pour interventions phyto

**Given** l'utilisateur clique sur un evenement du calendrier
**When** le detail s'affiche
**Then** il voit le resume de l'evenement (type, culture/animal concerne, parcelle, date, statut) avec un lien vers la page source du module

**Given** l'utilisateur est en vue semaine
**When** il navigue entre les semaines
**Then** les evenements se chargent dynamiquement en moins de 1 seconde (NFR1)

**Given** l'utilisateur n'a aucun evenement pour une periode
**When** le calendrier est vide
**Then** un message invite a planifier des activites avec des liens vers les modules

**Technical Notes:**
- Refonte de `src/components/dashboard/CalendarView.tsx` existant
- API unifiee GET /api/calendrier avec aggregation multi-modules (existante, a enrichir)
- Format evenement normalise : { id, type, module, titre, dateDebut, dateFin, parcelleId?, couleur, lienSource }
- Vues mois/semaine/jour avec navigation

### Story 5.2 : Filtres par type d'activite sur le calendrier

As a utilisateur de Gleba,
I want filtrer les evenements du calendrier par type d'activite,
So that je puisse me concentrer sur un module ou un type de tache specifique.

**Acceptance Criteria:**

**Given** le calendrier unifie est affiche
**When** l'utilisateur voit le panneau de filtres
**Then** des toggles sont disponibles par module (Maraichage, Verger, Elevage, Irrigation, Interventions) avec icone, couleur et compteur d'evenements visibles

**Given** l'utilisateur desactive le filtre "Elevage"
**When** le toggle est off
**Then** tous les evenements d'elevage disparaissent du calendrier et le compteur se met a jour

**Given** l'utilisateur active uniquement "Verger"
**When** seul ce filtre est actif
**Then** le calendrier n'affiche que les operations verger (tailles, greffes, traitements, recoltes arbres)

**Given** l'utilisateur veut filtrer par type d'evenement au sein d'un module
**When** il clique sur le module pour deployer les sous-filtres
**Then** il peut activer/desactiver individuellement : semis, plantations, recoltes (pour maraichage), taille, greffe, traitement (pour verger), vaccination, vermifuge (pour elevage)

**Given** l'utilisateur change les filtres
**When** le calendrier se met a jour
**Then** le filtrage est instantane (cote client, pas de re-fetch API)

**Technical Notes:**
- Panneau de filtres lateral ou en barre au-dessus du calendrier
- Etat des filtres en local state React, persistent via localStorage
- Filtrage cote client sur les donnees deja chargees
- Sous-filtres par type d'evenement au sein de chaque module

### Story 5.3 : Dashboard "ma journee" par parcelle

As a utilisateur de Gleba,
I want voir un tableau de bord de ma journee regroupant les taches par parcelle,
So that je puisse planifier ma journee efficacement en sachant quoi faire et ou.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers la page d'accueil (/)
**When** la page se charge
**Then** une section "Ma journee" affiche les taches du jour regroupees par parcelle, avec pour chaque parcelle : nom, nombre de taches, et liste des taches a effectuer

**Given** des taches du jour existent pour differentes parcelles
**When** le dashboard s'affiche
**Then** les parcelles sont triees par nombre de taches decroissant, et chaque tache affiche : type (icone), description courte, module source, priorite (urgent/normal)

**Given** l'utilisateur clique sur une tache
**When** l'action est effectuee
**Then** il peut soit marquer la tache comme terminee directement (checkbox), soit naviguer vers la page du module pour la traiter en detail

**Given** des taches non rattachees a une parcelle existent
**When** le dashboard s'affiche
**Then** elles apparaissent dans une section "Sans parcelle" en bas du dashboard

**Given** l'utilisateur a termine toutes ses taches du jour
**When** le dashboard s'affiche
**Then** un message de felicitation est affiche avec un resume : taches completees, prochaines taches a venir

**Given** l'utilisateur regarde le resume en haut du dashboard
**When** les compteurs s'affichent
**Then** il voit : nombre total de taches du jour, taches completees, taches en retard (date depassee), et meteo du jour (si disponible)

**Technical Notes:**
- Section dans `src/app/page.tsx` (page d'accueil existante)
- API GET /api/taches avec filtre date=today et groupBy parcelleId
- Rattachement tache → parcelle via la culture/arbre/lot concerne et son parcelleId
- Actions rapides : checkbox pour marquer termine via PATCH /api/taches/[id]
- Integration meteo existante pour l'affichage du jour

### Story 5.4 : Generation automatique de taches

As a utilisateur de Gleba,
I want que le systeme genere automatiquement des taches a partir de mes ITPs, cycles elevage et calendriers verger,
So that je n'oublie aucune action importante et que mon planning soit toujours a jour.

**Acceptance Criteria:**

**Given** une culture est creee avec un ITP (itineraire technique)
**When** les dates du cycle sont calculees (semis, plantation, recolte)
**Then** des taches sont generees automatiquement pour chaque etape de l'ITP avec date prevue, type et description

**Given** un lot d'animaux a un cycle de vaccination defini
**When** la prochaine vaccination approche (J-7)
**Then** une tache est creee automatiquement avec : "Vaccination [type] - Lot [nom]", date prevue, priorite urgente si en retard

**Given** un arbre a un calendrier de soins defini par espece (taille hivernal, traitement printanier)
**When** la periode de soin approche
**Then** une tache est creee automatiquement avec : "Taille [type] - [nom arbre]", date prevue, lien vers l'arbre

**Given** une tache auto-generee existe
**When** l'utilisateur la consulte
**Then** elle est identifiee comme "auto-generee" avec un lien vers la source (ITP, cycle elevage, calendrier verger) et ne peut pas etre supprimee manuellement (elle se resout quand l'action est realisee)

**Given** l'utilisateur realise une action prevue (ex: saisit une recolte correspondant a une tache)
**When** l'action est enregistree
**Then** la tache correspondante est automatiquement marquee comme terminee

**Given** le systeme genere les taches
**When** le processus de generation s'execute
**Then** les taches en doublon ne sont pas creees (verification par sourceType + sourceId + date)

**Technical Notes:**
- Service de generation dans `src/lib/task-generator.ts`
- Execution : a chaque connexion utilisateur ou via cron quotidien
- Sources : ITPs (modele ITP existant), cycles elevage (SoinAnimal previsionnel), calendrier verger (tree-care-calendar.ts existant)
- Taches generees avec auto=true, sourceType, sourceId pour eviter les doublons
- Marquage auto des taches quand l'evenement correspondant est enregistre (hook dans les API)

---

## Epic 6 : Integrations externes & IA transversale

L'utilisateur synchronise ses ventes avec Cagette.net, les nouvelles entites sont exposees via MCP, et l'agent IA peut raisonner sur l'ensemble du modele unifie.

### Story 6.1 : Outils MCP pour parcelles et transactions

As a agent IA ou utilisateur via l'assistant,
I want que les parcelles et transactions soient accessibles via des outils MCP,
So that l'IA puisse lire et agir sur les donnees spatiales et comptables comme sur les autres modules.

**Acceptance Criteria:**

**Given** le serveur MCP est actif
**When** un agent appelle l'outil `list_parcelles` avec des filtres optionnels (couche, nom)
**Then** les parcelles de l'utilisateur sont retournees avec id, nom, surface, couches, nombre d'entites rattachees

**Given** le serveur MCP est actif
**When** un agent appelle l'outil `get_parcelle` avec un id
**Then** la parcelle complete est retournee avec contour GeoJSON, planches, arbres et lots rattaches

**Given** le serveur MCP est actif
**When** un agent appelle l'outil `create_parcelle` avec nom, contour GeoJSON et couches
**Then** la parcelle est creee et retournee avec sa surface calculee

**Given** le serveur MCP est actif
**When** un agent appelle l'outil `list_transactions` avec filtres optionnels (type, periode, sourceType)
**Then** les transactions de l'utilisateur sont retournees avec montants, categories et sources

**Given** le serveur MCP est actif
**When** un agent appelle l'outil `stats_comptabilite` avec une periode
**Then** un resume est retourne : total revenus, total depenses, solde, ventilation par module source

**Given** un appel MCP est effectue
**When** le serveur repond
**Then** le temps de reponse est inferieur a 2 secondes (NFR13)
**And** l'authentification utilise un bearer token separe (NFR11)

**Technical Notes:**
- Nouveaux outils dans le serveur MCP existant (mcp-server/)
- 5 outils minimum : list_parcelles, get_parcelle, create_parcelle, list_transactions, stats_comptabilite
- Respecter le pattern des 39 outils existants
- Bearer token existant pour l'authentification MCP

### Story 6.2 : Validation non-regression des outils MCP existants

As a utilisateur de Gleba,
I want que les 39 outils MCP existants continuent de fonctionner apres les evolutions du modele,
So that l'assistant IA et les agents externes ne perdent aucune capacite.

**Acceptance Criteria:**

**Given** les modeles Prisma ont evolue (ajout Parcelle, Transaction, FK optionnelles)
**When** chaque outil MCP existant est appele avec des parametres valides
**Then** il retourne les resultats attendus sans erreur

**Given** les outils MCP qui listent des entites (cultures, recoltes, arbres, animaux)
**When** ils sont appeles
**Then** ils incluent le champ parcelleId dans les resultats si l'entite a ete rattachee a une parcelle (enrichissement sans casse)

**Given** les outils MCP de creation/modification
**When** ils sont appeles avec les parametres existants (sans parcelleId)
**Then** ils fonctionnent exactement comme avant (retrocompatibilite)

**Given** un inventaire des 39 outils est realise
**When** chaque outil est teste
**Then** un rapport de validation documente le statut (OK/KO) de chaque outil avec les eventuels ajustements effectues

**Technical Notes:**
- Script de test manuel ou semi-automatise appelant chaque outil MCP
- Enrichissement des reponses existantes avec parcelleId (ajout non-breaking)
- Documentation du rapport de validation dans docs/
- Ajustement des outils si des modeles renommes/deplaces cassent les requetes

### Story 6.3 : Requetes IA transversales sur modele unifie

As a utilisateur de Gleba,
I want poser des questions transversales a l'assistant IA couvrant parcelles, cultures, elevage et compta,
So that l'IA soit un vrai copilote de ma ferme capable de croiser les donnees de tous les modules.

**Acceptance Criteria:**

**Given** l'utilisateur demande "Resume de ma semaine"
**When** l'assistant traite la requete
**Then** il utilise les outils MCP pour agreger : recoltes (maraichage + verger), ventes et ecritures comptables, taches en retard, et retourne un resume structure

**Given** l'utilisateur demande "CA tomates ce mois-ci"
**When** l'assistant traite la requete
**Then** il interroge les transactions liees aux recoltes de tomates et retourne le chiffre d'affaires avec detail des ventes

**Given** l'utilisateur demande "Quelles parcelles sont en jachere ?"
**When** l'assistant traite la requete
**Then** il interroge les parcelles et cultures pour identifier celles sans culture active et retourne la liste

**Given** l'utilisateur demande une information croisant 3+ modules
**When** l'assistant chaine les outils MCP
**Then** il est capable d'appeler sequentiellement les outils necessaires (parcelles, cultures, elevage, compta) et de synthetiser une reponse coherente

**Given** l'assistant repond a une requete transversale
**When** la reponse est generee
**Then** elle cite les sources (module, entites concernees) pour que l'utilisateur puisse verifier

**Technical Notes:**
- Pas de nouveau code serveur — repose sur les outils MCP existants + nouveaux (Story 6.1)
- Le prompt systeme de l'assistant Ollama est enrichi avec la description des nouveaux outils
- Tests fonctionnels manuels avec scenarios transversaux
- Documentation des scenarios types dans l'aide utilisateur

### Story 6.4 : Synchronisation ventes avec Cagette.net

As a utilisateur de Gleba,
I want synchroniser mes ventes avec Cagette.net,
So that je puisse publier mes disponibilites et recuperer automatiquement les commandes sans ressaisie.

**Acceptance Criteria:**

**Given** l'utilisateur navigue vers /parametres
**When** il configure l'integration Cagette.net
**Then** il peut saisir son identifiant/cle API Cagette.net et tester la connexion

**Given** la connexion Cagette est configuree et active
**When** l'utilisateur a des produits disponibles (recoltes en stock)
**Then** il peut publier ses disponibilites vers Cagette.net en un clic (nom produit, quantite, prix unitaire)

**Given** des commandes sont passees sur Cagette.net
**When** la synchronisation s'execute (manuelle ou periodique)
**Then** les commandes sont importees comme transactions de type REVENU avec sourceType="CAGETTE" et les details client/produit/quantite

**Given** le service Cagette.net est indisponible
**When** une synchronisation est tentee
**Then** le systeme retry 3 fois avec backoff exponentiel puis affiche un message d'erreur sans bloquer l'application (NFR14)

**Given** une commande Cagette deja importee est modifiee sur Cagette.net
**When** la synchronisation suivante s'execute
**Then** la transaction existante est mise a jour (pas de doublon)

**Given** l'utilisateur veut desactiver l'integration
**When** il desactive Cagette dans les parametres
**Then** la synchronisation s'arrete, les transactions deja importees restent en place

**Technical Notes:**
- Nouveau module `src/lib/cagette.ts` pour l'integration API Cagette.net
- Stockage cle API chiffree dans les parametres utilisateur (table Settings ou UserSettings)
- Synchronisation declenchee manuellement + option cron (a evaluer)
- Retry avec backoff exponentiel (1s, 2s, 4s) et timeout 10s
- Mapping produits Gleba → produits Cagette a configurer par l'utilisateur

---

## Epic 7 : Administration, Multi-tenancy & PWA

L'admin gere les referentiels globaux, consulte les logs et metriques, le code open/proprietaire est separe architecturalement, et l'application est installable en PWA responsive.

### Story 7.1 : Gestion des referentiels globaux

As a admin de Gleba,
I want gerer les referentiels globaux (especes, varietes, ITPs, aliments, fertilisants) depuis la page admin,
So that je puisse enrichir les donnees de reference disponibles pour tous les utilisateurs.

**Acceptance Criteria:**

**Given** l'admin navigue vers /admin/referentiels
**When** la page se charge
**Then** des onglets sont disponibles pour chaque type de referentiel : Especes, Varietes, ITPs, Aliments, Fertilisants, avec un tableau CRUD pour chacun

**Given** l'admin est sur l'onglet "Especes"
**When** il clique sur "Ajouter"
**Then** un formulaire s'affiche avec les champs du modele Espece (nom, famille, type, description) et la creation est enregistree

**Given** l'admin modifie une variete existante
**When** il sauvegarde les modifications
**Then** la variete est mise a jour et les changements sont visibles immediatement pour tous les utilisateurs

**Given** l'admin supprime un referentiel utilise par des donnees utilisateur
**When** il tente la suppression
**Then** un avertissement indique le nombre d'entites liees et demande confirmation, ou la suppression est refusee si des FK non nullables existent

**Given** l'admin recherche un referentiel
**When** il utilise le champ de recherche du tableau
**Then** le filtrage s'effectue sur le nom et les colonnes pertinentes

**Given** un utilisateur non-admin tente d'acceder a /admin/referentiels
**When** la page est chargee
**Then** il est redirige vers la page d'accueil (middleware de protection existant)

**Technical Notes:**
- Page existante `src/app/admin/referentiels/page.tsx` a enrichir
- Composant existant `src/components/admin/AdminTabs.tsx`
- TanStack Table pour chaque referentiel avec inline edit si possible
- APIs admin existantes a verifier/completer pour chaque referentiel
- Protection par role ADMIN dans le middleware existant

### Story 7.2 : Audit et renforcement du multi-tenancy

As a admin de Gleba,
I want que toutes les nouvelles entites filtrent systematiquement par userId,
So that aucun utilisateur ne puisse acceder aux donnees d'un autre.

**Acceptance Criteria:**

**Given** le modele Parcelle est cree
**When** une requete API GET /api/parcelles est effectuee
**Then** seules les parcelles avec userId = session.user.id sont retournees

**Given** le modele Transaction est cree
**When** une requete API sur les transactions est effectuee
**Then** seules les transactions avec userId = session.user.id sont retournees

**Given** le modele DeplacementLot est cree
**When** une requete API sur les deplacements est effectuee
**Then** seuls les deplacements avec userId = session.user.id sont retournes

**Given** un utilisateur A tente d'acceder a une parcelle de l'utilisateur B via /api/parcelles/[id]
**When** le userId de la parcelle ne correspond pas a la session
**Then** une reponse 404 est retournee (pas 403, pour ne pas reveler l'existence de la ressource)

**Given** toutes les routes API nouvelles et modifiees
**When** un audit de securite est effectue
**Then** chaque route verifie `requireAuthApi()` et filtre par `userId: session.user.id` dans les requetes Prisma
**And** un document d'audit liste toutes les routes verifiees avec leur statut

**Technical Notes:**
- Audit systematique de toutes les routes dans src/app/api/
- Pattern existant : `const session = await requireAuthApi(); ... where: { userId: session.user.id }`
- Verifier les nouvelles routes : parcelles, transactions, deplacements
- Documenter l'audit dans un commentaire ou doc interne

### Story 7.3 : Logs de connexion et metriques systeme

As a admin de Gleba,
I want consulter les logs de connexion et les metriques systeme,
So that je puisse surveiller l'utilisation et detecter les problemes.

**Acceptance Criteria:**

**Given** l'admin navigue vers /admin
**When** l'onglet "Logs" est selectionne
**Then** un tableau affiche les logs de connexion recents : date/heure, email, succes/echec, IP, user-agent

**Given** l'admin consulte les logs
**When** il utilise les filtres
**Then** il peut filtrer par : periode, utilisateur, statut (succes/echec)

**Given** l'admin selectionne l'onglet "Metriques"
**When** les metriques se chargent
**Then** il voit : nombre d'utilisateurs actifs (7j, 30j), nombre de cultures actives, nombre de parcelles, nombre de transactions ce mois, espace disque BDD

**Given** des tentatives de connexion echouees sont detectees
**When** plus de 5 echecs pour un meme email en 1 heure
**Then** un indicateur d'alerte est visible dans les metriques

**Given** l'admin veut exporter les logs
**When** il clique sur "Exporter CSV"
**Then** un fichier CSV des logs filtres est telecharge

**Technical Notes:**
- Table LoginLog existante (migration 20260308000000_add_login_logs)
- Page admin existante `src/app/admin/page.tsx` + `AdminTabs.tsx`
- API existante : /api/admin/logs et /api/admin/metrics
- Metriques calculees via COUNT Prisma sur les modeles principaux
- Alerte echecs connexion : query groupBy email + count > 5 sur 1h

### Story 7.4 : Separation architecturale AGPL / proprietary

As a mainteneur de Gleba,
I want que la frontiere entre code open source (AGPL) et code proprietary (IA, ITPs) soit clairement definie et enforced,
So that le projet puisse etre forke en respectant la licence et que la valeur proprietary soit protegee.

**Acceptance Criteria:**

**Given** le code source de Gleba
**When** un developpeur inspecte la structure
**Then** le code proprietary est isole dans des dossiers clairement identifies : `src/lib/chat/` pour l'IA et les ITPs enrichis dans un emplacement dedie

**Given** un fork AGPL du projet
**When** le code proprietary est retire
**Then** l'application fonctionne en mode degrade : pas d'assistant IA, ITPs basiques uniquement, pas de service cloud

**Given** la separation est documentee
**When** un contributeur consulte la documentation
**Then** un fichier LICENSING.md a la racine documente : quels dossiers sont AGPL, quels dossiers sont proprietary, les regles de contribution, et les conditions de fork

**Given** le code est commite
**When** un fichier proprietary est modifie dans une PR
**Then** un commentaire dans le code ou un header de licence indique clairement "Proprietary - Not AGPL"

**Given** la preparation pour deux repos est evaluee
**When** le plan de separation est documente
**Then** il decrit : quels fichiers vont dans le repo public (AGPL), quels fichiers vont dans le repo prive, comment le repo prive depend du repo public (submodule ou package)

**Technical Notes:**
- Inventaire des fichiers proprietary : src/lib/chat/, mcp-server/ (outils IA), ITPs enrichis
- Ajout headers de licence dans les fichiers concernes
- Creation LICENSING.md a la racine
- Documentation du plan de separation en deux repos dans docs/
- Le fork AGPL doit passer `npm run build` sans les fichiers proprietary

### Story 7.5 : PWA installable et responsive

As a utilisateur de Gleba,
I want installer l'application sur mon appareil et l'utiliser confortablement sur desktop, tablette et mobile,
So that j'aie un acces rapide a Gleba depuis n'importe quel ecran.

**Acceptance Criteria:**

**Given** l'utilisateur visite https://gleba.fr sur Chrome desktop ou mobile
**When** le navigateur detecte le manifest PWA
**Then** une proposition d'installation est affichee (bandeau ou icone dans la barre d'adresse)

**Given** l'utilisateur installe la PWA
**When** il lance l'application depuis l'icone
**Then** l'application s'ouvre en mode standalone (sans barre de navigateur) avec l'icone et le nom "Gleba"

**Given** le manifest.json
**When** il est inspecte
**Then** il contient : name, short_name, description, start_url, display: standalone, theme_color, background_color, icons (192px et 512px)

**Given** l'utilisateur est sur un ecran desktop (> 1024px)
**When** il utilise l'application
**Then** les tableaux, formulaires et cartes utilisent l'espace disponible de maniere optimale (layout desktop prioritaire)

**Given** l'utilisateur est sur tablette (768-1024px)
**When** il utilise l'application
**Then** les tableaux passent en mode compact, les sidebars deviennent des drawers, et les formulaires restent utilisables

**Given** l'utilisateur est sur mobile (< 768px)
**When** il utilise l'application
**Then** les tableaux sont remplaces par des listes de cards, la navigation utilise un menu hamburger, et les actions principales sont accessibles en bas d'ecran

**Given** le service worker
**When** l'utilisateur charge la page
**Then** les assets statiques (JS, CSS, images, fonts) sont caches pour un chargement rapide lors des visites suivantes
**And** le First Contentful Paint est inferieur a 2 secondes (NFR3)

**Technical Notes:**
- Manifest.json existant a verifier et mettre a jour
- Service worker : utiliser next-pwa ou workbox pour le cache des assets
- Breakpoints Tailwind existants : sm (640px), md (768px), lg (1024px)
- Verifier les pages principales pour la responsivite : accueil, cultures, parcelles, carte, comptabilite
- Ne pas implementer le mode offline (hors perimetre) — uniquement le cache assets
