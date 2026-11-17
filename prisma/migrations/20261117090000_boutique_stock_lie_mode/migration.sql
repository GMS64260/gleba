-- Un produit relié à un stock se vend soit sur le stock réel (la vitrine ne
-- propose que ce qui reste), soit « à produire » : commandable sans limite, le
-- stock sort à la livraison, une fois la production faite. Le mode est figé sur
-- la ligne à la commande (nul = stock réel, comme les lignes déjà passées).
ALTER TABLE "produits_boutique" ADD COLUMN "stock_lie_mode" TEXT NOT NULL DEFAULT 'stock';
ALTER TABLE "produits_boutique" ADD CONSTRAINT "produits_boutique_stock_lie_mode_valide" CHECK ("stock_lie_mode" IN ('stock', 'a_produire'));
ALTER TABLE "lignes_commande_boutique" ADD COLUMN "stock_lie_mode" TEXT;
ALTER TABLE "lignes_commande_boutique" ADD CONSTRAINT "lignes_commande_boutique_stock_lie_mode_valide" CHECK ("stock_lie_mode" IS NULL OR ("stock_lie_type" IS NOT NULL AND "stock_lie_mode" IN ('stock', 'a_produire')));
