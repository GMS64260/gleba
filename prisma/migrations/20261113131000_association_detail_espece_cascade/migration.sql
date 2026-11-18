-- Détail d'association : la ligne suit son espèce à la suppression.
--
-- Avant : ON DELETE SET NULL. Supprimer une espèce laissait sa ligne avec
-- `espece` vide et la famille d'annotation intacte, soit une ligne « famille
-- seule ». Depuis que les alertes lisent les lignes de famille
-- (`evaluerAssociations`), une telle ligne opposerait le pivot à toutes les
-- espèces de la famille : une règle fabriquée par une suppression.
--
-- Après : ON DELETE CASCADE. La ligne disparaît avec l'espèce ; l'association
-- et ses autres lignes restent.
--
-- Aucune donnée n'est modifiée ici : les lignes déjà orphelines ne se
-- distinguent pas d'une ligne de famille voulue et ne sont pas touchées.
ALTER TABLE "associations_details" DROP CONSTRAINT IF EXISTS "associations_details_espece_fkey";
ALTER TABLE "associations_details" ADD CONSTRAINT "associations_details_espece_fkey" FOREIGN KEY ("espece") REFERENCES "especes"("espece") ON DELETE CASCADE ON UPDATE CASCADE;
