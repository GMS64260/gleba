-- Le trigger qui fige une récolte liée à un bon ou une facture surveillait
-- 'espece_id' et 'culture_id' : ces colonnes n'existent pas sur `recoltes`
-- (elles s'appellent `espece` et `culture`), si bien que `to_jsonb(OLD)->champ`
-- valait NULL des deux côtés et que l'espèce ou la culture d'un lot déjà livré
-- restait modifiable. Même fonction, bons noms de colonnes (revue du
-- 2026-11-04, constat D9).
DROP TRIGGER IF EXISTS recoltes_proteger_commercial ON recoltes;
CREATE TRIGGER recoltes_proteger_commercial BEFORE UPDATE ON recoltes FOR EACH ROW
  EXECUTE FUNCTION proteger_lot_commercial('user_id','quantite','unite','statut','date','espece','culture');
