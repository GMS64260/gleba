-- Associations : désactivation persistante plutôt que suppression.
--
-- Décision du 2026-11-15 (PR #73) : les trois règles incompatibles héritées de
-- l'import d'origine (« Source : Jardinage Bio Standard », sans justification)
-- ne sont pas supprimées du référentiel global. Elles sont marquées
-- désactivées, détails et historique conservés, et restent réactivables :
--   * « Romarin ! »        : cinq familles entières ;
--   * « Poivron piment ! » : les Alliaceae ;
--   * « Ail ! »            : artichaut, asperge, coriandre, pomme de terre et
--                            les Brassicaceae, que 20260514200000 voulait retirer.
--
-- Une règle désactivée n'alerte plus, n'est plus listée ni proposée
-- (`ASSOCIATION_ACTIVE`, src/lib/associations-alertes.ts).
-- Réactivation : PUT /api/associations/<id> { "active": true } (administration),
-- ou UPDATE "associations" SET desactivee_le = NULL, motif_desactivation = NULL
-- WHERE id = '<id>'.
--
-- Données du référentiel commun seulement ; rejouer ne change plus rien.

ALTER TABLE "associations" ADD COLUMN IF NOT EXISTS "desactivee_le" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "motif_desactivation" TEXT;

UPDATE "associations"
SET desactivee_le = CURRENT_TIMESTAMP,
    motif_desactivation = 'Incompatibilité héritée de l''import d''origine, sans fondement agronomique (revue du 2026-11-12) : désactivée, détails conservés (décision du 2026-11-15).'
WHERE id IN (
    'cml1gbd2q00422vbmgnu2yzu8', -- Romarin !
    'cml1gbcxi003o2vbmhxl2zvnm', -- Poivron piment !
    'cml1gbbum00032vbm1wd9zeyz'  -- Ail !
  )
  AND type = 'incompatible'
  AND desactivee_le IS NULL;
