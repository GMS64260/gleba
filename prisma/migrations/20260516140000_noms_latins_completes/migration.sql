-- ============================================================
-- Feedback Marc 2026-05-16 — Bug 14E : nom_latin manquant pour
-- 13+ espèces du référentiel (Absinthe, Achillée, Actinidia,
-- Amarante, Argousier, Artichaut, Asperge, Bambou, Betterave,
-- Blette, Bourrache, Camomille, Capucine).
-- Sources : INRAE Plant Database, Wikipédia botanique, ITAB.
-- COALESCE : on remplit seulement si le champ est vide.
-- ============================================================

UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Artemisia absinthium')       WHERE espece = 'Absinthe';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Achillea millefolium')        WHERE espece = 'Achillée';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Actinidia deliciosa')         WHERE espece = 'Actinidia';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Amaranthus caudatus')         WHERE espece = 'Amarante';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Cynara scolymus')             WHERE espece = 'Artichaut';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Asparagus officinalis')       WHERE espece = 'Asperge';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Phyllostachys spp.')          WHERE espece = 'Bambou';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Borago officinalis')          WHERE espece = 'Bourrache';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Matricaria chamomilla')       WHERE espece = 'Camomille';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Tropaeolum majus')            WHERE espece = 'Capucine';

-- Complément des autres espèces régulièrement utilisées sans binôme latin
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Cichorium intybus')           WHERE espece = 'Chicorée sauvage';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Cichorium endivia')           WHERE espece = 'Chicorée frisée';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Origanum majorana')           WHERE espece = 'Marjolaine';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Origanum vulgare')            WHERE espece = 'Origan';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Satureja hortensis')          WHERE espece = 'Sarriette';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Mentha spp.')                 WHERE espece = 'Menthe';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Calendula officinalis')       WHERE espece = 'Souci';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Tagetes spp.')                WHERE espece = 'Tagètes';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Cosmos bipinnatus')           WHERE espece = 'Cosmos';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Ricinus communis')            WHERE espece = 'Ricin';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Helianthus annuus')           WHERE espece = 'Tournesol';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Fagopyrum esculentum')        WHERE espece = 'Sarrasin';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Sinapis alba')                WHERE espece = 'Moutarde';
UPDATE especes SET nom_latin = COALESCE(nom_latin, 'Sorghum bicolor')             WHERE espece = 'Sorgho';
