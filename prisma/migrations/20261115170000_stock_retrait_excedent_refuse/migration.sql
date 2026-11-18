-- Retrait boutique → récolte : refus explicite d'un dépassement matériel (contre-revue ADV98, 2026-11-15).
--
-- La migration 20261115130000 bornait le reliquat écrit par la primitive
-- `stock_apres_retour_plafonne`, quel que soit l'écart. Récolte de 2,1 kg,
-- publication de 0,1, comptage en boutique à 0,2 puis retrait : la récolte
-- recevait 2,1 kg (0,1 kg perdu en silence) alors que le journal source
-- inscrivait stock_recolte_milli = 2200 et quantite_milli = 200, et que
-- `source_recolte_net_milli` rendait 2200. Avant ce lot, la CHECK refusait.
--
-- Règle : le plafond ne compense que l'écart de grille d'une production
-- héritée (2,0999999999999996 kg lue 2100 millièmes). Si le reliquat rendu, au
-- millième, dépasse la production lue au millième, le retrait (DELETE ou
-- retour au stock des récoltes) est refusé par `SOURCE_RECOLTE_EXCEDENT`
-- (message lisible dans `messageConflitStockCaisse`). Dans le cas accepté,
-- stock_r ≤ production au millième, donc le journal décrit le stock écrit
-- (source_recolte_milli(stock écrit) = stock_r). Aucune autre branche ne change.
BEGIN;

CREATE OR REPLACE FUNCTION source_recolte_boutique() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p produits_boutique; r recoltes; origine TEXT:=COALESCE(current_setting('gleba.source_stock_operation',true),'');
  unite_native TEXT; q BIGINT; avant BIGINT; apres BIGINT; delta BIGINT; reserve_r NUMERIC; reserve_g NUMERIC; reserve_b NUMERIC;
  libre NUMERIC; type_mouvement TEXT; q_mouvement BIGINT; stock_r BIGINT; source_avant JSONB; commande_exclue INTEGER;
BEGIN
  p:=CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  IF TG_OP='UPDATE' AND OLD.recolte_id IS NOT NULL AND NOT OLD.source_stock_suivi
    AND (NEW.user_id,NEW.recolte_id,NEW.unite) IS DISTINCT FROM (OLD.user_id,OLD.recolte_id,OLD.unite) THEN
    RAISE EXCEPTION 'SOURCE_RECOLTE_HISTORIQUE: rapprochez les stocks sans changer leur source ou unité.';
  END IF;
  IF TG_OP<>'INSERT' AND OLD.source_stock_suivi THEN
    IF TG_OP='UPDATE' AND (NEW.id,NEW.user_id,NEW.recolte_id,NEW.unite,NEW.source_stock_suivi) IS DISTINCT FROM
      (OLD.id,OLD.user_id,OLD.recolte_id,OLD.unite,OLD.source_stock_suivi) THEN
      RAISE EXCEPTION 'SOURCE_RECOLTE_IDENTITE: la source et l’unité du produit suivi sont figées.';
    END IF;
  END IF;
  IF TG_OP<>'INSERT' AND OLD.recolte_id IS NOT NULL AND NOT OLD.source_stock_suivi AND NOT (TG_OP='UPDATE' AND NEW.source_stock_suivi) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'SOURCE_RECOLTE_HISTORIQUE: rapprochez cette ancienne publication avant de rendre son stock aux récoltes.'; END IF;
    RETURN NEW;
  END IF;
  IF p.recolte_id IS NULL THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  SELECT * INTO r FROM recoltes WHERE id=p.recolte_id AND user_id=p.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_RECOLTE_IDENTITE: la récolte et le produit doivent appartenir à la même exploitation.'; END IF;
  PERFORM caisse_controler_stock_net(r.user_id,r.espece);
  unite_native:=COALESCE(r.unite,'kg');
  IF p.unite<>(CASE WHEN unite_native='piece' THEN 'pièce' ELSE unite_native END) AND p.unite<>unite_native THEN
    RAISE EXCEPTION 'SOURCE_RECOLTE_UNITE: un conditionnement explicite est nécessaire pour changer l’unité de la récolte.';
  END IF;
  source_avant:=jsonb_build_object('statut',r.statut,'dateVente',r.date_vente,'date',r.date,'quantite',r.quantite,'unite',r.unite,'stock',r.stock_disponible_commercial,
    'stockBoutiqueAvant',CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.stock_dispo END,
    'motif',COALESCE(current_setting('gleba.source_stock_motif',true),''));
  avant:=CASE WHEN TG_OP='INSERT' OR (NOT OLD.source_stock_suivi AND origine='adoption') THEN 0 ELSE source_recolte_milli(OLD.stock_dispo) END;
  apres:=CASE WHEN TG_OP='DELETE' THEN 0 ELSE source_recolte_milli(NEW.stock_dispo) END;
  delta:=apres-avant;
  IF unite_native<>'kg' AND (apres%1000<>0 OR avant%1000<>0) THEN RAISE EXCEPTION 'SOURCE_RECOLTE_QUANTITE: une quantité entière est requise dans cette unité.'; END IF;
  IF origine ~ '^commande:[0-9]+$' THEN commande_exclue:=split_part(origine,':',2)::INTEGER; END IF;
  SELECT COALESCE(sum(a.quantite-a.consomme),0) INTO reserve_b FROM caisse_affectations a WHERE a.user_id=p.user_id AND a.stock_type='boutique'
    AND a.stock_id=p.id::TEXT AND a.libere_le IS NULL AND a.session_id<>COALESCE(current_setting('gleba.caisse_session',true),'');
  SELECT reserve_b+COALESCE(sum(l.quantite::NUMERIC*1000),0) INTO reserve_b FROM lignes_commande_boutique l JOIN commandes_boutique c ON c.id=l.commande_id
    WHERE l.produit_id=p.id AND c.user_id=p.user_id AND c.statut NOT IN ('annulee','livree') AND c.vente_manuelle_id IS NULL AND c.paiement_statut<>'Confirmé'
      AND c.id IS DISTINCT FROM commande_exclue;
  IF apres<reserve_b THEN RAISE EXCEPTION 'SOURCE_RECOLTE_STOCK: cette quantité est réservée à une commande ou un marché.'; END IF;
  IF TG_OP='DELETE' AND (EXISTS(SELECT 1 FROM lignes_commande_boutique WHERE produit_id=p.id) OR EXISTS(SELECT 1 FROM mouvements_stock_commerciaux WHERE produit_boutique_id=p.id)) THEN
    RAISE EXCEPTION 'SOURCE_RECOLTE_IDENTITE: désactivez ce produit pour conserver ses commandes et mouvements.';
  END IF;
  IF TG_OP='INSERT' THEN
    IF EXISTS(SELECT 1 FROM produits_boutique WHERE recolte_id=p.recolte_id) OR r.statut<>'en_stock' THEN
      RAISE EXCEPTION 'SOURCE_RECOLTE_IDENTITE: cette source doit être rapprochée avant une nouvelle publication.';
    END IF;
    NEW.source_stock_suivi:=TRUE;
    type_mouvement:='publication'; q_mouvement:=apres;
    IF apres<=0 THEN RAISE EXCEPTION 'SOURCE_RECOLTE_QUANTITE: renseignez la quantité à confier à la boutique.'; END IF;
  ELSIF NOT OLD.source_stock_suivi THEN
    IF origine<>'adoption' THEN RAISE EXCEPTION 'SOURCE_RECOLTE_HISTORIQUE: le rapprochement doit être explicite.'; END IF;
    stock_r:=source_recolte_milli(NULLIF(current_setting('gleba.source_stock_loose',true),'')::DOUBLE PRECISION);
    UPDATE recoltes SET stock_disponible_commercial=stock_r::DOUBLE PRECISION/1000,source_stock_origine=COALESCE(source_stock_origine,'adoption'),statut='en_stock',date_vente=NULL WHERE id=r.id;
    type_mouvement:='adoption'; q_mouvement:=apres;
  ELSIF TG_OP='DELETE' OR (origine='retour-recolte' AND delta<0) THEN
    type_mouvement:='retrait'; q_mouvement:=avant-apres;
  ELSIF delta>0 AND origine='reassort' THEN type_mouvement:='publication'; q_mouvement:=delta;
  ELSIF delta<>0 THEN
    IF delta>0 AND origine NOT IN ('retour-client','comptage') AND COALESCE(current_setting('gleba.caisse_session',true),'')='' THEN
      RAISE EXCEPTION 'SOURCE_RECOLTE_MODE: précisez réassort, retour ou comptage du stock.';
    END IF;
    IF origine='retour-recolte' OR (origine='reassort' AND delta<0) THEN RAISE EXCEPTION 'SOURCE_RECOLTE_MODE: choisissez le sens du transfert de stock.'; END IF;
    type_mouvement:='variation'; q_mouvement:=delta;
  ELSE RETURN NEW; END IF;
  IF type_mouvement='publication' THEN
    SELECT COALESCE(sum(a.quantite-a.consomme),0) INTO reserve_r FROM caisse_affectations a
      WHERE a.user_id=r.user_id AND a.stock_type='recolte' AND a.stock_id=r.id::TEXT AND a.libere_le IS NULL;
    SELECT COALESCE(sum(a.quantite-a.consomme),0) INTO reserve_g FROM caisse_affectations a JOIN recoltes s ON s.id::TEXT=a.stock_id AND s.user_id=a.user_id
      WHERE a.user_id=r.user_id AND a.stock_type='recolte' AND s.espece=r.espece AND a.unite=unite_native AND a.libere_le IS NULL;
    stock_r:=source_recolte_milli(COALESCE(r.stock_disponible_commercial,r.quantite));
    libre:=least(stock_r-reserve_r,source_recolte_net_milli(r.user_id,r.espece,unite_native)-reserve_g);
    IF q_mouvement>libre THEN RAISE EXCEPTION 'SOURCE_RECOLTE_STOCK: la publication dépasserait la part libre après inventaire, consommations et réservations.'; END IF;
    stock_r:=stock_r-q_mouvement;
    UPDATE recoltes SET stock_disponible_commercial=stock_r::DOUBLE PRECISION/1000,source_stock_origine=COALESCE(source_stock_origine,'publication') WHERE id=r.id;
  ELSIF type_mouvement='retrait' THEN
    stock_r:=source_recolte_milli(COALESCE(r.stock_disponible_commercial,r.quantite))+q_mouvement;
    -- Au-delà de la production lue au millième, l'écart est matériel (ADV98) : refus atomique.
    IF stock_r>ROUND(CAST(r.quantite AS NUMERIC)*1000) THEN
      RAISE EXCEPTION 'SOURCE_RECOLTE_EXCEDENT: le stock rendu dépasserait la production de la récolte.';
    END IF;
    -- Écart de grille seulement : plafond lu sur la production brute (r.quantite), même primitive que restituerAuLot.
    UPDATE recoltes SET stock_disponible_commercial=stock_apres_retour_plafonne(stock_r::NUMERIC/1000,r.quantite) WHERE id=r.id;
  ELSIF type_mouvement='variation' THEN stock_r:=source_recolte_milli(COALESCE(r.stock_disponible_commercial,r.quantite)); END IF;
  INSERT INTO mouvements_source_stock_recoltes(user_id,espece_id,recolte_id,produit_id,type,quantite_milli,unite,stock_recolte_milli,stock_boutique_milli,origine_operation,produit_retire,snapshot_source,date)
    VALUES(r.user_id,r.espece,r.id,p.id,type_mouvement,q_mouvement,unite_native,stock_r,apres,COALESCE(NULLIF(origine,''),'sortie-stock'),TG_OP='DELETE',source_avant,date_trunc('milliseconds',clock_timestamp() AT TIME ZONE 'UTC'));
  PERFORM caisse_controler_stock_net(r.user_id,r.espece);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

COMMIT;
