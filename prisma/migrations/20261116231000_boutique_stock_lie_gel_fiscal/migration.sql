-- Le gel fiscal des lignes d'une commande (20261112102500) refusait toute
-- modification, y compris la pose du lien au stock sur une ligne passée avant
-- que son produit soit relié : la reprise échouait sur toute commande au
-- détail fiscal figé. Le lien se pose une fois (ancien lien nul) et ne se
-- modifie ni ne se retire ensuite ; prix, quantités et taxes restent figés.
CREATE OR REPLACE FUNCTION boutique_figer_ligne_fiscale() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE suivi BOOLEAN;
BEGIN
  SELECT fiscalite_snapshot IS NOT NULL INTO suivi FROM commandes_boutique WHERE id=OLD.commande_id;
  IF suivi AND (TG_OP='DELETE'
    OR (to_jsonb(NEW) - 'stock_lie_type' - 'stock_lie_ref' - 'stock_lie_conditionnement')
       IS DISTINCT FROM (to_jsonb(OLD) - 'stock_lie_type' - 'stock_lie_ref' - 'stock_lie_conditionnement')
    OR (OLD.stock_lie_type IS NOT NULL
        AND (NEW.stock_lie_type, NEW.stock_lie_ref, NEW.stock_lie_conditionnement)
            IS DISTINCT FROM (OLD.stock_lie_type, OLD.stock_lie_ref, OLD.stock_lie_conditionnement))) THEN
    RAISE EXCEPTION 'BOUTIQUE_FISCALITE_FIGEE: conservez les lignes de la commande enregistrée.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
