-- Arbres fruitiers d'outre-mer : rendre explicite le délai de première récolte.
--
-- 40 itinéraires actifs portent une durée de culture supérieure à un an (cocotier
-- 2 555 j, letchi et longane 1 825 j, manguier et arbre à pain 1 460 j, avocatier
-- et vanille 1 095 j, goyavier 730 j, ananas 500–600 j, bananier plantain 390 j)
-- et AUCUN ne renseignait `delai_premiere_recolte_annees`.
--
-- Conséquence : les semaines de l'itinéraire décrivent la SAISON de récolte, pas
-- le cycle, et le calcul des dates prenait l'écart de semaines au pied de la
-- lettre. « Avocatier — antilles » (plantation S25, récolte S26) proposait une
-- récolte d'avocats SEPT JOURS après la plantation, sous une fiche qui annonçait
-- « Cycle : 1095 jours ». « Cocotier — austral » proposait 350 jours contre
-- 2 555 déclarés.
--
-- Le correctif de calcul (src/lib/cultures/dates-itp.ts, `anneesAvantRecolte`)
-- déduit ce délai de la durée de culture quand il n'est pas déclaré. On l'inscrit
-- ici pour que l'intention soit dans la donnée et non dans une déduction : le
-- délai devient lisible sur la fiche, exportable, et corrigeable à la main si un
-- agronome affine une valeur.
--
-- Aucune autre colonne n'est touchée : ni les semaines, ni la durée de culture.
-- La contrainte `itps_delai_premiere_recolte_check` borne la valeur à [0, 30] —
-- le maximum produit ici est 7.

UPDATE "itps"
   SET "delai_premiere_recolte_annees" = GREATEST(1, ROUND("d_culture" / 365.0))::int
 WHERE "d_culture" IS NOT NULL
   AND "d_culture" > 365
   AND "delai_premiere_recolte_annees" IS NULL;
