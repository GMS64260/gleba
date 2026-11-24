-- Sortie datée d'un lot de récolte (perte, consommation personnelle, don).
-- Jusqu'ici seule la vente portait une date (`date_vente`) : une perte n'avait
-- que la date de la récolte. Colonne additive, nulle pour les lots en stock,
-- vendus, et pour les sorties antérieures. Sans valeur par défaut : aucune
-- réécriture de table ; le délai de verrou évite d'attendre derrière une
-- longue transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "recoltes" ADD COLUMN "date_sortie" TIMESTAMP(3);
COMMIT;
