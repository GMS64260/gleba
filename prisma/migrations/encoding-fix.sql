-- ============================================================================
-- Correction des accents manquants dans les libellés référentiels (Espèce,
-- Variété, ITP, Famille). À exécuter MANUELLEMENT après audit visuel.
--
-- ATTENTION : ces tables servent de clés (Prisma `id String @id`).
-- Renommer un id propagera contre les FK. Vérifier au préalable :
--   SELECT id FROM "Espece" WHERE id !~ '[À-ÿ]';
-- et ajuster les UPDATEs ci-dessous au cas par cas. Ne PAS exécuter en bloc.
-- ============================================================================

BEGIN;

-- ===== 1. Espece — vérifier d'abord les noms sans accents
-- (la PRIMARY KEY est `id`. Si on veut renommer, il faut soit aussi cascader
-- toutes les FK, soit ne renommer QUE les champs descriptifs)
--
-- Si vous voulez juste afficher proprement sans changer les clés, ajoutez
-- un champ `nomAffichage` ou utilisez la traduction côté UI.
--
-- À ce stade, on RÉPERTORIE plutôt que de modifier :
--
-- SELECT id FROM "Espece" WHERE id ILIKE '%aichage%' OR id ILIKE '%ecolte%'
--   OR id ILIKE '%ariete%' OR id ILIKE '%itineraire%';

-- Exemples (à dé-commenter et adapter SEULEMENT après confirmation) :
-- UPDATE "Espece" SET id = 'Récolte' WHERE id = 'Recolte';

-- ===== 2. Variete
-- SELECT id, "especeId" FROM "Variete" WHERE id = '-' OR id ILIKE '-%';
-- (issue connue : variétés "-" ou "-Nantaise" doublons)

-- ===== 3. Famille
-- SELECT * FROM "Famille";

-- ===== 4. ITP
-- SELECT id FROM "ITP" WHERE id ILIKE '%itineraire%' OR id ILIKE '%pepiniere%';

-- ===== 5. Categorie
-- SELECT DISTINCT categorie FROM "Espece";

-- Sentinelle de conformité (référencée par audit AP) :
-- SELECT * FROM "Rapport" WHERE titre = 'Conformite Bio/HVE';

ROLLBACK;
-- Passer ROLLBACK → COMMIT seulement après validation manuelle ligne par ligne.
