-- PROMPT 28 — Mère externe / hors troupeau (feedback éleveur caprin 2026-07-21)
-- Symétrique de pere_identifiant : n° de boucle d'une mère absente du cheptel (décédée, autre élevage).
ALTER TABLE "animaux" ADD COLUMN "mere_identifiant" TEXT;
