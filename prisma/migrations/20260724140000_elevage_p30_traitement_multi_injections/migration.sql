-- PROMPT 30 — Traitement à plusieurs injections (feedback La ferme des belles chèvres 2026-07-24)
-- Un traitement (ex. Pénijectyl J0/J1/J2) tient sur une ligne : nombre d'injections + intervalle.
-- Le délai d'attente est calculé depuis la dernière injection.
ALTER TABLE "soins_animaux" ADD COLUMN "nb_injections" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "soins_animaux" ADD COLUMN "intervalle_injections_heures" INTEGER;
