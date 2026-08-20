-- Variétés « Non spécifiée » créées en catalogue officiel sur une espèce privée.
--
-- `ensurePlaceholderVariete` créait le placeholder avec `user_id = NULL`, donc en
-- catalogue Gleba officiel, quelle que soit l'attribution de son espèce parente.
-- Sur une espèce PRIVÉE d'un membre, la variété devenait visible de tous : son
-- libellé nomme l'espèce (« Rubarbe — Non spécifiée »), et `GET /api/varietes`
-- renvoie `espece` en entier, donc la fiche complète de cette espèce privée.
--
-- 13 lignes étaient dans ce cas. On leur donne l'attribution de leur espèce :
-- elles suivent désormais sa visibilité. Aucune ligne du catalogue officiel n'est
-- touchée (l'espèce parente y a `user_id IS NULL`, le placeholder aussi).
--
-- Correctif de code associé : src/lib/varietes.ts (héritage à la création) et
-- src/app/api/varietes/route.ts (visibilité cascadée sur l'espèce parente).

UPDATE "varietes" v
   SET "user_id" = e."user_id",
       "partage_communaute" = e."partage_communaute"
  FROM "especes" e
 WHERE e."espece" = v."espece"
   AND v."is_placeholder" = true
   AND v."user_id" IS NULL
   AND e."user_id" IS NOT NULL;
