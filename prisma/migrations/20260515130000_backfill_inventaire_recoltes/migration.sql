-- ====================================================================
-- QA 2026-05-15 — Bug #7 : backfill `user_stock_especes.inventaire`
-- depuis l'historique `recoltes` (statut='en_stock').
--
-- Avant ce sprint, créer une Recolte ne touchait pas le stock. La page
-- Stocks Maraîchage affichait donc 0 article alors que 90 kg étaient
-- récoltés. La route POST /api/recoltes incrémente désormais le stock,
-- mais l'historique doit être recalculé.
--
-- Stratégie : pour chaque (userId, especeId), additionner les quantités
-- récoltées statut='en_stock' et écrire dans `user_stock_especes`. Si
-- une ligne existe déjà et est antérieure à la dernière récolte, on
-- écrase ; sinon (l'utilisateur a saisi manuellement après), on ne
-- touche pas.
-- ====================================================================

WITH agg AS (
  SELECT
    r.user_id,
    r.espece AS espece_id,
    SUM(r.quantite) AS total_quantite,
    MAX(r.date) AS derniere_date
    FROM recoltes r
   WHERE r.statut = 'en_stock'
   GROUP BY r.user_id, r.espece
)
INSERT INTO user_stock_especes (user_id, espece_id, inventaire, date_inventaire)
SELECT a.user_id, a.espece_id, a.total_quantite, a.derniere_date
  FROM agg a
ON CONFLICT (user_id, espece_id) DO UPDATE
   SET inventaire = EXCLUDED.inventaire,
       date_inventaire = EXCLUDED.date_inventaire
 WHERE user_stock_especes.date_inventaire IS NULL
    OR user_stock_especes.date_inventaire < EXCLUDED.date_inventaire;
