-- Référentiel espèces animales : doublon équin + paramètres zootechniques.
-- Tickets QA : cms1vo866 (doublon « Cheval »/« Chevaux » + durées de gestation
-- des espèces de rente) et cms1vnj05 (conso_jour / ponte_annuelle manquantes).
--
-- Périmètre : UNIQUEMENT le catalogue officiel (user_id IS NULL). Les espèces
-- créées par les utilisateurs ne sont jamais modifiées. Migration de données
-- additive et idempotente : chaque UPDATE ne s'applique que si la valeur
-- diffère (IS DISTINCT FROM) ou est absente (IS NULL) ; l'unique DELETE
-- (l'entrée fantôme 'chevaux_deselle_') n'a lieu qu'après re-rattachement de
-- toutes ses références et seulement s'il n'en reste aucune. Rejouable sans
-- erreur ni effet.

-- ============================================================================
-- A. Doublon Cheval / Chevaux (cms1vo866)
-- Le catalogue contient 'cheval' (« Cheval », 340 j) et une entrée fantôme
-- 'chevaux_deselle_' (« Chevaux », 330 j, poids NULL) issue d'une saisie
-- passée (aucun seed ne la recrée). On aligne 'cheval' sur 330 j (gestation
-- jument : 330-345 j ; DUREE_GESTATION_DEFAUTS du code dit 330), on re-rattache
-- toute référence éventuelle du doublon vers 'cheval', puis on supprime le
-- doublon s'il est bien catalogue et orphelin.
-- ============================================================================

-- A1. Gestation de référence du cheval : 330 j (cohérence base/code).
UPDATE especes_animales
SET duree_gestation = 330
WHERE espece_animale = 'cheval'
  AND user_id IS NULL
  AND duree_gestation IS DISTINCT FROM 330;

-- A2. Re-rattacher les références directes du doublon vers 'cheval'
-- (défensif : 0 référence au 26/07/2026, mais des données peuvent apparaître
-- d'ici au déploiement). Le garde EXISTS évite de casser la FK si 'cheval'
-- venait à manquer.
UPDATE animaux
SET espece_animale_id = 'cheval'
WHERE espece_animale_id = 'chevaux_deselle_'
  AND EXISTS (SELECT 1 FROM especes_animales WHERE espece_animale = 'cheval');

UPDATE lots_animaux
SET espece_animale_id = 'cheval'
WHERE espece_animale_id = 'chevaux_deselle_'
  AND EXISTS (SELECT 1 FROM especes_animales WHERE espece_animale = 'cheval');

UPDATE campagnes_reproduction
SET espece_animale_id = 'cheval'
WHERE espece_animale_id = 'chevaux_deselle_'
  AND EXISTS (SELECT 1 FROM especes_animales WHERE espece_animale = 'cheval');

-- prophylaxies_elevage.espece_animale_id est un champ texte SANS contrainte FK
-- (modèle ProphylaxieElevage) : on remappe aussi pour ne laisser aucun id mort.
UPDATE prophylaxies_elevage
SET espece_animale_id = 'cheval'
WHERE espece_animale_id = 'chevaux_deselle_';

-- A3. Races du doublon. Contrainte UNIQUE (espece_animale_id, nom) : une race
-- homonyme d'une race déjà présente sous 'cheval' ne peut pas être re-rattachée.
-- a) re-pointer les animaux de la race dupliquée vers la race canonique…
UPDATE animaux a
SET race_animale_id = cible.id
FROM races_animales dup
JOIN races_animales cible
  ON cible.espece_animale_id = 'cheval'
 AND cible.nom = dup.nom
WHERE dup.espece_animale_id = 'chevaux_deselle_'
  AND a.race_animale_id = dup.id;

-- b) …supprimer la race dupliquée devenue orpheline…
DELETE FROM races_animales dup
WHERE dup.espece_animale_id = 'chevaux_deselle_'
  AND EXISTS (
    SELECT 1 FROM races_animales c
    WHERE c.espece_animale_id = 'cheval' AND c.nom = dup.nom
  )
  AND NOT EXISTS (SELECT 1 FROM animaux a WHERE a.race_animale_id = dup.id);

-- c) …et re-rattacher les races sans homonyme sous 'cheval'.
UPDATE races_animales r
SET espece_animale_id = 'cheval'
WHERE r.espece_animale_id = 'chevaux_deselle_'
  AND EXISTS (SELECT 1 FROM especes_animales WHERE espece_animale = 'cheval')
  AND NOT EXISTS (
    SELECT 1 FROM races_animales c
    WHERE c.espece_animale_id = 'cheval' AND c.nom = r.nom
  );

-- A4. Supprimer l'entrée fantôme : uniquement si elle est bien catalogue
-- (user_id IS NULL) et plus référencée nulle part. La FK races_animales est en
-- ON DELETE CASCADE : le garde NOT EXISTS empêche toute suppression en cascade
-- silencieuse si une race résiduelle subsistait (l'entrée serait alors
-- conservée, sans erreur).
DELETE FROM especes_animales e
WHERE e.espece_animale = 'chevaux_deselle_'
  AND e.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM animaux a WHERE a.espece_animale_id = e.espece_animale)
  AND NOT EXISTS (SELECT 1 FROM lots_animaux l WHERE l.espece_animale_id = e.espece_animale)
  AND NOT EXISTS (SELECT 1 FROM races_animales r WHERE r.espece_animale_id = e.espece_animale)
  AND NOT EXISTS (SELECT 1 FROM campagnes_reproduction c WHERE c.espece_animale_id = e.espece_animale);

-- ============================================================================
-- B. Durées de gestation des espèces de rente (cms1vo866)
-- Valeurs de référence : bovins 283 j, ovins 147 j, porcins 115 j, lapins 31 j.
-- Les caprins sont déjà corrects (150 j) : intentionnellement non touchés.
-- Catalogue uniquement, et seulement si la valeur diffère.
-- ============================================================================

-- Bovins (Charolaise, Limousine, Normande, Salers : 280 -> 283).
UPDATE especes_animales
SET duree_gestation = 283
WHERE user_id IS NULL
  AND (espece_animale LIKE 'vache%' OR espece_animale LIKE 'bovin%')
  AND duree_gestation IS DISTINCT FROM 283;

-- Ovins (Lacaune, Mérinos d'Arles, Solognote, Suffolk : 150 -> 147).
UPDATE especes_animales
SET duree_gestation = 147
WHERE user_id IS NULL
  AND (espece_animale LIKE 'brebis%' OR espece_animale LIKE 'mouton%')
  AND duree_gestation IS DISTINCT FROM 147;

-- Porcins de rente (114 -> 115). Le cochon nain (filière nac) garde 114 :
-- le ticket vise les espèces de rente.
UPDATE especes_animales
SET duree_gestation = 115
WHERE user_id IS NULL
  AND filiere = 'rente'
  AND (espece_animale LIKE 'truie%' OR espece_animale LIKE 'cochon%' OR espece_animale LIKE 'porc%')
  AND duree_gestation IS DISTINCT FROM 115;

-- Lapins : 31 j (déjà le cas au 26/07/2026 ; garde-fou si une entrée dévie).
UPDATE especes_animales
SET duree_gestation = 31
WHERE user_id IS NULL
  AND (espece_animale LIKE 'lapin%' OR espece_animale LIKE 'lapine%')
  AND duree_gestation IS DISTINCT FROM 31;

-- ============================================================================
-- C. Paramètres zootechniques manquants (cms1vnj05)
-- conso_jour : consommation d'aliment de référence d'un adulte, en kg brut/jour
-- (valeurs prudentes ; bovins : fourrage + concentré ramené en brut).
-- ponte_annuelle : œufs/an de référence. On ne renseigne que les valeurs NULL :
-- AUCUNE valeur existante n'est écrasée. Catalogue uniquement.
-- ============================================================================

-- C1. conso_jour ------------------------------------------------------------

-- Poules et poulets : 0,13 kg/j (poule_pondeuse 0,12, poule_marans 0,13 et
-- poulet_chair 0,15 déjà renseignés, donc préservés).
UPDATE especes_animales SET conso_jour = 0.13
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'poule%';

-- Canards : 0,20 kg/j (canard_rouen).
UPDATE especes_animales SET conso_jour = 0.20
WHERE user_id IS NULL AND conso_jour IS NULL
  AND (espece_animale LIKE 'canard%' OR espece_animale LIKE 'cane\_%' ESCAPE '\');

-- Oies : 0,35 kg/j (oie_toulouse).
UPDATE especes_animales SET conso_jour = 0.35
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'oie%';

-- Dindes : 0,25 kg/j (aucune entrée catalogue au 26/07/2026 ; prêt si ajout).
UPDATE especes_animales SET conso_jour = 0.25
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'dinde%';

-- Cailles : 0,03 kg/j (aucune entrée catalogue au 26/07/2026).
UPDATE especes_animales SET conso_jour = 0.03
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'caille%';

-- Pintades : 0,12 kg/j (aucune entrée catalogue au 26/07/2026).
UPDATE especes_animales SET conso_jour = 0.12
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'pintade%';

-- Lapins de rente : 0,15 kg/j. Le lapin nain (nac, ~1,5 kg) est exclu :
-- 0,15 kg/j serait une valeur fausse pour lui.
UPDATE especes_animales SET conso_jour = 0.15
WHERE user_id IS NULL AND conso_jour IS NULL
  AND filiere = 'rente'
  AND espece_animale LIKE 'lapin%';

-- Chèvres : 2,5 kg/j (chevre_laitiere déjà à 1,5 : préservée).
UPDATE especes_animales SET conso_jour = 2.5
WHERE user_id IS NULL AND conso_jour IS NULL
  AND espece_animale LIKE 'chevre%';

-- Ovins : 2,0 kg/j.
UPDATE especes_animales SET conso_jour = 2.0
WHERE user_id IS NULL AND conso_jour IS NULL
  AND (espece_animale LIKE 'brebis%' OR espece_animale LIKE 'mouton%');

-- Porcins de rente : 2,8 kg/j. Le cochon nain (nac, ~70 kg) est exclu :
-- 2,8 kg/j serait une valeur fausse pour lui.
UPDATE especes_animales SET conso_jour = 2.8
WHERE user_id IS NULL AND conso_jour IS NULL
  AND filiere = 'rente'
  AND (espece_animale LIKE 'truie%' OR espece_animale LIKE 'cochon%' OR espece_animale LIKE 'porc%');

-- Bovins : 15 kg/j (ration totale ramenée en brut).
UPDATE especes_animales SET conso_jour = 15
WHERE user_id IS NULL AND conso_jour IS NULL
  AND (espece_animale LIKE 'vache%' OR espece_animale LIKE 'bovin%');

-- Équidés : cheval 10, âne 6, poney 7 (kg/j).
UPDATE especes_animales SET conso_jour = 10
WHERE user_id IS NULL AND conso_jour IS NULL AND espece_animale = 'cheval';

UPDATE especes_animales SET conso_jour = 6
WHERE user_id IS NULL AND conso_jour IS NULL AND espece_animale = 'ane';

UPDATE especes_animales SET conso_jour = 7
WHERE user_id IS NULL AND conso_jour IS NULL AND espece_animale = 'poney';

-- C2. ponte_annuelle ---------------------------------------------------------
-- Filière rente uniquement (jamais compagnie/equin/nac). Le poulet de chair
-- est exclu par construction : le motif 'poule\_%' exige un underscore littéral
-- après « poule » ('poulet_chair' ne matche pas).

-- Poule pondeuse : 280 (déjà renseignée au 26/07/2026 ; garde-fou).
UPDATE especes_animales SET ponte_annuelle = 280
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND espece_animale = 'poule_pondeuse';

-- Autres poules (races non précisées) : 200. Toutes déjà renseignées au
-- 26/07/2026 (180-240) : valeurs existantes préservées.
UPDATE especes_animales SET ponte_annuelle = 200
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND production IN ('oeufs', 'mixte')
  AND espece_animale LIKE 'poule\_%' ESCAPE '\'
  AND espece_animale <> 'poule_pondeuse';

-- Canes : 180 (canard_rouen, production mixte).
UPDATE especes_animales SET ponte_annuelle = 180
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND production IN ('oeufs', 'mixte')
  AND (espece_animale LIKE 'canard%' OR espece_animale LIKE 'cane\_%' ESCAPE '\');

-- Cailles : 250 (aucune entrée catalogue au 26/07/2026).
UPDATE especes_animales SET ponte_annuelle = 250
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND espece_animale LIKE 'caille%';

-- Oies : 40 (oie_toulouse ; ~30-40 œufs/an même en souche à viande).
UPDATE especes_animales SET ponte_annuelle = 40
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND espece_animale LIKE 'oie%';

-- Dindes : 90 (aucune entrée catalogue au 26/07/2026).
UPDATE especes_animales SET ponte_annuelle = 90
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND espece_animale LIKE 'dinde%';

-- Pintades : 150 (aucune entrée catalogue au 26/07/2026).
UPDATE especes_animales SET ponte_annuelle = 150
WHERE user_id IS NULL AND ponte_annuelle IS NULL
  AND filiere = 'rente'
  AND espece_animale LIKE 'pintade%';
