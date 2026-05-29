-- Nettoyage de données incohérentes signalées par le testeur.

-- R13/R32 — Cultures dont la récolte tombe AVANT le semis (ITP chevauchant deux
-- années, dates figées avant le correctif de calcul). La récolte est l'année +1.
UPDATE "cultures"
SET "date_recolte" = "date_recolte" + interval '1 year'
WHERE "date_recolte" IS NOT NULL AND "date_semis" IS NOT NULL
  AND "date_recolte" < "date_semis";

UPDATE "cultures"
SET "date_recolte" = "date_recolte" + interval '1 year'
WHERE "date_recolte" IS NOT NULL AND "date_plantation" IS NOT NULL AND "date_semis" IS NULL
  AND "date_recolte" < "date_plantation";

-- R10 — Étapes de campagne marquées « réalisées » à une date ANTÉRIEURE à la date
-- prévue (incohérence). On annule la réalisation (l'étape redevient à faire).
UPDATE "etapes_campagne"
SET "fait" = false, "date_realisation" = NULL
WHERE "date_realisation" IS NOT NULL AND "date_prevue" IS NOT NULL
  AND "date_realisation" < "date_prevue";

-- R3 — Ventes à prix nul marquées « payé » → repassées « non payé ».
UPDATE "ventes_produits"
SET "paye" = false
WHERE "paye" = true AND ("prix_total" = 0 OR "prix_total" IS NULL);
