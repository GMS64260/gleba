-- ============================================================
-- Complétion finale enrichissement ITPs (audit Marc 15/05/2026).
-- Couvre les espèces secondaires non traitées dans 20260515140000 :
-- aromatiques (aneth, origan, sarriette), engrais verts (phacélie,
-- moutarde, mélange), fleurs compagnes, et quelques compléments.
-- ============================================================

-- nb_graines_plant : graines/godet pour les espèces repiquées
UPDATE itps SET nb_graines_plant = 3 WHERE espece = 'Aneth'      AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 3 WHERE espece = 'Origan'     AND nb_graines_plant IS NULL;
UPDATE itps SET nb_graines_plant = 1 WHERE espece = 'Potimarron' AND nb_graines_plant IS NULL;
-- Engrais verts : semis direct en volée, pas de godet → NULL (déjà)

-- Commentaires manquants groupés par famille
UPDATE itps SET commentaire_agronome =
  'Aromatique semis direct ou godet. Sol drainé, exposition ensoleillée. Récolte échelonnée des feuilles fraîches.'
WHERE espece IN ('Aneth','Coriandre','Persil','Sarriette','Origan') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Semis direct, racine pivot — ne pas repiquer. Éclaircir à 5-8 cm. Récolte 60-80 jours selon variété.'
WHERE espece IN ('Betterave','Blette','Navet') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Semis sous abri 6-8 semaines avant plantation. Sol > 18 °C, paillage chaud (BRF, plastique noir). Sensible au mildiou.'
WHERE espece IN ('Concombre','Courge','Courge butternut','Potiron','Potimarron','Melon') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Plant repiqué après gelées. Sol > 18 °C, exposition plein sud. Tuteur recommandé pour variétés à gros fruits.'
WHERE espece IN ('Poivron','Poivron piment','Physalis') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Plant à godet 3 semaines puis transplantation. Récolte échelonnée, sol drainé, exposition mi-ombre acceptée.'
WHERE espece IN ('Chicorée frisée','Chicorée sauvage') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Pépinière 8-10 semaines puis transplantation après les saintes glaces. Sol riche, humide, drainé.'
WHERE espece = 'Céleri' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Plant repiqué tardif. Sol > 15 °C, exposition plein sud. Récolte des bulbes formés (cucurbitacée tardive).'
WHERE espece = 'Fenouil' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Caïeux en automne (pour la sortie d''été) ou au printemps (récolte décalée). Sol drainé, éviter excès d''eau.'
WHERE espece = 'Échalote' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Semis direct en lignes espacées 70-80 cm. Plante exigeante en eau et azote — bon précédent pour Brassicacées.'
WHERE espece IN ('Maïs','Tournesol') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Fleur compagne — semis direct ou godet selon espèce. Attire les pollinisateurs, fait office de plante-piège pour les pucerons.'
WHERE espece IN ('Bourrache','Capucine','Cosmos','Souci','Tagètes','Œillet d''Inde') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Engrais vert / couvre-sol — semis direct à la volée puis enfouissement avant montée à graines. Améliore la structure du sol.'
WHERE espece IN ('Phacélie','Moutarde','Mélange','Chénopode') AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

UPDATE itps SET commentaire_agronome =
  'Plante toxique (ricine) — usage uniquement ornemental ou comme répulsif. NE PAS consommer ni laisser à portée d''enfants.'
WHERE espece = 'Ricin' AND (commentaire_agronome IS NULL OR commentaire_agronome = '');

-- Réviser la date d'enrichissement pour tracer la migration
UPDATE itps SET derniere_revision = NOW()
WHERE derniere_revision IS NULL OR derniere_revision < '2026-05-15';
