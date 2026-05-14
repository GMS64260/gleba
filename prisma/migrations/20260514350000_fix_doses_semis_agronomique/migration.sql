-- DEV1 BUG-02 (audit Marc 2026-05-14) : doses_semis aberrantes
-- ============================================================
-- Le seed initial a importé toutes les doses « semis direct » en g/m² avec
-- des valeurs ×10 à ×50 supérieures à la réalité agronomique (probable
-- copy-paste depuis « graines pour 100 m² » sans diviser par 100).
--
-- Exemple constaté : Carotte 100 g/m² ⇒ 30 m² × 100 × 1.25 marge = 3,75 kg
-- pour une planche d'1 are. Dose réelle 1-3 g/m² (semis sur ligne 25-40 cm).
--
-- Sources : INRA itinéraires techniques, Larousse Agricole, Cerafel, GRAB.
-- Les pois/haricot sont laissés tels quels (40/20 g/m² réalistes pour gros
-- grains en semis dense).

UPDATE especes SET dose_semis = 2    WHERE LOWER(espece) = 'carotte'      AND dose_semis = 100;
UPDATE especes SET dose_semis = 2    WHERE LOWER(espece) = 'radis'        AND dose_semis = 80;
UPDATE especes SET dose_semis = 1.5  WHERE LOWER(espece) = 'roquette'     AND dose_semis = 50;
UPDATE especes SET dose_semis = 2    WHERE LOWER(espece) = 'coriandre'    AND dose_semis = 40;
UPDATE especes SET dose_semis = 1    WHERE LOWER(espece) = 'aneth'        AND dose_semis = 30;
UPDATE especes SET dose_semis = 1    WHERE LOWER(espece) = 'persil'       AND dose_semis = 30;
UPDATE especes SET dose_semis = 2    WHERE LOWER(espece) = 'betterave'    AND dose_semis = 25;
UPDATE especes SET dose_semis = 1.5  WHERE LOWER(espece) = 'navet'        AND dose_semis = 25;
UPDATE especes SET dose_semis = 1.5  WHERE LOWER(espece) = 'radis noir'   AND dose_semis = 20;
UPDATE especes SET dose_semis = 3    WHERE LOWER(espece) = 'salsifis'     AND dose_semis = 20;
UPDATE especes SET dose_semis = 1    WHERE LOWER(espece) = 'panais'       AND dose_semis = 15;
UPDATE especes SET dose_semis = 0.5  WHERE LOWER(espece) = 'laitue'       AND dose_semis = 12;
