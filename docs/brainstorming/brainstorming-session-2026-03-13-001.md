---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Fiabilisation et harmonisation du socle commun ERP Gleba - cartographie, parcelles, plan, planches, cultures'
session_goals: 'Fiabiliser le fonctionnement, harmoniser le modèle de données et UX, clarifier les relations entre entités, améliorer la cohérence de navigation'
selected_approach: 'ai-recommended'
techniques_used: ['Question Storming', 'First Principles Thinking', 'Morphological Analysis']
ideas_generated: 39
context_file: ''
session_active: false
workflow_completed: true
---

# Brainstorming Session Results

**Date:** 2026-03-13

## Session Overview

**Topic:** Fiabilisation et harmonisation du socle commun ERP Gleba - cartographie, parcelles, plan, planches, cultures
**Goals:** Fiabiliser le fonctionnement, harmoniser le modèle de données et UX, clarifier les relations entre entités, améliorer la cohérence de navigation

### Session Setup

_L'utilisateur souhaite travailler sur le socle fondamental de Gleba : les concepts interconnectés de cartographie, parcelle, plan, planche et culture. L'objectif est de fiabiliser et harmoniser ces parties communes de l'ERP pour obtenir un modèle cohérent et une expérience utilisateur fluide._

## Technique Selection

**Approche :** Techniques recommandées par l'IA
**Contexte d'analyse :** Harmonisation du socle commun avec focus sur fiabilisation et décloisonnement

**Techniques recommandées :**

- **Question Storming :** Cartographier les bonnes questions avant de chercher des réponses
- **First Principles Thinking :** Identifier les vérités fondamentales pour clarifier la cible
- **Morphological Analysis :** Explorer systématiquement les combinaisons de paramètres

## Technique Execution Results

### Phase 1 : Question Storming

**Insights clés découverts :**

- **#1** Planche = unité fine/intensive (maraîchage). Parcelle = unité large/extensive (verger, élevage, fourrage)
- **#2** Matrice de compatibilité : verger+élevage OK, maraîchage+élevage NON, maraîchage+verger potager OK
- **#3** Le maraîchage est un sanctuaire — protégé, incompatible bétail
- **#4** Le verger est l'entité la plus transversale — traverse tous les modules
- **#5** La parcelle = un contour géographique dessiné sur la carte (source de vérité)
- **#6** Les données élevage suivent le lot d'animaux, pas le terrain (relation de localisation)
- **#7** Modèle en couches magiques : parcelle neutre + couches d'activité empilées
- **#8** Double vue : carte globale (stratégique) + plan 2D jardin (opérationnel/tactile)
- **#9** Dessin d'abord, attribution ensuite — geste de création neutre et universel
- **#10** Toggle de couches sur la carte (comme des calques)
- **#11** Le plan 2D reste exclusivement maraîchage — interface terrain tablette
- **#12** Persona "tablette au champ" — UX gants/soleil/vitesse
- **#13** Socle spatial partagé entre modules — fin des silos
- **#14** La comptabilité comme colonne vertébrale unificatrice
- **#15** Rotation de pâturage = opportunité neuve à construire nativement
- **#16** Rattachement comptable par nature de production (œuf=élevage, pomme=verger)

### Phase 2 : First Principles Thinking (appliqué à l'existant)

**Idées générées :**

- **#17** Flux comptable automatique par événement métier (zéro saisie comptable manuelle)
- **#18** 3 flux de base universels : Entrées, Sorties, Charges
- **#20** Auto-consommation = mouvement interne entre couches
- **#21** Coût de revient par production (compta décisionnelle)
- **#22** Calendrier unifié multi-couches avec toggles par activité
- **#23** Tâches auto-générées par ITPs, cycles élevage, calendriers verger
- **#24** Vue "ma journée" par parcelle (regroupé par lieu)
- **#25** La carte n'est PAS le point d'entrée principal — navigation par modules conservée
- **#26** Modules visibles = couches actives (pas de parcelle élevage = pas de menu élevage)
- **#27** Dashboard agrégé transversal "que faire aujourd'hui"

### Phase 3 : Morphological Analysis

**Problèmes identifiés :**

- **#30** Contrainte projet : évolution pas révolution
- **#31** La parcelle n'existe pas comme entité dans Gleba
- **#32** Les arbres vivent dans leur silo, déconnectés de l'espace
- **#33** L'élevage est déconnecté de l'espace
- **#34** La comptabilité est fragmentée en pages multiples

**Solutions structurées :**

- **#35** Créer l'entité Parcelle : contour GeoJSON, surface auto-calculée, couches actives, nom
- **#36** Relation Parcelle → Planche = parent → enfants
- **#37** Relation Parcelle → Arbre = champ parcelleId (FK simple)
- **#38** Relation Lot → Parcelle = parcelleActuelle + historique déplacements
- **#39** Carte globale = nouvelle page /carte, plan 2D inchangé
- **#40** Transaction comptable unique : { type, montant, catégorie, couche, parcelleId, date }

## Idea Organization and Prioritization

### Thème A : Modèle spatial — La Parcelle (PRIORITÉ 1 — Fondation)

Créer l'entité Parcelle comme chaînon manquant. Contour GeoJSON dessiné sur la carte, surface auto-calculée, couches d'activité assignables. Pattern "dessin d'abord, attribution ensuite".

**Idées :** #1, #5, #7, #9, #31, #35, #36

### Thème B : Spatialisation des modules existants (PRIORITÉ 2 — Quick wins)

Connecter arbres et lots d'animaux aux parcelles via des FK simples. Petit effort, gros impact sur la cohérence.

**Idées :** #6, #32, #33, #37, #38

### Thème C : Comptabilité unifiée (PRIORITÉ 3 — Valeur métier)

Unifier la compta autour d'un modèle de transaction unique. Flux auto par événement métier. 3 types : entrées, sorties, charges. Auto-consommation comme mouvement interne.

**Idées :** #14, #16, #17, #18, #20, #21, #34, #40

### Thème D : Carte globale (PRIORITÉ 4)

Nouvelle page /carte affichant toutes les parcelles avec toggles par couche. Le plan 2D jardin reste inchangé, dédié maraîchage tactile.

**Idées :** #8, #10, #11, #12, #25, #39

### Thème E : Couches d'activité et compatibilité (PRIORITÉ 5)

Matrice de compatibilité entre usages. Modules visibles selon couches actives. Rotation de pâturage.

**Idées :** #2, #3, #4, #15, #26

### Thème F : Calendrier, tâches, vue quotidienne (PRIORITÉ 5)

Calendrier unifié multi-couches, tâches auto-générées, dashboard transversal "ma journée".

**Idées :** #22, #23, #24, #27

### Principes directeurs

- **#13** Socle spatial partagé, fin des silos
- **#28-29** Triptyque Espace / Activité / Flux
- **#30** Évolution, pas révolution — consolider l'existant

## Plan d'action

### Phase 1 — Fondation : Entité Parcelle (prioritaire)

1. Ajouter le modèle `Parcelle` au schema Prisma (géométrie, surface, nom, couches)
2. Migration base de données
3. API CRUD parcelles
4. Ajout champ `parcelleId` optionnel sur Planche

### Phase 2 — Quick wins : Spatialisation

1. Ajouter `parcelleId` sur le modèle Arbre
2. Ajouter `parcelleActuelleId` sur le modèle Lot (élevage)
3. Table historique déplacements lots
4. Mise à jour des APIs existantes

### Phase 3 — Comptabilité unifiée

1. Refonte du modèle Transaction unique
2. Génération automatique d'écritures depuis les événements métier (récolte, vente, achat)
3. Simplification des pages comptabilité
4. Support auto-consommation (mouvements internes)

### Phase 4 — Carte globale

1. Nouvelle page `/carte` avec affichage parcelles
2. Système de couches avec toggles
3. Interaction dessin de contours + attribution
4. Lien vers plan 2D pour les parcelles maraîchage

### Phase 5 — Harmonisation avancée

1. Matrice compatibilité couches
2. Modules visibles conditionnels
3. Calendrier unifié multi-couches
4. Dashboard "ma journée" transversal

## Session Summary

**Résultats clés :**

- 39 idées générées à travers 3 techniques de brainstorming
- 6 thèmes identifiés avec une priorisation claire
- Un modèle conceptuel émerge : la **Parcelle comme contour spatial neutre** avec des **couches d'activité empilables** et un **socle commun** (espace, temps, argent)
- Principe directeur : **évolution, pas révolution** — on enrichit l'existant sans tout casser

**Décisions prises :**

- Planche = maraîchage only, Parcelle = tout le reste + conteneur de planches
- Données élevage suivent le lot, pas le terrain
- Comptabilité rattachée à l'activité, pas à la localisation
- Plan 2D jardin inchangé, carte globale en complément
- Navigation par modules conservée, carte = outil transversal
