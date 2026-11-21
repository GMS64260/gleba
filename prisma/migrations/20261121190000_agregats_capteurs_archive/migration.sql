-- Revue Codex du 2026-11-12, CAP-01 : un agrégat journalier restauré sans
-- ses mesures brutes (sauvegarde au-delà du seuil de brut) était recalculé
-- sur le seul brut présent dès qu'une mesure tardive (rattrapage de 7 jours)
-- arrivait ce jour-là : 100 mesures d'historique devenaient 1.
--
-- La part « archive » d'une journée décrit les mesures que l'agrégat compte
-- mais dont le brut n'existe pas dans cette base. L'agrégation combine cette
-- part et le brut présent, sans compter deux fois le brut (l'archive ne le
-- contient pas). NULL : aucune part archivée, comportement inchangé.
ALTER TABLE "mesures_capteurs_jours"
  ADD COLUMN "archive_nombre" INTEGER,
  ADD COLUMN "archive_min" DOUBLE PRECISION,
  ADD COLUMN "archive_max" DOUBLE PRECISION,
  ADD COLUMN "archive_moyenne" DOUBLE PRECISION;

-- Part archivée complète ou absente, jamais vide.
ALTER TABLE "mesures_capteurs_jours"
  ADD CONSTRAINT "mesures_capteurs_jours_archive_check" CHECK (
    ("archive_nombre" IS NULL AND "archive_min" IS NULL AND "archive_max" IS NULL AND "archive_moyenne" IS NULL)
    OR ("archive_nombre" > 0 AND "archive_min" IS NOT NULL AND "archive_max" IS NOT NULL AND "archive_moyenne" IS NOT NULL
        AND "archive_nombre" <= "nombre")
  );
