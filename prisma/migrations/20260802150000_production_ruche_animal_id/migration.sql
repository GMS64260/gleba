-- ============================================================
-- QA cmsbtlka1 — récolte de la ruche non rattachable à une ruche
-- gérée en animal individuel : productions_ruche ne connaissait que
-- lot_id (LotAnimaux). Ajout additif d'un rattachement animal_id,
-- nullable, sans reprise de données.
-- ============================================================
ALTER TABLE "productions_ruche" ADD COLUMN "animal_id" INTEGER;

ALTER TABLE "productions_ruche"
    ADD CONSTRAINT "productions_ruche_animal_id_fkey"
    FOREIGN KEY ("animal_id") REFERENCES "animaux"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "productions_ruche_animal_id_idx" ON "productions_ruche"("animal_id");
