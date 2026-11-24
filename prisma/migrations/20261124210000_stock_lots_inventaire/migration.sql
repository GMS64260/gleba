-- Modèle de stock unique, L3 (2026-11-24, choix B de Guillaume) : un lot de
-- récolte peut naître d'un comptage du stock, sans culture d'origine (« lot
-- d'inventaire ») : une cave tenue par comptage, sans récolte saisie, garde
-- ainsi son stock quand le stock devient la somme des lots. La colonne
-- `culture` devient facultative ; la clé étrangère et sa cascade restent.
--
-- Écart d'inventaire : la part qu'un comptage ne retrouve pas sort des lots au
-- statut `ecart`, compté comme les autres sorties de lots comptés.
--
-- Modification du catalogue seulement : aucune réécriture de table.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "recoltes" ALTER COLUMN "culture" DROP NOT NULL;

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
      AND ((r.statut IN ('perte','consomme','don','ecart') AND r.date_sortie>comptage) OR (r.statut='vendu' AND r.date_vente>comptage))
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
