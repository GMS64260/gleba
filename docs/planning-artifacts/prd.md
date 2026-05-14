---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - docs/project-context.md
  - docs/project-overview.md
  - docs/architecture.md
  - docs/data-models.md
  - docs/api-contracts.md
  - docs/component-inventory.md
  - docs/source-tree-analysis.md
  - docs/development-guide.md
  - docs/deployment-guide.md
  - docs/brainstorming/brainstorming-session-2026-03-13-001.md
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 1
  projectDocs: 9
classification:
  projectType: web_app
  domain: agritech_erp
  complexity: medium
  projectContext: brownfield
workflowType: 'prd'
---

# Product Requirements Document - Gleba

**Author:** Guillaume Gomes
**Date:** 2026-03-14

## Executive Summary

Gleba est un ERP Open Core pour micro-fermes diversifiees (socle AGPL-3.0, couche IA proprietary), couvrant le maraichage, le verger, l'elevage et la comptabilite. Deploye en production sur https://gleba.fr, le systeme gere 51 modeles de donnees, 70+ endpoints API et 95 composants React au sein d'un monolithe Next.js 16 + PostgreSQL.

Ce PRD couvre la transformation de Gleba d'un ensemble de modules fonctionnels en silos vers un **ERP integre autour d'un socle spatial et comptable unifie**. L'evolution s'articule en 6 phases : creation de l'entite Parcelle, spatialisation des modules existants, unification de la comptabilite, carte globale multi-couches, harmonisation avancee, et interface robotique.

Public cible : micro-fermiers, maraîchers et permaculteurs qui ont besoin d'un outil complet sans ressaisie de donnees, avec une vision globale de leur exploitation.

## Differenciateur Produit

**IA by design.** Contrairement aux alternatives (Brinjel, Qrop, tableurs), Gleba expose nativement 39 outils MCP et integre un assistant Ollama capable de lire et agir sur l'ensemble des donnees. L'IA est une couche architecturale native, pas un gadget. L'harmonisation du socle permettra a l'agent IA de raisonner sur un modele unifie plutot que sur des fragments deconnectes.

**Construit par le terrain, pour le terrain.** Ne de besoins reels, code en autodidacte module par module. Cette evolution consolide les fondations pour que l'ensemble devienne plus que la somme de ses parties — une ferme entiere visible d'un coup d'oeil, ou chaque geste metier declenche automatiquement les ecritures comptables.

## Project Classification

| Attribut | Valeur |
|----------|--------|
| Type de projet | Web App (monolithe full-stack, PWA) |
| Domaine | Agritech / ERP agricole |
| Complexite | Moyenne — contraintes reglementaires ciblees (tracabilite phytosanitaire, facturation legale, TVA, registre abattage) |
| Contexte | Brownfield — systeme existant mature en production |
| Stack | Next.js 16, React 18, Prisma, PostgreSQL 16 (PostGIS), Docker + Caddy |
| Licence | Open Core — socle AGPL-3.0, couche IA + ITPs proprietary |

## Success Criteria

### User Success

- **Zero saisie comptable manuelle** : chaque evenement metier (recolte vendue, abattage, vente oeufs, production bois) genere automatiquement l'ecriture comptable correspondante.
- **Vision globale immediate** : l'utilisateur ouvre la carte et visualise l'ensemble de son exploitation — parcelles, planches, arbres, lots d'animaux — avec des couches activables par activite.
- **Navigation fluide entre modules** : depuis une parcelle sur la carte, acceder directement aux cultures, arbres ou lots qu'elle contient. Fin des silos.
- **Moment "aha"** : creer une recolte, la marquer vendue, et voir instantanement la facture + l'ecriture comptable + le stock mis a jour — sans changer de page.

### Business Success

- **Modele Open Core** : socle AGPL-3.0 pour l'adoption communautaire, couche IA + ITPs proprietary pour la monetisation. SaaS IA heberge a terme.
- **Adoption** : 2-3 structures exterieures (ecole, maraîcher, ecolieu) utilisent Gleba en production dans les 12 mois suivant l'harmonisation.
- **Communaute** : contributions exterieures sur GitHub (issues, PRs) comme indicateur d'interet.
- **Monetisation opportuniste** : support/hebergement si la demande emerge. Multi-tenancy deja en place.

### Technical Success

- **Zero regression** : aucune fonctionnalite existante ne cesse de fonctionner. Chaque phase deployee et verifiee independamment.
- **Modele de donnees unifie** : l'entite Parcelle relie coheremment planches, arbres et lots d'animaux.
- **Couverture MCP** : les 39 outils existants continuent de fonctionner + nouvelles entites exposees via de nouveaux outils.
- **Performance** : carte avec 50+ parcelles et couches d'activite en moins de 3 secondes.

### Measurable Outcomes

| Critere | Etat actuel | Cible |
|---------|-------------|-------|
| Ecritures comptables auto-generees | Partiel (recoltes, abattages) | 100% des evenements de vente |
| Modules relies spatialement | 1 (maraîchage via planches) | 3 (+ verger + elevage via parcelles) |
| Saisie manuelle pour une vente complete | ~4 etapes sur 2-3 pages | 1-2 clics depuis l'evenement source |
| Outils MCP couvrant le modele | 39 | 45+ (parcelles, transactions, carte) |
| Regressions post-deploiement | — | 0 |

## User Journeys

### 1. Marie, maraîchere diversifiee — Recolte → vente → compta

**Qui :** Marie, 34 ans, 8000 m² en maraîchage + 15 arbres fruitiers + 20 poules. Seule sur l'exploitation.

**Scene d'ouverture :** Mardi matin, Marie ouvre Gleba. Tomates mures en planche P3, oeufs a ramasser, client AMAP a 17h. Aujourd'hui elle navigue entre 3 onglets (potager, elevage, compta) et ressaisit les donnees a chaque etape.

**Action montante :** Apres l'harmonisation, Marie ouvre la carte et voit ses 3 parcelles : potager (6 planches), verger (15 pommiers), enclos poules. Elle touche la parcelle potager, voit les cultures par planche, touche P3, recolte 12 kg de tomates en 2 taps. Bascule sur l'enclos, saisit 18 oeufs. Marque 8 kg de tomates + 12 oeufs comme "vendus AMAP" — un seul geste.

**Climax :** Onglet compta : facture AMAP generee, ecritures de vente presentes, stock mis a jour. Zero saisie manuelle, 15 minutes gagnees.

**Resolution :** De 45 min de saisie quotidienne a 10 min. Le soir, elle demande a l'assistant IA "CA tomates ce mois-ci ?" — reponse instantanee car modele unifie.

**Capacites revelees :** Carte multi-couches, navigation parcelle → culture, recolte rapide, vente groupee multi-modules, auto-compta transversale.

### 2. Marie — Planification annuelle via les parcelles

**Scene d'ouverture :** Janvier, Marie planifie sa saison : parcelles disponibles, rotations, placement d'un nouveau lot de poules.

**Action montante :** Carte globale, 3 couches actives. Parcelle sud en jachere (rotation OK pour solanacees), verger a tailler en fevrier, enclos poules trop petit. Elle dessine un nouveau contour, l'attribue comme paturage volaille, deplace le lot "Poules 2026".

**Climax :** Calendrier unifie en une vue : semis mars (potager), tailles fevrier (verger), vaccinations poules (elevage). Tout lie aux parcelles.

**Resolution :** Planification de 2 jours sur tableur a une apres-midi dans Gleba.

**Capacites revelees :** Dessin de parcelles, attribution couches, calendrier unifie multi-modules, deplacement lots, historique spatial.

### 3. Admin — Referentiels et onboarding

**Qui :** Guillaume, createur de Gleba, role ADMIN.

**Scene d'ouverture :** Une ecole veut utiliser Gleba. Configuration des referentiels et verification systeme.

**Action montante :** Ajout de 5 varietes de tomates anciennes au referentiel global. Verification des ITPs, controle logs et metriques.

**Climax :** L'ecole se connecte, cree ses parcelles, saisit ses cultures. Tout fonctionne sans intervention supplementaire.

**Capacites revelees :** Gestion referentiels globaux, monitoring, onboarding, separation admin/user.

### 4. Agent IA / MCP — Orchestration transversale

**Qui :** Assistant Ollama integre ou agent externe via MCP.

**Scene d'ouverture :** Marie demande : "Resume de ma semaine : recoltes, ventes, taches en retard, meteo."

**Action montante :** L'agent interroge les outils MCP : recoltes (potager + verger), ventes et ecritures comptables, taches en retard, previsions meteo. Modele unifie = socle coherent sans recoupement de fragments.

**Climax :** "Cette semaine : 45 kg de legumes, 126 oeufs, 2 kg de pommes. CA : 380 EUR. 2 taches en retard : vermifuge poules (urgent), taille pommier Golden. Pluie jeudi — pas d'irrigation."

**Resolution :** L'IA est le copilote de la ferme. Demain, un robot humanoïde consomme les memes outils.

**Capacites revelees :** Outils MCP sur modele unifie, requetes transversales, base pour interfacage robotique.

### Journey Requirements Summary

| Parcours | Capacites cles |
|----------|---------------|
| Recolte → vente → compta | Auto-compta transversale, vente groupee multi-modules |
| Planification annuelle | Carte multi-couches, dessin parcelles, calendrier unifie, deplacement lots |
| Admin referentiels | Gestion globale, monitoring, onboarding |
| Agent IA/MCP | Outils MCP sur modele unifie, requetes transversales, base robotique |
| *Future : Ecole/equipe* | *Mode multi-utilisateurs partageant les memes parcelles (hors perimetre MVP)* |

## Domain-Specific Requirements

### Compliance & Regulatory

- **Registre phytosanitaire DRAAF** : le modele `Intervention` couvre la majorite des champs requis. Verification de conformite exacte hors perimetre de ce PRD.
- **Export Telepac (PAC)** : export parcelles au format Telepac (XML/GeoJSON + codes cultures PAC). Prerequis : entite Parcelle. Planifie en **Phase 3**.
- **RGPD** : mecanisme d'export/suppression des donnees utilisateur a evaluer si adoption par des structures externes. Non prioritaire MVP.

### Integration Requirements

- **Cagette.net** : synchronisation bidirectionnelle pour les ventes en circuit court (publication disponibilites, remontee commandes/ventes avec auto-compta). A evaluer en Phase 3-4.

## Innovation & Licensing

### Innovation Areas

**1. ERP agricole IA-natif.** Aucun outil comparable n'expose une couche IA native capable de lire ET ecrire sur l'ensemble des donnees metier. 39 outils MCP + assistant integre. L'harmonisation amplifie cette capacite.

**2. Architecture agent-ready.** Le pattern MCP rend Gleba consommable par n'importe quel agent — logiciel ou physique (robot humanoïde). Architecture "agent-agnostique".

**3. Modele Open Core + SaaS IA.** Socle ERP AGPL-3.0 pour l'adoption. Couche IA et ITPs enrichis proprietaires. Service IA heberge (SaaS) prevu a terme.

### Licensing Model

| Element | Licence | Justification |
|---------|---------|---------------|
| Socle ERP (app, components, lib hors chat) | AGPL-3.0 | Adoption, communaute, contributions |
| Schema Prisma, validations Zod | AGPL-3.0 | Necessaire au fonctionnement de base |
| Especes de base + seed basique | AGPL-3.0 | Le fork fonctionne en mode degrade |
| Couche IA (src/lib/chat/, mcp-server/) | Proprietary | Avantage competitif, differenciateur |
| ITPs enrichis | Proprietary | Savoir-faire agronomique, second moat |
| Service IA heberge (futur) | SaaS proprietary | Revenu recurrent |

### Competitive Landscape

| Solution | Couverture | IA native | Licence socle | Couche IA |
|----------|-----------|-----------|---------------|-----------|
| **Gleba** | Maraîchage + verger + elevage + compta | Oui (39 outils MCP) | AGPL-3.0 | Proprietary |
| Brinjel | Maraîchage | Non | Proprietary | — |
| Qrop | Maraîchage | Non | GPL | — |
| Ekylibre | ERP agricole complet | Non | AGPL | API REST |

## Web App Technical Requirements

### Architecture

- Application desktop-first, responsive tablette et mobile.
- Breakpoints : desktop (> 1024px, prioritaire), tablette (768-1024px), mobile (< 768px).
- Pages existantes en client components (`"use client"`) — inchange.
- Futures pages SEO en Server Components. Strategie SEO forte prevue, details a definir.

### Temps reel

- WebSocket ou SSE pour synchronisation multi-utilisateurs (contexte ecole/ecolieu).
- Cas d'usage prioritaire : mise a jour carte quand un autre utilisateur modifie une parcelle.
- A evaluer en Phase 4-5.

### PWA

- Application installable (manifest.json existant).
- Service worker pour cache assets statiques.
- Mode offline reporte a une phase ulterieure.

### Browser Support

| Navigateur | Priorite |
|-----------|----------|
| Chrome Desktop | Haute — usage principal |
| Firefox Desktop | Moyenne |
| Chrome/Safari Mobile | Moyenne — responsive |
| Navigateurs anciens | Non supporte |

## Project Scoping & Phased Development

### MVP Strategy

**Approche :** Problem-solving MVP — socle spatial unifie le plus vite possible, puis iterations.

**Ressources :** Developpeur solo, deploiement continu sur https://gleba.fr. Chaque phase deployee et verifiee avant la suivante.

### Phase 1 — Entite Parcelle (MVP)

- Modele Prisma `Parcelle` : contour GeoJSON, surface auto-calculee, nom, couches d'activite
- API CRUD parcelles avec multi-tenancy (userId)
- Champ `parcelleId` optionnel sur Planche, Arbre, LotAnimaux
- Migration BDD non-destructive (FK optionnelles)
- Outils MCP pour les parcelles

### Phase 2 — Spatialisation (MVP)

- UI d'attribution : rattacher arbres et lots d'animaux aux parcelles
- Historique de deplacement des lots entre parcelles
- Mise a jour des APIs arbres et elevage pour filtrer par parcelle
- Les vues existantes affichent la parcelle de rattachement

**Parcours MVP supporte :** arbres et lots rattaches a des parcelles, donnee spatiale coherente, modele pret pour la carte.

### Phase 3 — Comptabilite unifiee + Integrations (Growth)

- Modele de transaction unique remplacant VenteManuelle/DepenseManuelle
- Generation automatique d'ecritures depuis tous les evenements metier
- Auto-consommation comme mouvement interne
- Simplification des pages comptabilite
- Export Telepac (parcelles → format PAC)
- Integration Cagette.net (si effort raisonnable)
- Nouveaux outils MCP pour les transactions unifiees

### Phase 4 — Carte globale (Growth)

- Nouvelle page `/carte` avec affichage parcelles multi-couches
- Toggles par activite (maraîchage, verger, elevage)
- Dessin de contours + attribution d'activites
- Lien vers plan 2D pour les parcelles maraîchage
- Temps reel (synchronisation multi-user)

### Phase 5 — Harmonisation avancee (Vision)

- Calendrier unifie multi-couches
- Dashboard "ma journee" par parcelle
- Matrice compatibilite usages
- Rotation paturage native
- SEO (pages publiques, landing)
- Mode equipe multi-utilisateurs (ecoles/ecolieux)

### Phase 6 — Interface robotique (Vision)

- Interfacage robots humanoïdes via MCP
- SaaS IA heberge

### Risk Mitigation

**Technique — Compta unifiee (Phase 3) :** Chantier le plus risque (touche auto-compta, ventes, factures, TVA). Migration progressive avec coexistence ancien/nouveau modele. Tests manuels exhaustifs avant bascule.

**Regression — Toutes phases :** Checklist obligatoire : `npm run build` → Docker rebuild → curl endpoints → logs. Aucune phase suivante tant que la precedente est stable.

**Ressources — Dev solo :** Phases decoupables en sous-phases. FK optionnelles = livraisons incrementales sans bloquer l'existant.

**Marche — Adoption :** Open Core mitigue : AGPL attire la communaute, IA proprietary protege la valeur. Pas de pression time-to-market.

**Separation open/proprietary :** Frontiere architecturale claire. A terme, deux repos (public AGPL + prive proprietary).

**MCP protocole jeune :** Architecture decouplable — outils MCP encapsulent des appels API REST.

**Fork concurrent :** Le fork AGPL fonctionne mais sans IA, sans ITPs enrichis, sans service cloud.

**Donnees geographiques :** Contours GeoJSON = donnees de localisation. Multi-tenancy filtre par userId sur Parcelle.

## Functional Requirements

### Gestion des Parcelles

- **FR1:** L'utilisateur peut creer une parcelle en dessinant un contour GeoJSON avec un nom et des couches d'activite assignables
- **FR2:** L'utilisateur peut modifier les proprietes d'une parcelle (nom, couches, contour)
- **FR3:** L'utilisateur peut supprimer une parcelle
- **FR4:** Le systeme calcule automatiquement la surface d'une parcelle a partir de son contour GeoJSON
- **FR5:** L'utilisateur peut attribuer des couches d'activite a une parcelle (maraîchage, verger, elevage, paturage)
- **FR6:** L'utilisateur peut rattacher des planches existantes a une parcelle
- **FR7:** L'utilisateur peut rattacher des arbres existants a une parcelle
- **FR8:** L'utilisateur peut rattacher un lot d'animaux a une parcelle
- **FR9:** L'utilisateur peut deplacer un lot d'animaux d'une parcelle a une autre avec historique de deplacement
- **FR10:** L'utilisateur peut consulter l'historique des deplacements de lots par parcelle

### Carte Globale

- **FR11:** L'utilisateur peut visualiser toutes ses parcelles sur une carte interactive
- **FR12:** L'utilisateur peut activer/desactiver des couches d'activite sur la carte (maraîchage, verger, elevage)
- **FR13:** L'utilisateur peut naviguer depuis une parcelle sur la carte vers les cultures, arbres ou lots qu'elle contient
- **FR14:** L'utilisateur peut dessiner de nouvelles parcelles directement sur la carte
- **FR15:** L'utilisateur peut acceder au plan 2D jardin depuis une parcelle maraîchage sur la carte
- **FR16:** Le systeme synchronise en temps reel les modifications de parcelles entre utilisateurs connectes simultanement

### Comptabilite Unifiee

- **FR17:** Le systeme genere automatiquement une ecriture comptable pour chaque evenement de vente (recolte maraîchage, recolte arbre, vente oeufs, vente produit elevage, production bois, abattage)
- **FR18:** L'utilisateur peut visualiser l'ensemble de ses revenus et depenses dans une vue unifiee tous modules confondus
- **FR19:** L'utilisateur peut enregistrer une auto-consommation comme mouvement interne (pas de vente, pas de revenu)
- **FR20:** Le systeme maintient les ecritures comptables auto-generees synchronisees avec leurs evenements sources (modification/suppression cascade)
- **FR21:** L'utilisateur peut consulter le cout de revient par culture/production

### Facturation & Conformite

- **FR22:** Le systeme genere des factures avec numerotation legale (F-YYYY-NNNN) a partir des ventes
- **FR23:** L'utilisateur peut exporter ses parcelles au format Telepac (PAC)
- **FR24:** L'utilisateur peut consulter le registre de tracabilite phytosanitaire (interventions avec numAMM, DAR, doses)
- **FR25:** Le systeme calcule les declarations TVA selon les 3 taux (5.5%, 10%, 20%)

### Integrations Externes

- **FR26:** L'utilisateur peut synchroniser ses ventes avec Cagette.net (publication disponibilites, remontee commandes)
- **FR27:** Le systeme expose les nouvelles entites (parcelles, transactions) via des outils MCP
- **FR28:** Les outils MCP existants (39) continuent de fonctionner sans regression
- **FR29:** Un agent IA peut effectuer des requetes transversales sur le modele unifie (parcelles + cultures + elevage + compta)

### Calendrier & Taches

- **FR30:** L'utilisateur peut visualiser un calendrier unifie multi-modules (semis, plantations, recoltes, soins, operations verger, irrigations)
- **FR31:** L'utilisateur peut filtrer le calendrier par type d'activite (maraîchage, verger, elevage)
- **FR32:** L'utilisateur peut consulter un dashboard "ma journee" regroupant les taches de tous les modules par parcelle
- **FR33:** Le systeme genere automatiquement des taches a partir des ITPs, cycles elevage et calendriers verger

### Administration & Multi-tenancy

- **FR34:** L'admin peut gerer les referentiels globaux (especes, varietes, ITPs, aliments, fertilisants)
- **FR35:** Le systeme filtre toutes les donnees metier par userId (multi-tenancy)
- **FR36:** L'admin peut consulter les logs de connexion et metriques systeme
- **FR37:** Le systeme separe architecturalement le code open source (AGPL) du code proprietary (IA, ITPs)

### PWA & Accessibilite

- **FR38:** L'utilisateur peut installer l'application comme PWA sur son appareil
- **FR39:** L'application fonctionne en mode desktop-first avec responsive tablette et mobile

## Non-Functional Requirements

### Performance

- **NFR1:** Les actions utilisateur (navigation, saisie, enregistrement) completent en moins de 1 seconde
- **NFR2:** La carte multi-couches avec 50+ parcelles se charge en moins de 3 secondes
- **NFR3:** Le First Contentful Paint est inferieur a 2 secondes
- **NFR4:** Les ecritures comptables auto-generees sont creees en moins de 500ms apres l'evenement source
- **NFR5:** Le build Docker de production complete en moins de 5 minutes

### Securite

- **NFR6:** Toutes les donnees metier sont filtrees par userId — aucun utilisateur ne peut acceder aux donnees d'un autre
- **NFR7:** Les mots de passe sont hashes avec bcrypt — jamais stockes en clair
- **NFR8:** Les sessions utilisent JWT avec expiration geree par NextAuth
- **NFR9:** Les routes API sensibles sont protegees par rate limiting
- **NFR10:** Le code proprietary (couche IA, ITPs) est separe du code AGPL dans des repositories distincts a terme
- **NFR11:** L'API MCP utilise un bearer token separe pour l'authentification
- **NFR12:** Les objets Prisma incluant le modele User ne retournent jamais le hash du mot de passe au client

### Integration

- **NFR13:** Les outils MCP repondent en moins de 2 secondes par appel
- **NFR14:** L'integration Cagette.net tolere les indisponibilites du service externe (retry + fallback gracieux)
- **NFR15:** L'export Telepac genere un fichier conforme au format attendu par la plateforme PAC

### Fiabilite

- **NFR16:** Zero regression : chaque phase deployee passe la checklist de verification (build, curl endpoints, logs) avant d'etre consideree stable
- **NFR17:** Les migrations BDD sont non-destructives — les FK optionnelles permettent un rollback sans perte de donnees
- **NFR18:** Les operations comptables (ventes, factures, ecritures auto) utilisent des transactions Prisma atomiques

### Maintenabilite

- **NFR19:** Le code respecte les conventions existantes : TypeScript strict, path alias `@/`, validations Zod, composants Shadcn/UI
- **NFR20:** Chaque nouvelle entite (Parcelle, transactions) est documentee dans le schema Prisma et exposee via les outils MCP
