-- Modèle de stock unique, L4.1 (2026-11-24) : une perte, une consommation, un
-- don ou un écart d'inventaire peut porter sur le reste d'un lot de récolte
-- déjà lié à un bon, une facture ou une publication en boutique (reste suivi
-- par `stock_disponible_commercial`). Comme au verger, la sortie passe par le
-- journal des mouvements : le statut du lot reste figé (`proteger_lot_commercial`),
-- son reste baisse, et le stock de l'espèce retranche le mouvement.
-- Version publique ; la zone privée la remplace par la même règle, augmentée
-- des natures de la caisse de marché.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "mouvements_stock_commerciaux" DROP CONSTRAINT IF EXISTS "mouvements_stock_commerciaux_nature_check";
ALTER TABLE "mouvements_stock_commerciaux" ADD CONSTRAINT "mouvements_stock_commerciaux_nature_check" CHECK (
  nature IN ('livraison','perte','consomme','utilise','transforme','don','ecart') AND (nature = 'livraison' OR (
    document_id IS NULL AND facture_id IS NULL AND origine_retour_id IS NULL AND cle_idempotence IS NOT NULL
    AND quantite > 0 AND quantite < 'Infinity'::float8
    AND ((fruit_id IS NOT NULL AND bois_id IS NULL AND article_stock_type = 'fruit' AND nature IN ('perte','consomme','transforme'))
      OR (bois_id IS NOT NULL AND fruit_id IS NULL AND article_stock_type = 'bois' AND nature = 'utilise')
      OR (recolte_id IS NOT NULL AND fruit_id IS NULL AND bois_id IS NULL AND article_stock_type = 'recolte' AND nature IN ('perte','consomme','don','ecart')))
  ))
  AND ((nature = 'transforme') = (transformation_id IS NOT NULL))
  AND (lot_transforme_id IS NULL OR nature = 'livraison')
);
COMMIT;
