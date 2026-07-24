-- Suivi individuel des administrations d'un protocole multi-injections.
CREATE TABLE "injections_soins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "soin_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "date_prevue" TIMESTAMP(3) NOT NULL,
    "date_realisee" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'a_faire',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "injections_soins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "injections_soins_soin_id_numero_key"
  ON "injections_soins"("soin_id", "numero");
CREATE INDEX "injections_soins_user_id_statut_date_prevue_idx"
  ON "injections_soins"("user_id", "statut", "date_prevue");
CREATE INDEX "injections_soins_soin_id_idx"
  ON "injections_soins"("soin_id");

ALTER TABLE "injections_soins"
  ADD CONSTRAINT "injections_soins_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "injections_soins"
  ADD CONSTRAINT "injections_soins_soin_id_fkey"
  FOREIGN KEY ("soin_id") REFERENCES "soins_animaux"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprendre les protocoles déjà créés avant cette migration. Une ancienne
-- ligne `fait=true` prouve uniquement la première administration ; les
-- suivantes restent à acquitter.
INSERT INTO "injections_soins"
  ("id", "user_id", "soin_id", "numero", "date_prevue", "date_realisee",
   "statut", "created_at", "updated_at")
SELECT
  'inj_' || md5(random()::text || clock_timestamp()::text || s.id::text || n.numero::text),
  s.user_id,
  s.id,
  n.numero,
  s.date + ((n.numero - 1) * COALESCE(s.intervalle_injections_heures, 0) * INTERVAL '1 hour'),
  CASE WHEN n.numero = 1 AND s.fait THEN s.date ELSE NULL END,
  CASE WHEN n.numero = 1 AND s.fait THEN 'realisee' ELSE 'a_faire' END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM soins_animaux s
CROSS JOIN LATERAL generate_series(1, GREATEST(1, s.nb_injections)) AS n(numero);
