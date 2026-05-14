-- DEV1 BUG-07 (audit Marc 2026-05-14) : 16 récoltes marquées « vendu » sans
-- prix, ni client, ni date de vente. Le CA moyen kg s'en trouvait faussé
-- (17,50 € pour 90 kg = 0,19 €/kg).
--
-- On reverte ces lignes orphelines en statut « en_stock » et on trace le
-- motif dans `notes` pour que le maraîcher puisse les compléter.

UPDATE recoltes
SET
  statut = 'en_stock',
  notes = COALESCE(notes, '') ||
    CASE
      WHEN notes IS NULL OR notes = '' THEN ''
      ELSE E'\n'
    END ||
    '[Audit 2026-05-14] Statut « vendu » réverti en « en_stock » : prix/date/client manquants. À compléter.'
WHERE statut = 'vendu'
  AND (prix_kg IS NULL OR prix_kg = 0)
  AND date_vente IS NULL
  AND client_id IS NULL
  AND client_nom IS NULL;
