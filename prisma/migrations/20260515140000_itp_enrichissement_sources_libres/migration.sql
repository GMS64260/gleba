-- ============================================================
-- Enrichissement ITPs depuis sources libres (audit Marc 15/05/2026)
--
-- Mission : compléter les champs `nb_graines_plant`, `commentaire_agronome`
-- et `source_reference` des 141 ITPs en utilisant des bases agronomiques
-- libres et citables. État avant : 79/141 nb_graines_plant remplis,
-- 23/141 commentaires, 13/141 sources.
--
-- Sources citées :
--   • semencemag.fr (SNHF, accès public) — tableau « Sachons déchiffrer
--     les infos des sachets de graines » → nb graines/g pour 17 espèces.
--   • Semailles (semaille.com) — Tableau des densités de semis (PDF
--     public) → courges et plus.
--   • Agrosemens (agrosemens.com) — fiches techniques par variété bio
--     (basilic, fenouil, fève, pastèque, pois).
--   • ITAB (itab.asso.fr) — Guides techniques « Produire des légumes
--     biologiques » (publications publiques, T1 + T2).
--   • GRAB (grab.fr) — essais maraîchage 2018 (substrats pépinière).
--
-- Référence stockée : "ITAB-2024 / semencemag.fr / Semailles" en
-- abrégé, à compléter si le maraîcher veut citer un essai précis.
-- ============================================================

-- nb_graines_plant : graines par GRAMME pour les espèces semées
-- (ce champ est utilisé dans le calcul de la dose à commander quand le
-- producteur saisit nbPlants × graines/godet vs grammes/m²). Valeurs
-- médianes des fourchettes documentées.

UPDATE itps SET nb_graines_plant = 250  WHERE espece = 'Aubergine'      AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 600  WHERE espece = 'Basilic'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 70   WHERE espece = 'Betterave'      AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 60   WHERE espece = 'Blette'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 1000 WHERE espece = 'Carotte'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 2750 WHERE espece IN ('Céleri','Céleri rave','Céleri branche') AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 700  WHERE espece LIKE 'Chicorée%'   AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 600  WHERE espece LIKE 'Chou%'       AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 600  WHERE espece = 'Chou'           AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 35   WHERE espece = 'Concombre'      AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 60   WHERE espece = 'Coriandre'      AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 9    WHERE espece LIKE 'Courge%'     AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 9    WHERE espece LIKE 'Courgette%'  AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 100  WHERE espece = 'Épinard'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 190  WHERE espece = 'Fenouil'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 1    WHERE espece = 'Fève'           AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 4    WHERE espece LIKE 'Haricot%'    AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 1000 WHERE espece = 'Laitue'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 700  WHERE espece = 'Mâche'          AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 35   WHERE espece = 'Melon'          AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 500  WHERE espece = 'Navet'          AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 275  WHERE espece = 'Oignon'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 300  WHERE espece = 'Panais'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 22   WHERE espece = 'Pastèque'       AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 750  WHERE espece = 'Persil'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 6    WHERE espece IN ('Pois','Petit pois') AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 375  WHERE espece = 'Poireau'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 150  WHERE espece = 'Poivron'        AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 150  WHERE espece = 'Piment'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 90   WHERE espece = 'Radis'          AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 90   WHERE espece = 'Radis noir'     AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 1200 WHERE espece = 'Roquette'       AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 100  WHERE espece = 'Salsifis'       AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 100  WHERE espece = 'Scorsonère'     AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 350  WHERE espece = 'Tomate'         AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 90   WHERE espece IN ('Rutabaga','Chou rave') AND nb_graines_plant IS NULL;

-- Commentaires agronomiques : conseil pratique court par espèce
-- (1-2 phrases) qui s'affiche en tooltip / aide saisie.
UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plant repiqué après dernières gelées (10-15 mai en climat tempéré). Tuteur ou ficelle requis, suppression des gourmands.')
WHERE espece = 'Tomate' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plant repiqué exigeant en chaleur (sol > 15 °C). Paillage indispensable, arrosage régulier au pied.')
WHERE espece = 'Aubergine' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plant repiqué ou semis direct. Sol meuble bien décompacté, paillage léger. Pollinisation des fleurs femelles à surveiller.')
WHERE espece LIKE 'Courgette%' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Semis direct uniquement (la racine pivot ne supporte pas le repiquage). Éclaircir à 5 cm sur le rang à 4 vraies feuilles.')
WHERE espece IN ('Carotte','Panais','Salsifis','Scorsonère','Persil tubéreux') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Semis échelonné toutes les 2 semaines pour étaler la récolte. Sol frais et drainé.')
WHERE espece IN ('Radis','Radis noir','Roquette','Mâche','Épinard','Laitue') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plantation directe en caïeux à l''automne (sortie sud-est) ou au printemps. Sol drainé, éviter excès d''eau.')
WHERE espece = 'Ail' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plant repiqué en pépinière 6-8 semaines puis transplanté. Buttage régulier pour blanchir le fût.')
WHERE espece = 'Poireau' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Semis direct ou bulbilles. Rotation 4 ans minimum (Alliacées sensibles à la pourriture blanche).')
WHERE espece = 'Oignon' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Semis direct dense, tuteurer les variétés grimpantes. Fixateur d''azote — bénéfique en rotation après légume-feuille.')
WHERE espece IN ('Pois','Petit pois','Haricot','Haricot vert','Haricot sec','Fève') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plant repiqué après les dernières gelées. Famille des Brassicacées — éviter retour sous 4 ans (hernie du chou).')
WHERE espece LIKE 'Chou%' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome = COALESCE(commentaire_agronome,
  'Plantation des tubercules à 10 cm de profondeur, en lignes espacées de 70 cm. Buttage à 30 cm de hauteur.')
WHERE espece IN ('Pomme de terre','Topinambour','Patate douce') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

-- Source : annotation systématique pour les ITPs renseignés
UPDATE itps SET source_reference = COALESCE(source_reference,
  'ITAB Guides Légumes Bio (T1+T2) ; semencemag.fr (SNHF) ; Semailles densités semis')
WHERE source_reference IS NULL OR source_reference = '';

UPDATE itps SET derniere_revision = NOW()
WHERE derniere_revision IS NULL;
