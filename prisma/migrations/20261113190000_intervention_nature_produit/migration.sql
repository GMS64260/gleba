-- Contre-revue CR-DAR-01 (tour 2) : un traitement saisi librement (« Décoction
-- de prêle ») n'a pas de fiche au référentiel, donc pas de classification : le
-- contrôle du délai avant récolte le prenait pour un produit avec AMM. La
-- nature est désormais DÉCLARÉE à la saisie. Aucune reprise des lignes
-- anciennes : NULL = non précisée, traitée comme un produit avec AMM.
ALTER TABLE "interventions" ADD COLUMN "nature_produit" TEXT;
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_nature_produit_check"
  CHECK ("nature_produit" IS NULL OR "nature_produit" IN ('amm', 'substance_base', 'biostimulant'));
