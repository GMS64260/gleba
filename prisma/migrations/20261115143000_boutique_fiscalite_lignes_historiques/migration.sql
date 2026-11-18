-- EC04/BL-02 — taux précisés après coup pour une commande de boutique antérieure
-- à l'instantané fiscal (origine « manuel »). La ligne de l'instantané désigne
-- la ligne physique (`ligneId`) : son produit a pu être supprimé (produit_id
-- NULL) ou changer d'unité depuis. Les données historiques de la ligne (nom,
-- unité, quantité, prix, total) restent la seule référence et sont contrôlées
-- comme avant ; le catalogue courant n'est exigé que pour les instantanés
-- figés à la commande (inchangés).
BEGIN;
CREATE OR REPLACE FUNCTION boutique_verifier_fiscalite() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cible INTEGER; c commandes_boutique; s JSONB; l JSONB; p lignes_commande_boutique; total NUMERIC:=0; ids INTEGER[]:=ARRAY[]::INTEGER[]; ligne JSONB; champ TEXT; manuel BOOLEAN; cle INTEGER;
BEGIN
  ligne:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  cible:=(ligne->>(CASE WHEN TG_TABLE_NAME='commandes_boutique' THEN 'id' ELSE 'commande_id' END))::INTEGER;
  SELECT * INTO c FROM commandes_boutique WHERE id=cible;
  IF NOT FOUND OR c.fiscalite_snapshot IS NULL THEN RETURN NULL; END IF;
  s:=c.fiscalite_snapshot;
  IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR s->'version' IS DISTINCT FROM '1'::JSONB OR COALESCE(s->>'regimeTva','')='' OR
     COALESCE(s->>'devise','') NOT IN ('EUR','XPF') OR jsonb_typeof(s->'lignes') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: détail fiscal incomplet.';
  END IF;
  manuel:=s ? 'origine';
  IF manuel AND (s->>'origine' IS DISTINCT FROM 'manuel' OR COALESCE(s->>'acteurId','')='' OR COALESCE(s->>'corrigeLe','')='' OR
     s->>'contexteSource' IS NULL OR s->>'contexteSource' NOT IN ('profil-inchange','declare')) THEN
    RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: une correction manuelle indique son acteur, sa date et la source de son régime.';
  END IF;
  IF jsonb_array_length(s->'lignes')<1 OR jsonb_array_length(s->'lignes')>100 OR
     jsonb_array_length(s->'lignes')<>(SELECT count(*) FROM lignes_commande_boutique WHERE commande_id=cible) THEN
    RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: détail fiscal incomplet.';
  END IF;
  FOR l IN SELECT value FROM jsonb_array_elements(s->'lignes') LOOP
    FOREACH champ IN ARRAY ARRAY['quantiteMilli','prixCentimes','tauxBp','totalCentimes'] || CASE WHEN manuel THEN ARRAY['ligneId'] ELSE ARRAY['produitId'] END LOOP
      IF jsonb_typeof(l->champ) IS DISTINCT FROM 'number' OR (l->>champ)::NUMERIC<>trunc((l->>champ)::NUMERIC) THEN
        RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: valeurs entières requises.';
      END IF;
    END LOOP;
    IF NOT manuel AND l ? 'ligneId' THEN
      RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: seule une correction manuelle désigne la ligne de la commande.';
    END IF;
    IF manuel AND (NOT l ? 'produitId' OR (jsonb_typeof(l->'produitId') IS DISTINCT FROM 'null' AND
       (jsonb_typeof(l->'produitId') IS DISTINCT FROM 'number' OR (l->>'produitId')::NUMERIC<>trunc((l->>'produitId')::NUMERIC)))) THEN
      RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: valeurs entières requises.';
    END IF;
    cle:=(l->>(CASE WHEN manuel THEN 'ligneId' ELSE 'produitId' END))::INTEGER;
    IF NOT l ?& ARRAY['nom','unite','quantiteMilli','prixCentimes','tauxBp','totalCentimes'] OR
      cle=ANY(ids) OR (l->>'quantiteMilli')::NUMERIC NOT BETWEEN 1 AND 1000000000 OR
      (l->>'prixCentimes')::NUMERIC NOT BETWEEN 0 AND 100000000 OR (l->>'tauxBp')::NUMERIC NOT BETWEEN 0 AND 10000 OR
      (l->>'totalCentimes')::NUMERIC<>floor(((l->>'quantiteMilli')::NUMERIC*(l->>'prixCentimes')::NUMERIC+500)/1000) THEN
      RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: quantité, prix ou taxe invalide.';
    END IF;
    ids:=array_append(ids,cle);
    IF manuel THEN
      SELECT * INTO p FROM lignes_commande_boutique WHERE commande_id=cible AND id=cle;
    ELSE
      SELECT * INTO p FROM lignes_commande_boutique WHERE commande_id=cible AND produit_id=cle;
    END IF;
    IF NOT FOUND OR p.nom<>l->>'nom' OR p.unite<>l->>'unite' OR
      abs(p.quantite::NUMERIC*1000-(l->>'quantiteMilli')::NUMERIC)>0.000001 OR
      abs(p.prix_unitaire::NUMERIC*100-(l->>'prixCentimes')::NUMERIC)>0.000001 OR
      abs(p.total::NUMERIC*100-(l->>'totalCentimes')::NUMERIC)>0.000001 OR
      (manuel AND p.produit_id IS DISTINCT FROM (l->>'produitId')::INTEGER) OR
      (NOT manuel AND NOT EXISTS(SELECT 1 FROM produits_boutique b WHERE b.id=p.produit_id AND b.user_id=c.user_id AND b.boutique_id=c.boutique_id AND b.unite=p.unite)) THEN
      RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: les lignes fiscales et physiques doivent correspondre.';
    END IF;
    total:=total+(l->>'totalCentimes')::NUMERIC;
  END LOOP;
  IF total>100000000 OR abs(c.total::NUMERIC*100-total)>0.000001 THEN
    RAISE EXCEPTION 'BOUTIQUE_FISCALITE_INCOHERENTE: le total doit correspondre à la commande.';
  END IF;
  RETURN NULL;
END $$;
COMMIT;
