-- Audit 2026-07 : la numérotation des commandes boutique est PAR PRODUCTEUR
-- (count des commandes de l'utilisateur + 1) mais la contrainte d'unicité
-- était GLOBALE → collision garantie dès qu'un 2e producteur reçoit des
-- commandes (P2002 non catché → 500, boutique bloquée).
-- On remplace l'index unique global par un index unique (user_id, numero).

DROP INDEX IF EXISTS "commandes_boutique_numero_key";

CREATE UNIQUE INDEX "commandes_boutique_user_id_numero_key"
  ON "commandes_boutique" ("user_id", "numero");
