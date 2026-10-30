-- Achats d'arbre présumés réglés (décision du 2026-10-30), comme les achats
-- d'animaux et de lots. La reprise 20261028193000 avait ouvert chaque achat
-- historique en dette (paye = false) sous une note dédiée. Seules ces lignes
-- reprises, jamais rattachées au suivi des règlements (aucune cible pour leur
-- clé, cleSourceReglement('depense', 'achat_arbre', id)), passent réglées ;
-- HT arrondi au centime, TVA = TTC - HT. Une ligne passée par Règlements,
-- même aux versements annulés, garde son état : ses lectures détaillées la
-- montrent non réglée. Idempotent : la note change, une seconde exécution ne
-- trouve plus rien. Aucune autre ligne n'est touchée.
UPDATE depenses_manuelles d
SET paye = true,
    montant_ht = ROUND(COALESCE(d.montant_ht, d.montant / (1 + d.taux_tva / 100))::numeric, 2)::double precision,
    montant_tva = (d.montant::numeric
      - ROUND(COALESCE(d.montant_ht, d.montant / (1 + d.taux_tva / 100))::numeric, 2))::double precision,
    notes = 'Achat repris depuis la fiche arbre ; présumé réglé à l''achat.'
WHERE d.source_type = 'achat_arbre'
  AND d.auto = true
  AND d.paye = false
  AND d.notes = 'Achat repris depuis la fiche arbre ; règlement historique à préciser.'
  AND NOT EXISTS (
    SELECT 1 FROM cibles_reglement c
    WHERE c.user_id = d.user_id
      AND c.cle = '["depense","achat_arbre","id","' || d.source_id::text || '"]'
  );
