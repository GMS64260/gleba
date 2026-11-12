-- Associations : incompatibilités de famille entière sans fondement, et
-- erreurs de saisie manifestes du référentiel.
--
-- Revue du 2026-11-12. Les alertes lisent désormais les lignes de famille et de
-- groupe (`evaluerAssociations`, src/lib/associations-alertes.ts) : une ligne
-- « famille seule » d'une règle incompatible oppose le pivot à TOUTES les
-- espèces de la famille. Trois règles héritées de l'import d'origine
-- (« Source : Jardinage Bio Standard », sans justification) déclencheraient
-- ainsi des alertes sans fondement agronomique :
--   * « Romarin ! »        : cinq familles entières (Amaranthaceae, Asteraceae,
--                            Cucurbitaceae, Fabaceae, Solanaceae) ;
--   * « Tomate ! »         : Alliaceae, alors qu'ail, oignon et poireau sont
--                            des compagnes classiques de la tomate ;
--   * « Poivron piment ! » : Alliaceae.
--
-- S'y ajoutent trois erreurs de saisie :
--   * « Ail ! » garde artichaut, asperge, coriandre et le groupe Chou, que la
--     migration 20260514200000 voulait retirer (elle cherchait « incompat »
--     dans le nom et a manqué « Ail ! »), et range la pomme de terre « Aide
--     contre le mildiou » dans une incompatibilité ;
--   * « Chou-rave ! » porte pour pivot le Chou-fleur (copie de « Chou-fleur ! ») ;
--   * « Ail × Légumineuses (incompatible) » n'a qu'un détail, sans l'ail.
--
-- Règles de cette migration :
--   - les lignes sont ciblées par l'identifiant de leur association, jamais
--     par libellé ; le référentiel est global, aucune donnée d'exploitation
--     n'est touchée ;
--   - rien ne se passe si l'association est absente, n'est plus de type
--     « incompatible », ou est déjà corrigée : rejouer ne change plus rien ;
--   - une règle qui ne garde que son pivot ne relie plus personne (muette
--     partout) : elle est supprimée, mais seulement dans cet état ;
--   - pas de changement de schéma.

-- 1. « Romarin ! » : plus d'incompatibilité avec cinq familles entières.
DELETE FROM "associations_details" d
USING "associations" a
WHERE a.id = d.association_id
  AND a.id = 'cml1gbd2q00422vbmgnu2yzu8'
  AND a.type = 'incompatible'
  AND d.espece IS NULL
  AND COALESCE(d.groupe, '') = ''
  AND d.famille IN ('Amaranthaceae', 'Asteraceae', 'Cucurbitaceae', 'Fabaceae', 'Solanaceae');

-- 2. « Tomate ! » : plus d'incompatibilité avec les Alliaceae (les autres
--    lignes, toutes d'espèce, restent).
DELETE FROM "associations_details" d
USING "associations" a
WHERE a.id = d.association_id
  AND a.id = 'cml1gbd4k00482vbmvmkh22l3'
  AND a.type = 'incompatible'
  AND d.espece IS NULL
  AND COALESCE(d.groupe, '') = ''
  AND d.famille = 'Alliaceae';

-- 3. « Poivron piment ! » : idem.
DELETE FROM "associations_details" d
USING "associations" a
WHERE a.id = d.association_id
  AND a.id = 'cml1gbcxi003o2vbmhxl2zvnm'
  AND a.type = 'incompatible'
  AND d.espece IS NULL
  AND COALESCE(d.groupe, '') = ''
  AND d.famille = 'Alliaceae';

-- 4. « Ail ! » : compagnes que 20260514200000 voulait déjà retirer, et la
--    pomme de terre dont la note est favorable.
DELETE FROM "associations_details" d
USING "associations" a
WHERE a.id = d.association_id
  AND a.id = 'cml1gbbum00032vbm1wd9zeyz'
  AND a.type = 'incompatible'
  AND (
    d.espece IN ('Artichaut', 'Asperge', 'Coriandre', 'Pomme de terre')
    OR (d.espece IS NULL AND d.famille = 'Brassicaceae')
  );

-- 5. Règles réduites à leur pivot par les étapes 1, 3 et 4 : elles ne relient
--    plus rien. Supprimées seulement si elles n'ont plus qu'un détail au plus
--    (une règle complétée depuis par l'administration est conservée).
DELETE FROM "associations" a
WHERE a.id IN (
    'cml1gbd2q00422vbmgnu2yzu8', -- Romarin !
    'cml1gbcxi003o2vbmhxl2zvnm', -- Poivron piment !
    'cml1gbbum00032vbm1wd9zeyz'  -- Ail !
  )
  AND a.type = 'incompatible'
  AND (SELECT count(*) FROM "associations_details" d WHERE d.association_id = a.id) <= 1;

-- 6. « Chou-rave ! » : le pivot est le Chou-rave, pas le Chou-fleur.
UPDATE "associations_details" d
SET espece = 'Chou-rave'
WHERE d.association_id = 'cml1gbccs001p2vbmmm3in7ji'
  AND d.espece = 'Chou-fleur'
  AND d.requise
  AND EXISTS (SELECT 1 FROM "especes" e WHERE e.espece = 'Chou-rave')
  AND NOT EXISTS (
    SELECT 1 FROM "associations_details" x
    WHERE x.association_id = d.association_id AND x.espece = 'Chou-rave'
  );

UPDATE "associations"
SET description = 'Association expérimentale ou structurelle avec Chou-rave.'
WHERE id = 'cml1gbccs001p2vbmmm3in7ji'
  AND description = 'Association expérimentale ou structurelle avec Chou-fleur.';

-- 7. « Ail × Légumineuses (incompatible) » : l'ail manquait, la règle était
--    invisible. La ligne « Fabaceae / Légumineuses » garde son groupe : elle
--    s'affiche sur la fiche de l'ail, sans alerter pour la famille entière
--    (pois, fève et haricot ont leurs règles d'espèce).
INSERT INTO "associations_details" (association_id, espece, famille, groupe, requise, notes)
SELECT 'asso-ail-legumineuses-incompat', 'Ail', NULL, NULL, true, NULL
WHERE EXISTS (SELECT 1 FROM "associations" a WHERE a.id = 'asso-ail-legumineuses-incompat')
  AND EXISTS (SELECT 1 FROM "especes" e WHERE e.espece = 'Ail')
  AND NOT EXISTS (
    SELECT 1 FROM "associations_details" d
    WHERE d.association_id = 'asso-ail-legumineuses-incompat' AND d.espece = 'Ail'
  );
