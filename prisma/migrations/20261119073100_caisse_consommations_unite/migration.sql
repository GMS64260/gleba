-- Même unité figée que calculerStocksNet, pour la caisse et la boutique.
-- Aucun événement ni quantité historique n’est réécrit.
CREATE OR REPLACE FUNCTION source_recolte_net_milli(ferme TEXT, espece_cible TEXT, unite_cible TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE unite_principale TEXT; comptage TIMESTAMP; curseur NUMERIC; inventaire NUMERIC;
  production NUMERIC; consommation NUMERIC; commercial NUMERIC; transferts NUMERIC;
BEGIN
  SELECT caisse_unite_stock(COALESCE(u.unite_rendement,e.unite_rendement)),COALESCE(u.date_inventaire,'1970-01-01'::TIMESTAMP),
    COALESCE(u.inventaire,0)::NUMERIC,COALESCE(u.source_stock_sequence,'0')::NUMERIC
    INTO unite_principale,comptage,inventaire,curseur FROM especes e
    LEFT JOIN user_stock_especes u ON u.espece_id=e.espece AND u.user_id=ferme WHERE e.espece=espece_cible;
  SELECT COALESCE(sum(r.quantite::NUMERIC),0) INTO production FROM recoltes r
    WHERE r.user_id=ferme AND r.espece=espece_cible AND r.statut='en_stock' AND r.date>comptage
      AND COALESCE(r.unite,'kg')=unite_cible AND r.source_stock_origine IS DISTINCT FROM 'adoption'
      AND NOT EXISTS(SELECT 1 FROM produits_boutique p WHERE p.user_id=ferme AND p.recolte_id=r.id AND NOT p.source_stock_suivi);
  SELECT COALESCE(sum(c.quantite::NUMERIC),0) INTO consommation FROM consommations c
    WHERE c.user_id=ferme AND c.espece=espece_cible AND c.date>comptage AND COALESCE(c.unite,'kg')=unite_cible;
  SELECT COALESCE(sum(m.quantite::NUMERIC),0) INTO commercial FROM mouvements_stock_commerciaux m
    JOIN recoltes r ON r.id=m.recolte_id AND r.user_id=ferme WHERE m.user_id=ferme AND r.espece=espece_cible AND m.unite=unite_cible
      AND NOT EXISTS(SELECT 1 FROM produits_boutique p WHERE p.user_id=ferme AND p.recolte_id=r.id AND NOT p.source_stock_suivi)
      AND (CASE WHEN m.caisse_evenement_id IS NOT NULL THEN m.date
        WHEN ((m.date AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::DATE=((m.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::DATE
        THEN m.created_at ELSE m.date END)>comptage;
  SELECT COALESCE(sum(CASE s.type WHEN 'publication' THEN -s.quantite_milli WHEN 'retrait' THEN s.quantite_milli ELSE 0 END),0)
    INTO transferts FROM mouvements_source_stock_recoltes s WHERE s.user_id=ferme AND s.espece_id=espece_cible AND s.unite=unite_cible
      AND (s.date>comptage OR (s.date=comptage AND s.id>curseur));
  RETURN floor(((CASE WHEN unite_cible=unite_principale THEN inventaire ELSE 0 END)+production-consommation-commercial)*1000+transferts+0.5);
END $$;

