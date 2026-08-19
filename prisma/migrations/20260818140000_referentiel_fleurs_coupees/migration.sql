-- Ticket FB-PMWX8O (2026-08-18) — une maraîchère installant une FERME FLORALE a
-- demandé à l'assistant de créer une catégorie de culture « fleur ». La réponse
-- honnête à l'époque était « aucun écran ne le permet » : le champ Type d'une
-- espèce est une liste fermée qui ne contenait pas les fleurs.
--
-- Cause racine, côté données : Gleba SAIT cultiver des fleurs, mais ne les
-- nomme nulle part. Les six fleurs déjà présentes au catalogue étaient rangées
-- en `legume` (Cosmos, Tagètes), `aromatique` (Souci), `engrais_vert`
-- (Tournesol) ou `ornement` (Ricin) — ce dernier type portant en réalité les
-- ligneux d'agrément du verger (Albizia, Bambou, Frêne, Tilleul). Une ferme
-- florale n'avait donc ni catégorie, ni catalogue, ni itinéraire technique :
-- d'où sa question précédente (FB-2DX9QI), « peux-tu importer des ITP depuis
-- internet ? ».
--
-- Ce que fait cette migration, en additif et idempotent (catalogue officiel
-- `user_id IS NULL` uniquement, jamais une saisie de membre) :
--   1. les 10 familles botaniques manquantes des fleurs coupées ;
--   2. 23 espèces florales de plein champ et d'abri, avec leurs données
--      agronomiques (densité, dose, germination, besoins, prix indicatif) ;
--   3. un itinéraire technique métropolitain par espèce (semis, implantation,
--      récolte, durées), calé sur la zone `oceanique` comme les 525 autres ITP
--      documentés — la transposition vers les autres zones est faite à la
--      lecture par `decalageItpPourZone` ;
--   4. le reclassement des deux fleurs mal typées (Cosmos, Tagètes), aucune
--      culture existante ne les référençant.
--
-- Sources agronomiques : ITAB, SNHF/semencemag, fiches techniques des
-- semenciers de fleurs coupées, Collectif de la Fleur Française. Les rendements
-- sont exprimés en kg/m² comme le reste du référentiel ; la vente à la TIGE
-- reste un écart produit ouvert, documenté dans le vault.

-- ---------------------------------------------------------------------------
-- 0. Ouvrir la liste fermée des types d'espèce
--    `especes_type_check` est le second garde-fou derrière le zod
--    `ESPECE_TYPES` : sans cette reprise, toute création d'espèce florale
--    échouerait en base avec une 500, y compris depuis /maraichage/especes/new.
--    L'ordre reproduit celui de src/lib/validations/espece.ts.
-- ---------------------------------------------------------------------------

ALTER TABLE especes DROP CONSTRAINT IF EXISTS especes_type_check;
ALTER TABLE especes ADD CONSTRAINT especes_type_check CHECK (
  type = ANY (ARRAY[
    'legume'::text,
    'aromatique'::text,
    'fleur'::text,
    'engrais_vert'::text,
    'arbre_fruitier'::text,
    'petit_fruit'::text,
    'ornement'::text
  ])
);

-- ---------------------------------------------------------------------------
-- 1. Familles botaniques manquantes
-- ---------------------------------------------------------------------------

INSERT INTO familles (famille, nom_fr, intervalle) VALUES
  ('Amaryllidaceae', 'Amaryllidacées (narcisses)',                4),
  ('Caprifoliaceae', 'Caprifoliacées (scabieuses)',               3),
  ('Caryophyllaceae', 'Caryophyllacées (œillets, gypsophiles)',   3),
  ('Iridaceae',      'Iridacées (glaïeuls, iris)',                4),
  ('Liliaceae',      'Liliacées (tulipes, lis)',                  4),
  ('Paeoniaceae',    'Péoniacées (pivoines)',                     5),
  ('Plantaginaceae', 'Plantaginacées (mufliers)',                 3),
  ('Plumbaginaceae', 'Plumbaginacées (statices)',                 3),
  ('Polemoniaceae',  'Polémoniacées (phlox)',                     3),
  ('Ranunculaceae',  'Renonculacées (anémones, renoncules)',      4)
ON CONFLICT (famille) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Espèces florales
--    `espece` (identifiant) = nom lisible, convention du catalogue officiel.
-- ---------------------------------------------------------------------------

INSERT INTO especes (
  espece, nom, nom_normalise, type, categorie, famille, nom_latin,
  unite_rendement, rendement, vivace, a_planifier,
  besoin_n, besoin_p, besoin_eau, besoin_k,
  niveau, densite, etalement, dose_semis, unite_dose, taux_germination,
  mode_semis, type_culture_semis, marge_securite_pct,
  temp_germination, jours_levee, irrigation, conservation,
  prix_kg, zones_adaptees, besoin_froid, description
) VALUES
  -- Annuelles semées en pépinière puis repiquées ------------------------------
  ('Zinnia', 'Zinnia', 'zinnia', 'fleur', 'fleur', 'Asteraceae', 'Zinnia elegans',
   'kg_m2', 2.5, false, true, 2, 2, 3, 3,
   'Facile', 9, 0.4, 2, 'graines_plant', 85,
   'plant_repique', 'pepiniere_puis_repiquage', 15,
   '20-25', 7, 'Moyen', false,
   25, NULL, NULL,
   'Fleur coupée d''été, la plus productive du panel débutant. Récolte échelonnée de juillet aux gelées, environ 60 à 80 tiges par m² sur la saison. Couper au-dessus d''un nœud pour relancer la ramification.'),

  ('Amarante queue-de-renard', 'Amarante queue-de-renard', 'amarante queue de renard', 'fleur', 'fleur', 'Amaranthaceae', 'Amaranthus caudatus',
   'kg_m2', 3.0, false, true, 2, 2, 2, 2,
   'Facile', 6, 0.5, 2, 'graines_plant', 90,
   'plant_repique', 'pepiniere_puis_repiquage', 15,
   '20-25', 8, 'Moyen', true,
   22, NULL, NULL,
   'Grandes inflorescences retombantes, fraîches ou séchées. Tolère la sécheresse une fois installée. Tuteurage utile en sol riche.'),

  ('Célosie', 'Célosie', 'celosie', 'fleur', 'fleur', 'Amaranthaceae', 'Celosia argentea',
   'kg_m2', 2.2, false, true, 3, 2, 3, 3,
   'Moyen', 11, 0.3, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '22-25', 8, 'Moyen', true,
   28, NULL, NULL,
   'Crêtes de coq et plumeuses. Exige de la chaleur : ne pas planter avant que le sol dépasse 15 °C, sinon la plante se bloque. Excellente en fleur séchée.'),

  ('Reine-marguerite', 'Reine-marguerite', 'reine marguerite', 'fleur', 'fleur', 'Asteraceae', 'Callistephus chinensis',
   'kg_m2', 1.8, false, true, 2, 2, 3, 3,
   'Moyen', 16, 0.25, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '18-22', 10, 'Moyen', false,
   24, NULL, NULL,
   'Une seule coupe par pied : semer en plusieurs séries à trois semaines d''intervalle pour étaler la récolte. Sensible à la fusariose, respecter une rotation de 3 ans.'),

  ('Rudbeckie', 'Rudbeckie', 'rudbeckie', 'fleur', 'fleur', 'Asteraceae', 'Rudbeckia hirta',
   'kg_m2', 2.0, false, true, 2, 2, 2, 2,
   'Facile', 9, 0.4, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 15,
   '20-22', 10, 'Moyen', false,
   24, NULL, NULL,
   'Longue tenue en vase, floraison jusqu''aux premières gelées. Souvent conduite en annuelle même sur les variétés vivaces.'),

  ('Muflier', 'Muflier', 'muflier', 'fleur', 'fleur', 'Plantaginaceae', 'Antirrhinum majus',
   'kg_m2', 2.0, false, true, 3, 2, 3, 3,
   'Moyen', 16, 0.25, 3, 'graines_plant', 75,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '15-20', 12, 'Moyen', false,
   30, NULL, NULL,
   'Gueule-de-loup. Semis très fin, à ne pas recouvrir. Filet de palissage indispensable : les tiges se couchent et se courbent vers la lumière. Repart après recoupe.'),

  ('Giroflée ravenelle', 'Giroflée ravenelle', 'giroflee ravenelle', 'fleur', 'fleur', 'Brassicaceae', 'Matthiola incana',
   'kg_m2', 1.5, false, true, 3, 2, 3, 3,
   'Moyen', 25, 0.2, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '15-18', 10, 'Moyen', false,
   32, 'oceanique,oceanique_altere,semi_continental,mediterraneen', 'faible',
   'Culture d''hiver sous abri, récoltée au printemps quand rien d''autre ne fleurit. Une seule coupe par pied. Attention à la rotation : brassicacée, comme les choux.'),

  ('Statice', 'Statice', 'statice', 'fleur', 'fleur', 'Plumbaginaceae', 'Limonium sinuatum',
   'kg_m2', 1.5, false, true, 2, 2, 2, 2,
   'Facile', 9, 0.35, 2, 'graines_plant', 70,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '18-22', 14, 'Faible', true,
   26, NULL, NULL,
   'Immortelle de référence : se sèche sans perdre sa couleur. Supporte le sec et les sols pauvres. Germination lente et irrégulière, prévoir la marge de semis.'),

  ('Ammi élevé', 'Ammi élevé', 'ammi eleve', 'fleur', 'fleur', 'Apiaceae', 'Ammi majus',
   'kg_m2', 1.8, false, true, 2, 2, 2, 2,
   'Facile', 9, 0.35, 3, 'graines_plant', 70,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '15-20', 14, 'Moyen', false,
   24, NULL, NULL,
   'Dentelle blanche, la fleur de remplissage des bouquets. La sève peut être photosensibilisante : manches longues à la récolte par temps ensoleillé.'),

  ('Scabieuse', 'Scabieuse', 'scabieuse', 'fleur', 'fleur', 'Caprifoliaceae', 'Scabiosa atropurpurea',
   'kg_m2', 1.5, false, true, 2, 2, 2, 2,
   'Facile', 9, 0.35, 2, 'graines_plant', 75,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '18-20', 12, 'Moyen', false,
   26, NULL, NULL,
   'Floraison très longue si on coupe régulièrement. Les capsules sèches se vendent aussi bien que les fleurs.'),

  ('Pois de senteur', 'Pois de senteur', 'pois de senteur', 'fleur', 'fleur', 'Fabaceae', 'Lathyrus odoratus',
   'kg_m2', 1.2, false, true, 1, 2, 3, 3,
   'Moyen', 8, 0.25, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '12-18', 12, 'Élevé', false,
   34, NULL, NULL,
   'Grimpant : filet ou grillage de 1,80 m obligatoire. Légumineuse, donc peu d''azote. Récolter tous les deux jours, sinon la montée à graine arrête la floraison.'),

  ('Phlox de Drummond', 'Phlox de Drummond', 'phlox de drummond', 'fleur', 'fleur', 'Polemoniaceae', 'Phlox drummondii',
   'kg_m2', 1.2, false, true, 2, 2, 3, 2,
   'Facile', 16, 0.25, 3, 'graines_plant', 70,
   'plant_repique', 'pepiniere_puis_repiquage', 20,
   '15-18', 12, 'Moyen', false,
   24, NULL, NULL,
   'Tiges courtes, à réserver aux petits bouquets. Germination améliorée à l''obscurité.'),

  ('Immortelle', 'Immortelle', 'immortelle', 'fleur', 'fleur', 'Asteraceae', 'Xerochrysum bracteatum',
   'kg_m2', 1.5, false, true, 2, 2, 2, 2,
   'Facile', 9, 0.35, 2, 'graines_plant', 80,
   'plant_repique', 'pepiniere_puis_repiquage', 15,
   '20-22', 8, 'Faible', true,
   26, NULL, NULL,
   'Hélichryse à bractées. Se récolte en bouton : la fleur continue de s''ouvrir après la coupe. Séchage tête en bas, à l''ombre et à l''air libre.'),

  -- Annuelles semées en place ------------------------------------------------
  ('Gypsophile annuelle', 'Gypsophile annuelle', 'gypsophile annuelle', 'fleur', 'fleur', 'Caryophyllaceae', 'Gypsophila elegans',
   'kg_m2', 1.2, false, true, 1, 2, 2, 2,
   'Facile', 40, 0.2, 1.5, 'g_m2', 85,
   'graine_directe', 'semis_direct', 15,
   '15-20', 8, 'Faible', true,
   24, NULL, NULL,
   'Cycle très court (environ 10 semaines) : semer en séries toutes les trois semaines. Préfère un sol calcaire et drainant.'),

  ('Nigelle de Damas', 'Nigelle de Damas', 'nigelle de damas', 'fleur', 'fleur', 'Ranunculaceae', 'Nigella damascena',
   'kg_m2', 1.0, false, true, 1, 1, 2, 2,
   'Facile', 40, 0.2, 1.2, 'g_m2', 80,
   'graine_directe', 'semis_direct', 15,
   '15-18', 12, 'Faible', true,
   22, NULL, NULL,
   'Ne supporte pas le repiquage : semis en place uniquement. Double production, la fleur puis la capsule séchée. Se ressème seule d''une année sur l''autre.'),

  ('Tournesol ornemental', 'Tournesol ornemental', 'tournesol ornemental', 'fleur', 'fleur', 'Asteraceae', 'Helianthus annuus',
   'kg_m2', 3.5, false, true, 3, 2, 3, 3,
   'Facile', 12, 0.35, 4, 'g_m2', 90,
   'graine_directe', 'semis_direct', 15,
   '15-25', 7, 'Moyen', false,
   20, NULL, NULL,
   'Variétés de fleur coupée, sans pollen et à tige unique, distinctes du tournesol oléagineux. Une seule coupe par pied : semer toutes les deux semaines d''avril à juillet pour tenir la saison.'),

  -- Bulbes, tubercules et vivaces --------------------------------------------
  ('Dahlia', 'Dahlia', 'dahlia', 'fleur', 'fleur', 'Asteraceae', 'Dahlia x hortensis',
   'kg_m2', 4.0, true, true, 3, 3, 4, 4,
   'Moyen', 2, 0.8, 2, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 10,
   NULL, NULL, 'Élevé', false,
   30, NULL, NULL,
   'La production la plus rentable au m² d''une ferme florale. Plus on coupe, plus il fleurit. Tubercules à arracher et hiverner hors sol au-dessus de la zone océanique douce ; palissage nécessaire.'),

  ('Glaïeul', 'Glaïeul', 'glaieul', 'fleur', 'fleur', 'Iridaceae', 'Gladiolus x hortulanus',
   'kg_m2', 2.5, false, true, 2, 3, 3, 3,
   'Facile', 36, 0.15, 36, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 10,
   NULL, NULL, 'Moyen', false,
   22, NULL, NULL,
   'Plantation échelonnée d''avril à juin pour étaler la récolte. Une hampe par bulbe. Buttage ou filet contre la verse.'),

  ('Tulipe', 'Tulipe', 'tulipe', 'fleur', 'fleur', 'Liliaceae', 'Tulipa gesneriana',
   'kg_m2', 2.5, false, true, 2, 2, 2, 3,
   'Facile', 60, 0.12, 60, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 10,
   NULL, NULL, 'Moyen', false,
   28, 'oceanique,oceanique_altere,semi_continental,montagnard,mediterraneen', 'eleve',
   'Plantation à l''automne, récolte au printemps. En fleur coupée on arrache le bulbe avec la tige, ce qui gagne 5 cm de longueur et libère la planche. Exige une vraie période de froid : sans vernalisation, pas de floraison.'),

  ('Narcisse', 'Narcisse', 'narcisse', 'fleur', 'fleur', 'Amaryllidaceae', 'Narcissus pseudonarcissus',
   'kg_m2', 2.0, true, true, 2, 2, 2, 2,
   'Facile', 50, 0.14, 50, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 10,
   NULL, NULL, 'Moyen', false,
   24, 'oceanique,oceanique_altere,semi_continental,montagnard,mediterraneen', 'modere',
   'Première fleur de la saison. La sève est toxique pour les autres fleurs : faire tremper les tiges seules pendant 12 h avant tout bouquet mélangé. Le bulbe reste en place plusieurs années.'),

  ('Renoncule', 'Renoncule', 'renoncule', 'fleur', 'fleur', 'Ranunculaceae', 'Ranunculus asiaticus',
   'kg_m2', 1.8, false, true, 2, 2, 3, 3,
   'Moyen', 16, 0.25, 16, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 15,
   NULL, NULL, 'Moyen', false,
   34, 'oceanique,oceanique_altere,semi_continental,mediterraneen', 'faible',
   'Griffes à réhydrater 4 h puis à pré-germer au frais avant plantation. Culture sous abri froid, récolte de mars à mai. Craint l''excès d''eau et la chaleur précoce.'),

  ('Anémone', 'Anémone', 'anemone', 'fleur', 'fleur', 'Ranunculaceae', 'Anemone coronaria',
   'kg_m2', 1.5, false, true, 2, 2, 3, 3,
   'Moyen', 25, 0.2, 25, 'caieux_m2', NULL,
   'bulbe_caieu', 'plantation_bulbes_caieux', 15,
   NULL, NULL, 'Moyen', false,
   30, 'oceanique,oceanique_altere,semi_continental,mediterraneen', 'faible',
   'Même conduite que la renoncule, avec laquelle elle se plante en association. Récolte longue, de février à mai sous abri.'),

  ('Pivoine', 'Pivoine', 'pivoine', 'fleur', 'fleur', 'Paeoniaceae', 'Paeonia lactiflora',
   'kg_m2', 1.5, true, true, 3, 3, 3, 3,
   'Moyen', 1, 1.0, 1, 'pieces_m2', NULL,
   'bouture', 'bouture', 10,
   NULL, NULL, 'Moyen', false,
   60, 'oceanique,oceanique_altere,semi_continental,montagnard', 'eleve',
   'Investissement de long terme : rien la première année, une récolte réelle à partir de la troisième, puis vingt ans de production. Ne jamais enterrer les yeux à plus de 3 cm. Se coupe en bouton mou et se conserve plusieurs semaines à sec au froid.')
ON CONFLICT (espece) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Itinéraires techniques (référence métropole, zone océanique)
-- ---------------------------------------------------------------------------

INSERT INTO itps (
  it_plante, nom, nom_normalise, espece,
  s_semis, s_implantation_debut, s_implantation_fin, s_plantation,
  s_recolte, s_recolte_fin, d_recolte, d_pepiniere, d_culture,
  nb_rangs, espacement, esp_rangs, decal_max,
  type_planche, mode_demarrage, zone_climat, statut_validation, actif,
  source_reference, commentaire_agronome
) VALUES
  ('Zinnia — plein champ', 'Zinnia — plein champ', 'zinnia plein champ', 'Zinnia',
   13, 18, 22, 19, 27, 40, 14, 42, 56, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; SNHF/semencemag ; fiches techniques semenciers fleurs coupées',
   'Semis à 20-25 °C, repiquage après les dernières gelées. Pincer au-dessus de la 3ᵉ paire de feuilles pour forcer la ramification.'),

  ('Amarante queue-de-renard — plein champ', 'Amarante queue-de-renard — plein champ', 'amarante queue de renard plein champ', 'Amarante queue-de-renard',
   14, 19, 22, 19, 29, 40, 12, 35, 70, 2, 40, 45, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Éviter les sols trop azotés qui donnent des tiges molles. Récolter quand la moitié de l''épi est colorée.'),

  ('Célosie — plein champ', 'Célosie — plein champ', 'celosie plein champ', 'Célosie',
   13, 20, 23, 20, 29, 40, 12, 49, 63, 3, 30, 35, 3,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Ne planter qu''une fois le sol à 15 °C minimum : un coup de froid bloque la plante définitivement.'),

  ('Reine-marguerite — plein champ', 'Reine-marguerite — plein champ', 'reine marguerite plein champ', 'Reine-marguerite',
   13, 19, 24, 19, 28, 38, 10, 42, 63, 4, 25, 30, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Une coupe par pied : prévoir 3 séries espacées de 3 semaines. Rotation de 3 ans, fusariose.'),

  ('Rudbeckie — plein champ', 'Rudbeckie — plein champ', 'rudbeckie plein champ', 'Rudbeckie',
   12, 18, 22, 19, 28, 42, 14, 49, 63, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Couper quand le cœur commence à peine à bomber. Floraison jusqu''aux gelées si on récolte régulièrement.'),

  ('Muflier — plein champ', 'Muflier — plein champ', 'muflier plein champ', 'Muflier',
   8, 14, 18, 15, 24, 38, 14, 49, 63, 4, 25, 30, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; SNHF/semencemag ; fiches techniques semenciers fleurs coupées',
   'Semis en surface, sans recouvrir. Palissage horizontal obligatoire. Recoupe possible 6 semaines après la première.'),

  ('Giroflée ravenelle — abri hiver', 'Giroflée ravenelle — abri hiver', 'giroflee ravenelle abri hiver', 'Giroflée ravenelle',
   32, 40, 44, 42, 16, 21, 6, 70, 182, 5, 20, 25, 3,
   'Sous abri', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Semis de fin d''été, plantation d''automne sous abri froid, récolte d''avril. Une coupe par pied. Ne pas enchaîner derrière une brassicacée.'),

  ('Statice — plein champ', 'Statice — plein champ', 'statice plein champ', 'Statice',
   10, 17, 21, 17, 27, 40, 14, 49, 70, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Germination lente et étalée. Récolter quand les petites fleurs blanches sont sorties des bractées colorées, sinon le séchage vire.'),

  ('Ammi élevé — plein champ', 'Ammi élevé — plein champ', 'ammi eleve plein champ', 'Ammi élevé',
   10, 17, 21, 17, 26, 36, 10, 49, 63, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Racine pivotante fragile : repiquer jeune, en motte. Sève photosensibilisante, se couvrir à la récolte par grand soleil.'),

  ('Scabieuse — plein champ', 'Scabieuse — plein champ', 'scabieuse plein champ', 'Scabieuse',
   12, 18, 22, 18, 27, 42, 14, 42, 63, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Récolte deux fois par semaine, sinon la plante monte à graine et s''arrête. Les capsules sèches sont un second produit.'),

  ('Pois de senteur — plein champ', 'Pois de senteur — plein champ', 'pois de senteur plein champ', 'Pois de senteur',
   6, 13, 16, 13, 22, 30, 8, 49, 63, 2, 20, 60, 3,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; SNHF/semencemag ; fiches techniques semenciers fleurs coupées',
   'Semis en godet profond dès février, pincer à 4 feuilles. Filet de 1,80 m. Récolte tous les deux jours, sans exception.'),

  ('Phlox de Drummond — plein champ', 'Phlox de Drummond — plein champ', 'phlox de drummond plein champ', 'Phlox de Drummond',
   12, 18, 22, 18, 26, 36, 10, 42, 56, 4, 25, 30, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Lever à l''obscurité. Tiges courtes : réserver aux bouquets ronds et aux compositions basses.'),

  ('Immortelle — plein champ', 'Immortelle — plein champ', 'immortelle plein champ', 'Immortelle',
   13, 19, 22, 19, 28, 40, 12, 42, 63, 3, 30, 35, 4,
   'Plein champ', 'Pépinière', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Récolter en bouton : la bractée s''ouvre après la coupe. Séchage tête en bas, à l''ombre, en petits bouquets.'),

  ('Gypsophile annuelle — semis direct', 'Gypsophile annuelle — semis direct', 'gypsophile annuelle semis direct', 'Gypsophile annuelle',
   13, 13, 26, NULL, 25, 38, 6, NULL, 84, 5, 15, 20, 6,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Cycle de 10 semaines : semer en séries toutes les 3 semaines d''avril à juillet. Sol drainant, calcaire de préférence.'),

  ('Nigelle de Damas — semis direct', 'Nigelle de Damas — semis direct', 'nigelle de damas semis direct', 'Nigelle de Damas',
   12, 12, 22, NULL, 24, 34, 6, NULL, 84, 5, 15, 20, 6,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; SNHF/semencemag',
   'Semis en place obligatoire, le repiquage échoue. Semis d''automne possible en zone douce pour une récolte plus précoce.'),

  ('Tournesol ornemental — semis direct', 'Tournesol ornemental — semis direct', 'tournesol ornemental semis direct', 'Tournesol ornemental',
   15, 15, 28, NULL, 25, 40, 14, NULL, 70, 3, 25, 35, 8,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Variétés à tige unique et sans pollen. Une coupe par pied : semer toutes les 2 semaines d''avril à juillet. Protéger les semis des oiseaux.'),

  ('Dahlia — plein champ', 'Dahlia — plein champ', 'dahlia plein champ', 'Dahlia',
   NULL, 18, 21, 19, 29, 43, 14, NULL, 70, 2, 60, 70, 3,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées ; Collectif de la Fleur Française',
   'Planter le tubercule à 10 cm, œil vers le haut, après les gelées. Pincer à 4 paires de feuilles. Récolter tous les 2 à 3 jours : le dahlia ne mûrit plus après la coupe. Arracher et hiverner hors zone douce.'),

  ('Glaïeul — plein champ', 'Glaïeul — plein champ', 'glaieul plein champ', 'Glaïeul',
   NULL, 14, 24, 15, 28, 40, 12, NULL, 91, 6, 15, 20, 8,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Plantations échelonnées d''avril à juin, 12 cm de profondeur. Couper quand les 2 premiers boutons colorent, en gardant 4 feuilles pour reformer le bulbe.'),

  ('Tulipe — plantation automne', 'Tulipe — plantation automne', 'tulipe plantation automne', 'Tulipe',
   NULL, 43, 48, 45, 14, 18, 4, NULL, 147, 8, 12, 15, 3,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées ; Collectif de la Fleur Française',
   'Planter de fin octobre à début décembre, à 10-12 cm. En fleur coupée, arracher le bulbe avec la tige au stade bouton coloré : 5 cm de tige gagnés et la planche libérée pour une culture d''été.'),

  ('Narcisse — plantation automne', 'Narcisse — plantation automne', 'narcisse plantation automne', 'Narcisse',
   NULL, 37, 43, 40, 11, 15, 4, NULL, 161, 7, 14, 18, 3,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Planter dès septembre, à 12-15 cm. Récolter au stade « col d''oie ». Sève toxique pour les autres fleurs : 12 h de trempage séparé avant tout mélange.'),

  ('Renoncule — abri hiver', 'Renoncule — abri hiver', 'renoncule abri hiver', 'Renoncule',
   NULL, 40, 44, 42, 15, 21, 6, NULL, 175, 4, 25, 30, 3,
   'Sous abri', 'Sous abri', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées ; Collectif de la Fleur Française',
   'Réhydrater les griffes 4 h en eau courante puis pré-germer 10 à 14 jours à 10 °C avant plantation. Abri froid non chauffé, arrosage mesuré : la pourriture est le premier risque.'),

  ('Anémone — abri hiver', 'Anémone — abri hiver', 'anemone abri hiver', 'Anémone',
   NULL, 40, 44, 42, 13, 21, 8, NULL, 161, 5, 20, 25, 3,
   'Sous abri', 'Sous abri', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées',
   'Même préparation que la renoncule, avec laquelle elle se plante en alternance sur la même planche. Récolte de février à mai.'),

  ('Pivoine — plantation automne', 'Pivoine — plantation automne', 'pivoine plantation automne', 'Pivoine',
   NULL, 40, 45, 44, 20, 23, 3, NULL, 196, 1, 90, 100, 3,
   'Plein champ', 'Plein champ', 'oceanique', 'source_documentee', true,
   'ITAB ; fiches techniques semenciers fleurs coupées ; Collectif de la Fleur Française',
   'Plantation d''octobre à novembre, yeux à 3 cm maximum sous la surface : plus profond, la touffe ne fleurit jamais. Aucune coupe les deux premières années. Récolte au stade bouton mou, conservation à sec jusqu''à 4 semaines à 2 °C.')
ON CONFLICT (it_plante) DO NOTHING;

-- Délai avant première récolte : seule la pivoine est concernée du panel.
UPDATE itps SET delai_premiere_recolte_annees = 3
WHERE it_plante = 'Pivoine — plantation automne' AND delai_premiere_recolte_annees IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Reclassement des fleurs déjà présentes mais mal typées
--    Aucune culture ne les référence (vérifié en production le 2026-08-18).
--    Souci, Capucine et Tournesol restent à leur type d'usage (aromatique,
--    légume, engrais vert) : ils sont cultivés pour autre chose que la fleur.
-- ---------------------------------------------------------------------------

UPDATE especes
SET type = 'fleur',
    categorie = COALESCE(NULLIF(categorie, ''), 'fleur')
WHERE user_id IS NULL
  AND espece IN ('Cosmos', 'Tagètes')
  AND type = 'legume';

-- Cosmos était au catalogue avec un rendement nul, donc invisible de toute
-- prévision de récolte.
UPDATE especes
SET rendement = 2.0,
    prix_kg = COALESCE(prix_kg, 22)
WHERE user_id IS NULL
  AND espece = 'Cosmos'
  AND (rendement IS NULL OR rendement = 0);
