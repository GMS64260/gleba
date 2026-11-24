-- Modèle de stock unique, lot 2 (2026-11-24) : une sortie saisie dans
-- Consommations (écran, assistant, MCP) consomme les lots de récolte libres, du
-- plus ancien au plus récent. Chaque lot sorti garde le lien vers sa sortie
-- (`recoltes.consommation_id`) pour être rendu au stock si elle est annulée ;
-- seule la part qu'aucun lot ne couvre (`consommations.quantite_hors_lots`)
-- reste retranchée du stock de l'espèce comme avant. NULL = ligne antérieure :
-- toute sa quantité est hors lots.
--
-- Le stock de l'espèce (`source_recolte_net_milli`, double SQL de
-- `calculerStocksNet`) retranche aussi désormais les lots datés jusqu'au
-- dernier comptage puis sortis après lui (perte, consommation, don, vente),
-- dans l'unité principale de l'espèce, la seule que le comptage porte : il
-- les comptait encore, et rien ne les en déduisait avant le comptage suivant.
--
-- Colonnes additives, nulles, sans valeur par défaut : aucune réécriture.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "consommations" ADD COLUMN "quantite_hors_lots" DOUBLE PRECISION;
ALTER TABLE "recoltes" ADD COLUMN "consommation_id" INTEGER;
CREATE INDEX "recoltes_consommation_id_idx" ON "recoltes"("consommation_id");
ALTER TABLE "recoltes" ADD CONSTRAINT "recoltes_consommation_id_fkey" FOREIGN KEY ("consommation_id") REFERENCES "consommations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION source_recolte_net_milli(ferme TEXT, espece_cible TEXT, unite_cible TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE unite_principale TEXT; comptage TIMESTAMP; curseur NUMERIC; inventaire NUMERIC;
  production NUMERIC; consommation NUMERIC; commercial NUMERIC; transferts NUMERIC; sorties_comptees NUMERIC;
BEGIN
  SELECT caisse_unite_stock(COALESCE(u.unite_rendement,e.unite_rendement)),COALESCE(u.date_inventaire,'1970-01-01'::TIMESTAMP),
    COALESCE(u.inventaire,0)::NUMERIC,COALESCE(u.source_stock_sequence,'0')::NUMERIC
    INTO unite_principale,comptage,inventaire,curseur FROM especes e
    LEFT JOIN user_stock_especes u ON u.espece_id=e.espece AND u.user_id=ferme WHERE e.espece=espece_cible;
  SELECT COALESCE(sum(r.quantite::NUMERIC),0) INTO production FROM recoltes r
    WHERE r.user_id=ferme AND r.espece=espece_cible AND r.statut='en_stock' AND r.date>comptage
      AND COALESCE(r.unite,'kg')=unite_cible AND r.source_stock_origine IS DISTINCT FROM 'adoption'
      AND NOT EXISTS(SELECT 1 FROM produits_boutique p WHERE p.user_id=ferme AND p.recolte_id=r.id AND NOT p.source_stock_suivi);
  -- Lots comptés (datés jusqu'au comptage) sortis après lui.
  SELECT COALESCE(sum(r.quantite::NUMERIC),0) INTO sorties_comptees FROM recoltes r
    WHERE r.user_id=ferme AND r.espece=espece_cible AND r.date<=comptage AND COALESCE(r.unite,'kg')=unite_cible
      AND ((r.statut IN ('perte','consomme','don') AND r.date_sortie>comptage) OR (r.statut='vendu' AND r.date_vente>comptage))
      -- Daté du jour du comptage mais saisi après lui : jamais compté, donc pas retranché.
      AND (((r.date AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::DATE<>((r.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::DATE
        OR r.created_at<=comptage)
      AND NOT EXISTS(SELECT 1 FROM produits_boutique p WHERE p.user_id=ferme AND p.recolte_id=r.id AND NOT p.source_stock_suivi);
  SELECT COALESCE(sum(COALESCE(c.quantite_hors_lots,c.quantite)::NUMERIC),0) INTO consommation FROM consommations c
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
  -- Le comptage ne porte que l'unité principale : seules ses sorties s'en retranchent.
  RETURN floor(((CASE WHEN unite_cible=unite_principale THEN inventaire-sorties_comptees ELSE 0 END)+production-consommation-commercial)*1000+transferts+0.5);
END $$;

COMMIT;
