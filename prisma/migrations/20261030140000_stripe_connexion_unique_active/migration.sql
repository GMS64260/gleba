-- Connexions Stripe : unicité par exploitation, une seule connexion ACTIVE par
-- compte Stripe sur l'instance (revue du 2026-10-30).
--
-- Avant : UNIQUE (compte_stripe_id, mode_test) global. Une connexion
-- déconnectée (actif = false, jeton effacé) d'une exploitation empêchait toute
-- connexion du même compte Stripe ailleurs, et l'import d'une sauvegarde sur la
-- même instance échouait tant que l'exploitation source existait.
--
-- Après :
--   - UNIQUE (user_id, compte_stripe_id, mode_test) : une ligne par compte
--     Stripe et par mode dans chaque exploitation (clé d'upsert, modélisée par
--     Prisma : @@unique([userId, compteStripeId, modeTest])) ;
--   - UNIQUE (compte_stripe_id, mode_test) WHERE actif : une seule connexion
--     active par compte Stripe sur toute l'instance. Index PARTIEL que Prisma 5
--     ne sait pas modéliser : il vit uniquement ici (commentaire dans le
--     schéma). Une migration générée par `prisma migrate dev` proposerait de le
--     supprimer : en retirer ce DROP INDEX à la main.
--
-- Migration additive : aucune donnée n'est modifiée. Les nouveaux index sont
-- créés avant la suppression de l'ancien. L'ancien index global garantit
-- qu'aucune ligne existante ne viole les nouveaux ; la vérification ci-dessous
-- le confirme et fait échouer la migration, avec un message explicite, si la
-- base a dérivé (index supprimé à la main, par exemple), plutôt que de
-- trancher entre des connexions.

DO $$
DECLARE
  doublons_exploitation integer;
  doublons_actifs integer;
BEGIN
  SELECT count(*) INTO doublons_exploitation FROM (
    SELECT 1 FROM "connexions_stripe"
    GROUP BY "user_id", "compte_stripe_id", "mode_test"
    HAVING count(*) > 1
  ) d;
  IF doublons_exploitation > 0 THEN
    RAISE EXCEPTION 'CONNEXIONS_STRIPE_DOUBLONS: % compte(s) Stripe sont reliés plusieurs fois à la même exploitation (même mode). Fusionnez ou supprimez ces connexions à la main avant de relancer la migration 20261030140000_stripe_connexion_unique_active.', doublons_exploitation;
  END IF;

  SELECT count(*) INTO doublons_actifs FROM (
    SELECT 1 FROM "connexions_stripe"
    WHERE "actif"
    GROUP BY "compte_stripe_id", "mode_test"
    HAVING count(*) > 1
  ) d;
  IF doublons_actifs > 0 THEN
    RAISE EXCEPTION 'CONNEXIONS_STRIPE_ACTIVES_MULTIPLES: % compte(s) Stripe ont plusieurs connexions actives (même mode). Déconnectez toutes ces connexions sauf une avant de relancer la migration 20261030140000_stripe_connexion_unique_active.', doublons_actifs;
  END IF;
END $$;

-- CreateIndex (modélisé : @@unique([userId, compteStripeId, modeTest]))
CREATE UNIQUE INDEX "connexions_stripe_user_id_compte_stripe_id_mode_test_key"
  ON "connexions_stripe"("user_id", "compte_stripe_id", "mode_test");

-- Index unique PARTIEL, non modélisé par Prisma 5 : une seule connexion active
-- par compte Stripe et par mode sur toute l'instance.
CREATE UNIQUE INDEX "connexions_stripe_compte_stripe_id_mode_test_actif_key"
  ON "connexions_stripe"("compte_stripe_id", "mode_test")
  WHERE "actif";

-- DropIndex (ancienne unicité globale, remplacée par les deux index ci-dessus)
DROP INDEX IF EXISTS "connexions_stripe_compte_stripe_id_mode_test_key";
