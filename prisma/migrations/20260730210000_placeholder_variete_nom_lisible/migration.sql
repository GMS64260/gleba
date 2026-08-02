-- Variétés « Non spécifiée » : renseigner le nom affiché.
--
-- `ensurePlaceholderVariete` construisait l'id du placeholder à partir de
-- l'ID de l'espèce et ne peuplait pas `nom`. Pour une espèce du catalogue
-- Gleba, l'id est le nom lisible, donc le repli `nom ?? id` de l'UI passait
-- inaperçu. Pour une espèce perso, l'id est un cuid : le sélecteur de variété
-- et la page Stocks affichaient « cms7n0lx10003k0rei0qb6pkv — Non spécifiée ».
--
-- Friction constatée le 2026-07-30 sur le premier compte ayant créé des
-- espèces perso (13 placeholders concernés, plus 5 hérités côté catalogue).
-- On backfille tous les placeholders sans nom ; le code renseigne désormais
-- `nom` à la création.

UPDATE "varietes" v
SET "nom" = COALESCE(e."nom", e."espece") || ' — Non spécifiée'
FROM "especes" e
WHERE v."espece" = e."espece"
  AND v."is_placeholder" = true
  AND v."nom" IS NULL;
