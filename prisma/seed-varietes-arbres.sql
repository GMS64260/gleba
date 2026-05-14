-- ============================================================
-- Gleba - Données variétales : Petits fruits, Arbres fruitiers méditerranéens, Noyers, Châtaigniers
-- Données collectées depuis pépinières françaises, INRAE, AFIDOL, Wikipedia FR
-- Date : 2026-03-08
-- ============================================================

-- ============================================================
-- 1. FAMILLES BOTANIQUES MANQUANTES
-- ============================================================

INSERT INTO familles (famille, intervalle, couleur, description)
VALUES
  ('Oléacées', 0, '#808000', 'Oliviers, frênes, lilas'),
  ('Moracées', 0, '#6b4226', 'Figuiers, mûriers'),
  ('Juglandacées', 0, '#8B7355', 'Noyers, caryers'),
  ('Fagacées', 0, '#654321', 'Châtaigniers, chênes, hêtres'),
  ('Actinidiacées', 0, '#556B2F', 'Kiwis'),
  ('Lythracées', 0, '#DC143C', 'Grenadiers, salicaires'),
  ('Ébénacées', 0, '#FF8C00', 'Plaqueminiers (kakis)'),
  ('Rutacées', 0, '#FFD700', 'Agrumes : citronniers, orangers, mandariniers'),
  ('Grossulariacées', 0, '#B22222', 'Groseilliers, cassissiers')
ON CONFLICT (famille) DO NOTHING;


-- ============================================================
-- 2. ESPÈCES
-- ============================================================

INSERT INTO especes (espece, type, famille, nom_latin, rendement, vivace, besoin_n, besoin_eau, couleur, description)
VALUES
  -- Petits fruits
  ('Framboisier',    'petit_fruit',    'Rosacées',        'Rubus idaeus',            1.5,  true, 3, 4, '#C0392B', 'Petit fruit rouge ou jaune, remontant ou non, culture en haie fruitière'),
  ('Groseillier',    'petit_fruit',    'Grossulariacées', 'Ribes rubrum',            4.0,  true, 2, 3, '#E74C3C', 'Arbuste à grappes rouges, blanches ou roses, autofertile'),
  ('Cassissier',     'petit_fruit',    'Grossulariacées', 'Ribes nigrum',            3.0,  true, 3, 3, '#2C3E50', 'Cassis noir aromatique, riche en vitamine C'),
  ('Mûrier',         'petit_fruit',    'Rosacées',        'Rubus fruticosus',        5.0,  true, 2, 3, '#1A1A2E', 'Ronce sans épine, liane vigoureuse, gros fruits noirs'),

  -- Arbres fruitiers méditerranéens
  ('Olivier',        'arbre_fruitier', 'Oléacées',        'Olea europaea',          30.0,  true, 2, 2, '#808000', 'Arbre emblématique méditerranéen, huile et olives de table'),
  ('Figuier',        'arbre_fruitier', 'Moracées',        'Ficus carica',           20.0,  true, 2, 2, '#6B4226', 'Arbre méditerranéen, figues fraîches ou séchées, bifère ou unifère'),
  ('Grenadier',      'arbre_fruitier', 'Lythracées',      'Punica granatum',        40.0,  true, 2, 2, '#DC143C', 'Arbre méditerranéen, grenades sucrées à acidulées'),
  ('Plaqueminier',   'arbre_fruitier', 'Ébénacées',       'Diospyros kaki',         30.0,  true, 2, 3, '#FF8C00', 'Kaki, fruit automnal astringent ou non selon variété'),
  ('Citronnier',     'arbre_fruitier', 'Rutacées',        'Citrus limon',           50.0,  true, 3, 4, '#F1C40F', 'Agrume remontant, floraison quasi permanente en climat doux'),
  ('Oranger',        'arbre_fruitier', 'Rutacées',        'Citrus sinensis',        60.0,  true, 3, 4, '#E67E22', 'Agrume à fruits sucrés, variétés navel ou sanguines'),

  -- Noyers et châtaigniers
  ('Noyer',          'arbre_fruitier', 'Juglandacées',    'Juglans regia',          30.0,  true, 2, 2, '#8B7355', 'Grand arbre, noix sèches, entrée en production lente (variétés terminales)'),
  ('Châtaignier',    'arbre_fruitier', 'Fagacées',        'Castanea sativa',        25.0,  true, 2, 3, '#654321', 'Grand arbre, châtaignes et marrons, variétés traditionnelles et hybrides'),

  -- Kiwi et autres
  ('Kiwi',           'arbre_fruitier', 'Actinidiacées',   'Actinidia deliciosa',    30.0,  true, 3, 4, '#556B2F', 'Liane vigoureuse, fruits à peau velue, plante dioïque sauf var. autofertiles'),
  ('Cognassier',     'arbre_fruitier', 'Rosacées',        'Cydonia oblonga',        25.0,  true, 2, 3, '#F4D03F', 'Petit arbre rustique, coings parfumés pour gelées et pâtes de fruits'),
  ('Néflier',        'arbre_fruitier', 'Rosacées',        'Mespilus germanica',     20.0,  true, 1, 2, '#A0522D', 'Petit arbre rustique, nèfles à consommer après blettissement')
ON CONFLICT (espece) DO UPDATE SET
  type = EXCLUDED.type,
  famille = EXCLUDED.famille,
  nom_latin = EXCLUDED.nom_latin,
  rendement = EXCLUDED.rendement,
  vivace = EXCLUDED.vivace,
  besoin_n = EXCLUDED.besoin_n,
  besoin_eau = EXCLUDED.besoin_eau,
  couleur = EXCLUDED.couleur,
  description = EXCLUDED.description;


-- ============================================================
-- 3. VARIÉTÉS
-- ============================================================

-- ----------------------------------------------------------
-- 3.1 FRAMBOISIER (Rubus idaeus)
-- Rendement: kg/plant/an | Récolte exprimée en semaine ISO
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Framboisier-Meeker',
   'Framboisier', 26, 5,
   'NON REMONTANT. Origine: USA (Washington). Floraison: mai. Récolte: fin juin à fin juillet (5 semaines). '
   || 'Rendement: 1.5-2 kg/plant. Fruit: 3.5-10 g, rouge foncé, ferme, excellente tenue. '
   || 'Conservation: bonne (congélation, transformation). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale, sensible au Phytophthora. '
   || 'Vigueur: forte, tiges érigées épineuses. '
   || 'Particularités: variété de référence pour l''industrie de transformation et la congélation. Très bonne aptitude au transport.'
  ),

  ('Framboisier-Heritage',
   'Framboisier', 27, 14,
   'REMONTANT. Origine: USA (Cornell University, 1969). Floraison: mai puis août. Récolte: 1ère fin juin-juillet, 2nde septembre-octobre. '
   || 'Rendement: 1.5-2 kg/plant. Fruit: 3-4 g, rouge moyen, ferme, saveur équilibrée sucrée-acide. '
   || 'Conservation: bonne, fruit ferme. Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance aux maladies racinaires et viroses. '
   || 'Vigueur: forte, tiges très épineuses, drageonne abondamment. '
   || 'Particularités: variété remontante de référence mondiale. Double récolte possible. Très rustique (-25°C).'
  ),

  ('Framboisier-Tulameen',
   'Framboisier', 25, 6,
   'NON REMONTANT. Origine: Canada (Colombie-Britannique). Floraison: mai-juin (4-6 semaines). Récolte: mi-juin à fin juillet. '
   || 'Rendement: 2-3 kg/plant. Fruit: 4-6 g (jusqu''à 10-15 g), rouge clair, très gros calibre, juteux, saveur sucrée. '
   || 'Conservation: moyenne (fruit fragile). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale, sensible à la pourriture grise. '
   || 'Vigueur: forte, tiges peu épineuses. '
   || 'Particularités: référence en calibre de fruit. Excellente qualité gustative pour le frais. La plus vendue en pépinière.'
  ),

  ('Framboisier-Autumn Bliss',
   'Framboisier', 30, 10,
   'REMONTANT. Origine: UK (East Malling, 1984). Floraison: avril-mai puis juillet-août. Récolte: fin juillet à mi-octobre. '
   || 'Rendement: 1.5-2 kg/plant. Fruit: 3-5 g, rouge foncé, moyennement ferme, saveur douce et parfumée. '
   || 'Conservation: courte (consommation rapide). Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance au puceron du framboisier (vecteur de virus). '
   || 'Vigueur: moyenne, port compact (1-1.2 m), peu d''épines. '
   || 'Particularités: variété compacte idéale en pot. Très précoce parmi les remontants. Bonne rusticité.'
  ),

  ('Framboisier-Maravilla',
   'Framboisier', 26, 16,
   'REMONTANT. Origine: USA (Driscoll''s, Californie). Floraison: mai puis août. Récolte: fin juin-juillet puis août-octobre. '
   || 'Rendement: 2-3 kg/plant. Fruit: 6-8 g, rouge brillant, très gros, ferme, saveur sucrée. '
   || 'Conservation: très bonne (fruit ferme, excellente tenue). Autofertile: oui. '
   || 'Résistance maladies: bonne. '
   || 'Vigueur: très forte, tiges vigoureuses jusqu''à 2 m. '
   || 'Particularités: variété premium du marché frais. Production étalée. Rendement élevé sous tunnel.'
  ),

  ('Framboisier-Glen Ample',
   'Framboisier', 27, 6,
   'NON REMONTANT. Origine: Écosse (James Hutton Institute). Floraison: mai-juin. Récolte: début juillet à mi-août. '
   || 'Rendement: 2-3 kg/plant. Fruit: 4-6 g, rouge foncé, juteux, très parfumé. '
   || 'Conservation: bonne (fruit ferme). Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance aux maladies et ravageurs, notamment le puceron. '
   || 'Vigueur: forte, tiges SANS épines, dressées. '
   || 'Particularités: variété sans épines facilitant la récolte. Très bon rendement. Rustique. Idéale pour le marché frais.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.2 GROSEILLIER (Ribes rubrum)
-- Rendement: kg/plant/an
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Groseillier-Jonkheer van Tets',
   'Groseillier', 25, 3,
   'Origine: Pays-Bas. Floraison: avril (fleurs jaune miel). Récolte: fin juin à mi-juillet (précoce). '
   || 'Rendement: 3-4 kg/plant. Fruit: gros, rouge translucide, longues grappes, légèrement acide. '
   || 'Conservation: courte (3-5 jours frais, congélation possible). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance à l''oïdium, sensible à l''anthracnose. '
   || 'Vigueur: forte, port érigé, croissance rapide. '
   || 'Particularités: variété précoce de référence. Excellente pour le frais et la transformation. Très rustique.'
  ),

  ('Groseillier-Rovada',
   'Groseillier', 30, 4,
   'Origine: Pays-Bas. Floraison: avril-mai. Récolte: fin juillet à fin août (tardive). '
   || 'Rendement: 4-6 kg/plant. Fruit: gros, rouge vif, grappes très longues (15-20 cm), saveur acidulée. '
   || 'Conservation: bonne (fruit ferme, bonne tenue). Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance générale (oïdium, mildiou). '
   || 'Vigueur: forte, port érigé. '
   || 'Particularités: variété tardive de référence pour le marché frais. Grappes spectaculaires. Rendement record.'
  ),

  ('Groseillier-Versaillaise rouge',
   'Groseillier', 27, 3,
   'Origine: France (Versailles, XIXe siècle). Floraison: avril. Récolte: juillet (mi-saison). '
   || 'Rendement: 3-5 kg/plant. Fruit: moyen, rouge brillant, grappes moyennes, acidité marquée. '
   || 'Conservation: courte. Autofertile: oui. '
   || 'Résistance maladies: sensible à l''oïdium en conditions humides. '
   || 'Vigueur: moyenne à forte. '
   || 'Particularités: variété traditionnelle française. Excellente pour la transformation (jus, gelées). Bon rendement en jus.'
  ),

  ('Groseillier-Blanka',
   'Groseillier', 28, 4,
   'Origine: Tchéquie. Floraison: avril-mai. Récolte: juillet à août. '
   || 'Rendement: 5-8 kg/plant (jusqu''à 11 kg). Fruit: groseille blanche translucide à ambrée, très gros, saveur douce et sucrée. '
   || 'Conservation: bonne. Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale. '
   || 'Vigueur: forte, port étalé. '
   || 'Particularités: variété la plus productive en groseille blanche. Saveur très douce, idéale pour le frais. Peu acide.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.3 CASSISSIER (Ribes nigrum)
-- Rendement: kg/plant/an
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Cassissier-Noir de Bourgogne',
   'Cassissier', 28, 2,
   'Origine: France (Bourgogne, variété ancienne). Floraison: avril. Récolte: mi-juillet (2 semaines). '
   || 'Rendement: 1.5-2.5 kg/plant. Fruit: moyen, noir, très aromatique et parfumé, saveur typique. '
   || 'Conservation: courte (transformation rapide recommandée). Autofertile: NON (pollinisateur nécessaire: Géant de Boskoop, Andega). '
   || 'Résistance maladies: sensible à l''oïdium. '
   || 'Vigueur: moyenne, port érigé. '
   || 'Particularités: variété emblématique de la crème de cassis de Dijon. Arôme incomparable. Rendement modeste.'
  ),

  ('Cassissier-Andega',
   'Cassissier', 29, 3,
   'Origine: Lituanie. Floraison: tardive (avril-mai). Récolte: fin juillet à mi-août. '
   || 'Rendement: 3-4 kg/plant. Fruit: gros, noir, acidulé, très bon arôme. '
   || 'Conservation: bonne. Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance aux maladies (oïdium, rouille). '
   || 'Vigueur: moyenne, port semi-érigé. '
   || 'Particularités: excellent pollinisateur pour Noir de Bourgogne. Floraison tardive évitant les gelées. Très productif.'
  ),

  ('Cassissier-Titania',
   'Cassissier', 28, 3,
   'Origine: Suède. Floraison: avril. Récolte: mi-juillet à début août. '
   || 'Rendement: 2.5-3.5 kg/plant. Fruit: moyen, noir, saveur douce et légèrement acide. '
   || 'Conservation: bonne. Autofertile: oui. '
   || 'Résistance maladies: excellente résistance à l''oïdium, au mildiou et au gel. '
   || 'Vigueur: forte, port érigé et vigoureux. '
   || 'Particularités: variété robuste très résistante. Goût moins prononcé que Noir de Bourgogne. Bien adaptée au nord.'
  ),

  ('Cassissier-Big Ben',
   'Cassissier', 26, 3,
   'Origine: Écosse (James Hutton Institute). Floraison: avril. Récolte: fin juin à mi-juillet (précoce). '
   || 'Rendement: 3-5 kg/plant. Fruit: TRÈS gros (2-3× la taille standard, jusqu''à 2.5 g/baie), noir brillant, sucré et doux. '
   || 'Conservation: bonne (peau résistante). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance à l''oïdium et au mildiou. RHS Award of Garden Merit. '
   || 'Vigueur: forte, port érigé, 1.5 m à maturité. '
   || 'Particularités: créé pour le marché du frais. Baies assez sucrées pour être consommées crues directement.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.4 MÛRIER SANS ÉPINE (Rubus fruticosus)
-- Rendement: kg/plant/an
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Mûrier-Thornfree',
   'Mûrier', 30, 8,
   'Origine: USA (USDA, 1966). Floraison: mai-juin (fleurs blanc-rosé). Récolte: fin juillet à septembre. '
   || 'Rendement: 5-10 kg/plant. Fruit: très gros, noir, ferme, saveur douce à maturité. '
   || 'Conservation: courte (2-3 jours frigo, congélation recommandée). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale. '
   || 'Vigueur: très forte, tiges semi-rampantes sans épines, jusqu''à 4 m. '
   || 'Particularités: variété pionnière sans épine. Récolte tardive et abondante. Adapté climat tempéré.'
  ),

  ('Mûrier-Loch Ness',
   'Mûrier', 29, 5,
   'Origine: Écosse (James Hutton Institute). Floraison: mai-juin. Récolte: mi-juillet à fin août. '
   || 'Rendement: 5-8 kg/plant. Fruit: gros (6-9 g), noir brillant, ferme, saveur aromatique et douce. '
   || 'Conservation: bonne (fruit ferme, bonne tenue après récolte). Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance aux maladies. Rusticité: -20°C. '
   || 'Vigueur: forte, port semi-dressé sans épines, 1.5-2 m. '
   || 'Particularités: excellente tenue en barquette. Très productive. Port semi-érigé facilitant la récolte.'
  ),

  ('Mûrier-Triple Crown',
   'Mûrier', 31, 8,
   'Origine: USA (USDA, 1996). Floraison: mai-juin (fleurs blanc-rose). Récolte: août à octobre. '
   || 'Rendement: 5-12 kg/plant (jusqu''à 25 kg en conditions optimales). Fruit: énorme (jusqu''à 8 g), noir, sucré, excellente saveur. '
   || 'Conservation: bonne (fruit ferme). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale. '
   || 'Vigueur: très forte, sans épines, port semi-érigé vigoureux. '
   || 'Particularités: « triple couronne » = gros fruit + très bon goût + absence d''épines. Rendement exceptionnel.'
  ),

  ('Mûrier-Dirksen',
   'Mûrier', 30, 8,
   'Origine: USA. Floraison: mai-juin (fleurs blanc rosé). Récolte: fin juillet à septembre. '
   || 'Rendement: 5-8 kg/plant. Fruit: gros, noir à maturité, bonne saveur. '
   || 'Conservation: moyenne. Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité exceptionnelle: -23°C. '
   || 'Vigueur: forte, sans épines. '
   || 'Particularités: variété la plus rustique parmi les mûriers sans épines. Très résistante au froid.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.5 OLIVIER (Olea europaea)
-- Rendement: kg/arbre/an (arbre adulte 15+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Olivier-Aglandau',
   'Olivier', 44, 6,
   'Origine: Haute-Provence (Alpes-de-Haute-Provence, Bouches-du-Rhône, Var). Floraison: mai-juin. Récolte: début novembre à mi-décembre. '
   || 'Rendement: 30-50 kg/arbre. Rendement huile: 21%. Usage: huile (20% production française). '
   || 'Conservation: huile fruitée et onctueuse, bonne conservation. Autofertile: partiellement (pollinisateurs: Bouteillan, Picholine, Verdale). '
   || 'Résistance maladies: bonne résistance au froid (-15°C), résistante aux maladies. '
   || 'Vigueur: forte, port érigé. '
   || 'Particularités: variété la mieux adaptée aux régions froides. Très productive et régulière. Huile AOP Haute-Provence.'
  ),

  ('Olivier-Bouteillan',
   'Olivier', 43, 5,
   'Origine: Var, Bouches-du-Rhône. Floraison: mai. Récolte: fin octobre à décembre. '
   || 'Rendement: 20-40 kg/arbre. Rendement huile: 18-20%. Usage: huile (saveur herbacée, notes de pomme et poire). '
   || 'Conservation: huile claire, bonne conservation. Autofertile: NON (pollinisateurs: Aglandau, Cayon). '
   || 'Résistance maladies: bonne résistance générale. '
   || 'Vigueur: moyenne, port légèrement étalé. '
   || 'Particularités: huile de qualité fine. Olive pulpeuse et grosse. Bon rendement en huile.'
  ),

  ('Olivier-Picholine',
   'Olivier', 39, 8,
   'Origine: Languedoc (variété la plus répandue en France). Floraison: mai-juin. Récolte: vert en septembre, noir en novembre-décembre. '
   || 'Rendement: 20-40 kg/arbre. Rendement huile: 15-18%. Usage: double (table verte + huile). '
   || 'Conservation: bonne en saumure (olive de table) ou huile. Autofertile: partiellement (pollinisateurs: Manzanille, Aglandau, Bouteillan, Verdale). '
   || 'Résistance maladies: moyenne, sensible au cycloconium. '
   || 'Vigueur: forte, port érigé dense. '
   || 'Particularités: N°1 en France en superficie. Double usage table/huile. Huile forte et légèrement amère. AOP Nîmes et Picholine.'
  ),

  ('Olivier-Lucques',
   'Olivier', 46, 4,
   'Origine: Languedoc (Hérault, Aude). Floraison: mai-juin (longue durée). Récolte: mi-novembre à mi-décembre. '
   || 'Rendement: 15-30 kg/arbre. Rendement huile: 14-16% (faible). Usage: principalement olive de table verte (chair fine, fondante). '
   || 'Conservation: excellente en olive de table. Autofertile: NON (pollen stérile, pollinisateurs obligatoires: Arbequina, Picholine, Grossane). '
   || 'Résistance maladies: moyenne. Rusticité: -12°C. '
   || 'Vigueur: forte, port étalé. '
   || 'Particularités: olive de table la plus réputée de France. Forme en croissant caractéristique. AOP Lucques du Languedoc.'
  ),

  ('Olivier-Tanche',
   'Olivier', 44, 8,
   'Origine: Drôme, Baronnies provençales (Nyons). Floraison: mai-juin. Récolte: novembre à janvier (complète maturité). '
   || 'Rendement: 20-50 kg/arbre. Rendement huile: 20-25% (élevé). Usage: double (olive noire de table + huile douce). '
   || 'Conservation: olive noire ridée, excellente conservation. Autofertile: partiellement (pollinisateurs: Cayon, Picholine, Cailletier). '
   || 'Résistance maladies: bonne résistance au froid (-15°C), bonne résistance générale. '
   || 'Vigueur: forte, port arrondi. '
   || 'Particularités: AOP Olive et Huile de Nyons. Entrée en production rapide (3-4 ans). Production régulière. 98% des vergers de Nyons.'
  ),

  ('Olivier-Arbequina',
   'Olivier', 43, 6,
   'Origine: Catalogne (Espagne). Floraison: fin avril à mai. Récolte: fin octobre à décembre. '
   || 'Rendement: 20-50 kg/arbre. Rendement huile: 18-22%. Usage: huile (dorée, douce, arômes amande et tomate). '
   || 'Conservation: huile fine, conservation moyenne. Autofertile: oui. '
   || 'Résistance maladies: bonne résistance au repilo et à la tuberculose. Rusticité: -12°C. '
   || 'Vigueur: moyenne, port étalé, petit arbre (3-4 m). '
   || 'Particularités: mise à fruit très rapide (2-3 ans). Adaptée haute densité. Productivité élevée. Pollinisateur utile pour Lucques.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.6 FIGUIER (Ficus carica)
-- Rendement: kg/arbre/an (arbre adulte 8+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Figuier-Violette de Solliès',
   'Figuier', 35, 8,
   'UNIFÈRE. Origine: Solliès-Pont, Var (AOP Figue de Solliès). Floraison: auto-fécondation (caprification non nécessaire). Récolte: fin août à octobre. '
   || 'Rendement: 20-40 kg/arbre. Fruit: gros, aplati, peau bleu-noir ardoise, chair rouge, sucrée, très parfumée. '
   || 'Conservation: courte (2-4 jours frigo). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -12°C. '
   || 'Vigueur: très forte, grand développement. '
   || 'Particularités: 75% de la production française de figues. AOP. Aussi appelée Bourjassotte Noire. Récolte tardive et abondante.'
  ),

  ('Figuier-Goutte d''Or',
   'Figuier', 27, 8,
   'BIFÈRE. Origine: France (variété ancienne). Floraison: auto-fécondation. Récolte 1: début juillet (faible). Récolte 2: fin août à octobre (abondante). '
   || 'Rendement: 15-25 kg/arbre. Fruit: très gros, doré, chair rosée, juteux et très parfumé. '
   || 'Conservation: courte (fruit fragile). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: faible à moyenne, petit développement. '
   || 'Particularités: idéale petits jardins et culture en bac. Variété bifère ancienne. Très grosse figue dorée.'
  ),

  ('Figuier-Ronde de Bordeaux',
   'Figuier', 30, 5,
   'UNIFÈRE. Origine: Bordeaux, France. Floraison: auto-fécondation. Récolte: fin juillet à début septembre (précoce). '
   || 'Rendement: 15-30 kg/arbre. Fruit: petit à moyen, brun-noir, chair rouge foncé, très sucré et parfumé. '
   || 'Conservation: courte. Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C (une des plus rustiques). '
   || 'Vigueur: moyenne, port arrondi compact. '
   || 'Particularités: parmi les plus rustiques des figuiers. Récolte précoce et abondante. Convient au nord de la Loire.'
  ),

  ('Figuier-Dauphine',
   'Figuier', 23, 14,
   'BIFÈRE. Origine: France (variété ancienne). Floraison: auto-fécondation. Récolte 1: juin (grosse figue-fleur). Récolte 2: fin septembre. '
   || 'Rendement: 20-35 kg/arbre. Fruit: gros, brun-rose, juteux et très parfumé, chair rose. '
   || 'Conservation: courte. Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -12°C. '
   || 'Vigueur: forte, grand développement. '
   || 'Particularités: variété bifère précoce. Première récolte importante dès juin. Aussi appelée Boule d''Or.'
  ),

  ('Figuier-Brown Turkey',
   'Figuier', 27, 12,
   'BIFÈRE. Origine: USA (variété ancienne, très répandue). Floraison: auto-fécondation. Récolte 1: juillet. Récolte 2: septembre-octobre. '
   || 'Rendement: 15-25 kg/arbre. Fruit: petit à moyen (30-40 g), brun-violet, chair rose, sucré. '
   || 'Conservation: courte à moyenne. Autofertile: oui. '
   || 'Résistance maladies: très bonne, très tolérante. Rusticité: -15°C. '
   || 'Vigueur: forte, vigoureux et adaptable. '
   || 'Particularités: variété la plus fiable et tolérante. Bifère selon climat. Convient partout en France. Valeur sûre.'
  ),

  ('Figuier-Pastilière',
   'Figuier', 31, 4,
   'UNIFÈRE. Origine: France (Sud-Ouest). Floraison: auto-fécondation. Récolte: début août à début septembre (précoce pour une unifère). '
   || 'Rendement: 10-20 kg/arbre. Fruit: moyen, allongé, violet-noir, chair rouge foncé, saveur sucrée et musquée. '
   || 'Conservation: courte. Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: faible à moyenne, petit arbre compact. '
   || 'Particularités: figue allongée originale en forme de goutte. Précoce et productive pour sa taille. Bonne rusticité.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.7 NOYER (Juglans regia)
-- Rendement: kg/arbre/an (arbre adulte 15+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Noyer-Franquette',
   'Noyer', 40, 3,
   'Origine: Isère, France (variété traditionnelle). Floraison: tardive (mai). Récolte: fin septembre à mi-octobre. '
   || 'Rendement: 30-50 kg/arbre (2-3 t/ha). Noix: coque assez dure, cerneaux clairs, saveur douce et fine. '
   || 'Conservation: excellente (12-18 mois en sec). Autofertile: partiellement (pollinisateurs: Ronde de Montignac, Meylannaise). '
   || 'Résistance maladies: bonne résistance à la bactériose. Très rustique (-25°C). '
   || 'Vigueur: très forte, grand arbre, fructification terminale. '
   || 'Particularités: N°1 en France (AOP Noix de Grenoble + Périgord). Floraison tardive évitant les gelées. Mise à fruit lente (8-10 ans).'
  ),

  ('Noyer-Lara',
   'Noyer', 39, 3,
   'Origine: USA, introduite en France. Floraison: précoce (avril). Récolte: fin septembre à début octobre. '
   || 'Rendement: 40-70 kg/arbre (5-6 t/ha à 8 ans). Noix: grosse, coque tendre, cerneaux clairs. '
   || 'Conservation: bonne (noix fraîche ou sèche, 12 mois). Autofertile: partiellement (protandre, complémentaire avec Franquette). '
   || 'Résistance maladies: sensible à la bactériose. Rusticité: -20°C. '
   || 'Vigueur: moyenne, port semi-érigé à semi-étalé. '
   || 'Particularités: mise à fruit très rapide (3-5 ans). Fructification latérale. Très productive. Débourrement précoce (attention gel).'
  ),

  ('Noyer-Fernor',
   'Noyer', 41, 3,
   'Origine: France (INRA Bordeaux, 1978, croisement Franquette × Lara). Floraison: tardive (mai). Récolte: mi-octobre. '
   || 'Rendement: 40-60 kg/arbre (4-5 t/ha). Noix: grosse (légèrement plus que Franquette), coque mi-dure, cerneaux clairs. '
   || 'Conservation: très bonne (12-18 mois). Autofertile: NON (pollinisateur: Fernette). '
   || 'Résistance maladies: bonne résistance à la bactériose (meilleure que Lara). Rusticité: -22°C. '
   || 'Vigueur: forte, port érigé. '
   || 'Particularités: combine rusticité de Franquette et productivité de Lara. Mise à fruit rapide (5-7 ans). Variété typique du Sud-Ouest.'
  ),

  ('Noyer-Parisienne',
   'Noyer', 40, 3,
   'Origine: France (bassin Sud-Est). Floraison: tardive. Récolte: fin septembre à mi-octobre. '
   || 'Rendement: 30-50 kg/arbre. Noix: grosse, ronde, coque dure, cerneaux de bonne qualité. '
   || 'Conservation: très bonne. Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale. Très rustique. '
   || 'Vigueur: très forte, grand arbre, fructification terminale. '
   || 'Particularités: variété traditionnelle du bassin grenoblois. Autofertile. AOP Noix de Grenoble.'
  ),

  ('Noyer-Mayette',
   'Noyer', 40, 3,
   'Origine: France (Isère, variété traditionnelle ancienne). Floraison: tardive (mai). Récolte: fin septembre à mi-octobre. '
   || 'Rendement: 25-40 kg/arbre. Noix: grosse, bien ronde, coque épaisse, cerneaux blancs de haute qualité gustative. '
   || 'Conservation: excellente. Autofertile: partiellement. '
   || 'Résistance maladies: bonne. Très rustique (-25°C). '
   || 'Vigueur: très forte, grand arbre majestueux. '
   || 'Particularités: variété noble historique de l''Isère. Noix de prestige. Mise à fruit longue (10+ ans). AOP Noix de Grenoble.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.8 CHÂTAIGNIER (Castanea sativa / hybrides)
-- Rendement: kg/arbre/an (arbre adulte 10+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Châtaignier-Marigoule',
   'Châtaignier', 41, 3,
   'Origine: France (INRA, hybride naturel C. sativa × C. crenata, Migoule/Ussac, Corrèze, 1986). Floraison: juin-juillet. Récolte: mi-octobre (3 semaines). '
   || 'Rendement: 25-40 kg/arbre (3 t/ha). Fruit: moyen à gros, parfois cloisonné, peau mince, chair blanc-doré, très tendre et sucrée. '
   || 'Conservation: moyenne (séchage ou congélation). Autofertile: NON (pollinisateurs: Maraval, Belle Épine). '
   || 'Résistance maladies: très bonne résistance à l''encre et à l''anthracnose (hybride). '
   || 'Vigueur: forte. '
   || 'Particularités: avec Bouche de Bétizac, variété hybride la plus cultivée en France. Mise à fruit: ~5 ans. Qualité gustative excellente pour un hybride.'
  ),

  ('Châtaignier-Bouche de Bétizac',
   'Châtaignier', 40, 3,
   'Origine: France (INRA, Malemort-sur-Corrèze, 1962, hybride C. sativa × C. crenata). Floraison: juin-juillet. Récolte: début octobre (3 semaines). '
   || 'Rendement: 25-40 kg/arbre (3 t/ha). Fruit: gros à très gros (calibre imposant), chair tendre, bonne saveur pour un hybride. '
   || 'Conservation: moyenne. Autofertile: NON (pas de pollen! Pollinisateurs: Belle Épine, Marron de Goujounac, Marron de Chevanceaux). '
   || 'Résistance maladies: bonne résistance à l''encre, peu sensible au chancre et au cynips du châtaignier. '
   || 'Vigueur: moyenne, port érigé, plantation serrée possible (7×7 m, 200 arbres/ha). '
   || 'Particularités: variété hybride la plus cultivée en France. Mise à fruit rapide. Excellent calibre pour la vente au détail. Nécessite irrigation.'
  ),

  ('Châtaignier-Comballe',
   'Châtaignier', 42, 3,
   'Origine: France (Saint-Pierreville, Ardèche, XVIIe siècle, C. sativa pure). Floraison: juin-juillet. Récolte: 2e quinzaine d''octobre (tardive). '
   || 'Rendement: 20-35 kg/arbre. Fruit: bon calibre (30-70 fruits/kg), forme elliptique, écorce brillante châtain à reflets miel, stries sombres. '
   || 'Conservation: bonne (séchage traditionnel). Autofertile: partiellement (bénéficie de pollinisateurs). '
   || 'Résistance maladies: sensible à l''encre (C. sativa pure). '
   || 'Vigueur: forte. '
   || 'Particularités: variété traditionnelle emblématique de l''Ardèche. Qualité gustative très bonne (texture fine, sucrée, parfumée). AOP Châtaigne d''Ardèche.'
  ),

  ('Châtaignier-Belle Épine',
   'Châtaignier', 41, 3,
   'Origine: France (Ardèche, C. sativa pure). Floraison: juin-juillet (longue durée). Récolte: mi-octobre. '
   || 'Rendement: 25-40 kg/arbre. Fruit: très gros calibre (65-85 fruits/kg), précoce, légèrement cloisonné, bonne saveur. '
   || 'Conservation: bonne. Autofertile: oui (pollen abondant, fleurs longistaminées). '
   || 'Résistance maladies: bonne résistance générale, robuste. Résistant à la chaleur et à la sécheresse. '
   || 'Vigueur: très forte. '
   || 'Particularités: EXCELLENT POLLINISATEUR universel compatible avec de nombreuses variétés. 25% de déchet à l''épluchage mais fort rendement. Très rustique.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.9 KIWI (Actinidia)
-- Rendement: kg/pied/an (pied adulte 7+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Kiwi-Hayward',
   'Kiwi', 44, 3,
   'Origine: Nouvelle-Zélande (la plus cultivée au monde). Floraison: mai-juin. Récolte: début novembre aux premières gelées. '
   || 'Rendement: 20-30 kg/pied (20 t/ha). Fruit: gros (80-120 g), peau brune velue, chair verte, acidulé et sucré. '
   || 'Conservation: excellente (jusqu''à 6 mois au frigo). Autofertile: NON (dioïque, pollinisateur mâle obligatoire: Tomuri, 1 mâle pour 5-8 femelles). '
   || 'Résistance maladies: bonne, sensible au PSA (Pseudomonas syringae pv. actinidiae). '
   || 'Vigueur: très forte, liane vigoureuse. '
   || 'Particularités: variété de référence mondiale. Mise en production 3-5 ans, pleine production à 7 ans. Nécessite palissage solide. Kiwi de France AOC.'
  ),

  ('Kiwi-Solissimo',
   'Kiwi', 42, 3,
   'Origine: France (INRA, variété Renact®). Floraison: mai-juin. Récolte: octobre-novembre. '
   || 'Rendement: 30-60 kg/pied (sur pied de 10 ans). Fruit: moyen à gros, peau brune, chair verte, saveur douce et sucrée. '
   || 'Conservation: bonne (3-4 mois). Autofertile: oui (variété autofertile, un seul pied suffit). '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: forte, liane vigoureuse. '
   || 'Particularités: kiwi autofertile le plus productif. Pas besoin de mâle. Très bonne alternative à Hayward pour jardins familiaux.'
  ),

  ('Kiwi-Jenny',
   'Kiwi', 41, 3,
   'Origine: sélection horticole. Floraison: mai-juin. Récolte: mi-octobre à novembre. '
   || 'Rendement: 10-20 kg/pied. Fruit: petit à moyen (40-60 g), chair douce et juteuse. '
   || 'Conservation: moyenne (2-3 mois). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: moyenne, moins vigoureuse que Hayward. '
   || 'Particularités: autofertile avec fruits plus petits que Hayward. Convient pour petits jardins. Peut servir de pollinisateur.'
  ),

  ('Kiwi-Issai',
   'Kiwi', 36, 3,
   'Origine: Japon (Actinidia arguta, mini-kiwi ou kiwaï). Floraison: mai-juin. Récolte: septembre (précoce). '
   || 'Rendement: 5-15 kg/pied. Fruit: petit (taille grosse cerise, 3-5 g), peau lisse comestible, chair douce et très sucrée. '
   || 'Conservation: courte (1-2 semaines). Autofertile: oui. '
   || 'Résistance maladies: très bonne. Rusticité: -25°C (très rustique). '
   || 'Vigueur: forte, liane vigoureuse. '
   || 'Particularités: mini-kiwi (kiwaï) sans épluchage. Récolte bien plus précoce que le kiwi classique. Convient régions au nord de la Loire. Très rustique.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.10 GRENADIER (Punica granatum)
-- Rendement: kg/arbre/an (arbre adulte 8+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Grenadier-Wonderful',
   'Grenadier', 39, 4,
   'Origine: USA (Californie, variété la plus cultivée au monde). Floraison: juin-juillet (fleurs rouge-orangé, plusieurs vagues). Récolte: fin septembre à fin octobre. '
   || 'Rendement: 40-50 kg/arbre. Fruit: gros (Ø 120 mm), rouge profond, arilles rouge rubis, saveur équilibrée sucré-acide. '
   || 'Conservation: très bonne (2-3 mois au frigo). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: forte, arbre vigoureux jusqu''à 4-5 m. '
   || 'Particularités: variété de référence mondiale. Fruits précoces et réguliers. Excellent pour le jus. Meilleurs fruits des premières fleurs.'
  ),

  ('Grenadier-Mollar de Elche',
   'Grenadier', 40, 3,
   'Origine: Espagne (Elche, Alicante). Floraison: juin-juillet (fleurs orange foncé). Récolte: début octobre (maturité légèrement plus précoce que Wonderful). '
   || 'Rendement: 30-50 kg/arbre. Fruit: très gros, peau rouge-rosé, arilles roses à rouge clair, pépins très petits et souples, chair très sucrée. '
   || 'Conservation: bonne (2 mois au frigo). Autofertile: oui (rendement amélioré avec 2 arbres). '
   || 'Résistance maladies: bonne. Rusticité: -12°C. '
   || 'Vigueur: forte. '
   || 'Particularités: grenade de table par excellence. Pépins quasi imperceptibles. Saveur très douce. Adaptée climats méditerranéens à automnes doux.'
  ),

  ('Grenadier-Fina Tendral',
   'Grenadier', 41, 3,
   'Origine: Espagne (Murcia, variété de connaisseurs). Floraison: juin-juillet. Récolte: mi-octobre à début novembre. '
   || 'Rendement: 25-40 kg/arbre. Fruit: gros, peau épaisse jaune-rosé, arilles croquantes, saveur riche et très fruitée. '
   || 'Conservation: très bonne (peau épaisse protectrice, 3+ mois). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -10°C. '
   || 'Vigueur: moyenne à forte. '
   || 'Particularités: production régulière sous forte insolation. Peau épaisse = meilleure conservation. Variété tardive.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.11 PLAQUEMINIER / KAKI (Diospyros kaki)
-- Rendement: kg/arbre/an (arbre adulte 8+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Plaqueminier-Fuyu',
   'Plaqueminier', 43, 3,
   'NON ASTRINGENT (PCNA). Origine: Japon. Floraison: fin avril à mai. Récolte: fin octobre à novembre. '
   || 'Rendement: 30-60 kg/arbre. Fruit: moyen à gros, aplati, rouge-orangé brillant, chair ferme et sucrée, consommable dès la récolte. '
   || 'Conservation: bonne (2-3 semaines à température ambiante, 2 mois au frigo). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: moyenne, port étalé. '
   || 'Particularités: « kaki-pomme », se consomme ferme comme une pomme sans attendre le blettissement. Très productif.'
  ),

  ('Plaqueminier-Hachiya',
   'Plaqueminier', 43, 3,
   'ASTRINGENT. Origine: Japon (variété la plus cultivée au Japon). Floraison: mai-juin. Récolte: fin octobre à novembre. '
   || 'Rendement: 30-50 kg/arbre. Fruit: gros, conique (en cœur), rouge-orangé, chair molle et mielleuse à maturité. '
   || 'Conservation: longue après blettissement (congélation ou séchage excellent). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -15°C. '
   || 'Vigueur: forte, grand développement. '
   || 'Particularités: astringent → consommer uniquement blet (mou). Excellent séché (hoshigaki). Meilleure saveur mielleuse une fois blet.'
  ),

  ('Plaqueminier-Muscat',
   'Plaqueminier', 43, 3,
   'ASTRINGENT. Origine: ancienne variété européenne. Floraison: mai-juin. Récolte: fin octobre à novembre. '
   || 'Rendement: 25-40 kg/arbre. Fruit: gros, légèrement conique, rouge-orangé, chair miellée et parfumée au goût musqué caractéristique. '
   || 'Conservation: consommer blet. Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -18°C (une des plus rustiques). '
   || 'Vigueur: forte. '
   || 'Particularités: variété la plus répandue en France. Texture miellée à surmaturité. Goût musqué unique. Très rustique.'
  ),

  ('Plaqueminier-Rojo Brillante',
   'Plaqueminier', 44, 4,
   'ASTRINGENT (traitable au CO2 → non astringent = Persimon®). Origine: Espagne (Valence). Floraison: mai-juin. Récolte: début novembre à fin novembre. '
   || 'Rendement: 30-60 kg/arbre. Fruit: gros à très gros, ovale, rouge brillant intense, chair ferme et sucrée après traitement CO2. '
   || 'Conservation: très bonne après traitement (2-3 mois au frigo). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -12°C. '
   || 'Vigueur: forte, productif. '
   || 'Particularités: « Persimon® » (marque commerciale après traitement CO2). N°1 en Espagne. Se consomme ferme comme Fuyu après traitement. Très beau fruit.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.12 COGNASSIER (Cydonia oblonga)
-- Rendement: kg/arbre/an (arbre adulte 5+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Cognassier-Champion',
   'Cognassier', 41, 3,
   'Origine: USA (variété ancienne très répandue). Floraison: tardive (mai, fleurs rose clair). Récolte: mi-octobre à début novembre. '
   || 'Rendement: 20-40 kg/arbre. Fruit: très gros (~500 g), jaune vif, piriforme, chair ferme, très parfumé. '
   || 'Conservation: courte à moyenne (fin novembre, en fruitier frais). Autofertile: oui. '
   || 'Résistance maladies: bonne résistance générale, légère sensibilité à la tavelure en conditions humides. '
   || 'Vigueur: moyenne, petit arbre (3-4 m). '
   || 'Particularités: variété robuste et productive. Floraison tardive = protection gel. Excellente pour gelées, pâtes de fruits et cotignac.'
  ),

  ('Cognassier-Vranja',
   'Cognassier', 41, 3,
   'Origine: Serbie (aussi appelé Géant de Vranja ou Monstrueux de Vranja). Floraison: tardive (mai, fleurs rose clair). Récolte: mi-octobre. '
   || 'Rendement: 25-50 kg/arbre. Fruit: TRÈS gros (jusqu''à 1.5 kg!), allongé/piriforme, peau jaune d''or, chair jaune clair, doux et très parfumé. '
   || 'Conservation: moyenne (quelques semaines en fruitier). Autofertile: oui. '
   || 'Résistance maladies: très bonne résistance naturelle aux maladies. Rusticité: -20°C. '
   || 'Vigueur: forte, arbre vigoureux et productif. '
   || 'Particularités: les plus gros coings existants. Variété patrimoniale serbe d''une grande robustesse. Très décoratif au jardin.'
  ),

  ('Cognassier-Géant de Leskovac',
   'Cognassier', 42, 3,
   'Origine: Balkans (Leskovac, Serbie). Floraison: tardive (mai). Récolte: mi-octobre à fin octobre. '
   || 'Rendement: 20-40 kg/arbre. Fruit: très gros, piriforme, jaune, chair ferme, TRÈS parfumé (parmi les plus parfumés). '
   || 'Conservation: bonne. Autofertile: oui. '
   || 'Résistance maladies: bonne. Très rustique (climats frais). '
   || 'Vigueur: forte. '
   || 'Particularités: réputé pour le parfum exceptionnel de ses fruits. Origine balkanique, idéal pour les climates plus frais. Bonne productivité.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.13 NÉFLIER (Mespilus germanica)
-- Rendement: kg/arbre/an (arbre adulte 6+ ans)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Néflier-Nottingham',
   'Néflier', 43, 3,
   'Origine: Angleterre. Floraison: mai (grandes fleurs blanches en coupe). Récolte: fin octobre à novembre (après premières gelées). '
   || 'Rendement: 15-30 kg/arbre. Fruit: petit (~4 cm Ø), mais excellente saveur, chair brune et fondante après blettissement. '
   || 'Conservation: par blettissement (3-4 semaines sur paille, puis consommation). Autofertile: oui. '
   || 'Résistance maladies: très bonne. Très rustique (-20°C). '
   || 'Vigueur: moyenne, port érigé, petit arbre ou grand arbuste (3-5 m). '
   || 'Particularités: RHS Award of Garden Merit. Meilleur goût parmi les néfliers. Petit fruit compensé par la qualité. Arbre ornemental.'
  ),

  ('Néflier-Royal',
   'Néflier', 43, 3,
   'Origine: sélection européenne. Floraison: mai (fleurs blanches). Récolte: fin octobre à novembre. '
   || 'Rendement: 30-50 kg/arbre (le plus productif). Fruit: moyen à gros, bonne saveur après blettissement. '
   || 'Conservation: par blettissement (3-4 semaines). Autofertile: oui. '
   || 'Résistance maladies: bonne. Très rustique (-20°C). '
   || 'Vigueur: forte, port étalé. '
   || 'Particularités: variété la plus productive. Bon équilibre entre rendement et qualité. Rendement très élevé pour un néflier.'
  ),

  ('Néflier-Dutch',
   'Néflier', 43, 3,
   'Origine: Pays-Bas (aussi appelé Giant ou Monstrous). Floraison: mai (fleurs blanches). Récolte: fin octobre à novembre. '
   || 'Rendement: 20-40 kg/arbre. Fruit: GROS (le plus gros des néfliers, 5-6 cm Ø), chair fondante après blettissement. '
   || 'Conservation: par blettissement (3-4 semaines). Autofertile: oui. '
   || 'Résistance maladies: bonne. Très rustique (-20°C). '
   || 'Vigueur: forte, port étalé, arbre plus grand (4-6 m). '
   || 'Particularités: les plus gros fruits parmi les néfliers. Bonne productivité. Idéal si on veut de gros fruits pour compotes et confitures.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.14 CITRONNIER (Citrus limon)
-- Rendement: kg/arbre/an (arbre adulte 5+ ans, en pleine terre climat doux)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Citronnier-Quatre Saisons',
   'Citronnier', 40, 20,
   'Aussi appelé Eureka. Origine: Californie (1858, variété la plus cultivée au monde). Floraison: quasi permanente (3-4 floraisons/an, principale au printemps). Récolte: toute l''année, principale automne-hiver. '
   || 'Rendement: 30-100 kg/arbre. Fruit: moyen à gros, ovale, jaune, zeste très parfumé, jus abondant (rendement jus 40-45%). '
   || 'Conservation: excellente (fruits restent longtemps sur l''arbre). Autofertile: oui. '
   || 'Résistance maladies: moyenne, sensible aux cochenilles et à la gommose. Rusticité: -4°C (perd ses feuilles à -2°C). '
   || 'Vigueur: faible à moyenne, petit arbre (2-3 m). '
   || 'Particularités: le citronnier le plus cultivé au monde. Production étalée toute l''année. Culture possible en pot (rentrée hors gel). Floraison remontante très odorante.'
  ),

  ('Citronnier-Meyer',
   'Citronnier', 28, 20,
   'Origine: Chine (hybride probable Citrus limon × Citrus sinensis, importé par F. Meyer en 1908). Floraison: 2-4 fois/an (printemps et automne principaux). Récolte: 1ère en juillet, 2nde octobre-décembre. '
   || 'Rendement: 20-50 kg/arbre. Fruit: gros, rond, peau lisse et fine, jaune vif à orangée à maturité, pulpe orange, goût plus doux et moins acide. '
   || 'Conservation: bonne. Autofertile: oui. '
   || 'Résistance maladies: bonne résistance aux maladies et parasites (meilleure que Eureka). Rusticité: -7°C (la plus rustique des citronniers). '
   || 'Vigueur: moyenne. '
   || 'Particularités: le citronnier le plus rustique. Hybride naturel citron-orange. Goût plus doux, très apprécié en cuisine. Idéal pour les régions moins clémentes.'
  ),

  ('Citronnier-Eureka',
   'Citronnier', 40, 20,
   'Identique à Quatre Saisons (même variété, noms différents). Origine: Californie (1858). Floraison: quasi permanente. Récolte: étalée toute l''année. '
   || 'Rendement: 30-100 kg/arbre. Fruit: ovale, jaune, classique, très juteux, acidité marquée. '
   || 'Conservation: excellente (sur l''arbre ou au frais). Autofertile: oui. '
   || 'Résistance maladies: moyenne. Rusticité: -4°C. '
   || 'Vigueur: faible à moyenne. '
   || 'Particularités: synonyme de « Quatre Saisons ». Le citron standard du commerce mondial. Aussi appelé Garey''s Eureka ou Citron de Menton.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ----------------------------------------------------------
-- 3.15 ORANGER (Citrus sinensis)
-- Rendement: kg/arbre/an (arbre adulte 5+ ans, en pleine terre climat doux)
-- ----------------------------------------------------------

INSERT INTO varietes (variete, espece, s_recolte, d_recolte, description)
VALUES
  ('Oranger-Washington Navel',
   'Oranger', 49, 14,
   'Origine: Brésil puis USA (la plus courante des navelines). Floraison: printemps (avril-mai, fleurs blanches très parfumées). Récolte: décembre à mars. '
   || 'Rendement: 40-80 kg/arbre. Fruit: gros, sans pépins, peau épaisse facile à peler, chair juteuse et sucrée, nombril (navel) caractéristique. '
   || 'Conservation: bonne (2-3 mois au frais). Autofertile: oui. '
   || 'Résistance maladies: moyenne. Rusticité: -5°C. '
   || 'Vigueur: forte, arbre vigoureux et très productif. '
   || 'Particularités: orange de table N°1 mondiale. Sans pépins. Se pèle facilement. Excellent à manger frais. Variété la plus courante en pépinière.'
  ),

  ('Oranger-Valencia Late',
   'Oranger', 8, 12,
   'Origine: Espagne puis Californie (orange à jus de référence). Floraison: printemps (avril-mai). Récolte: février à juin (très tardive). '
   || 'Rendement: 50-100 kg/arbre. Fruit: moyen, sans pépins, peau fine, très juteux, sucré et parfumé, excellent pour le jus. '
   || 'Conservation: très bonne (reste longtemps sur l''arbre sans se dégrader). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -5°C. '
   || 'Vigueur: forte, croissance rapide, très productif. '
   || 'Particularités: variété la plus tardive = récolte quand les autres sont finies. Orange à jus de référence mondiale. Fruits et fleurs coexistent sur l''arbre.'
  ),

  ('Oranger-Sanguinelli',
   'Oranger', 5, 8,
   'Origine: Espagne (Murcia). Floraison: printemps (avril-mai). Récolte: février à avril (tardive). '
   || 'Rendement: 40-70 kg/arbre. Fruit: moyen, peau orange veinée de rouge, chair orange veinée de rouge sang, jus doux et très parfumé. '
   || 'Conservation: bonne (1-2 mois au frais). Autofertile: oui. '
   || 'Résistance maladies: bonne. Rusticité: -5°C. '
   || 'Vigueur: forte, arbre vigoureux non épineux. '
   || 'Particularités: orange sanguine à jus coloré exceptionnel. Très riche en anthocyanes (antioxydants). Coloration accentuée par les écarts thermiques jour/nuit.'
  )
ON CONFLICT (variete) DO UPDATE SET
  espece = EXCLUDED.espece,
  s_recolte = EXCLUDED.s_recolte,
  d_recolte = EXCLUDED.d_recolte,
  description = EXCLUDED.description;


-- ============================================================
-- RÉSUMÉ : 15 espèces, 56 variétés
-- ============================================================
-- Framboisier:    6 variétés (Meeker, Heritage, Tulameen, Autumn Bliss, Maravilla, Glen Ample)
-- Groseillier:    4 variétés (Jonkheer van Tets, Rovada, Versaillaise rouge, Blanka)
-- Cassissier:     4 variétés (Noir de Bourgogne, Andega, Titania, Big Ben)
-- Mûrier:         4 variétés (Thornfree, Loch Ness, Triple Crown, Dirksen)
-- Olivier:        6 variétés (Aglandau, Bouteillan, Picholine, Lucques, Tanche, Arbequina)
-- Figuier:        6 variétés (Violette de Solliès, Goutte d'Or, Ronde de Bordeaux, Dauphine, Brown Turkey, Pastilière)
-- Noyer:          5 variétés (Franquette, Lara, Fernor, Parisienne, Mayette)
-- Châtaignier:    4 variétés (Marigoule, Bouche de Bétizac, Comballe, Belle Épine)
-- Kiwi:           4 variétés (Hayward, Solissimo, Jenny, Issai)
-- Grenadier:      3 variétés (Wonderful, Mollar de Elche, Fina Tendral)
-- Plaqueminier:   4 variétés (Fuyu, Hachiya, Muscat, Rojo Brillante)
-- Cognassier:     3 variétés (Champion, Vranja, Géant de Leskovac)
-- Néflier:        3 variétés (Nottingham, Royal, Dutch)
-- Citronnier:     3 variétés (Quatre Saisons, Meyer, Eureka)
-- Oranger:        3 variétés (Washington Navel, Valencia Late, Sanguinelli)
