-- QA cmswxphw6 — le référentiel Verger & Forêt affichait « — » dans la colonne
-- « Nom latin » pour Mûrier sans épine et Physalis. La chasse au motif a trouvé
-- 27 espèces officielles du catalogue Gleba sans nom botanique, tous types
-- confondus. On les complète ici. « Mélange » et « Mesclun » restent volontairement
-- sans nom latin : ce sont des mélanges d'espèces, pas des taxons.
--
-- QA cmswxo3ri — la Phacélie prévue sur 4 planches était absente des besoins en
-- semences : aucun engrais vert du catalogue ne porte de dose de semis, donc le
-- besoin calculé valait 0 et la ligne était filtrée comme « rien à commander ».
-- Le code rend désormais ce cas visible (statut « Dose manquante ») ; on renseigne
-- en plus les doses de la famille concernée (références ITAB / semenciers,
-- converties de kg/ha en g/m²).
--
-- Additif et idempotent : on ne touche que le catalogue officiel
-- (`user_id IS NULL`) et uniquement les valeurs encore vides, jamais une saisie.

UPDATE especes SET nom_latin = v.nom_latin
FROM (VALUES
  -- aromatiques
  ('Achillée millefeuille', 'Achillea millefolium'),
  ('Hibiscus',              'Hibiscus sabdariffa'),
  ('Houblon',               'Humulus lupulus'),
  ('Mélisse',               'Melissa officinalis'),
  -- engrais verts
  ('Mélilot',               'Melilotus officinalis'),
  ('Phacélie',              'Phacelia tanacetifolia'),
  ('Trèfle blanc',          'Trifolium repens'),
  ('Trèfle incarnat',       'Trifolium incarnatum'),
  ('Trèfle violet',         'Trifolium pratense'),
  ('Vesce',                 'Vicia sativa'),
  -- légumes
  ('Chayote',               'Sechium edule'),
  ('Chénopode',             'Chenopodium album'),
  ('Chénopode vivace',      'Chenopodium bonus-henricus'),
  ('Fenouil',               'Foeniculum vulgare'),
  ('Maïs',                  'Zea mays'),
  ('Panais',                'Pastinaca sativa'),
  ('Patate douce',          'Ipomoea batatas'),
  ('Poivron piment',        'Capsicum annuum'),
  ('Radis noir',            'Raphanus sativus var. niger'),
  ('Raifort',               'Armoracia rusticana'),
  ('Salsifis',              'Tragopogon porrifolius'),
  ('Topinambour',           'Helianthus tuberosus'),
  -- ornements
  ('Albizia',               'Albizia julibrissin'),
  ('Pyracantha',            'Pyracantha coccinea'),
  ('Tilleul',               'Tilia cordata'),
  -- petits fruits (les deux espèces du signalement)
  ('Mûrier sans épine',     'Rubus fruticosus'),
  ('Physalis',              'Physalis peruviana')
) AS v(espece, nom_latin)
WHERE especes.espece = v.espece
  AND especes.user_id IS NULL
  AND (especes.nom_latin IS NULL OR especes.nom_latin = '');

-- Doses de semis des engrais verts, en g/m² (kg/ha ÷ 10).
UPDATE especes SET dose_semis = v.dose_semis, unite_dose = 'g_m2'
FROM (VALUES
  ('Phacélie',        1.0),   -- 10 kg/ha
  ('Vesce',          10.0),   -- 100 kg/ha
  ('Trèfle blanc',    1.0),   -- 10 kg/ha
  ('Trèfle incarnat', 2.5),   -- 25 kg/ha
  ('Trèfle violet',   2.0),   -- 20 kg/ha
  ('Mélilot',         2.0),   -- 20 kg/ha
  ('Mélange',         3.0)    -- 30 kg/ha, mélange multi-espèces courant
) AS v(espece, dose_semis)
WHERE especes.espece = v.espece
  AND especes.user_id IS NULL
  AND especes.type = 'engrais_vert'
  AND (especes.dose_semis IS NULL OR especes.dose_semis = 0);
