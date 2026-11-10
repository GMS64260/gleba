-- `uniq_collecte_traite` porte sur (user_id, date, traite, animal_id, lot_id),
-- or une collecte vise un animal OU un lot : l'une des deux colonnes est
-- toujours NULL, et deux NULL sont distincts pour un index unique. L'unicité
-- n'était donc jamais appliquée (revue du 2026-11-04, constat D13).
--
-- L'index est recréé avec NULLS NOT DISTINCT (PostgreSQL 15+). Si des doublons
-- existent déjà, il est laissé tel quel et un avertissement est émis : une
-- migration ne supprime pas de collectes, et ne doit pas bloquer un démarrage.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "collectes_lait"
    GROUP BY "user_id", "date", "traite", "animal_id", "lot_id"
    HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'uniq_collecte_traite : des collectes en double existent, index laissé inchangé (à dédoublonner puis recréer avec NULLS NOT DISTINCT).';
  ELSE
    DROP INDEX IF EXISTS "uniq_collecte_traite";
    CREATE UNIQUE INDEX "uniq_collecte_traite"
      ON "collectes_lait"("user_id", "date", "traite", "animal_id", "lot_id") NULLS NOT DISTINCT;
  END IF;
END $$;
