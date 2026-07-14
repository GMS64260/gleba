-- Correctif review #4/#9 : la sentinelle « Communauté Gleba » (user_id =
-- 'gleba-communaute') reçoit les entrées partagées de TOUS les membres supprimés.
-- Deux membres différents peuvent légitimement avoir une entrée partagée de même
-- nom normalisé ; une fois toutes deux reprises par la sentinelle, elles
-- violeraient l'index unique partiel (user_id, nom_normalise) → la transaction de
-- suppression de compte échouerait.
--
-- On EXCLUT donc la sentinelle des index uniques partiels perso : elle devient un
-- « bac » de conservation où les doublons de nom sont tolérés (contributions
-- orphelines préservées ; un admin peut nettoyer). L'unicité par membre reste
-- garantie pour tous les vrais comptes.

DROP INDEX IF EXISTS "especes_user_nomnorm_perso_key";
CREATE UNIQUE INDEX "especes_user_nomnorm_perso_key"
  ON "especes" ("user_id", "nom_normalise")
  WHERE "user_id" IS NOT NULL AND "user_id" <> 'gleba-communaute';

DROP INDEX IF EXISTS "itps_user_nomnorm_perso_key";
CREATE UNIQUE INDEX "itps_user_nomnorm_perso_key"
  ON "itps" ("user_id", "nom_normalise")
  WHERE "user_id" IS NOT NULL AND "user_id" <> 'gleba-communaute';

DROP INDEX IF EXISTS "varietes_user_espece_nomnorm_perso_key";
CREATE UNIQUE INDEX "varietes_user_espece_nomnorm_perso_key"
  ON "varietes" ("user_id", "espece", "nom_normalise")
  WHERE "user_id" IS NOT NULL AND "user_id" <> 'gleba-communaute';
