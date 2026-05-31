-- ============================================================
-- Bug #8 (testeur) — Restauration des accents français sur les
-- NOMS d'ITP (PK itps.it_plante), affichés tels quels à l'utilisateur.
--
-- Cas signalés : « Epinard-printemps » → « Épinard-printemps »,
-- « Feve-printemps » → « Fève-printemps ». On corrige par cohérence
-- l'ensemble des ITP de ces deux espèces ainsi que le suffixe de saison
-- « -ete » → « -été » (présent sur de nombreux ITP).
--
-- NB :
--  * `itps.it_plante` est la PK référencée par `cultures.it_plante` et
--    `rotations_details.it_plante` avec ON UPDATE CASCADE → les renames
--    se propagent automatiquement, aucune mise à jour manuelle des FK.
--  * L'index unique d'ITP porte sur (espece, s_semis, s_plantation,
--    s_recolte, type_planche), PAS sur le nom → aucun risque de collision.
--  * Le besoin d'irrigation « Eleve » n'est PAS migré ici : c'est une
--    valeur d'ENUM stockée et comparée dans le code
--    (api/cultures/irriguer, assistant-helpers, validations/espece). Le
--    libellé accentué « Élevé » est restauré côté affichage uniquement.
--
-- Migration IDEMPOTENTE : chaque UPDATE est guardé par le nom source ;
-- réexécutée, elle ne touche que les lignes encore au format ASCII.
-- NON APPLIQUÉE automatiquement (cf. consignes).
-- ============================================================

BEGIN;

-- ── Épinard ──────────────────────────────────────────────────
UPDATE itps SET it_plante = 'Épinard-automne'   WHERE it_plante = 'Epinard-automne';
UPDATE itps SET it_plante = 'Épinard-été'       WHERE it_plante = 'Epinard-ete';
UPDATE itps SET it_plante = 'Épinard-printemps' WHERE it_plante = 'Epinard-printemps';

-- ── Fève ─────────────────────────────────────────────────────
UPDATE itps SET it_plante = 'Fève-automne'      WHERE it_plante = 'Feve-automne';
UPDATE itps SET it_plante = 'Fève-printemps'    WHERE it_plante = 'Feve-printemps';

-- NB : on se limite STRICTEMENT aux espèces signalées par le testeur
-- (Épinard, Fève). Un renommage global « -ete » → « -été » sur tous les ITP
-- (PK avec ON UPDATE CASCADE) serait large et risqué pour un gain non demandé ;
-- il est volontairement écarté.

COMMIT;
