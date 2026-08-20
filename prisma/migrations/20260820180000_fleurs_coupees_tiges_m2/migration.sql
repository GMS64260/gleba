-- Les 25 fleurs coupées du catalogue passent du kilo à la TIGE.
--
-- Elles portaient un rendement en kg/m² — dahlia à 4 kg/m², zinnia à 2,5 — ce
-- qui ne veut rien dire pour de la fleur coupée : personne ne vend un dahlia au
-- kilo, une ferme florale dimensionne en tiges par mètre carré. La migration
-- 20260818140000 qui a créé ces espèces l'écrivait déjà noir sur blanc : « la
-- vente à la TIGE reste un écart produit ouvert ». Les unités existent depuis
-- le 2026-08-20 (`tiges_m2`), cette migration s'en sert.
--
-- MÉTHODE, vérifiable ligne à ligne :
--     rendement (tiges/m²) = densite (plants/m²) × tiges par plant
-- La densité vient du référentiel, posée par la migration du 2026-08-18 sur ses
-- propres sources (ITAB, SNHF/semencemag, semenciers, Collectif de la Fleur
-- Française) ; elle est LUE en base, pas recopiée ici, pour que la dérivation
-- reste vraie même si une densité a été corrigée entre-temps. Le seul facteur
-- ajouté est le nombre de tiges par plant, dont la base est donnée par espèce
-- dans docs/referentiel-fleurs-coupees.md : 7 valeurs mesurées et sourcées,
-- 4 botaniques (un bulbe ou un corme = un épi), 14 défauts de classe ancrés sur
-- une espèce mesurée de la même conduite et tirés vers le bas.
--
-- Un rendement de catalogue n'est qu'un ordre de grandeur ; c'est à la ferme de
-- déclarer le sien (bloc « Chez moi », `user_stock_especes.rendement`), et sa
-- valeur prime. Une valeur de classe est un point de départ, pas une promesse.
--
-- PÉRIMÈTRE ET IDEMPOTENCE : catalogue officiel seulement (`user_id IS NULL`),
-- et seulement les lignes encore dans leur état d'origine (`kg_m2`). Une espèce
-- déjà curée en tiges, ou une espèce perso d'un membre, n'est jamais réécrite.
-- Rejouer la migration ne fait donc rien. Aucune donnée de ferme n'est touchée :
-- les récoltes déjà saisies gardent l'unité figée sur leur ligne.
UPDATE especes AS e
SET unite_rendement = 'tiges_m2',
    -- Densité absente ⇒ on n'invente pas un rendement : l'unité est corrigée,
    -- la valeur reste à renseigner (la projection rendra 0, pas un faux chiffre).
    rendement = ROUND((f.tiges_par_plant * NULLIF(e.densite, 0))::numeric, 0)
FROM (
  VALUES
    ('Amarante queue-de-renard', 5),   -- classe : annuelle remontante, panicules peu nombreuses
    ('Ammi élevé', 5),                 -- classe : ombellifère, tiges de qualité limitées
    ('Anémone', 6),                    -- classe : corme remontant, ancré sur la renoncule
    ('Cosmos', 15),                    -- classe : annuelle très remontante, ancré sur le zinnia
    ('Célosie', 6),                    -- classe : tige maîtresse + latérales
    ('Dahlia', 10),                    -- mesuré : 4 relevées en ferme, 20 « courant » en référence
    ('Giroflée ravenelle', 3),         -- classe : épi dominant + quelques latérales
    ('Glaïeul', 1),                    -- botanique : un épi par corme
    ('Gypsophile annuelle', 3),        -- classe : semis dense, plants peu ramifiés
    ('Immortelle', 8),                 -- classe : annuelle remontante
    ('Muflier', 6),                    -- mesuré : 5 à 6 en moyenne, jusqu'à 12
    ('Narcisse', 1),                   -- botanique : une hampe par bulbe
    ('Nigelle de Damas', 3),           -- classe : semis dense, une à deux coupes
    ('Phlox de Drummond', 6),          -- classe : annuelle remontante
    ('Pivoine', 10),                   -- mesuré : 10 à 30 sur touffe adulte (borne basse)
    ('Pois de senteur', 20),           -- mesuré : 20 en moyenne, jusqu'à 34
    ('Reine-marguerite', 5),           -- classe : type ramifié, tiges commercialisables
    ('Renoncule', 5),                  -- mesuré : 5,3 tiges par corme sur 2 450 cormes
    ('Rudbeckie', 8),                  -- classe : annuelle remontante
    ('Scabieuse', 10),                 -- classe : très remontante avec récolte suivie
    ('Statice', 6),                    -- classe : annuelle remontante
    ('Tagètes', 10),                   -- classe : annuelle très remontante
    ('Tournesol ornemental', 1),       -- botanique : variétés de coupe à tige unique
    ('Tulipe', 1),                     -- botanique : un bouton par bulbe (hybrides standard)
    ('Zinnia', 15)                     -- mesuré : 15 à 25 sur la durée de vie du plant
) AS f(espece, tiges_par_plant)
WHERE e.espece = f.espece
  AND e.user_id IS NULL
  AND e.type = 'fleur'
  AND e.unite_rendement = 'kg_m2';
