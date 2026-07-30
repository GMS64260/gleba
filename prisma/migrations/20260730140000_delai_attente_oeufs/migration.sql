-- Délai de retrait sur les ŒUFS (QA 2026-07-30).
--
-- Le modèle ne portait que des délais lait et viande. La matrice AMM
-- (20260726220000) déclinait donc mécaniquement le délai lait du produit sur
-- toutes les espèces couvertes, volailles incluses : un traitement sur des
-- pondeuses affichait une date de « remise en vente du lait ». Réglementairement
-- les 4 jours de tylosine sur une poule pondeuse sont un délai œufs.
--
-- Migration additive : les colonnes sont créées avec un défaut neutre, puis les
-- délais lait aberrants portés par des volailles sont basculés en délai œufs.

ALTER TABLE "produits_veterinaires"
  ADD COLUMN IF NOT EXISTS "temps_attente_oeufs_j" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "produits_veterinaires_especes"
  ADD COLUMN IF NOT EXISTS "temps_attente_oeufs_j" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "soins_animaux"
  ADD COLUMN IF NOT EXISTS "temps_attente_oeufs_j" INTEGER,
  ADD COLUMN IF NOT EXISTS "fin_attente_oeufs" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "soins_animaux_fin_attente_oeufs_idx"
  ON "soins_animaux" ("fin_attente_oeufs");

-- Bascule de la matrice produit × espèce : sur une volaille, un délai « lait »
-- n'a pas de sens ; c'est le délai œufs qui était renseigné. On ne touche que
-- les lignes où le délai œufs n'a pas déjà été saisi, pour rester idempotent.
UPDATE "produits_veterinaires_especes" pve
SET "temps_attente_oeufs_j" = pve."temps_attente_lait_j",
    "temps_attente_lait_j" = 0
FROM "especes_animales" ea
WHERE ea."espece_animale" = pve."espece_animale_id"
  AND ea."type" = 'volaille'
  AND pve."temps_attente_lait_j" > 0
  AND pve."temps_attente_oeufs_j" = 0;

-- Même bascule sur les soins déjà enregistrés visant une espèce avicole : la
-- date de remise en vente du lait affichée était trompeuse.
UPDATE "soins_animaux" s
SET "temps_attente_oeufs_j" = s."temps_attente_lait_j",
    "fin_attente_oeufs" = s."fin_attente_lait",
    "temps_attente_lait_j" = 0,
    "fin_attente_lait" = NULL
WHERE s."temps_attente_lait_j" > 0
  AND s."temps_attente_oeufs_j" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "especes_animales" ea
    WHERE ea."espece_animale" = COALESCE(
            (SELECT l."espece_animale_id" FROM "lots_animaux" l WHERE l."id" = s."lot_id"),
            (SELECT a."espece_animale_id" FROM "animaux" a WHERE a."id" = s."animal_id")
          )
      AND ea."type" = 'volaille'
  );
