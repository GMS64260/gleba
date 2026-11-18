-- Restitution de stock : refus explicite au-delà de la production (décision du Lead, 2026-11-15).
--
-- La primitive `stock_apres_retour_plafonne` (migration 20261115130000)
-- ramenait à la production tout reliquat qui l'atteignait ou la dépassait,
-- quel que soit l'écart : un retour qui rendait plus que la production perdait
-- l'excédent en silence. La règle est tranchée (arbitrage du 15/11) : refuser
-- tout retour qui dépasse la production BRUTE de plus de 10⁻⁹.
--
-- Le reliquat `apres` est un décimal exact ; la production `plafond` est un
-- float8 brut (0,7 × 3 = 2,0999999999999996, ou 2,3000000006 à dix décimales).
-- Le refus se mesure dans le domaine float8, où la production est exacte (un
-- CAST float8 → numeric n'en garde que 15 chiffres). Le passage numeric →
-- float8 est l'arrondi au plus proche, monotone : la comparaison est donc celle
-- des valeurs décimales, au demi-ulp près.
--
-- - reliquat au-dessus de la production brute de plus de 10⁻⁹
--   (CAST(apres − 10⁻⁹) > production) : `STOCK_RETOUR_EXCEDENT`, l'instruction
--   échoue et la transaction est annulée (message lisible côté application) ;
-- - sinon, reliquat qui atteint la production lue sur la grille (retour
--   intégral : 2,1 pour 0,7 × 3, 2,300000001 pour 2,3000000006, 2,3 pour
--   2,3000000004) ou qui la dépasse en float8 : la production brute, le lot
--   retrouve exactement son état d'avant la sortie (ni dépassement de la CHECK
--   `stock <= production`, ni perte de la fraction historique) ;
-- - sinon : le reliquat, strictement sous la production.
--
-- Contre-revue ADV259 : la première version de cette migration mesurait le
-- seuil sur ROUND(production, 9) + 10⁻⁹ et acceptait jusqu'à ~1,5·10⁻⁹ de
-- dépassement réel (production 2,3000000006, reliquat 2,300000002). Migration
-- réécrite avant toute livraison (absente du banc et de gleba_tests).
--
-- Même règle côté TypeScript dans `plafonnerStock` (src/lib/stocks/milliemes.ts).
-- Appelants inchangés : `sqlStockApresRetour`/`restituerAuLot`
-- (src/lib/stocks/milliemes-sql.ts) et la branche retrait du trigger
-- `source_recolte_boutique`, dont le refus au millième (`SOURCE_RECOLTE_EXCEDENT`,
-- 20261115170000) précède l'appel.
-- Même signature et même type de retour : seuls le langage et le corps changent.
BEGIN;

CREATE OR REPLACE FUNCTION stock_apres_retour_plafonne(apres NUMERIC, plafond DOUBLE PRECISION) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF apres IS NULL THEN RETURN NULL; END IF;
  IF plafond IS NULL THEN RETURN CAST(apres AS DOUBLE PRECISION); END IF;
  IF CAST(apres - 0.000000001 AS DOUBLE PRECISION) > plafond THEN
    RAISE EXCEPTION 'STOCK_RETOUR_EXCEDENT: le stock rendu (%) dépasserait la production du lot (%).', apres, plafond;
  END IF;
  IF apres >= ROUND(CAST(plafond AS NUMERIC), 9) OR CAST(apres AS DOUBLE PRECISION) > plafond THEN RETURN plafond; END IF;
  RETURN CAST(apres AS DOUBLE PRECISION);
END $$;

COMMIT;
