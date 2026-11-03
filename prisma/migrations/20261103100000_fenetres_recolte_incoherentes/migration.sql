-- Fenêtres de récolte incohérentes : réparer les fiches existantes.
--
-- Constat du 2026-11-03 (comptage en lecture seule) : sur 322 cultures portant
-- une fenêtre de récolte, 2 finissaient avant leur début (de 46 et 234 jours)
-- et 1 durait 392 jours (fin héritée d'un autre itinéraire, défaut du
-- 2026-10-25). Le code traite ces fenêtres comme incohérentes
-- (`fenetreRecolteIncoherente`, src/lib/cultures/fenetre-recolte.ts), mais ne
-- les répare qu'au prochain enregistrement réussi de la fiche. D'ici là, elles
-- faussent les retards de récolte, l'occupation des planches et les alertes.
--
-- Cette migration fait tout de suite la réparation qu'un enregistrement ferait
-- (`finRecolteApresModification`), avec la même règle :
--   1. les dates se comparent en jours civils : minuit UTC pile vaut le jour
--      saisi, sinon c'est le jour à Paris (`jourCivilStocke`) ;
--   2. une fenêtre est incohérente si sa fin tombe avant son début, ou si elle
--      dure plus de 364 jours (52 semaines) ;
--   3. si l'ITP de la culture est actif et visible par son propriétaire
--      (référentiel, partagé ou à lui) et porte une durée, la fin vaut
--      début + durée. La durée explicite prime ; sinon on prend le couple
--      début/fin sur 52 semaines (`semainesDeRecolte`). La fin est écrite à
--      minuit UTC (`dateJourSeul`) ;
--   4. sinon (pas d'ITP, ITP invisible, inactif ou sans durée), la fin est
--      effacée : rien n'est inventé.
-- Les fenêtres cohérentes ne sont pas touchées. Rejouer la migration ne change
-- plus rien. Comme le changement ne touche pas au schéma, l'image précédente
-- lit les fiches réparées sans difficulté.
WITH fenetres AS (
  SELECT
    c.id,
    CASE WHEN c.date_recolte = date_trunc('day', c.date_recolte) THEN c.date_recolte::date
         ELSE ((c.date_recolte AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date
    END AS debut,
    CASE WHEN c.fin_recolte = date_trunc('day', c.fin_recolte) THEN c.fin_recolte::date
         ELSE ((c.fin_recolte AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Paris')::date
    END AS fin,
    CASE WHEN i.actif AND (i.user_id IS NULL OR i.partage_communaute OR i.user_id = c.user_id)
         THEN COALESCE(
           NULLIF(GREATEST(i.d_recolte, 0), 0),
           NULLIF(((i.s_recolte_fin - i.s_recolte) % 52 + 52) % 52, 0)
         )
    END AS semaines
  FROM cultures c
  LEFT JOIN itps i ON i.it_plante = c.it_plante
  WHERE c.date_recolte IS NOT NULL
    AND c.fin_recolte IS NOT NULL
)
UPDATE cultures c
SET fin_recolte = CASE WHEN f.semaines IS NULL THEN NULL
                       ELSE (f.debut + f.semaines * 7)::timestamp
                  END
FROM fenetres f
WHERE c.id = f.id
  AND (f.fin < f.debut OR f.fin - f.debut > 364);
