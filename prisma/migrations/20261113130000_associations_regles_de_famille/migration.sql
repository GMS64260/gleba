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
-- Décision du 2026-11-15 (PR #73) : « Romarin ! », « Poivron piment ! » et
-- « Ail ! » ne sont NI supprimées NI amputées de leurs détails. Elles sont
-- désactivées, détails et historique conservés, réactivables, par la
-- migration 20261113133000_associations_desactivation. Cette migration ne
-- corrige donc que « Tomate ! », « Chou-rave ! » et « Ail × Légumineuses ».
--
-- Règles de cette migration :
--   - les lignes sont ciblées par l'identifiant de leur association, jamais
--     par libellé ; le référentiel est global, aucune donnée d'exploitation
--     n'est touchée ;
--   - rien ne se passe si l'association est absente, n'est plus de type
--     « incompatible », ou est déjà corrigée : rejouer ne change plus rien ;
--   - aucune association n'est supprimée ;
--   - pas de changement de schéma.

-- 1. « Romarin ! » : désactivée par 20261113133000, détails conservés.

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

-- 3 à 5. « Poivron piment ! » et « Ail ! » : désactivées par 20261113133000,
--        détails conservés ; aucune suppression.

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
