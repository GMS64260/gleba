# API Contracts — Gleba

> Généré le 2026-03-12 | Scan level: deep | 70+ endpoints

## Patterns communs

- **Auth** : Toutes les routes nécessitent `requireAuthApi()` (JWT via NextAuth)
- **Multi-tenancy** : Les données sont filtrées par `userId: session.user.id`
- **Pagination** : `page`, `pageSize`, `sortBy`, `sortOrder` (la plupart des endpoints GET list)
- **Soft deletes** : Factures (statut=annulee), Clients (actif=false), VenteProduit (annule=true)
- **Auto-comptabilité** : Ventes, Récoltes, Abattages créent automatiquement des écritures comptables

---

## Module Jardin

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/jardin` | Planches avec positions et cultures actives (filtre parcelle) |
| GET | `/api/objets-jardin` | Liste des objets jardin (allées, serres, etc.) |
| POST | `/api/objets-jardin` | Créer un objet jardin |
| PUT | `/api/objets-jardin/[id]` | Modifier un objet jardin |
| DELETE | `/api/objets-jardin/[id]` | Supprimer un objet jardin |

## Module Cultures

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/cultures` | Lister les cultures (pagination, filtres annee/espece/planche/etat) |
| POST | `/api/cultures` | Créer une culture (valide dates, occupation, décremente stock) |
| GET | `/api/cultures/[id]` | Détail culture |
| PUT | `/api/cultures/[id]` | Mise à jour complète |
| PATCH | `/api/cultures/[id]` | Mise à jour partielle (semisFait, plantationFaite, etc.) |
| DELETE | `/api/cultures/[id]` | Supprimer (cascade récoltes) |
| POST | `/api/cultures/irriguer` | Marquer irrigation effectuée |

## Module Récoltes

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/recoltes` | Lister récoltes (pagination, filtres espece/culture/date) |
| POST | `/api/recoltes` | Créer récolte (valide ownership culture) |
| GET | `/api/recoltes/[id]` | Détail récolte |
| PUT | `/api/recoltes/[id]` | Modifier récolte |
| PATCH | `/api/recoltes/[id]` | Marquer vendu + auto-facture + auto-compta |
| DELETE | `/api/recoltes/[id]` | Supprimer (cleanup auto-compta) |

## Module Planches

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/planches` | Lister planches (pagination, recherche, filtres ilot/rotation) |
| POST | `/api/planches` | Créer planche (nom unique per-user, auto-calcul surface) |
| GET | `/api/planches/[id]` | Détail planche (id=nom, rotation, cultures, fertilisations) |
| PUT | `/api/planches/[id]` | Modifier planche |
| DELETE | `/api/planches/[id]` | Supprimer (échec si cultures existent) |

## Module Espèces (Référentiel global)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/especes` | Lister espèces (pagination, filtres type/famille) |
| POST | `/api/especes` | Créer espèce (Admin) |
| GET | `/api/especes/[id]` | Détail espèce (variétés, ITPs) |
| PUT | `/api/especes/[id]` | Modifier espèce |
| DELETE | `/api/especes/[id]` | Supprimer (échec si cultures/récoltes) |

## Module Variétés

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/varietes` | Lister variétés (filtres espece/fournisseur, inclut stock user) |
| POST | `/api/varietes` | Créer variété (Admin) |
| PUT | `/api/varietes/[id]` | Modifier variété (Admin) |
| DELETE | `/api/varietes/[id]` | Supprimer variété (Admin) |

## Module ITPs (Itinéraires Techniques)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/itps` | Lister ITPs (filtres especeId) |
| POST | `/api/itps` | Créer ITP |
| GET | `/api/itps/[id]` | Détail ITP |
| PUT | `/api/itps/[id]` | Modifier ITP |
| DELETE | `/api/itps/[id]` | Supprimer ITP (échec si cultures/rotations) |

## Module Arbres (Verger)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/arbres` | Lister arbres (filtres parcelle/type/zone/etat) |
| POST | `/api/arbres` | Créer arbre (auto-génère calendrier soins) |
| GET | `/api/arbres/[id]` | Détail arbre |
| PUT | `/api/arbres/[id]` | Modifier arbre |
| DELETE | `/api/arbres/[id]` | Supprimer arbre |
| GET | `/api/arbres/recoltes` | Lister récoltes arbres (filtres arbreId/year/statut) |
| POST | `/api/arbres/recoltes` | Créer récolte arbre |
| PUT | `/api/arbres/recoltes/[id]` | Modifier récolte arbre |
| PATCH | `/api/arbres/recoltes/[id]` | Marquer vendu + auto-facture |
| DELETE | `/api/arbres/recoltes/[id]` | Supprimer récolte arbre |
| GET | `/api/arbres/bois` | Lister productions bois |
| POST | `/api/arbres/bois` | Créer production bois |
| PUT | `/api/arbres/bois/[id]` | Modifier production bois |
| DELETE | `/api/arbres/bois/[id]` | Supprimer production bois |
| GET | `/api/arbres/operations` | Lister opérations arbre |
| POST | `/api/arbres/operations` | Créer opération |
| PUT | `/api/arbres/operations/[id]` | Modifier opération |
| DELETE | `/api/arbres/operations/[id]` | Supprimer opération |
| POST | `/api/arbres/[id]/generer-calendrier` | Générer calendrier soins pour un arbre |
| GET | `/api/arbres/observations` | Lister observations santé |
| POST | `/api/arbres/observations` | Créer observation santé |
| GET | `/api/arbres/pollinisation` | Matrice de pollinisation |
| GET | `/api/arbres/zones` | Lister zones verger |
| POST | `/api/arbres/zones` | Créer zone verger |
| GET | `/api/arbres/taches` | Tâches verger à venir |

## Module Élevage

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/elevage/animaux` | Lister animaux (filtres espece/statut/lot/sexe) |
| POST | `/api/elevage/animaux` | Créer animal |
| PATCH | `/api/elevage/animaux` | Mise à jour rapide animal |
| GET | `/api/elevage/animaux/[id]` | Détail animal (généalogie, naissances, productions, soins) |
| PUT | `/api/elevage/animaux/[id]` | Modifier animal complet |
| PATCH | `/api/elevage/animaux/[id]` | Mise à jour partielle (statut, poids) |
| DELETE | `/api/elevage/animaux/[id]` | Supprimer animal |
| GET | `/api/elevage/lots` | Lister lots d'animaux |
| POST | `/api/elevage/lots` | Créer lot |
| GET | `/api/elevage/soins` | Lister soins (filtres animal/lot/type/fait) |
| POST | `/api/elevage/soins` | Créer soin |
| PATCH | `/api/elevage/soins` | Modifier soin |
| DELETE | `/api/elevage/soins` | Supprimer soin |
| GET | `/api/elevage/production-oeufs` | Lister productions oeufs |
| POST | `/api/elevage/production-oeufs` | Créer production oeufs |
| PATCH | `/api/elevage/production-oeufs` | Modifier production oeufs |
| DELETE | `/api/elevage/production-oeufs` | Supprimer production oeufs |
| GET | `/api/elevage/ventes` | Lister ventes produits (filtres type/date/paye) |
| POST | `/api/elevage/ventes` | Créer vente (auto-compta, met à jour statut animal) |
| PATCH | `/api/elevage/ventes` | Modifier vente (paye, facture) |
| DELETE | `/api/elevage/ventes` | Soft-delete vente |
| GET | `/api/elevage/abattages` | Lister abattages |
| POST | `/api/elevage/abattages` | Créer abattage |
| GET | `/api/elevage/consommations-aliments` | Lister consommations aliments |
| POST | `/api/elevage/consommations-aliments` | Créer consommation aliment |
| GET | `/api/elevage/naissances` | Lister naissances |
| POST | `/api/elevage/naissances` | Créer naissance |
| GET | `/api/elevage/stats` | Statistiques élevage (effectifs, production, coûts) |
| GET | `/api/elevage/analyse-couts` | Analyse coûts élevage |
| GET | `/api/elevage/mortalites` | Taux de mortalité |
| GET | `/api/elevage/taches` | Tâches élevage à venir |

## Module Comptabilité

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/comptabilite/clients` | Lister clients (filtres type/actif/recherche) |
| POST | `/api/comptabilite/clients` | Créer client |
| PATCH | `/api/comptabilite/clients` | Modifier client |
| DELETE | `/api/comptabilite/clients` | Soft-delete client |
| GET | `/api/comptabilite/factures` | Lister factures (filtres year/statut/type/client) |
| POST | `/api/comptabilite/factures` | Créer facture (auto-numéro) |
| PATCH | `/api/comptabilite/factures` | Modifier facture (statut, paiement) |
| DELETE | `/api/comptabilite/factures` | Soft-delete facture (annulee) |
| GET | `/api/comptabilite/revenus` | Revenus unifiés (tous modules agrégés) |
| GET | `/api/comptabilite/depenses` | Dépenses unifiées (tous modules agrégés) |
| GET | `/api/comptabilite/ventes-manuelles` | Lister ventes manuelles |
| POST | `/api/comptabilite/ventes-manuelles` | Créer vente manuelle |
| PATCH | `/api/comptabilite/ventes-manuelles` | Modifier vente manuelle |
| DELETE | `/api/comptabilite/ventes-manuelles` | Supprimer vente manuelle |
| GET | `/api/comptabilite/depenses-manuelles` | Lister dépenses manuelles |
| POST | `/api/comptabilite/depenses-manuelles` | Créer dépense manuelle |
| PATCH | `/api/comptabilite/depenses-manuelles` | Modifier dépense manuelle |
| DELETE | `/api/comptabilite/depenses-manuelles` | Supprimer dépense manuelle |
| GET | `/api/comptabilite/stats` | Statistiques comptables (CA, marges, TVA) |
| GET | `/api/comptabilite/tva` | Déclarations TVA |
| GET | `/api/comptabilite/couts-production` | Coûts de production par culture |

## Modules Transversaux

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/calendrier` | Événements calendrier (semis, plantations, récoltes, irrigations, soins) |
| GET | `/api/taches` | Tâches à faire (tous modules) |
| POST | `/api/taches` | Créer tâche |
| GET | `/api/interventions` | Lister interventions terrain |
| POST | `/api/interventions` | Créer intervention (traçabilité phytosanitaire) |
| GET | `/api/tracabilite` | Registre de traçabilité |
| GET | `/api/carte` | Données carte (parcelles géo) |
| POST | `/api/carte` | Créer parcelle géo |
| GET | `/api/meteo` | Données météo (cache Open-Meteo) |
| GET | `/api/lunaire` | Calendrier lunaire |
| GET | `/api/sol` | Données pédologiques (SoilGrids) |
| POST | `/api/irrigations/generate` | Générer planning irrigation |

## Admin

| Méthode | Path | Description |
|---------|------|-------------|
| GET | `/api/admin/logs` | Logs de connexion |
| GET | `/api/admin/metrics` | Métriques système |

## Auth

| Méthode | Path | Description |
|---------|------|-------------|
| POST | `/api/auth/register` | Inscription utilisateur |
| POST | `/api/auth/verify` | Vérification email |
| POST | `/api/auth/resend-verify` | Renvoyer email de vérification |
| * | `/api/auth/[...nextauth]` | Routes NextAuth (signIn, signOut, session) |
