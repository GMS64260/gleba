-- ============================================================
-- BUG #14 + #21 (audit Marc 2026-05-15) : taxonomie incorrecte.
--
-- #14 : Actinidia (kiwi) listé comme culture maraîchère et apparaît
--      dans Semences avec « à commander 1,7 g ». Le kiwi se propage
--      par bouture ou greffe, jamais par semis direct. Et son
--      `dose_semis = 0.1 g/m²` est arbitraire.
--
-- #21 : Albizia (mimosée) et Bambou listés en `type=ornement` mais
--      avec `a_planifier=true` → polluent la liste « à planifier »
--      du maraîchage. Capucine a `rendement=0.5 kg/m²` ce qui n'a
--      pas de sens pour une fleur compagne — on garde le type mais
--      on neutralise le rendement.
--
-- Pas de migration UI ici : la page Référentiel maraîchage filtre
-- déjà par type (legume/aromatique/engrais_vert/arbre_fruitier/
-- petit_fruit). Le bug venait du fait que ces espèces se retrouvaient
-- dans des cultures de l'utilisateur — on ne change pas leur type
-- canonique (correct), juste leur mode_semis / planifiable.
-- ============================================================

-- Actinidia : propagation par bouture, pas de dose semis
UPDATE especes
SET mode_semis = 'bouture',
    dose_semis = NULL
WHERE espece = 'Actinidia';

-- Kiwi : pareil, propagation bouture/greffe
UPDATE especes
SET mode_semis = 'bouture',
    dose_semis = NULL
WHERE espece = 'Kiwi';

-- Vigne : pareil
UPDATE especes
SET mode_semis = 'bouture',
    dose_semis = NULL
WHERE espece = 'Vigne';

-- Albizia, Bambou : ornements, ne plus apparaître dans la liste
-- « à planifier » du maraîchage (l'utilisateur les ajoutera
-- manuellement via le module Verger / Bocage si besoin).
UPDATE especes
SET a_planifier = false
WHERE espece IN ('Albizia', 'Bambou')
  AND type = 'ornement';

-- Capucine : fleur compagne, le rendement kg/m² n'a pas de sens
UPDATE especes
SET rendement = NULL
WHERE espece = 'Capucine';

-- Œillet d'Inde / Souci / Bourrache : idem, fleurs compagnes
UPDATE especes
SET rendement = NULL
WHERE espece IN ('Œillet d''Inde', 'Souci', 'Bourrache')
  AND rendement IS NOT NULL;
