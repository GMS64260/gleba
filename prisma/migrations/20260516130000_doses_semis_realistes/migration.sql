-- ============================================================
-- Feedback Marc 2026-05-16 — doses de semis irréalistes
-- ============================================================
-- Constat : Carotte 100 g/m² (×100 trop), Radis 80 g/m² (×6 trop), etc.
-- Cause : import-potaleger.ts a ré-écrasé les corrections agronomiques
-- précédentes (migrations 0240, 0241, 0350) en réimportant la table
-- Potaleger d'origine, dont les `Dose_semis` étaient en "g pour 100 m²"
-- importés tels quels en `g/m²`.
--
-- Cette migration ré-applique les doses agronomiques sourcées INRAE /
-- Larousse Agricole / Cerafel / GRAB. Les unités `unite_dose` ne sont
-- pas touchées (g_m2 / graines_plant / caieux_m2 déjà cohérentes).
-- ============================================================

-- === SEMIS DIRECT (g/m²) — racines fines et feuilles ===
UPDATE especes SET dose_semis = 0.8  WHERE espece = 'Carotte';
UPDATE especes SET dose_semis = 1.5  WHERE espece = 'Radis';
UPDATE especes SET dose_semis = 1.5  WHERE espece = 'Radis noir';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Laitue';
UPDATE especes SET dose_semis = 2    WHERE espece = 'Betterave';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Blette';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Navet';
UPDATE especes SET dose_semis = 1.5  WHERE espece = 'Roquette';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Panais';
UPDATE especes SET dose_semis = 3    WHERE espece = 'Salsifis';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Persil';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Aneth';
UPDATE especes SET dose_semis = 2    WHERE espece = 'Coriandre';
UPDATE especes SET dose_semis = 1.5  WHERE espece = 'Fenouil';
UPDATE especes SET dose_semis = 5    WHERE espece = 'Bourrache';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Camomille';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Souci';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Marjolaine';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Sarriette';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Origan';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Absinthe';

-- === SEMIS DIRECT (g/m²) — gros grains (légumineuses, céréales, engrais verts) ===
UPDATE especes SET dose_semis = 20   WHERE espece IN ('Pois','Petit pois'); -- semis en ligne, 20 g/m² est haut mais cohérent
UPDATE especes SET dose_semis = 15   WHERE espece IN ('Haricot','Haricot vert','Haricot sec');
UPDATE especes SET dose_semis = 1    WHERE espece = 'Amarante';
UPDATE especes SET dose_semis = 1    WHERE espece = 'Tournesol';
UPDATE especes SET dose_semis = 0.5  WHERE espece = 'Ricin';
UPDATE especes SET dose_semis = 10   WHERE espece = 'Sorgho';
UPDATE especes SET dose_semis = 6    WHERE espece = 'Moutarde';   -- engrais vert
UPDATE especes SET dose_semis = 12   WHERE espece = 'Sarrasin';   -- engrais vert
UPDATE especes SET dose_semis = 2    WHERE espece = 'Fraisier';

-- === PÉPINIÈRE / REPIQUAGE (graines/plant) — laissé inchangé si déjà raisonnable ===
-- (Tomate/Aubergine/Poivron/Chou… déjà à 2-4 graines/godet, conforme.)

-- === Trace de l'ajustement
COMMENT ON COLUMN especes.dose_semis IS 'g/m² (semis direct) ou graines/plant (pépinière) ou caïeux/m² (bulbes) — voir unite_dose. Doses agronomiques 2026-05-16.';
