# Data Models — Gleba

> Généré le 2026-03-12 | 51 modèles Prisma | PostgreSQL 16 (PostGIS)

## Vue d'ensemble

- **ORM** : Prisma 5.22.0
- **BDD** : PostgreSQL 16 avec PostGIS 3.4
- **Multi-tenancy** : Par `userId` sur chaque modèle métier
- **Référentiels globaux** : Espece, Variete, ITP, Famille, Fournisseur, Destination, Fertilisant, EspeceAnimale, Aliment
- **Stocks per-user** : UserStockVariete, UserStockFertilisant, UserStockAliment, UserStockEspece

## Migrations

1. `20250129000000_add_auth` — Authentification et schéma noyau
2. `20250129000001_add_arbres` — Module arbres/verger
3. `20260308000000_add_login_logs` — Logs de connexion
4. `20260308100000_add_email_verification` — Vérification email

## Enums

| Enum | Valeurs |
|------|---------|
| **Role** | ADMIN, USER |

> Note : La plupart des champs "type" et "statut" utilisent des String avec des valeurs implicites (pas d'enum Prisma).

---

## Authentification (3 modèles)

### User (`users`)
Utilisateur de l'application. Clé de multi-tenancy.
- **PK** : `id` (CUID)
- **Champs clés** : email (unique), password (bcrypt), name, role (ADMIN/USER), active, emailVerified, apiToken (unique)
- **Relations** : ~40 relations 1:N vers tous les modèles métier

### Session (`sessions`)
Sessions NextAuth JWT.
- **PK** : `id` (CUID)
- **FK** : userId → User (Cascade)
- **Champs** : sessionToken (unique), expires

### LoginLog (`login_logs`)
Journal des tentatives de connexion.
- **PK** : `id` (autoincrement)
- **FK** : userId → User (Cascade, optionnel)
- **Champs** : email, success, reason, ip, userAgent, createdAt

---

## Référentiels niveau 1 (4 modèles)

### Famille (`familles`)
Familles botaniques (Solanacées, Cucurbitacées, etc.).
- **PK** : `id` (String)
- **Champs** : intervalle (années entre rotations), couleur, description
- **Relations** : especes[], associationDetails[]

### Fournisseur (`fournisseurs`)
Fournisseurs de semences, aliments, matériel.
- **PK** : `id` (String)
- **Champs** : contact, adresse, type (semences/aliments/animaux/materiel/mixte), conditionsPaiement, actif
- **Relations** : varietes[], aliments[]

### Destination (`destinations`)
Destinations de consommation (marché, AMAP, etc.).
- **PK** : `id` (String)
- **Relations** : consommations[], ventesProduits[]

### Fertilisant (`fertilisants`)
Amendements et engrais.
- **PK** : `id` (String)
- **Champs** : type, N/P/K/Ca/Mg/S (%), densite, prix, stock
- **Relations** : fertilisations[], userStocks[]

---

## Référentiels niveau 2 (4 modèles)

### Espece (`especes`)
Espèces cultivables (135+).
- **PK** : `id` (String)
- **FK** : familleId → Famille
- **Champs** : type (legume/arbre_fruitier/petit_fruit/aromatique/engrais_vert), nomLatin, rendement (kg/m²), vivace, besoinN/P/K/Eau, irrigation, conservation, prixKg, objectifAnnuel
- **Relations** : varietes[], cultures[], recoltes[], itps[], arbres[], userStocks[]

### Variete (`varietes`)
Cultivars d'une espèce.
- **PK** : `id` (String)
- **FK** : especeId → Espece (Cascade), fournisseurId → Fournisseur (SetNull)
- **Champs** : semaineRecolte, nbGrainesG, prixGraine, bio
- **Relations** : cultures[], userStocks[]

### ITP (`itps`)
Itinéraires Techniques de Plantes (planning cultural).
- **PK** : `id` (String)
- **FK** : especeId → Espece
- **Champs** : semaineSemis/Plantation/Recolte (1-52), dureeRecolte, dureePepiniere, nbRangs, espacement, typePlanche
- **Relations** : cultures[], rotationsDetails[]

### EspeceAnimale (`especes_animales`)
Espèces animales de référence.
- **PK** : `id` (String)
- **Champs** : nom, type (volaille/mammifere_petit/grand), production (oeufs/viande/lait/mixte), dureeGestation, ponteAnnuelle, consommationJour, prixAchat
- **Relations** : animaux[], lots[]

---

## Infrastructure spatiale & temporelle (7 modèles)

### Planche (`planches`)
Planches de culture / bandes de terre.
- **PK** : `id` (CUID)
- **FK** : userId → User (Cascade), rotationId → Rotation (SetNull), parcelleGeoId → ParcelleGeo (SetNull)
- **Champs** : nom (unique per-user), largeur, longueur, surface (m²), posX/posY (plan 2D), rotation2D, ilot, type (Serre/Plein champ/Tunnel), irrigation, typeSol, phSol, carboneOrg
- **Contrainte** : @unique([nom, userId])
- **Relations** : cultures[], fertilisations[], analyses[]

### Rotation (`rotations`)
Plans de rotation culturale.
- **PK** : `id` (String)
- **Champs** : active, nbAnnees, notes
- **Relations** : details[], planches[]

### RotationDetail (`rotations_details`)
Détail annuel d'une rotation.
- **FK** : rotationId → Rotation (Cascade), itpId → ITP (SetNull)
- **Champs** : annee (position dans le cycle)

### ParcelleGeo (`parcelles_geo`)
Parcelles géoréférencées (cadastre).
- **PK** : `id` (CUID)
- **Champs** : nom, geometry (GeoJSON), centroidLat/Lng, surface (ha), commune, section, numero, typeSol, usage, couleur
- **Relations** : planches[], objetsJardin[], arbres[], lotsAnimaux[]

### AnalyseSol (`analyses_de_sol`)
Analyses de sol (laboratoire ou estimation).
- **Champs** : texture (argile/limon/sable %), chimie (pH, MO%, CEC), macro (N/P/K/Ca/Mg/Na), oligo (Fe/Mn/Cu/Zn/B)

### ObjetJardin (`objets_jardin`)
Objets du plan 2D (allées, serres, composteurs).
- **Champs** : type (allee/passage/serre/compost/autre), dimensions, position, couleur

### Note (`notes`)
Notes générales.
- **Champs** : titre, contenu (Markdown), categorie, date

---

## Opérationnel — Cultures (5 modèles)

### Culture (`cultures`)
Instance de culture (semis → récolte).
- **PK** : `id` (autoincrement)
- **FK** : userId, especeId, varieteId, itpId, plancheId
- **Champs** : annee, dateSemis/Plantation/Recolte, semisFait/plantationFaite/recolteFaite, terminee, nbRangs, longueur, espacement, aIrriguer, derniereIrrigation
- **Index** : [userId, annee], [aIrriguer]
- **Relations** : recoltes[], irrigationsPlanifiees[]

### Recolte (`recoltes`)
Récoltes de cultures maraîchères.
- **Champs** : date, quantite (kg), statut (en_stock/vendu/consomme/perte), prixKg, prixTotal, clientId, factureId
- **Index** : [cultureId, date], [statut]

### IrrigationPlanifiee (`irrigations_planifiees`)
Planning d'irrigation automatique.
- **Champs** : datePrevue, fait, dateEffective

### Consommation (`consommations`)
Consommation de stock (auto-conso, dons).
- **Champs** : date, quantite (kg), prix, destinationId

### Fertilisation (`fertilisations`)
Applications d'amendements.
- **FK** : plancheId → Planche (Cascade), fertilisantId → Fertilisant (Restrict)
- **Champs** : date, quantite (kg/L)

---

## Module Arbres/Verger (8 modèles)

### Arbre (`arbres`)
Arbres fruitiers, forestiers, haies.
- **PK** : `id` (autoincrement)
- **Champs** : nom, type (fruitier/petit_fruit/forestier/ornement/haie), espece, variete, portGreffe, position (posX/posY, envergure), formeTaille, vigueur, floraison, groupePollinisation, autofertile, periodeRecolte, conservation, zoneId
- **Relations** : recoltesArbres[], productionsBois[], operationsArbres[], pollinisateurs[], observationsSante[]

### RecolteArbre (`recoltes_arbres`)
Récoltes de fruits d'arbres.
- **Champs** : date, quantite (kg), qualite, statut, prixKg, factureId

### ProductionBois (`production_bois`)
Production de bois (élagage, BRF, chauffage).
- **Champs** : type (elagage/abattage/branchage), volumeM3, poidsKg, destination, statut

### OperationArbre (`operations_arbres`)
Opérations d'entretien (taille, greffe, traitement).
- **Champs** : type, datePrevue, fait, dureeMinutes, cout, recurrence, saisonRecommandee

### ZoneVerger (`zones_verger`)
Zones du verger.
- **Champs** : nom, type (verger/haie/bosquet/agroforesterie), surface, exposition, altitude, protectionVent

### PollinisationArbre (`pollinisation_arbres`)
Compatibilité de pollinisation inter-arbres.
- **Contrainte** : @unique([arbrePolliniseId, arbrePollinisateurId])
- **Champs** : compatibilite (excellente/bonne/partielle/incompatible)

### ObservationSante (`observations_sante`)
Observations sanitaires (maladies, ravageurs).
- **Champs** : type (maladie/ravageur/carence), symptome, diagnostic, gravite, traitement, produit, DAR, numAMM, resolu

### Parametre (`params`)
Paramètres applicatifs clé-valeur.

---

## Module Élevage (9 modèles)

### Animal (`animaux`)
Animaux individuels.
- **FK** : especeAnimaleId, lotId, mereId (auto-référence généalogie)
- **Champs** : identifiant (bague/puce), nom, race, sexe, dateNaissance, statut (actif/vendu/abattu/mort), poidsActuel, posX/posY

### LotAnimaux (`lots_animaux`)
Lots/troupeaux.
- **Champs** : nom, dateArrivee, quantiteInitiale/Actuelle, statut (actif/reforme/termine)

### ProductionOeuf (`production_oeufs`)
Production d'oeufs quotidienne.
- **Champs** : date, quantite, casses, sales, calibre

### VenteProduit (`ventes_produits`)
Ventes de produits d'élevage.
- **Champs** : type (oeufs/viande/animal_vivant/lait), quantite, unite, prixUnitaire/Total, tauxTVA, paye, annule

### Abattage (`abattages`)
Registre d'abattage.
- **Champs** : quantite, poidsVif/Carcasse, destination (auto_consommation/vente/don), lieu (ferme/abattoir)

### ConsommationAliment (`consommations_aliments`)
Consommation d'aliments par lot.
- **FK** : alimentId → Aliment, lotId → LotAnimaux

### SoinAnimal (`soins_animaux`)
Soins vétérinaires.
- **Champs** : type (vaccination/vermifuge/traitement), produit, cout, veterinaire, datePrevue, fait

### NaissanceAnimale (`naissances_animales`)
Naissances.
- **Champs** : mereId, pereIdentifiant, date, nombreNes/Vivants/Males/Femelles

### Aliment (`aliments`)
Référentiel d'aliments pour animaux.
- **Champs** : nom, type (granules/cereales/foin), especesCibles, proteines, energie, prix, stock

---

## Module Comptabilité (5 modèles)

### Client (`clients`)
Clients / acheteurs.
- **Champs** : nom, type (particulier/professionnel/association/amap), adresse, SIRET, TVA intra, conditionsPaiement, exonererTVA, actif

### Facture (`factures`)
Factures émises (obligation légale — jamais supprimées, seulement annulées).
- **Champs** : numero (F-YYYY-NNNN, unique per-user), type (facture/avoir/acompte), totalHT/TVA/TTC, statut (brouillon/emise/payee/annulee)
- **Relations** : lignes[], ventesProduits[], abattages[], recoltesArbres[], productionsBois[]

### LigneFacture (`lignes_factures`)
Lignes de facture.
- **Champs** : description, quantite, prixUnitaire, tauxTVA (5.5/10/20), montantHT/TVA/TTC

### VenteManuelle (`ventes_manuelles`)
Ventes saisies manuellement.
- **Champs** : categorie (legumes/fruits/transformation/service), sourceType/sourceId (lien auto-compta), auto (flag)

### DepenseManuelle (`depenses_manuelles`)
Dépenses saisies manuellement.
- **Champs** : categorie (materiel/carburant/main_oeuvre/abonnement), sourceType/sourceId, auto (flag)

---

## Stocks per-user (4 modèles)

| Modèle | Table | Clé composite | Champs stock |
|--------|-------|---------------|--------------|
| UserStockVariete | `user_stock_varietes` | [userId, varieteId] | stockGraines (g), stockPlants (nb) |
| UserStockFertilisant | `user_stock_fertilisants` | [userId, fertilisantId] | stock (kg/L), prix |
| UserStockAliment | `user_stock_aliments` | [userId, alimentId] | stock (kg), stockMin (alerte) |
| UserStockEspece | `user_stock_especes` | [userId, especeId] | inventaire (kg), objectifAnnuel |

---

## Interventions & Traçabilité (1 modèle)

### Intervention (`interventions`)
Opérations terrain avec traçabilité phytosanitaire.
- **Champs** : type (semis/plantation/desherbage/.../traitement_phyto), cultureId/plancheId/arbreId, dureeMinutes, nbPersonnes, produitPhyto, numAMM, DAR, delaiReentree, doseAppliquee, surfaceTraitee

---

## Chat IA (2 modèles)

### Conversation (`conversations`)
- **Champs** : userId, title, createdAt
- **Relations** : messages[]

### ChatMessage (`chat_messages`)
- **Champs** : role (user/assistant/tool), content (@db.Text), toolCalls (Json), toolResults (Json)

---

## Météo (2 modèles)

### MeteoCache (`meteo_cache`)
Cache de données météo Open-Meteo.
- **Contrainte** : @unique([lat, lng, date, source])
- **Champs** : températures min/max, précipitation, ET0, radiation, ensoleillement, humidité, vent

### StationMeteo (`stations_meteo`)
Stations météo personnelles.
- **Champs** : provider (ecowitt/wunderground/netatmo), stationId, apiKey, lat/lng, active

---

## Diagramme des relations clés

```
User ──┬── Planche ──── Culture ──── Recolte
       │       │            │
       │       └── Rotation ── RotationDetail ── ITP ── Espece ── Famille
       │                                                    │
       │                                              Variete
       │
       ├── Arbre ──┬── RecolteArbre
       │           ├── OperationArbre
       │           ├── ProductionBois
       │           └── ObservationSante
       │
       ├── Animal ──┬── SoinAnimal
       │    │       ├── ProductionOeuf
       │    │       └── Abattage
       │    └── LotAnimaux
       │
       ├── Client ── Facture ── LigneFacture
       │
       ├── VenteManuelle / DepenseManuelle
       │
       └── ParcelleGeo ── ObjetJardin
```
