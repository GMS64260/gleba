-- Modèle de stock unique, L4.2 (2026-11-24) : le stock de récolte d'une
-- espèce est la SOMME DES RESTES DE SES LOTS en stock, dans l'unité demandée.
-- Le reste d'un lot est `stock_disponible_commercial` quand il est suivi (bon,
-- facture, caisse, boutique), sa quantité sinon. Il est arrondi au millième
-- LOT PAR LOT : la garde par lot de la caisse implique ainsi la garde globale.
--
-- Un comptage ne s'ajoute plus : il aligne les lots (L3, L4.1). Les
-- consommations, les mouvements commerciaux et le journal des transferts avec
-- la boutique ne se retranchent plus : chacun a déjà baissé le reste d'un lot.
-- Les réservations de marché ne se retranchent pas ici (les gardes le font).
--
-- Mesuré en production avant ce lot (diagnostic L4.0, 2026-11-24) : l'ancien
-- calcul et la somme des lots sont égaux pour 338 couples sur 338.
--
-- Pendant TypeScript : `calculerStocksNet` (`src/lib/stocks-helpers.ts`),
-- arrondi par lot `milliemesDuReste` (`src/lib/stocks/milliemes.ts`).
-- Modification du catalogue seulement.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION source_recolte_net_milli(ferme TEXT, espece_cible TEXT, unite_cible TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE total NUMERIC;
BEGIN
  SELECT COALESCE(sum(floor(COALESCE(r.stock_disponible_commercial,r.quantite)::NUMERIC*1000+0.5)),0) INTO total FROM recoltes r
    WHERE r.user_id=ferme AND r.espece=espece_cible AND r.statut='en_stock' AND COALESCE(r.unite,'kg')=unite_cible
      -- Anciens liens à la boutique sans répartition suivie : leur stock vit en boutique.
      AND NOT EXISTS(SELECT 1 FROM produits_boutique p WHERE p.user_id=ferme AND p.recolte_id=r.id AND NOT p.source_stock_suivi);
  RETURN total;
END $$;

COMMIT;
