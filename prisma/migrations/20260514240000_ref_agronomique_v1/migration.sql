-- ====================================================================
-- Refonte référentiel agronomique (Sprint Audit Marc, 2026-05-14).
--
-- Audit utilisateur d'un maraîcher pro a remonté ~15 bugs bloquants
-- sur le contenu du référentiel :
--   * dosages g/m² faux (carotte 100, radis 80, tomate 2,5...)
--   * ITPs avec récolte avant semis (chou de Bruxelles, ail automne)
--   * carotte avec date de plantation (impossible, taproot)
--   * nomenclature familles mixée (Brassicaceae vs Brassicacées)
--   * doublon Brocoli / Chou brocoli
--   * associations Ail × Pois marquées compatible
--   * familles manquantes (Basilic, Cassissier...)
--   * type "Pépinière" par défaut sur tous les ITPs y compris carotte
--
-- Sources : Le Jardinier-Maraîcher (J.-M. Fortier), ITAB,
-- fiches Kokopelli et Germinance, La Bio des Plantes (PUF).
-- ====================================================================

-- ====================================================================
-- 1. Nouveaux champs sur Espèce
-- ====================================================================

ALTER TABLE especes
  ADD COLUMN IF NOT EXISTS unite_dose TEXT,
  ADD COLUMN IF NOT EXISTS type_culture_semis TEXT;

-- unite_dose ∈ ('g_m2','pieces_m2','graines_plant','caieux_m2')
--   g_m2          : grammes de graines par m² (semis direct dense)
--   pieces_m2     : nombre de plants par m² (repiquage en place)
--   graines_plant : graines par godet (semis en pépinière)
--   caieux_m2     : caieux/bulbilles/tubercules par m²
ALTER TABLE especes
  DROP CONSTRAINT IF EXISTS especes_unite_dose_check;
ALTER TABLE especes
  ADD CONSTRAINT especes_unite_dose_check
    CHECK (unite_dose IS NULL OR unite_dose IN ('g_m2','pieces_m2','graines_plant','caieux_m2'));

-- type_culture_semis ∈ ('semis_direct','pepiniere_puis_repiquage','plantation_bulbes_caieux','bouture')
ALTER TABLE especes
  DROP CONSTRAINT IF EXISTS especes_type_culture_semis_check;
ALTER TABLE especes
  ADD CONSTRAINT especes_type_culture_semis_check
    CHECK (type_culture_semis IS NULL OR type_culture_semis IN
      ('semis_direct','pepiniere_puis_repiquage','plantation_bulbes_caieux','bouture'));

-- ====================================================================
-- 2. Stock semences : unité de stock (graines / caieux / bulbes / plants)
-- ====================================================================
ALTER TABLE user_stock_varietes
  ADD COLUMN IF NOT EXISTS unite_stock TEXT;
ALTER TABLE user_stock_varietes
  DROP CONSTRAINT IF EXISTS user_stock_varietes_unite_stock_check;
ALTER TABLE user_stock_varietes
  ADD CONSTRAINT user_stock_varietes_unite_stock_check
    CHECK (unite_stock IS NULL OR unite_stock IN
      ('graines','caieux','bulbes','tubercules','plants','pieces'));

ALTER TABLE user_stock_especes
  ADD COLUMN IF NOT EXISTS unite_stock TEXT;
ALTER TABLE user_stock_especes
  DROP CONSTRAINT IF EXISTS user_stock_especes_unite_stock_check;
ALTER TABLE user_stock_especes
  ADD CONSTRAINT user_stock_especes_unite_stock_check
    CHECK (unite_stock IS NULL OR unite_stock IN
      ('graines','caieux','bulbes','tubercules','plants','pieces'));

-- ====================================================================
-- 3. Familles : ajout nom_fr pour conserver le libellé français
--    Standard botanique APG IV pour la PK (latine).
-- ====================================================================
ALTER TABLE familles
  ADD COLUMN IF NOT EXISTS nom_fr TEXT;

-- Hydrate nom_fr pour les familles latines déjà connues
UPDATE familles SET nom_fr = 'Liliacées (Alliaceae)'   WHERE famille = 'Alliaceae'    AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Apiacées'                WHERE famille = 'Apiaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Astéracées'              WHERE famille = 'Asteraceae'   AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Brassicacées (Crucifères)' WHERE famille = 'Brassicaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Solanacées'              WHERE famille = 'Solanaceae'   AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Fabacées (Légumineuses)' WHERE famille = 'Fabaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Cucurbitacées'           WHERE famille = 'Cucurbitaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Rosacées'                WHERE famille = 'Rosaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Lamiacées'               WHERE famille = 'Lamiaceae'    AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Amaranthacées (incl. Chénopodiacées)' WHERE famille = 'Amaranthaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Poacées (Graminées)'     WHERE famille = 'Poaceae'      AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Convolvulacées'          WHERE famille = 'Convolvulaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Polygonacées'            WHERE famille = 'Polygonaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Boraginacées'            WHERE famille = 'Boraginaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Valérianacées'           WHERE famille = 'Valerianaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Malvacées'               WHERE famille = 'Malvaceae'    AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Tropéolacées'            WHERE famille = 'Tropaeolaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Rutacées'                WHERE famille = 'Rutaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Hydrophyllacées'         WHERE famille = 'Hydrophyllaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Cannabacées'             WHERE famille = 'Cannabaceae'  AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Euphorbiacées'           WHERE famille = 'Euphorbiaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Élaeagnacées'            WHERE famille = 'Elaeagnaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Asparagacées'            WHERE famille = 'Asparagaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Actinidiacées'           WHERE famille = 'Actinidiaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Grossulariacées'         WHERE famille = 'Grossulariaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Moracées'                WHERE famille = 'Moraceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Oléacées'                WHERE famille = 'Oleaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Myrtacées'               WHERE famille = 'Myrtaceae'    AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Ebenacées'               WHERE famille = 'Ebenaceae'    AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Vitacées'                WHERE famille = 'Vitaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Juglandacées'            WHERE famille = 'Juglandaceae' AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Lythracées'              WHERE famille = 'Lythraceae'   AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Fagacées'                WHERE famille = 'Fagaceae'     AND nom_fr IS NULL;
UPDATE familles SET nom_fr = 'Couverts végétaux'       WHERE famille = 'Couverts végétaux' AND nom_fr IS NULL;

-- Assure la présence des familles latines manquantes (Chenopodioideae = sous-fam des Amaranthaceae APG)
INSERT INTO familles (famille, intervalle, couleur, description, nom_fr)
VALUES
  ('Amaranthaceae',    3, '#A0522D', 'Famille des Amaranthacées (incl. Chénopodioideae : betterave, blette, épinard)', 'Amaranthacées (incl. Chénopodiacées)'),
  ('Brassicaceae',     4, '#9B59B6', 'Famille des Brassicacées (Crucifères : choux, navets, radis, roquette)',         'Brassicacées (Crucifères)'),
  ('Solanaceae',       4, '#E74C3C', 'Famille des Solanacées (tomate, aubergine, poivron, pomme de terre)',            'Solanacées'),
  ('Fabaceae',         3, '#27AE60', 'Famille des Fabacées (Légumineuses : haricot, pois, fève)',                       'Fabacées (Légumineuses)'),
  ('Cucurbitaceae',    3, '#F1C40F', 'Famille des Cucurbitacées (courge, courgette, concombre, melon)',                 'Cucurbitacées'),
  ('Rosaceae',         5, '#FF6B9D', 'Famille des Rosacées (fraise, framboise, mûre, pommier)',                         'Rosacées')
ON CONFLICT (famille) DO NOTHING;

-- ====================================================================
-- 4. Migration des familles francisées vers les noms latins (APG IV)
--    Toutes les references especes vers ces familles francisées migrent.
-- ====================================================================
UPDATE especes SET famille = 'Brassicaceae'  WHERE famille = 'Brassicacées';
UPDATE especes SET famille = 'Solanaceae'    WHERE famille = 'Solanacées';
UPDATE especes SET famille = 'Fabaceae'      WHERE famille = 'Fabacées';
UPDATE especes SET famille = 'Cucurbitaceae' WHERE famille = 'Cucurbitacées';
UPDATE especes SET famille = 'Rosaceae'      WHERE famille = 'Rosacées';
UPDATE especes SET famille = 'Asteraceae'    WHERE famille = 'Astéracées';
UPDATE especes SET famille = 'Apiaceae'      WHERE famille = 'Apiacées';
UPDATE especes SET famille = 'Alliaceae'     WHERE famille = 'Alliacées';
UPDATE especes SET famille = 'Amaranthaceae' WHERE famille = 'Chénopodiacées';

-- Idem pour associations_details (FK avec ON UPDATE CASCADE en théorie, mais on est explicite)
UPDATE associations_details SET famille = 'Brassicaceae'  WHERE famille = 'Brassicacées';
UPDATE associations_details SET famille = 'Solanaceae'    WHERE famille = 'Solanacées';
UPDATE associations_details SET famille = 'Fabaceae'      WHERE famille = 'Fabacées';
UPDATE associations_details SET famille = 'Cucurbitaceae' WHERE famille = 'Cucurbitacées';
UPDATE associations_details SET famille = 'Rosaceae'      WHERE famille = 'Rosacées';
UPDATE associations_details SET famille = 'Asteraceae'    WHERE famille = 'Astéracées';
UPDATE associations_details SET famille = 'Apiaceae'      WHERE famille = 'Apiacées';
UPDATE associations_details SET famille = 'Alliaceae'     WHERE famille = 'Alliacées';
UPDATE associations_details SET famille = 'Amaranthaceae' WHERE famille = 'Chénopodiacées';

-- Suppression des familles francisées maintenant orphelines
DELETE FROM familles WHERE famille IN ('Brassicacées','Solanacées','Fabacées','Cucurbitacées','Rosacées','Astéracées','Apiacées','Alliacées','Chénopodiacées');

-- ====================================================================
-- 5. Familles manquantes pour certaines espèces (audit Bug #15)
-- ====================================================================
INSERT INTO familles (famille, intervalle, couleur, description, nom_fr) VALUES
  ('Betulaceae',       4, '#8B6F47', 'Bétulacées (noisetier, bouleau)',         'Bétulacées'),
  ('Adoxaceae',        4, '#3D9970', 'Adoxacées (sureau)',                       'Adoxacées')
ON CONFLICT (famille) DO NOTHING;

UPDATE especes SET famille = 'Lamiaceae'     WHERE espece = 'Basilic'    AND (famille IS NULL OR famille = '' OR famille = '-');
UPDATE especes SET famille = 'Grossulariaceae' WHERE espece = 'Cassissier' AND (famille IS NULL OR famille = '' OR famille = '-');
UPDATE especes SET famille = 'Betulaceae'    WHERE espece = 'Noisetier'  AND (famille IS NULL OR famille = '' OR famille = '-');
UPDATE especes SET famille = 'Adoxaceae'     WHERE espece = 'Sureau'     AND (famille IS NULL OR famille = '' OR famille = '-');

-- Nom latin pour espèces qui en manquent (Bug #15)
UPDATE especes SET nom_latin = 'Ribes nigrum'         WHERE espece = 'Cassissier'  AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Corylus avellana'     WHERE espece = 'Noisetier'   AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Sambucus nigra'       WHERE espece = 'Sureau'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Ocimum basilicum'     WHERE espece = 'Basilic'     AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Anethum graveolens'   WHERE espece = 'Aneth'       AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Coriandrum sativum'   WHERE espece = 'Coriandre'   AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Thymus vulgaris'      WHERE espece = 'Thym'        AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Rosmarinus officinalis' WHERE espece = 'Romarin'   AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Origanum vulgare'     WHERE espece = 'Origan'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Salvia officinalis'   WHERE espece = 'Sauge'       AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Mentha spp.'          WHERE espece = 'Menthe'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Lavandula angustifolia' WHERE espece = 'Lavande'   AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Petroselinum crispum' WHERE espece = 'Persil'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Daucus carota'        WHERE espece = 'Carotte'     AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Raphanus sativus'     WHERE espece = 'Radis'       AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Lactuca sativa'       WHERE espece = 'Laitue'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Solanum lycopersicum' WHERE espece = 'Tomate'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. italica' WHERE espece = 'Chou brocoli' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. gemmifera' WHERE espece = 'Chou de Bruxelles' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. botrytis' WHERE espece = 'Chou-fleur' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. gongylodes' WHERE espece = 'Chou-rave' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. capitata' WHERE espece = 'Chou pommé' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica oleracea var. acephala' WHERE espece IN ('Chou frisé','Chou kale') AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Brassica rapa subsp. pekinensis' WHERE espece = 'Chou de Chine' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Eruca sativa'         WHERE espece = 'Roquette'    AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Cucumis melo'         WHERE espece = 'Melon'       AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Cucurbita pepo'       WHERE espece = 'Potiron'     AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Cucurbita maxima'     WHERE espece IN ('Potimarron','Courge butternut') AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Solanum tuberosum'    WHERE espece = 'Pomme de terre' AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Allium sativum'       WHERE espece = 'Ail'         AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Allium cepa'          WHERE espece = 'Oignon'      AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Allium cepa Aggregatum' WHERE espece = 'Échalote'  AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Allium porrum'        WHERE espece = 'Poireau'     AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Allium schoenoprasum' WHERE espece = 'Ciboulette'  AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Pisum sativum'        WHERE espece = 'Petit pois'  AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Phaseolus vulgaris'   WHERE espece IN ('Haricot','Haricot sec','Haricot vert') AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Spinacia oleracea'    WHERE espece = 'Épinard'     AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');
UPDATE especes SET nom_latin = 'Valerianella locusta' WHERE espece = 'Mâche'       AND (nom_latin IS NULL OR nom_latin = '' OR nom_latin = '-');

-- ====================================================================
-- 6. FUSION Brocoli -> Chou brocoli (Bug #13)
--    Pas de cascade automatique sur Espece.id : on migre manuellement.
-- ====================================================================
-- Sécurité : on ne fusionne que si Chou brocoli existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM especes WHERE espece = 'Chou brocoli')
     AND EXISTS (SELECT 1 FROM especes WHERE espece = 'Brocoli') THEN
    UPDATE cultures           SET espece = 'Chou brocoli' WHERE espece = 'Brocoli';
    UPDATE itps               SET espece = 'Chou brocoli' WHERE espece = 'Brocoli';
    UPDATE recoltes           SET espece = 'Chou brocoli' WHERE espece = 'Brocoli';
    -- varietes : on les rattache ; conflit éventuel sur le nom de variété peu probable
    UPDATE varietes           SET espece = 'Chou brocoli' WHERE espece = 'Brocoli';
    UPDATE associations_details SET espece = 'Chou brocoli' WHERE espece = 'Brocoli';
    -- Supprime l'espèce orpheline
    DELETE FROM especes WHERE espece = 'Brocoli';
  END IF;
END$$;

-- ====================================================================
-- 7. type_culture_semis : classification par espèce
--    semis_direct                : semé en place, jamais repiqué (taproot, etc.)
--    pepiniere_puis_repiquage    : semé en godet puis transplanté
--    plantation_bulbes_caieux    : ail, oignon (bulbilles), échalote, PdT, topinambour
--    bouture                     : patate douce, aromatiques vivaces
-- ====================================================================

-- Semis direct (racine pivot, semis en pleine terre exclusif)
UPDATE especes SET type_culture_semis = 'semis_direct'
WHERE espece IN (
  'Carotte','Radis','Radis noir','Raifort','Panais','Salsifis','Mâche',
  'Roquette','Navet','Betterave','Blette','Épinard','Maïs','Fève',
  'Petit pois','Pois','Haricot','Haricot sec','Haricot vert','Aneth',
  'Coriandre','Cerfeuil','Persil','Bourrache','Capucine','Camomille',
  'Souci','Tagètes','Cosmos','Phacélie','Sarrasin','Trèfle blanc',
  'Trèfle incarnat','Trèfle violet','Vesce','Mélilot','Moutarde','Sorgho',
  'Tournesol','Chicorée frisée','Chicorée sauvage','Salsifis','Amarante',
  'Chénopode','Chénopode vivace'
);

-- Pépinière puis repiquage (semis en godet, transplantation)
UPDATE especes SET type_culture_semis = 'pepiniere_puis_repiquage'
WHERE espece IN (
  'Tomate','Aubergine','Poivron','Poivron piment','Concombre','Courgette',
  'Courge','Courge butternut','Potiron','Potimarron','Chayote','Melon',
  'Chou','Chou brocoli','Chou de Bruxelles','Chou de Chine','Chou frisé',
  'Chou kale','Chou pommé','Chou-fleur','Chou-rave','Brocoli',
  'Laitue','Céleri','Céleri-rave','Fenouil','Artichaut','Poireau',
  'Basilic','Marjolaine','Sarriette','Camomille','Hibiscus','Physalis'
);

-- Plantation directe de bulbes / caieux / tubercules
UPDATE especes SET type_culture_semis = 'plantation_bulbes_caieux'
WHERE espece IN (
  'Ail','Oignon','Échalote','Pomme de terre','Topinambour','Asperge',
  'Ciboulette'
);

-- Bouture (vivace)
UPDATE especes SET type_culture_semis = 'bouture'
WHERE espece IN (
  'Patate douce','Romarin','Thym','Sauge','Lavande','Menthe','Origan',
  'Mélisse','Houblon','Absinthe','Achillée millefeuille'
);

-- Synchroniser mode_semis (déjà présent) avec type_culture_semis
UPDATE especes SET mode_semis = 'graine_directe'  WHERE type_culture_semis = 'semis_direct'         AND (mode_semis IS NULL OR mode_semis NOT IN ('bulbe_caieu','bouture'));
UPDATE especes SET mode_semis = 'plant_repique'   WHERE type_culture_semis = 'pepiniere_puis_repiquage' AND (mode_semis IS NULL OR mode_semis NOT IN ('bulbe_caieu','bouture'));
UPDATE especes SET mode_semis = 'bulbe_caieu'     WHERE type_culture_semis = 'plantation_bulbes_caieux';
UPDATE especes SET mode_semis = 'bouture'         WHERE type_culture_semis = 'bouture';

-- ====================================================================
-- 8. Dosages semences agronomiquement corrects (Bug #2)
--    Source : Le Jardinier-Maraîcher (J.-M. Fortier) ch.8 ; ITAB ;
--    Kokopelli ; Germinance.
--
--    unite_dose conditionne l'interprétation :
--      g_m2          : Carotte 0.8, Radis 1.5...
--      pieces_m2     : ex tomate 3 pl/m², courgette 1 pl/m²
--      graines_plant : ex tomate 2 graines/godet (semis pépinière)
--      caieux_m2     : ex ail 20 caieux/m², oignon bulbilles 70/m²
--
--    On exprime UNITÉ + dose ; le calcul lib/semences/calcul.ts consomme.
-- ====================================================================

-- === SEMIS DIRECT (g/m²) ===
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.8,  taux_germination = 70  WHERE espece = 'Carotte';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1.5,  taux_germination = 90  WHERE espece = 'Radis';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1.5,  taux_germination = 85  WHERE espece = 'Radis noir';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.5,  taux_germination = 85  WHERE espece = 'Laitue';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 12,   taux_germination = 85  WHERE espece IN ('Pois','Petit pois');
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 12,   taux_germination = 90  WHERE espece IN ('Haricot','Haricot vert','Haricot sec');
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 20,   taux_germination = 85  WHERE espece = 'Fève';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 2,    taux_germination = 80  WHERE espece = 'Betterave';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1,    taux_germination = 80  WHERE espece = 'Blette';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 4,    taux_germination = 80  WHERE espece = 'Épinard';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1,    taux_germination = 80  WHERE espece = 'Navet';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1.5,  taux_germination = 85  WHERE espece = 'Roquette';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 2,    taux_germination = 80  WHERE espece = 'Mâche';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1,    taux_germination = 60  WHERE espece = 'Panais';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 3,    taux_germination = 70  WHERE espece = 'Salsifis';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.5,  taux_germination = 65  WHERE espece IN ('Chicorée frisée','Chicorée sauvage');
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.5,  taux_germination = 65  WHERE espece = 'Persil';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1,    taux_germination = 80  WHERE espece = 'Aneth';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 2,    taux_germination = 75  WHERE espece = 'Coriandre';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 8,    taux_germination = 90  WHERE espece = 'Maïs';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1.5,  taux_germination = 75  WHERE espece = 'Fenouil';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 5,    taux_germination = 80  WHERE espece = 'Bourrache';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 1.5,  taux_germination = 75  WHERE espece = 'Capucine';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.5,  taux_germination = 80  WHERE espece = 'Camomille';
UPDATE especes SET unite_dose = 'g_m2', dose_semis = 0.5,  taux_germination = 75  WHERE espece IN ('Souci','Tagètes','Cosmos');

-- === PÉPINIÈRE PUIS REPIQUAGE (graines / godet) ===
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 90 WHERE espece = 'Tomate';
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 75 WHERE espece = 'Aubergine';
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 80 WHERE espece IN ('Poivron','Poivron piment');
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 85 WHERE espece = 'Concombre';
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 1.5, taux_germination = 90 WHERE espece = 'Courgette';
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 85 WHERE espece IN ('Courge','Courge butternut','Potiron','Potimarron','Chayote','Melon');
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 85 WHERE espece IN ('Chou','Chou brocoli','Chou de Bruxelles','Chou de Chine','Chou frisé','Chou kale','Chou pommé','Chou-fleur','Chou-rave','Brocoli');
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 3,   taux_germination = 70 WHERE espece IN ('Céleri','Céleri-rave');
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 2,   taux_germination = 75 WHERE espece IN ('Fenouil','Artichaut');
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 1,   taux_germination = 70 WHERE espece = 'Poireau';
UPDATE especes SET unite_dose = 'graines_plant', dose_semis = 3,   taux_germination = 70 WHERE espece = 'Basilic';

-- === PLANTATION CAIEUX / BULBES / TUBERCULES (unités / m²) ===
UPDATE especes SET unite_dose = 'caieux_m2',    dose_semis = 20,  taux_germination = 95 WHERE espece = 'Ail';
UPDATE especes SET unite_dose = 'caieux_m2',    dose_semis = 70,  taux_germination = 95 WHERE espece = 'Oignon';      -- bulbilles
UPDATE especes SET unite_dose = 'caieux_m2',    dose_semis = 40,  taux_germination = 95 WHERE espece = 'Échalote';
UPDATE especes SET unite_dose = 'caieux_m2',    dose_semis = 4,   taux_germination = 95 WHERE espece = 'Pomme de terre';
UPDATE especes SET unite_dose = 'caieux_m2',    dose_semis = 3,   taux_germination = 95 WHERE espece = 'Topinambour';
UPDATE especes SET unite_dose = 'pieces_m2',    dose_semis = 4,   taux_germination = 95 WHERE espece = 'Patate douce'; -- boutures

-- ====================================================================
-- 9. Marge de sécurité par espèce (Bug #7)
--    Plus la germination est faible, plus la marge est élevée.
-- ====================================================================
UPDATE especes SET marge_securite_pct = 30 WHERE taux_germination IS NOT NULL AND taux_germination < 65;
UPDATE especes SET marge_securite_pct = 25 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 65 AND 74;
UPDATE especes SET marge_securite_pct = 20 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 75 AND 84;
UPDATE especes SET marge_securite_pct = 15 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 85 AND 92;
UPDATE especes SET marge_securite_pct = 10 WHERE taux_germination IS NOT NULL AND taux_germination >= 93;

-- ====================================================================
-- 10. ITPs critiques (Bugs #3 #4 #5)
--
--    Ail :
--       Automne : plantation S42-S46 -> récolte S26-S28 (juin-juillet)
--       Printemps : plantation S10-S14 -> récolte S28-S30 (juillet)
--    Chou de Bruxelles :
--       Semis S14-S16 (pépinière) -> plantation S20-S22 -> récolte S44 (durée 16)
--    Brocoli (Chou brocoli) :
--       Semis S14 -> plantation S18 -> récolte S26 (12 sem = 84 j)
--    Carotte (3 ITPs) :
--       Toujours semis direct : pas de date_plantation
--       Récolte pleine terre   : 14 sem après semis
--       Conservation extérieur : semer S24, récolte S40
--       Serre conservation     : semer S32, récolte S42 (octobre-novembre)
-- ====================================================================
UPDATE itps SET s_semis = 42, s_plantation = NULL, s_recolte = 26, d_recolte = 4,
                mode_demarrage = 'Plantation', type_planche = 'Plein champ',
                commentaire_agronome = 'Plantation des caieux à l''automne, vernalisation hivernale, récolte juin-juillet (S25-S28).',
                source_reference = 'Le Jardinier-Maraîcher (J.-M. Fortier)',
                derniere_revision = NOW()
WHERE it_plante IN ('Ail plant. automne','ITP-AIL-01');

UPDATE itps SET s_semis = 10, s_plantation = NULL, s_recolte = 28, d_recolte = 4,
                mode_demarrage = 'Plantation', type_planche = 'Plein champ',
                commentaire_agronome = 'Plantation printanière des caieux, récolte mi-juillet à fin août (S28-S32).',
                source_reference = 'Le Jardinier-Maraîcher (J.-M. Fortier)',
                derniere_revision = NOW()
WHERE it_plante IN ('Ail plant. printemps','ITP-Ail');

UPDATE itps SET s_semis = 16, s_plantation = 22, s_recolte = 44, d_recolte = 16,
                mode_demarrage = 'Pépinière', type_planche = 'Plein champ',
                commentaire_agronome = 'Semis avril-mai en pépinière, plantation mai-juin, récolte novembre-février (S44 -> S08 année suivante).',
                source_reference = 'ITAB - Fiches techniques crucifères',
                derniere_revision = NOW()
WHERE it_plante = 'Chou de Bruxelles';

UPDATE itps SET s_semis = 14, s_plantation = 18, s_recolte = 26, d_recolte = 6,
                mode_demarrage = 'Pépinière', type_planche = 'Plein champ',
                commentaire_agronome = 'Cycle 90-120 jours. Semis avril, plantation mai, récolte fin juin à fin juillet.',
                source_reference = 'ITAB - Fiches techniques crucifères',
                derniere_revision = NOW()
WHERE it_plante IN ('Chou brocoli','ITP-Brocoli');

-- Carotte : 4 ITPs, supprimer s_plantation (semis direct)
UPDATE itps SET s_plantation = NULL, mode_demarrage = 'Plein champ', type_planche = 'Plein champ',
                commentaire_agronome = 'Semis direct en place (racine pivot - aucun repiquage possible).',
                derniere_revision = NOW()
WHERE espece = 'Carotte';

UPDATE itps SET s_semis = 12, s_recolte = 26, d_recolte = 6,
                commentaire_agronome = 'Carotte de printemps en pleine terre : semis mars-avril, récolte juin-juillet.',
                source_reference = 'Le Jardinier-Maraîcher (J.-M. Fortier)'
WHERE it_plante IN ('Carotte pleine terre','ITP-Carotte-printemps','ITP-CAR-01');

UPDATE itps SET s_semis = 24, s_recolte = 40, d_recolte = 8,
                commentaire_agronome = 'Carotte de conservation : semis fin juin (S24), récolte octobre (S40), conservation hivernale.',
                source_reference = 'Le Jardinier-Maraîcher (J.-M. Fortier)'
WHERE it_plante IN ('Carotte pleine terre conservation','ITP-Carotte-automne','ITP-CAR-02');

UPDATE itps SET s_semis = 5, s_recolte = 19, d_recolte = 4, type_planche = 'Sous abri',
                commentaire_agronome = 'Carotte précoce sous tunnel/serre : semis février, récolte mai (S19).'
WHERE it_plante = 'Carotte serre';

UPDATE itps SET s_semis = 32, s_recolte = 42, d_recolte = 4, type_planche = 'Sous abri',
                commentaire_agronome = 'Carotte d''automne sous tunnel : semis août, récolte octobre-novembre.'
WHERE it_plante = 'Carotte serre conservation';

-- Radis, Mâche, Roquette : retirer s_plantation (semis direct uniquement)
UPDATE itps SET s_plantation = NULL, mode_demarrage = 'Plein champ', type_planche = COALESCE(type_planche,'Plein champ')
WHERE espece IN ('Radis','Radis noir','Mâche','Roquette','Navet','Panais','Salsifis','Betterave','Épinard','Maïs','Petit pois','Pois','Haricot','Haricot vert','Haricot sec','Fève','Coriandre','Aneth','Persil','Cerfeuil','Chicorée frisée','Chicorée sauvage');

-- Basilic : étendre fenêtre récolte mai-octobre (Bug #27)
UPDATE itps SET s_semis = 8, s_plantation = 16, s_recolte = 22, d_recolte = 22,
                commentaire_agronome = 'Basilic : semis pépinière mars, plantation mi-mai après derniers gels, récolte juin à octobre (jusqu''aux premières gelées).',
                source_reference = 'Le Jardinier-Maraîcher (J.-M. Fortier)',
                derniere_revision = NOW()
WHERE espece = 'Basilic';

-- Modes de démarrage globaux : aligner sur le nouveau type_culture_semis
UPDATE itps i SET mode_demarrage = 'Pépinière'
FROM especes e
WHERE i.espece = e.espece AND e.type_culture_semis = 'pepiniere_puis_repiquage'
  AND (i.mode_demarrage IS NULL OR i.mode_demarrage IN ('', 'Pépinière'));

UPDATE itps i SET mode_demarrage = 'Plein champ'
FROM especes e
WHERE i.espece = e.espece AND e.type_culture_semis = 'semis_direct'
  AND (i.mode_demarrage IS NULL OR i.mode_demarrage IN ('', 'Pépinière'));

UPDATE itps i SET mode_demarrage = 'Plantation'
FROM especes e
WHERE i.espece = e.espece AND e.type_culture_semis = 'plantation_bulbes_caieux'
  AND (i.mode_demarrage IS NULL OR i.mode_demarrage IN ('', 'Pépinière'));

-- ====================================================================
-- 11. Contraintes ITP : empêcher saisie aberrante
--
--    Pour les espèces semis_direct : s_plantation DOIT être NULL.
--    Pour pepiniere_puis_repiquage : s_plantation >= s_semis (modulo 52).
--
--    On utilise un trigger plutôt qu'un CHECK car on a besoin du
--    type_culture_semis de l'espèce associée.
-- ====================================================================

CREATE OR REPLACE FUNCTION enforce_itp_dates() RETURNS TRIGGER AS $$
DECLARE
  tcs TEXT;
BEGIN
  IF NEW.espece IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT type_culture_semis INTO tcs FROM especes WHERE espece = NEW.espece;

  IF tcs = 'semis_direct' AND NEW.s_plantation IS NOT NULL THEN
    -- Force la cohérence métier : un semis direct n'a pas de date de plantation
    NEW.s_plantation := NULL;
  END IF;

  IF tcs = 'pepiniere_puis_repiquage' AND NEW.s_semis IS NOT NULL AND NEW.s_plantation IS NOT NULL THEN
    -- semaine ISO en cercle : on tolère un écart de 1 à 26 semaines
    IF ((NEW.s_plantation - NEW.s_semis + 52) % 52) < 1 THEN
      RAISE EXCEPTION 'ITP %: plantation S% doit suivre le semis S% (au moins 1 semaine)', NEW.it_plante, NEW.s_plantation, NEW.s_semis;
    END IF;
  END IF;

  IF NEW.s_semis IS NOT NULL AND NEW.s_recolte IS NOT NULL THEN
    -- Délai minimal semis -> récolte : 4 semaines (modulo 52)
    IF ((NEW.s_recolte - NEW.s_semis + 52) % 52) < 4 THEN
      RAISE EXCEPTION 'ITP %: récolte S% trop proche du semis S% (< 4 semaines)', NEW.it_plante, NEW.s_recolte, NEW.s_semis;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS itp_dates_consistency ON itps;
CREATE TRIGGER itp_dates_consistency
  BEFORE INSERT OR UPDATE ON itps
  FOR EACH ROW
  EXECUTE FUNCTION enforce_itp_dates();

-- ====================================================================
-- 12. ASSOCIATIONS - Ail × Légumineuses : cohérence (Bug #9)
--
--    Ail × Pois était marqué "+" (favorable), contredisant la règle
--    famille Ail × Fabaceae incompatible. Idem Ail × Haricot était
--    correctement à "!" (incompatible).
-- ====================================================================

-- "Ail Pois +" est incorrect : on retire la ligne d'association et on
-- ajoute la version incompatible (Ail Pois !)
DELETE FROM associations_details
 WHERE association_id = 'cml1gbbvm00072vbms78uzlvv'   -- "Ail Pois +"
   AND espece IN ('Ail','Pois');
DELETE FROM associations WHERE id = 'cml1gbbvm00072vbms78uzlvv';

INSERT INTO associations (id, nom, description, notes)
VALUES ('asso-ail-pois-incompat','Ail × Pois (incompatible)',
        'L''ail inhibe les bactéries Rhizobium des pois, réduisant la fixation d''azote.',
        'Référence : ITAB - Compagnonnage légumineuses')
ON CONFLICT (id) DO NOTHING;

INSERT INTO associations_details (association_id, espece, famille, requise)
VALUES
  ('asso-ail-pois-incompat','Ail',NULL,false),
  ('asso-ail-pois-incompat','Pois',NULL,false)
ON CONFLICT DO NOTHING;

-- Ajout symétrique : Ail × Fève (manquait)
INSERT INTO associations (id, nom, description, notes)
VALUES ('asso-ail-feve-incompat','Ail × Fève (incompatible)',
        'L''ail inhibe les bactéries Rhizobium des fèves, réduisant la fixation d''azote.',
        'Référence : ITAB - Compagnonnage légumineuses')
ON CONFLICT (id) DO NOTHING;

INSERT INTO associations_details (association_id, espece, famille, requise)
VALUES
  ('asso-ail-feve-incompat','Ail',NULL,false),
  ('asso-ail-feve-incompat','Fève',NULL,false)
ON CONFLICT DO NOTHING;

-- ====================================================================
-- 13. Espèces orphelines avec données absurdes (audit complémentaire)
-- ====================================================================

-- Sureau & Cassissier : ce sont des arbustes pas des légumes (Bug auxiliaire)
UPDATE especes SET type = 'petit_fruit', vivace = TRUE, unite_rendement = 'kg_arbre'
WHERE espece IN ('Sureau','Cassissier','Pyracantha','Frêne','Mûrier platane','Mûrier sans épine','Mandarinier','Kumquat','Feijoa','Kaki-pomme','Actinidia','Houblon')
  AND type = 'legume';

-- Ricin : ornement (toxique, pas alimentaire)
UPDATE especes SET type = 'ornement' WHERE espece = 'Ricin';

-- Topinambour : taux_germination via tubercules
UPDATE especes SET taux_germination = 95 WHERE espece = 'Topinambour';
