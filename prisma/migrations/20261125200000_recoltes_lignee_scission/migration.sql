-- Lignée des lots de récolte (2026-11-25, défaut D51 de l'équipe debug).
-- Une vente ou une sortie partielle scinde une ligne de `recoltes` en deux
-- lignes de même culture et de même date, sans lien entre elles : tout écran
-- qui compte des lignes annonçait « 2 récoltes » pour une seule saisie.
-- `recolte_origine_id` relie la part créée à la récolte saisie (la racine).
-- NULL = récolte saisie. Si la racine est supprimée, ses parts redeviennent
-- des racines (SET NULL) : jamais de suppression en cascade d'un reliquat.
--
-- Colonne additive, nulle, sans valeur par défaut : aucune réécriture, et
-- l'image précédente lit ce schéma. Les scissions antérieures ne sont pas
-- reliées ici : reprise à part, à blanc par défaut
-- (scripts/reprise-lignee-recoltes.ts).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "recoltes" ADD COLUMN "recolte_origine_id" INTEGER;
CREATE INDEX "recoltes_recolte_origine_id_idx" ON "recoltes"("recolte_origine_id");
ALTER TABLE "recoltes" ADD CONSTRAINT "recoltes_recolte_origine_id_fkey" FOREIGN KEY ("recolte_origine_id") REFERENCES "recoltes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
