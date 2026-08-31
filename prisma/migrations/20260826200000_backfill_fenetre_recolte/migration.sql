-- Fenêtre de récolte : remplir `cultures.fin_recolte` depuis l'itinéraire.
--
-- Constat du 2026-08-26 : la colonne existait depuis l'origine, était lue par
-- six modules (plan de croissance, planificateur d'irrigation, registre de
-- culture, plan 2D, vue 3D) et n'était écrite par AUCUN chemin d'écran — seul
-- `/api/import` savait la poser. Elle valait NULL sur les 579 cultures de la
-- base. Conséquence mesurée : 84 cultures « récolte en retard » sur 13 comptes,
-- 63 jours de retard en moyenne et 142 au maximum, alors que le référentiel
-- documente la durée (767 ITP sur 773 portent `d_recolte`).
--
-- Le code pose désormais cette borne à la création. Cette migration traite le
-- passé, sans quoi les comptes existants garderaient leur arriéré fantôme.
--
-- Trois règles de prudence :
--   1. on ne touche QUE les lignes où `fin_recolte` est NULL — une valeur posée
--      par un import ou par un utilisateur n'est jamais réécrite ;
--   2. on n'invente rien : sans durée au référentiel, la ligne reste NULL et le
--      comportement d'avant s'applique tel quel ;
--   3. la durée explicite prime sur le couple début/fin, qui ne sert que de
--      repli et tient compte du bouclage sur 52 semaines (une récolte peut
--      commencer en S48 et finir en S6).
UPDATE cultures c
SET fin_recolte = c.date_recolte + (
  COALESCE(
    NULLIF(GREATEST(i.d_recolte, 0), 0),
    NULLIF(((i.s_recolte_fin - i.s_recolte) % 52 + 52) % 52, 0)
  ) * INTERVAL '7 days'
)
FROM itps i
WHERE c.it_plante = i.it_plante
  AND c.fin_recolte IS NULL
  AND c.date_recolte IS NOT NULL
  AND COALESCE(
        NULLIF(GREATEST(i.d_recolte, 0), 0),
        NULLIF(((i.s_recolte_fin - i.s_recolte) % 52 + 52) % 52, 0)
      ) IS NOT NULL;
