-- L’unité est figée à la saisie ; les lignes antérieures restent inchangées.
-- Convention historique : NULL représente des kg, sans conversion supposée.
BEGIN;
-- Stabiliser les sorties et leurs unités courantes pendant le contrôle.
LOCK TABLE consommations, especes, user_stock_especes IN SHARE ROW EXCLUSIVE MODE;
-- L’ancien écrivain pouvait aussi accepter des tiges/pièces/bottes sans les
-- enregistrer. L’unité courante ne prouve pas celle de la sortie historique :
-- refuser le déploiement ambigu plutôt que convertir ou libérer du stock.
-- Le contrôle porte sur toutes les lignes, y compris antérieures au comptage.
DO $$
DECLARE ambigu INTEGER;
BEGIN
  SELECT count(*) INTO ambigu
    FROM consommations c JOIN especes e ON e.espece=c.espece
    LEFT JOIN user_stock_especes u ON u.espece_id=c.espece AND u.user_id=c.user_id
    WHERE COALESCE(u.unite_rendement,e.unite_rendement) IN ('tiges_m2','pieces_m2','bottes_m2');
  IF ambigu>0 THEN
    RAISE EXCEPTION 'CONSOMMATIONS_UNITE_AMBIGUE : % sortie(s) sans unité sur un stock non pondéral. Migration arrêtée ; vérifier l’unité historique avant toute reprise, sans conversion supposée.', ambigu;
  END IF;
END $$;
ALTER TABLE "consommations" ADD COLUMN "unite" TEXT;
ALTER TABLE "consommations" ADD CONSTRAINT "consommations_unite_check"
  CHECK ("unite" IS NULL OR "unite" IN ('kg', 'tige', 'piece', 'botte'));
COMMIT;
