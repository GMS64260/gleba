-- ============================================================
-- Feedback testeur 2026-05-26 (cmpm79lql) — Traçabilité des naissances :
-- en élevage en lot (lapins), une portée n'a pas de mère nominative et
-- ne pouvait être rattachée à un lot. On ajoute un lien direct lot_id.
-- ============================================================

ALTER TABLE "naissances_animales" ADD COLUMN "lot_id" INTEGER;

CREATE INDEX "naissances_animales_lot_id_idx" ON "naissances_animales"("lot_id");

ALTER TABLE "naissances_animales"
  ADD CONSTRAINT "naissances_animales_lot_id_fkey"
  FOREIGN KEY ("lot_id") REFERENCES "lots_animaux"("id")
  ON UPDATE CASCADE ON DELETE SET NULL;

-- Backfill : rattacher les naissances existantes au lot de leur mère
-- (quand la mère est dans un lot). Les portées sans mère restent à
-- compléter manuellement via le formulaire.
UPDATE "naissances_animales" n
SET "lot_id" = a."lot_id"
FROM "animaux" a
WHERE n."mere_id" = a."id" AND a."lot_id" IS NOT NULL AND n."lot_id" IS NULL;
