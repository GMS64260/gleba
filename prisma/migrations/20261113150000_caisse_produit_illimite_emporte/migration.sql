-- ST-01 (revue vente directe du 2026-11-11) : un produit de boutique à stock
-- illimité (stock_dispo NULL) emporté au marché n'a pas de quantité physique à
-- protéger. La garde refusait pourtant toute écriture de sa ligne tant qu'une
-- autre session en gardait une part : changement de prix, bon de livraison,
-- vente d'un second marché. Un stock illimité couvre toute réservation ; le
-- passage d'illimité à une quantité finie reste comparé à la part emportée.
-- Seule la condition finale change ; le reste de la fonction est repris de
-- 20261112084000_caisse_sources_recoltes.
CREATE OR REPLACE FUNCTION caisse_proteger_stock_reserve() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  ligne jsonb;
  ancien jsonb;
  genre text;
  unite_source text;
  physique double precision;
  reserve double precision;
  ferme text;
  source_id text;
  session_autorisee text := COALESCE(current_setting('gleba.caisse_session', true), '');
BEGIN
  ligne := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  ancien := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  ferme := ligne->>'user_id';
  source_id := ligne->>'id';
  genre := CASE TG_TABLE_NAME WHEN 'recoltes' THEN 'recolte' WHEN 'recoltes_arbres' THEN 'fruit'
    WHEN 'production_bois' THEN 'bois' WHEN 'produits_boutique' THEN 'boutique' WHEN 'lots_transformes' THEN 'transforme' END;
  SELECT COALESCE(SUM(quantite - consomme), 0)::double precision / 1000 INTO reserve
    FROM caisse_affectations WHERE user_id = ferme AND stock_type = genre AND stock_id = source_id
      AND libere_le IS NULL AND session_id <> session_autorisee;
  IF TG_TABLE_NAME = 'produits_boutique' AND TG_OP <> 'DELETE'
     AND ligne->>'recolte_id' IS NOT NULL
     AND (TG_OP = 'INSERT' OR (ligne->>'recolte_id') IS DISTINCT FROM (ancien->>'recolte_id'))
     AND NOT COALESCE((ligne->>'source_stock_suivi')::BOOLEAN,FALSE) THEN
    IF EXISTS(SELECT 1 FROM caisse_affectations WHERE user_id = ferme AND stock_type = 'recolte'
       AND stock_id = ligne->>'recolte_id' AND libere_le IS NULL AND quantite > consomme) THEN
      RAISE EXCEPTION 'Cette récolte est réservée à un marché. Clôturez son affectation avant de la publier en boutique.';
    END IF;
  END IF;
  IF reserve > 0 THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Ce stock est réservé à un marché et ne peut pas être supprimé.'; END IF;
    unite_source := CASE WHEN genre = 'fruit' THEN 'kg' ELSE ligne->>'unite' END;
    IF TG_OP = 'UPDATE' AND (ligne->>'unite') IS DISTINCT FROM (ancien->>'unite') THEN
      RAISE EXCEPTION 'Conservez l’unité du stock réservé au marché.';
    END IF;
    physique := CASE
      WHEN genre = 'boutique' THEN (ligne->>'stock_dispo')::double precision
      WHEN genre = 'bois' THEN COALESCE((ligne->>'stock_disponible_commercial')::double precision,
        (ligne->>'volume_stere')::double precision, (ligne->>'volume_m3')::double precision, (ligne->>'poids_kg')::double precision, 0)
      ELSE COALESCE((ligne->>'stock_disponible_commercial')::double precision, (ligne->>'quantite')::double precision, 0)
    END;
    IF genre IN ('recolte','fruit','bois') AND ligne->>'statut' <> 'en_stock' THEN physique := 0; END IF;
    IF (physique IS NULL AND genre <> 'boutique') OR physique + 0.000001 < reserve THEN
      RAISE EXCEPTION 'Cette sortie prendrait du stock réservé au marché (% %). Revenez à la préparation ou clôturez le marché.', reserve, COALESCE(unite_source, 'unité');
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
