-- Bug R28 — Backfill : créer l'écriture comptable auto (DepenseManuelle) pour les
-- achats de lots déjà enregistrés, afin que les KPI Dépenses passés (ex. 2025)
-- reflètent ces achats. Idempotent (NOT EXISTS). La liste /depenses exclut les
-- écritures auto et agrège le lot brut → pas de double comptage.
INSERT INTO "depenses_manuelles"
  (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant,
   journal, module, paye, tva_inferee, source_type, source_id, auto, created_at)
SELECT
  l.user_id,
  COALESCE(l.date_arrivee, now()),
  'achats',
  'Achat lot ' || COALESCE(l.nom, '#' || l.id::text),
  5.5,
  round((l.prix_achat_total / 1.055)::numeric, 2),
  round((l.prix_achat_total - l.prix_achat_total / 1.055)::numeric, 2),
  l.prix_achat_total,
  'AC', 'elevage', true, false,
  'achat_animal', l.id, true, now()
FROM "lots_animaux" l
WHERE l.prix_achat_total IS NOT NULL AND l.prix_achat_total > 0
  AND NOT EXISTS (
    SELECT 1 FROM "depenses_manuelles" d
    WHERE d.source_type = 'achat_animal' AND d.source_id = l.id AND d.auto = true
  );
