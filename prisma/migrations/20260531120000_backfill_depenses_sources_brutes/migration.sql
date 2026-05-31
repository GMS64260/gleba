-- Bug COMPTA #1 — Backfill : créer l'écriture comptable auto (DepenseManuelle)
-- pour TOUTES les sources brutes de dépenses qui n'en avaient pas encore.
--
-- Contexte : la SSOT compta (getKpiCompta) somme les DepenseManuelle. La
-- ventilation par module (/api/comptabilite/stats) et la liste /depenses
-- agrègent les sources BRUTES (soins, aliments, achats animaux/arbres,
-- fertilisations, opérations arbres) + DepenseManuelle non-auto.
--
-- Seul `achat_animal` (lots) avait une écriture auto (cf. migration
-- 20260529210000_backfill_depenses_lots). Les autres sources étaient comptées
-- dans la ventilation par module MAIS absentes de la SSOT → écart « KPI Dépenses
-- vs TOTAL par module » (bannière « Incohérence détectée »).
--
-- Cette migration complète la SSOT pour qu'elle inclue chaque dépense réelle une
-- seule fois. Idempotente (NOT EXISTS sur source_type/source_id/auto). La liste
-- /depenses et la ventilation par module continuent d'exclure les auto et
-- d'agréger la source brute → aucun double comptage.
--
-- Les montants/modules/taux TVA reproduisent EXACTEMENT le calcul des sources
-- brutes côté /api/comptabilite/stats (prix global aliment/fertilisant), afin
-- que KPI Dépenses == TOTAL ventilation par module.

-- 1) Soins animaux (cout) → module elevage
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  s.user_id,
  s.date,
  'autre',
  'Soin animal #' || s.id::text,
  20,
  round((s.cout / 1.20)::numeric, 2),
  round((s.cout - s.cout / 1.20)::numeric, 2),
  s.cout,
  'AC', 'elevage', true, true,
  'soin_animal', s.id, true, now()
FROM "soins_animaux" s
WHERE s.cout IS NOT NULL AND s.cout > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'soin_animal' AND d.source_id = s.id AND d.auto = true
  );

-- 2) Achats animaux individuels (prix_achat) → module elevage
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  a.user_id,
  COALESCE(a.date_arrivee, a.created_at),
  'achats',
  'Achat animal ' || COALESCE(a.nom, '#' || a.id::text),
  5.5,
  round((a.prix_achat / 1.055)::numeric, 2),
  round((a.prix_achat - a.prix_achat / 1.055)::numeric, 2),
  a.prix_achat,
  'AC', 'elevage', true, true,
  'achat_animal_individuel', a.id, true, now()
FROM "animaux" a
WHERE a.prix_achat IS NOT NULL AND a.prix_achat > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'achat_animal_individuel' AND d.source_id = a.id AND d.auto = true
  );

-- 3) Achats arbres (prix_achat) → module verger
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  a.user_id,
  COALESCE(a.date_achat, a.date_plantation, a.created_at),
  'achats',
  'Achat arbre ' || a.nom,
  5.5,
  round((a.prix_achat / 1.055)::numeric, 2),
  round((a.prix_achat - a.prix_achat / 1.055)::numeric, 2),
  a.prix_achat,
  'AC', 'verger', true, true,
  'achat_arbre', a.id, true, now()
FROM "arbres" a
WHERE a.prix_achat IS NOT NULL AND a.prix_achat > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'achat_arbre' AND d.source_id = a.id AND d.auto = true
  );

-- 4) Opérations arbres (cout) → module verger
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  o.user_id,
  o.date,
  'autre',
  'Opération arbre ' || o.type,
  20,
  round((o.cout / 1.20)::numeric, 2),
  round((o.cout - o.cout / 1.20)::numeric, 2),
  o.cout,
  'AC', 'verger', true, true,
  'operation_arbre', o.id, true, now()
FROM "operations_arbres" o
WHERE o.cout IS NOT NULL AND o.cout > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'operation_arbre' AND d.source_id = o.id AND d.auto = true
  );

-- 5) Consommations d'aliments (quantite * prix global) → module elevage
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  c.user_id,
  c.date,
  'achats',
  'Consommation aliment ' || c.aliment_id,
  10,
  round(((c.quantite * al.prix) / 1.10)::numeric, 2),
  round(((c.quantite * al.prix) - (c.quantite * al.prix) / 1.10)::numeric, 2),
  round((c.quantite * al.prix)::numeric, 2),
  'AC', 'elevage', true, true,
  'consommation_aliment', c.id, true, now()
FROM "consommations_aliments" c
JOIN "aliments" al ON c.aliment_id = al.aliment
WHERE al.prix IS NOT NULL AND (c.quantite * al.prix) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'consommation_aliment' AND d.source_id = c.id AND d.auto = true
  );

-- 6) Fertilisations (quantite * prix global) → module potager
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  f.user_id,
  f.date,
  'achats',
  'Fertilisation ' || f.fertilisant,
  20,
  round(((f.quantite * fe.prix) / 1.20)::numeric, 2),
  round(((f.quantite * fe.prix) - (f.quantite * fe.prix) / 1.20)::numeric, 2),
  round((f.quantite * fe.prix)::numeric, 2),
  'AC', 'potager', true, true,
  'fertilisation', f.id, true, now()
FROM "fertilisations" f
JOIN "fertilisants" fe ON f.fertilisant = fe.fertilisant
WHERE fe.prix IS NOT NULL AND (f.quantite * fe.prix) > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'fertilisation' AND d.source_id = f.id AND d.auto = true
  );
