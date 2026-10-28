-- Journal des sorties physiques hors vente : production et pièces commerciales conservées.
ALTER TABLE mouvements_stock_commerciaux ADD COLUMN IF NOT EXISTS nature TEXT NOT NULL DEFAULT 'livraison';
ALTER TABLE mouvements_stock_commerciaux ADD COLUMN IF NOT EXISTS cle_idempotence TEXT;
ALTER TABLE mouvements_stock_commerciaux ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS mouvements_stock_commerciaux_user_id_cle_idempotence_key
  ON mouvements_stock_commerciaux(user_id, cle_idempotence);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mouvements_stock_commerciaux_nature_check') THEN
    ALTER TABLE mouvements_stock_commerciaux ADD CONSTRAINT mouvements_stock_commerciaux_nature_check CHECK (
      nature IN ('livraison','perte','consomme','utilise') AND (nature = 'livraison' OR (
        document_id IS NULL AND facture_id IS NULL AND origine_retour_id IS NULL AND cle_idempotence IS NOT NULL
        AND quantite > 0 AND quantite < 'Infinity'::float8
        AND ((fruit_id IS NOT NULL AND bois_id IS NULL AND article_stock_type = 'fruit' AND nature IN ('perte','consomme'))
          OR (bois_id IS NOT NULL AND fruit_id IS NULL AND article_stock_type = 'bois' AND nature = 'utilise'))
      ))
    );
  END IF;
END $$;

-- Reprise déterministe des achats jusqu'ici affichés sans écriture : aucun paiement inventé.
-- Les miroirs existants, leurs pointages et leur journal restent intacts.
INSERT INTO depenses_manuelles (user_id, date, categorie, description, montant, montant_ht, montant_tva,
  taux_tva, journal, fournisseur_nom, module, comptable, paye, tva_inferee, source_type, source_id, auto, notes)
SELECT a.user_id, COALESCE(a.date_achat, a.date_plantation, a.created_at), 'plants', 'Achat ' || a.nom,
  a.prix_achat, a.prix_achat / 1.1, a.prix_achat - a.prix_achat / 1.1,
  10, 'AC', a.fournisseur, 'verger', true, false, true, 'achat_arbre', a.id, true,
  'Achat repris depuis la fiche arbre ; règlement historique à préciser.'
FROM arbres a WHERE a.prix_achat > 0 AND a.prix_achat < 'Infinity'::float8
ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
