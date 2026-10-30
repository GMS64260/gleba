-- Un lot du verger entamé seulement par des sorties physiques (perte,
-- consommation, usage interne) reste corrigeable (revue du 2026-10-30) :
-- depuis le 2026-10-28, la première perte d'un lot jamais livré le figeait
-- pour toujours. L'API vérifie que la nouvelle quantité couvre ces sorties.
-- Un lot qui porte une livraison (bon ou facture) reste figé ; maraîchage
-- inchangé. Seul le corps de la fonction change, les triggers restent.
CREATE OR REPLACE FUNCTION proteger_lot_commercial() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE champ text; modifie boolean := false;
BEGIN
  IF OLD.stock_disponible_commercial IS NULL THEN RETURN NEW; END IF;
  FOREACH champ IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->champ IS DISTINCT FROM to_jsonb(NEW)->champ THEN modifie := true; END IF;
  END LOOP;
  IF NOT modifie THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'recoltes_arbres'
    AND EXISTS (SELECT 1 FROM mouvements_stock_commerciaux WHERE fruit_id = OLD.id AND nature <> 'livraison')
    AND NOT EXISTS (SELECT 1 FROM mouvements_stock_commerciaux WHERE fruit_id = OLD.id AND nature = 'livraison') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'production_bois'
    AND EXISTS (SELECT 1 FROM mouvements_stock_commerciaux WHERE bois_id = OLD.id AND nature <> 'livraison')
    AND NOT EXISTS (SELECT 1 FROM mouvements_stock_commerciaux WHERE bois_id = OLD.id AND nature = 'livraison') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'STOCK_COMMERCIAL_LIE: Ce lot est lié à un bon ou une facture. Utilisez les documents commerciaux pour livrer le reliquat ou enregistrer son retour.';
END $$;
