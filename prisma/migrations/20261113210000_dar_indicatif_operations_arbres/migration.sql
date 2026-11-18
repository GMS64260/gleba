-- Lot dar-cadre-legal-blocage (tour 2, revues QA et adverse).
--
-- 1. Avant ce lot, POST /api/interventions écrivait `dar = saisi ?? délai du
--    catalogue` : le délai générique de ProduitPhyto.darJours (un ordre de
--    grandeur, pas le délai d'une AMM) devenait indiscernable d'un délai saisi
--    et bloquait la mise en vente. L'API ne recopie plus rien ; les lignes
--    anciennes dont le délai est égal à celui du catalogue sont marquées
--    « indicatives ». Une ligne où l'exploitant avait lui-même saisi la même
--    valeur ne s'en distingue pas : dans le doute elle devient un rappel (le
--    défaut légal de 3 jours continue de bloquer) ; ressaisir le délai sur le
--    traitement le rend de nouveau opposable. Aucune donnée n'est modifiée.
ALTER TABLE "interventions" ADD COLUMN "dar_indicatif" BOOLEAN NOT NULL DEFAULT false;
UPDATE "interventions" i
   SET "dar_indicatif" = true
  FROM "produits_phyto" p
 WHERE i."produit_phyto_id" = p."id"
   AND i."dar" IS NOT NULL
   AND i."dar" = p."dar_jours";

-- 2. Un traitement réalisé saisi dans Verger > Opérations entre au contrôle du
--    délai avant récolte : délai de l'étiquette et nature déclarée du produit,
--    comme sur les interventions. Aucune reprise : NULL = non renseigné.
ALTER TABLE "operations_arbres" ADD COLUMN "dar" INTEGER;
ALTER TABLE "operations_arbres" ADD COLUMN "nature_produit" TEXT;
ALTER TABLE "operations_arbres" ADD CONSTRAINT "operations_arbres_dar_check"
  CHECK ("dar" IS NULL OR "dar" >= 0);
ALTER TABLE "operations_arbres" ADD CONSTRAINT "operations_arbres_nature_produit_check"
  CHECK ("nature_produit" IS NULL OR "nature_produit" IN ('amm', 'substance_base', 'biostimulant'));
