-- ============================================================
-- Gleba Demo Data Enrichment Script
-- Enrichit le compte demo@gleba.fr avec verger, élevage, compta
-- Run: docker compose exec -T db psql -U gleba -d gleba < prisma/seed-demo-enriched.sql
-- ============================================================

DO $$
DECLARE
  uid TEXT;
  -- Parcelle IDs
  parc_maraichage TEXT; parc_elevage TEXT;
  -- Planche IDs
  pid_a TEXT; pid_b TEXT; pid_serre TEXT;
  pid_c TEXT; pid_d TEXT; pid_e TEXT; pid_tunnel TEXT; pid_aroma TEXT;
  -- Zone verger IDs
  zid_principal INT; zid_sud INT; zid_petits INT;
  -- Arbre IDs
  a_pg INT; a_rdr INT; a_gs INT;
  a_conf INT; a_will INT;
  a_burl INT; a_nap INT;
  a_rc INT; a_berg INT; a_fig INT; a_noyer INT;
  a_fr1 INT; a_fr2 INT; a_cass INT; a_gros INT;
  -- Lot IDs
  lid_pond INT; lid_poulet INT; lid_lapin INT;
  -- Animal IDs
  ani1 INT; ani2 INT; ani3 INT; ani4 INT; ani5 INT; ani6 INT;
  ani7 INT; ani8 INT; ani9 INT; ani10 INT; ani11 INT; ani12 INT;
  -- Client IDs
  cid1 INT; cid2 INT; cid3 INT; cid4 INT; cid5 INT; cid6 INT;
  -- Facture IDs
  fid1 INT; fid2 INT; fid3 INT; fid4 INT; fid5 INT;
  -- Culture ID (réutilisé)
  clt INT;
BEGIN
  SELECT id INTO uid FROM users WHERE email = 'demo@gleba.fr';
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Run main seed first.';
  END IF;
  RAISE NOTICE 'Demo user ID: %', uid;

  -- ==========================================================
  -- CLEANUP
  -- ==========================================================
  DELETE FROM pollinisation_arbres WHERE arbre_pollinise_id IN (SELECT id FROM arbres WHERE user_id = uid);
  DELETE FROM observations_sante WHERE user_id = uid;
  DELETE FROM operations_arbres WHERE user_id = uid;
  DELETE FROM recoltes_arbres WHERE user_id = uid;
  DELETE FROM production_bois WHERE user_id = uid;
  DELETE FROM arbres WHERE user_id = uid;
  DELETE FROM zones_verger WHERE user_id = uid;
  DELETE FROM production_oeufs WHERE user_id = uid;
  DELETE FROM ventes_produits WHERE user_id = uid;
  DELETE FROM abattages WHERE user_id = uid;
  DELETE FROM consommations_aliments WHERE user_id = uid;
  DELETE FROM soins_animaux WHERE user_id = uid;
  DELETE FROM naissances_animales WHERE user_id = uid;
  DELETE FROM animaux WHERE user_id = uid;
  DELETE FROM lots_animaux WHERE user_id = uid;
  DELETE FROM lignes_factures WHERE facture_id IN (SELECT id FROM factures WHERE user_id = uid);
  DELETE FROM factures WHERE user_id = uid;
  DELETE FROM ventes_manuelles WHERE user_id = uid;
  DELETE FROM depenses_manuelles WHERE user_id = uid;
  DELETE FROM clients WHERE user_id = uid;
  DELETE FROM interventions WHERE user_id = uid;
  DELETE FROM fertilisations WHERE user_id = uid;
  DELETE FROM recoltes WHERE user_id = uid;
  DELETE FROM cultures WHERE user_id = uid;
  -- Reset parcelle_geo_id sur planches/objets avant suppression parcelles
  UPDATE planches SET parcelle_geo_id = NULL WHERE user_id = uid;
  UPDATE objets_jardin SET parcelle_geo_id = NULL WHERE user_id = uid;
  DELETE FROM parcelles_geo WHERE user_id = uid;
  RAISE NOTICE 'Cleanup done';

  -- ==========================================================
  -- REFERENCE DATA
  -- ==========================================================
  INSERT INTO especes (espece, type, famille, rendement, vivace, besoin_n, besoin_eau, couleur)
  VALUES
    ('Cerisier', 'arbre_fruitier', 'Rosacées', 15, true, 2, 3, '#e74c3c'),
    ('Abricotier', 'arbre_fruitier', 'Rosacées', 20, true, 2, 2, '#f39c12'),
    ('Figuier', 'arbre_fruitier', NULL, 15, true, 2, 2, '#8e44ad'),
    ('Noyer', 'arbre_fruitier', NULL, 25, true, 2, 2, '#795548'),
    ('Cassissier', 'petit_fruit', NULL, 3, true, 2, 3, '#2c3e50'),
    ('Groseillier', 'petit_fruit', NULL, 3, true, 2, 3, '#e74c3c')
  ON CONFLICT (espece) DO NOTHING;

  INSERT INTO especes_animales (espece_animale, nom, type, production, duree_couvaison, duree_elevage, poids_adulte, rendement_carcasse, ponte_annuelle, conso_jour, prix_achat, couleur, description)
  VALUES
    ('poule_pondeuse', 'Poule pondeuse', 'volaille', 'oeufs', 21, 150, 2.5, NULL, 280, 0.12, 15, '#d4a017', 'Poule pondeuse rousse'),
    ('poulet_chair', 'Poulet de chair', 'volaille', 'viande', 21, 90, 3.5, 70, NULL, 0.15, 5, '#d4a574', 'Poulet fermier label'),
    ('canard_barbarie', 'Canard de Barbarie', 'volaille', 'viande', 35, 120, 4.5, 65, NULL, 0.18, 8, '#5d4037', 'Canard rustique'),
    ('lapin_chair', 'Lapin de chair', 'mammifere_petit', 'viande', NULL, 90, 4, 55, NULL, 0.15, 12, '#8d6e63', 'Lapin fermier'),
    ('chevre_laitiere', 'Chèvre laitière', 'mammifere_grand', 'lait', NULL, 365, 55, NULL, NULL, 2.0, 250, '#f5f5dc', 'Chèvre Alpine'),
    ('mouton_viande', 'Mouton', 'mammifere_grand', 'viande', NULL, 180, 80, 45, NULL, 2.5, 200, '#e0e0e0', 'Mouton Suffolk')
  ON CONFLICT (espece_animale) DO NOTHING;
  UPDATE especes_animales SET duree_gestation = 31 WHERE espece_animale = 'lapin_chair' AND duree_gestation IS NULL;
  UPDATE especes_animales SET duree_gestation = 150 WHERE espece_animale = 'chevre_laitiere' AND duree_gestation IS NULL;
  UPDATE especes_animales SET duree_gestation = 152 WHERE espece_animale = 'mouton_viande' AND duree_gestation IS NULL;

  INSERT INTO aliments (aliment, nom, type, especes_cibles, proteines, energie, prix, description)
  VALUES
    ('granules_pondeuses', 'Granulés pondeuses', 'granules', 'volaille', 16.5, 2700, 0.45, 'Aliment complet pondeuses'),
    ('ble_entier', 'Blé entier', 'cereales', 'volaille', 11.5, 3100, 0.30, 'Complément céréales'),
    ('mais_concasse', 'Maïs concassé', 'cereales', 'volaille', 8.5, 3350, 0.35, 'Énergie rapide'),
    ('granules_lapin', 'Granulés lapin', 'granules', 'lapin', 15, 2500, 0.55, 'Aliment complet lapin'),
    ('foin_prairie', 'Foin de prairie', 'foin', 'lapin,chevre,mouton', 8, 1800, 0.15, 'Foin naturel'),
    ('granules_chevre', 'Granulés chèvre', 'granules', 'chevre', 18, 2800, 0.50, 'Aliment chèvre lactation'),
    ('complement_mineral', 'Complément minéral', 'complement', 'chevre,mouton', NULL, NULL, 1.20, 'Pierre à lécher + CMV')
  ON CONFLICT (aliment) DO NOTHING;

  INSERT INTO fournisseurs (fournisseur, contact, type, notes, actif)
  VALUES
    ('Couvoir du Moulin', 'SARL', 'animaux', 'Poussins et volailles', true),
    ('Moulin de Provence', 'Coopérative', 'aliments', 'Aliments bio animaux', true),
    ('Pépinière du Verger', 'EARL', 'mixte', 'Arbres fruitiers', true)
  ON CONFLICT (fournisseur) DO NOTHING;
  RAISE NOTICE 'Reference data done';

  -- ==========================================================
  -- PARCELLES
  -- ==========================================================
  INSERT INTO parcelles_geo (id, nom, user_id, geometry, centroid_lat, centroid_lng, surface_ha, usage, couleur, notes, created_at, updated_at)
  VALUES (
    'dmo_parc_mar_' || substr(md5(uid), 1, 10),
    'Potager',
    uid,
    '{"type":"Polygon","coordinates":[[[2.3510,48.8560],[2.3530,48.8560],[2.3530,48.8575],[2.3510,48.8575],[2.3510,48.8560]]]}',
    48.85675, 2.3520, 0.12, 'culture, verger', '#4ade80', 'Parcelle maraîchage - planches, serres et arbres', now(), now()
  );
  SELECT id INTO parc_maraichage FROM parcelles_geo WHERE nom='Potager' AND user_id=uid;

  INSERT INTO parcelles_geo (id, nom, user_id, geometry, centroid_lat, centroid_lng, surface_ha, usage, couleur, notes, created_at, updated_at)
  VALUES (
    'dmo_parc_elv_' || substr(md5(uid), 1, 10),
    'Prairie',
    uid,
    '{"type":"Polygon","coordinates":[[[2.3570,48.8560],[2.3590,48.8560],[2.3590,48.8575],[2.3570,48.8575],[2.3570,48.8560]]]}',
    48.85675, 2.3580, 0.15, 'prairie', '#a78bfa', 'Parcelle élevage - pâturage et enclos', now(), now()
  );
  SELECT id INTO parc_elevage FROM parcelles_geo WHERE nom='Prairie' AND user_id=uid;

  RAISE NOTICE 'Parcelles done: %, %', parc_maraichage, parc_elevage;

  -- ==========================================================
  -- PLANCHES
  -- ==========================================================
  INSERT INTO planches (id, nom, user_id, largeur, longueur, surface, ilot, type, irrigation, type_sol, retention_eau, pos_x, pos_y, notes)
  VALUES
    ('dmo_a_' || substr(md5(uid), 1, 16), 'Demo-A', uid, 1.2, 10, 12, 'Maraîchage', 'Plein champ', 'Goutte-à-goutte', 'Limoneux', 'Moyenne', 0, 0, 'Planche principale'),
    ('dmo_b_' || substr(md5(uid), 2, 16), 'Demo-B', uid, 0.8, 8, 6.4, 'Maraîchage', 'Plein champ', 'Manuel', 'Sableux', 'Faible', 1.5, 0, 'Racines'),
    ('dmo_s_' || substr(md5(uid), 3, 16), 'Serre-Demo', uid, 1.0, 6, 6, 'Serre', 'Serre', 'Goutte-à-goutte', 'Mixte', 'Moyenne', 0, 11, 'Serre tunnel semis'),
    ('dmo_c_' || substr(md5(uid), 4, 16), 'Demo-C', uid, 1.2, 8, 9.6, 'Maraîchage', 'Plein champ', 'Manuel', 'Limoneux', 'Moyenne', 3.0, 0, 'Légumineuses'),
    ('dmo_d_' || substr(md5(uid), 5, 16), 'Demo-D', uid, 2.0, 6, 12, 'Maraîchage', 'Plein champ', 'Goutte-à-goutte', 'Limoneux', 'Moyenne', 4.5, 0, 'Courges'),
    ('dmo_e_' || substr(md5(uid), 6, 16), 'Demo-E', uid, 1.0, 10, 10, 'Maraîchage', 'Plein champ', 'Manuel', 'Sableux', 'Faible', 0, 13, 'Alliacées'),
    ('dmo_t_' || substr(md5(uid), 7, 16), 'Tunnel-Demo', uid, 1.5, 8, 12, 'Serre', 'Tunnel', 'Goutte-à-goutte', 'Mixte', 'Moyenne', 1.5, 11, 'Tunnel solanacées'),
    ('dmo_r_' || substr(md5(uid), 8, 16), 'Aromatiques', uid, 1.0, 3, 3, 'Maraîchage', 'Plein champ', 'Manuel', 'Sableux', 'Faible', 7, 0, 'Aromatiques')
  ON CONFLICT (nom, user_id) DO NOTHING;

  SELECT id INTO pid_a FROM planches WHERE nom='Demo-A' AND user_id=uid;
  SELECT id INTO pid_b FROM planches WHERE nom='Demo-B' AND user_id=uid;
  SELECT id INTO pid_serre FROM planches WHERE nom='Serre-Demo' AND user_id=uid;
  SELECT id INTO pid_c FROM planches WHERE nom='Demo-C' AND user_id=uid;
  SELECT id INTO pid_d FROM planches WHERE nom='Demo-D' AND user_id=uid;
  SELECT id INTO pid_e FROM planches WHERE nom='Demo-E' AND user_id=uid;
  SELECT id INTO pid_tunnel FROM planches WHERE nom='Tunnel-Demo' AND user_id=uid;
  SELECT id INTO pid_aroma FROM planches WHERE nom='Aromatiques' AND user_id=uid;

  -- Assigner toutes les planches à la parcelle maraîchage
  UPDATE planches SET parcelle_geo_id = parc_maraichage WHERE user_id = uid AND parcelle_geo_id IS NULL;
  RAISE NOTICE 'Planches done';

  -- ==========================================================
  -- CULTURES 2025 (terminées) + RÉCOLTES
  -- ==========================================================

  -- Tomate Coeur de Boeuf 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Tomate', 'Tomate-Coeur de Boeuf', 'ITP-Tomate-printemps', pid_a, 2025, '2025-02-20', '2025-05-05', '2025-07-12', true, true, true, 'x', 2, 5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Tomate',clt,'2025-07-12',2.8),(uid,'Tomate',clt,'2025-07-22',4.5),
    (uid,'Tomate',clt,'2025-08-02',6.2),(uid,'Tomate',clt,'2025-08-15',5.8),
    (uid,'Tomate',clt,'2025-08-28',3.2);

  -- Tomate Cerise 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Tomate', 'Tomate-Cerise rouge', 'ITP-Tomate-printemps', pid_a, 2025, '2025-02-20', '2025-05-05', '2025-07-10', true, true, true, 'x', 2, 5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Tomate',clt,'2025-07-10',1.2),(uid,'Tomate',clt,'2025-07-20',2.1),
    (uid,'Tomate',clt,'2025-07-30',2.8),(uid,'Tomate',clt,'2025-08-10',3.2),
    (uid,'Tomate',clt,'2025-08-20',2.5),(uid,'Tomate',clt,'2025-09-01',1.5);

  -- Tomate Noire de Crimée 2025 (tunnel)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Tomate', 'Tomate-Noire de Crimée', 'ITP-Tomate-printemps', pid_tunnel, 2025, '2025-02-18', '2025-05-01', '2025-07-15', true, true, true, 'x', 2, 8, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Tomate',clt,'2025-07-15',3.0),(uid,'Tomate',clt,'2025-07-28',4.8),
    (uid,'Tomate',clt,'2025-08-08',5.5),(uid,'Tomate',clt,'2025-08-22',4.2),
    (uid,'Tomate',clt,'2025-09-05',2.8);

  -- Courgette 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Courgette', 'Courgette-Verte de Milan', 'ITP-Courgette', pid_d, 2025, '2025-04-15', '2025-05-20', '2025-07-01', true, true, true, 'x', 1, 6, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Courgette',clt,'2025-07-01',3.2),(uid,'Courgette',clt,'2025-07-10',4.8),
    (uid,'Courgette',clt,'2025-07-20',6.1),(uid,'Courgette',clt,'2025-07-30',5.5),
    (uid,'Courgette',clt,'2025-08-10',4.2),(uid,'Courgette',clt,'2025-08-20',2.5);

  -- Carotte printemps 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Carotte', 'Carotte-Nantaise', 'ITP-Carotte-printemps', pid_b, 2025, '2025-03-18', '2025-07-01', true, true, 'x', 5, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Carotte',clt,'2025-07-01',8.5),(uid,'Carotte',clt,'2025-07-15',6.2);

  -- Carotte automne 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Carotte', 'Carotte-Touchon', 'ITP-Carotte-automne', pid_b, 2025, '2025-06-10', '2025-10-05', true, true, 'x', 5, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Carotte',clt,'2025-10-05',7.8),(uid,'Carotte',clt,'2025-10-20',5.5);

  -- Poivron 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Poivron', 'Poivron-Corno di Toro', 'ITP-Poivron', pid_serre, 2025, '2025-02-05', '2025-05-15', '2025-07-25', true, true, true, 'x', 2, 6, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Poivron',clt,'2025-07-25',1.5),(uid,'Poivron',clt,'2025-08-08',2.8),
    (uid,'Poivron',clt,'2025-08-22',3.2),(uid,'Poivron',clt,'2025-09-05',1.8);

  -- Aubergine 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Aubergine', 'Aubergine-Violette longue', 'ITP-Aubergine', pid_tunnel, 2025, '2025-02-05', '2025-05-15', '2025-07-10', true, true, true, 'x', 2, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Aubergine',clt,'2025-07-10',2.2),(uid,'Aubergine',clt,'2025-07-25',3.5),
    (uid,'Aubergine',clt,'2025-08-08',4.0),(uid,'Aubergine',clt,'2025-08-22',2.8);

  -- Haricot vert 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Haricot vert', 'Haricot-Contender', 'ITP-Haricot-vert', pid_c, 2025, '2025-05-05', '2025-07-15', true, true, 'x', 4, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Haricot vert',clt,'2025-07-15',1.8),(uid,'Haricot vert',clt,'2025-07-22',2.5),
    (uid,'Haricot vert',clt,'2025-07-30',2.2),(uid,'Haricot vert',clt,'2025-08-06',1.5);

  -- Petit pois 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Petit pois', 'Petit pois-Merveille de Kelvedon', 'ITP-Petit-pois', pid_c, 2025, '2025-03-08', '2025-06-02', true, true, 'x', 3, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Petit pois',clt,'2025-06-02',1.5),(uid,'Petit pois',clt,'2025-06-10',2.0),
    (uid,'Petit pois',clt,'2025-06-18',1.2);

  -- Courge butternut 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Courge butternut', 'Courge butternut-Waltham', 'ITP-Butternut', pid_d, 2025, '2025-04-18', '2025-05-28', '2025-09-22', true, true, true, 'x', 1, 6, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Courge butternut',clt,'2025-09-22',28.5);

  -- Oignon 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Oignon', 'Oignon-Jaune Paille des Vertus', 'ITP-Oignon', pid_e, 2025, '2025-02-20', '2025-04-15', '2025-08-10', true, true, true, 'x', 5, 5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Oignon',clt,'2025-08-10',15.5);

  -- Poireau 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Poireau', 'Poireau-Bleu de Solaise', 'ITP-Poireau', pid_e, 2025, '2025-02-20', '2025-06-01', '2025-10-05', true, true, true, 'x', 4, 5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Poireau',clt,'2025-10-05',3.8),(uid,'Poireau',clt,'2025-10-22',3.5),
    (uid,'Poireau',clt,'2025-11-10',3.2);

  -- Laitue printemps 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Laitue', 'Laitue-Batavia', 'ITP-Laitue-printemps', pid_a, 2025, '2025-02-22', '2025-04-08', '2025-05-22', true, true, true, 'x', 5, 3, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Laitue',clt,'2025-05-22',1.5),(uid,'Laitue',clt,'2025-05-29',1.8);

  -- Laitue été 2025
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Laitue', 'Laitue-Feuille de chêne', 'ITP-Laitue-ete', pid_a, 2025, '2025-05-18', '2025-06-18', '2025-07-28', true, true, true, 'x', 5, 3, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Laitue',clt,'2025-07-28',1.8),(uid,'Laitue',clt,'2025-08-05',1.5);

  -- Basilic 2025
  INSERT INTO cultures (user_id, espece, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Basilic', pid_aroma, 2025, '2025-04-15', '2025-05-20', '2025-06-20', true, true, true, 'x', 3, 1.5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Basilic',clt,'2025-06-20',0.3),(uid,'Basilic',clt,'2025-07-10',0.4),
    (uid,'Basilic',clt,'2025-08-01',0.4),(uid,'Basilic',clt,'2025-08-25',0.3);

  -- Persil 2025
  INSERT INTO cultures (user_id, espece, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Persil', pid_aroma, 2025, '2025-03-15', '2025-05-20', true, true, 'x', 3, 1.5, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Persil',clt,'2025-05-20',0.2),(uid,'Persil',clt,'2025-06-15',0.3),
    (uid,'Persil',clt,'2025-07-15',0.3),(uid,'Persil',clt,'2025-08-15',0.2);

  -- Épinard 2025
  INSERT INTO cultures (user_id, espece, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Épinard', 'ITP-Epinard', pid_b, 2025, '2025-03-10', '2025-05-10', true, true, 'x', 5, 4, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Épinard',clt,'2025-05-10',1.2),(uid,'Épinard',clt,'2025-05-20',1.5);

  -- Fraise 2025
  INSERT INTO cultures (user_id, espece, variete, planche, annee, date_recolte, recolte_faite, terminee, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Fraise', 'Fraise-Mara des Bois', pid_a, 2025, '2025-05-18', true, 'v', 3, 2, now())
  RETURNING id INTO clt;
  INSERT INTO recoltes (user_id, espece, culture, date, quantite) VALUES
    (uid,'Fraise',clt,'2025-05-18',0.8),(uid,'Fraise',clt,'2025-05-28',1.2),
    (uid,'Fraise',clt,'2025-06-08',1.5),(uid,'Fraise',clt,'2025-06-20',1.0),
    (uid,'Fraise',clt,'2025-08-10',0.5);

  RAISE NOTICE 'Cultures 2025 + recoltes done';

  -- ==========================================================
  -- CULTURES 2026 (en cours / planifiées)
  -- ==========================================================

  -- Tomate Marmande 2026 (semis fait, plantation prévue)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Tomate', 'Tomate-Marmande', 'ITP-Tomate-printemps', pid_serre, 2026, '2026-02-15', '2026-05-01', '2026-07-15', true, false, false, true, 2, 6, now());

  -- Tomate Cerise 2026 (semis fait)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Tomate', 'Tomate-Cerise rouge', 'ITP-Tomate-tardive', pid_tunnel, 2026, '2026-02-15', '2026-05-15', '2026-08-01', true, false, false, true, 2, 4, now());

  -- Laitue serre 2026 (en cours, plantation faite)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Laitue', 'Laitue-Batavia', 'ITP-Laitue-printemps', pid_a, 2026, '2026-01-20', '2026-02-10', '2026-03-25', true, true, false, true, 5, 3, now());

  -- Carotte 2026 (planifié)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Carotte', 'Carotte-Nantaise', 'ITP-Carotte-printemps', pid_b, 2026, '2026-03-15', '2026-07-01', false, false, true, 5, 4, now());

  -- Petit pois 2026 (semis fait)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Petit pois', 'Petit pois-Merveille de Kelvedon', 'ITP-Petit-pois', pid_c, 2026, '2026-02-10', '2026-06-01', true, false, 3, 4, now());

  -- Épinard 2026 (semis fait, en cours)
  INSERT INTO cultures (user_id, espece, it_plante, planche, annee, date_semis, date_recolte, semis_fait, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Épinard', 'ITP-Epinard', pid_e, 2026, '2026-02-01', '2026-04-15', true, false, true, 5, 5, now());

  -- Oignon 2026 (semis fait)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Oignon', 'Oignon-Jaune Paille des Vertus', 'ITP-Oignon', pid_e, 2026, '2026-02-10', '2026-04-15', '2026-08-10', true, false, false, 5, 5, now());

  -- Poivron 2026 (semis pépinière)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, a_irriguer, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Poivron', 'Poivron-Corno di Toro', 'ITP-Poivron', pid_serre, 2026, '2026-02-01', '2026-05-15', '2026-07-25', true, false, false, true, 2, 3, now());

  -- Courge butternut 2026 (planifié)
  INSERT INTO cultures (user_id, espece, variete, it_plante, planche, annee, date_semis, date_plantation, date_recolte, semis_fait, plantation_faite, recolte_faite, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Courge butternut', 'Courge butternut-Waltham', 'ITP-Butternut', pid_d, 2026, '2026-04-15', '2026-05-25', '2026-09-20', false, false, false, 1, 6, now());

  -- Basilic 2026 (planifié)
  INSERT INTO cultures (user_id, espece, planche, annee, date_semis, date_plantation, semis_fait, plantation_faite, recolte_faite, nb_rangs, longueur, updated_at)
  VALUES (uid, 'Basilic', pid_aroma, 2026, '2026-04-15', '2026-05-20', false, false, false, 3, 1.5, now());

  RAISE NOTICE 'Cultures 2026 done';

  -- ==========================================================
  -- VERGER - ZONES
  -- ==========================================================
  INSERT INTO zones_verger (user_id, nom, type, surface, exposition, altitude, protection_vent, type_sol, irrigation, notes)
  VALUES (uid, 'Verger principal', 'verger', 400, 'sud', 250, 'haie', 'Limoneux', 'goutte_a_goutte', 'Pommiers et poiriers, terrain légèrement pentu')
  RETURNING id INTO zid_principal;

  INSERT INTO zones_verger (user_id, nom, type, surface, exposition, type_sol, irrigation, notes)
  VALUES (uid, 'Verger sud', 'verger', 200, 'sud', 'Sableux', 'aucune', 'Cerisiers, prunier, abricotier - zone chaude')
  RETURNING id INTO zid_sud;

  INSERT INTO zones_verger (user_id, nom, type, surface, exposition, type_sol, irrigation, notes)
  VALUES (uid, 'Haie fruitière', 'haie', 60, 'est', 'Limoneux', 'aucune', 'Petits fruits en bordure')
  RETURNING id INTO zid_petits;

  -- ==========================================================
  -- VERGER - ARBRES
  -- ==========================================================
  INSERT INTO arbres (user_id, nom, type, espece, variete, port_greffe, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Pommier Golden', 'fruitier', 'Pommier', 'Golden Delicious', 'M9', '2020-11-15', 16, 2, 3, 2.5, 'bon', 'gobelet', 'moyenne', true, 2022, 25, 'moyenne', false, 'septembre', 'longue', zid_principal, now())
  RETURNING id INTO a_pg;

  INSERT INTO arbres (user_id, nom, type, espece, variete, port_greffe, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, pollinisateur, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Pommier Reine des Reinettes', 'fruitier', 'Pommier', 'Reine des Reinettes', 'M9', '2020-11-15', 16, 6, 3, 2.8, 'excellent', 'gobelet', 'moyenne', true, 2022, 30, 'moyenne', false, 'Golden Delicious', 'septembre', 'moyenne', zid_principal, now())
  RETURNING id INTO a_rdr;

  INSERT INTO arbres (user_id, nom, type, espece, variete, port_greffe, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Pommier Granny Smith', 'fruitier', 'Pommier', 'Granny Smith', 'M9', '2021-11-20', 16, 10, 2.5, 2.2, 'bon', 'fuseau', 'moyenne', true, 2023, 20, 'tardive', false, 'octobre', 'longue', zid_principal, now())
  RETURNING id INTO a_gs;

  INSERT INTO arbres (user_id, nom, type, espece, variete, port_greffe, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, pollinisateur, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Poirier Conference', 'fruitier', 'Poirier', 'Conference', 'Cognassier BA29', '2021-02-20', 20, 2, 2.5, 3, 'bon', 'palmette_u', 'moyenne', true, 2023, 22, 'precoce', false, 'Williams', 'octobre', 'longue', zid_principal, now())
  RETURNING id INTO a_conf;

  INSERT INTO arbres (user_id, nom, type, espece, variete, port_greffe, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, pollinisateur, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Poirier Williams', 'fruitier', 'Poirier', 'Williams', 'Cognassier BA29', '2021-02-20', 20, 6, 2.5, 2.8, 'bon', 'palmette_u', 'moyenne', true, 2023, 25, 'moyenne', false, 'Conference', 'aout', 'courte', zid_principal, now())
  RETURNING id INTO a_will;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Cerisier Burlat', 'fruitier', 'Cerisier', 'Burlat', '2019-11-10', 24, 2, 4, 4, 'excellent', 'gobelet', 'forte', true, 2021, 18, 'precoce', false, 'juin', zid_sud, now())
  RETURNING id INTO a_burl;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, pollinisateur, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Cerisier Napoléon', 'fruitier', 'Cerisier', 'Napoléon', '2019-11-10', 24, 6, 4, 3.8, 'bon', 'gobelet', 'forte', true, 2021, 15, 'moyenne', false, 'Burlat', 'juillet', zid_sud, now())
  RETURNING id INTO a_nap;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Prunier Reine Claude', 'fruitier', 'Prunier', 'Reine Claude dorée', '2019-11-10', 24, 10, 4, 3.5, 'excellent', 'gobelet', 'moyenne', true, 2021, 20, 'moyenne', true, 'aout', zid_sud, now())
  RETURNING id INTO a_rc;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, forme_taille, vigueur, productif, annee_production, rendement_moyen, floraison, autofertile, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Abricotier Bergeron', 'fruitier', 'Abricotier', 'Bergeron', '2020-02-15', 28, 4, 3.5, 3, 'bon', 'gobelet', 'moyenne', true, 2022, 18, 'precoce', true, 'juillet', 'courte', zid_sud, now())
  RETURNING id INTO a_berg;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, vigueur, productif, annee_production, rendement_moyen, autofertile, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Figuier Violette de Sollies', 'fruitier', 'Figuier', 'Violette de Sollies', '2020-03-15', 28, 8, 3, 2.5, 'excellent', 'forte', true, 2022, 12, true, 'aout', zid_sud, now())
  RETURNING id INTO a_fig;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, vigueur, productif, annee_production, rendement_moyen, autofertile, periode_recolte, conservation, zone_id, updated_at)
  VALUES (uid, 'Noyer Franquette', 'fruitier', 'Noyer', 'Franquette', '2018-11-15', 30, 2, 6, 5, 'excellent', 'forte', true, 2023, 25, true, 'octobre', 'longue', zid_principal, now())
  RETURNING id INTO a_noyer;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, productif, rendement_moyen, autofertile, periode_recolte, zone_id, notes, updated_at)
  VALUES (uid, 'Framboisiers rang 1', 'petit_fruit', 'Framboisier', 'Malling Promise', '2022-03-10', 12, 10, 2, 1.5, 'bon', true, 3, true, 'juin', zid_petits, 'Rang de 4m, remontant', now())
  RETURNING id INTO a_fr1;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, productif, rendement_moyen, autofertile, periode_recolte, zone_id, notes, updated_at)
  VALUES (uid, 'Framboisiers rang 2', 'petit_fruit', 'Framboisier', 'Heritage', '2023-03-15', 12, 12, 2, 1.5, 'bon', true, 2.5, true, 'septembre', zid_petits, 'Variété remontante tardive', now())
  RETURNING id INTO a_fr2;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, productif, rendement_moyen, autofertile, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Cassissier Noir de Bourgogne', 'petit_fruit', 'Cassissier', 'Noir de Bourgogne', '2022-11-10', 12, 14, 1.5, 1.2, 'bon', true, 3, true, 'juillet', zid_petits, now())
  RETURNING id INTO a_cass;

  INSERT INTO arbres (user_id, nom, type, espece, variete, date_plantation, pos_x, pos_y, envergure, hauteur, etat, productif, rendement_moyen, autofertile, periode_recolte, zone_id, updated_at)
  VALUES (uid, 'Groseillier Jonkheer van Tets', 'petit_fruit', 'Groseillier', 'Jonkheer van Tets', '2022-11-10', 12, 16, 1.5, 1.2, 'bon', true, 2.5, true, 'juillet', zid_petits, now())
  RETURNING id INTO a_gros;

  -- Assigner tous les arbres à la parcelle potager (usage culture+verger)
  UPDATE arbres SET parcelle_geo_id = parc_maraichage WHERE user_id = uid AND parcelle_geo_id IS NULL;
  RAISE NOTICE 'Arbres done (15)';

  -- Pollinisation
  INSERT INTO pollinisation_arbres (arbre_pollinise_id, arbre_pollinisateur_id, compatibilite) VALUES
    (a_pg, a_rdr, 'excellente'), (a_rdr, a_pg, 'excellente'),
    (a_pg, a_gs, 'bonne'), (a_gs, a_rdr, 'bonne'),
    (a_conf, a_will, 'excellente'), (a_will, a_conf, 'excellente'),
    (a_burl, a_nap, 'bonne'), (a_nap, a_burl, 'bonne');

  -- ==========================================================
  -- VERGER - OPÉRATIONS (2024-2026)
  -- ==========================================================
  -- Tailles d'hiver 2025
  INSERT INTO operations_arbres (user_id, arbre_id, date, type, description, duree_minutes, nb_personnes, fait, saison_recommandee) VALUES
    (uid, a_pg, '2025-01-15', 'taille', 'Taille de formation gobelet - suppression gourmands', 45, 1, true, 'hiver'),
    (uid, a_rdr, '2025-01-15', 'taille', 'Taille de fructification - éclaircir le centre', 40, 1, true, 'hiver'),
    (uid, a_gs, '2025-01-16', 'taille', 'Taille douce fuseau - raccourcir les prolongements', 30, 1, true, 'hiver'),
    (uid, a_conf, '2025-01-20', 'taille', 'Taille palmette U - maintien de la forme', 50, 1, true, 'hiver'),
    (uid, a_will, '2025-01-20', 'taille', 'Taille palmette U - équilibrage des bras', 50, 1, true, 'hiver'),
    (uid, a_burl, '2025-02-01', 'taille', 'Taille cerisier légère - bois mort uniquement', 20, 1, true, 'hiver'),
    (uid, a_nap, '2025-02-01', 'taille', 'Taille cerisier - suppression branches se croisant', 25, 1, true, 'hiver'),
    (uid, a_rc, '2025-02-05', 'taille', 'Taille prunier - aération du centre', 35, 1, true, 'hiver'),
    (uid, a_berg, '2025-02-10', 'taille', 'Taille abricotier - branches mortes et gourmands', 30, 1, true, 'hiver');

  -- Traitements printaniers 2025
  INSERT INTO operations_arbres (user_id, arbre_id, date, type, description, produit, quantite, unite, cout, fait, saison_recommandee) VALUES
    (uid, a_pg, '2025-03-05', 'traitement', 'Bouillie bordelaise débourrement', 'Bouillie bordelaise', 0.5, 'L', 3.5, true, 'printemps'),
    (uid, a_rdr, '2025-03-05', 'traitement', 'Bouillie bordelaise débourrement', 'Bouillie bordelaise', 0.5, 'L', 3.5, true, 'printemps'),
    (uid, a_gs, '2025-03-05', 'traitement', 'Bouillie bordelaise débourrement', 'Bouillie bordelaise', 0.4, 'L', 3.0, true, 'printemps'),
    (uid, a_conf, '2025-03-08', 'traitement', 'Bouillie bordelaise pré-floral', 'Bouillie bordelaise', 0.4, 'L', 3.0, true, 'printemps'),
    (uid, a_will, '2025-03-08', 'traitement', 'Bouillie bordelaise pré-floral', 'Bouillie bordelaise', 0.4, 'L', 3.0, true, 'printemps'),
    (uid, a_burl, '2025-03-10', 'traitement', 'Traitement moniliose préventif', 'Bouillie bordelaise', 0.6, 'L', 4.0, true, 'printemps');

  -- Fertilisations arbres 2025
  INSERT INTO operations_arbres (user_id, arbre_id, date, type, description, produit, quantite, unite, cout, fait, saison_recommandee) VALUES
    (uid, a_pg, '2025-03-15', 'fertilisation', 'Apport compost + corne broyée au pied', 'Compost + corne broyée', 5, 'kg', 4.0, true, 'printemps'),
    (uid, a_rdr, '2025-03-15', 'fertilisation', 'Apport compost + corne broyée', 'Compost + corne broyée', 5, 'kg', 4.0, true, 'printemps'),
    (uid, a_conf, '2025-03-18', 'fertilisation', 'Compost mûr au pied', 'Compost maison', 8, 'kg', 2.0, true, 'printemps'),
    (uid, a_will, '2025-03-18', 'fertilisation', 'Compost mûr au pied', 'Compost maison', 8, 'kg', 2.0, true, 'printemps');

  -- Tailles d'été 2025
  INSERT INTO operations_arbres (user_id, arbre_id, date, type, description, duree_minutes, fait, saison_recommandee) VALUES
    (uid, a_pg, '2025-06-15', 'taille', 'Taille en vert - pincement gourmands', 20, true, 'ete'),
    (uid, a_rdr, '2025-06-15', 'taille', 'Taille en vert - suppression pousses verticales', 20, true, 'ete'),
    (uid, a_burl, '2025-06-20', 'taille', 'Éclaircissage cerises vertes', 15, true, 'ete'),
    (uid, a_fig, '2025-07-01', 'taille', 'Pincement des rameaux - limiter la vigueur', 15, true, 'ete');

  -- Tailles hiver 2026 (faites)
  INSERT INTO operations_arbres (user_id, arbre_id, date, type, description, duree_minutes, fait, saison_recommandee) VALUES
    (uid, a_pg, '2026-01-12', 'taille', 'Taille hivernale 2026 - éclaircir charpentières', 45, true, 'hiver'),
    (uid, a_rdr, '2026-01-12', 'taille', 'Taille hivernale 2026 - rajeunissement', 40, true, 'hiver'),
    (uid, a_gs, '2026-01-13', 'taille', 'Taille fuseau 2026', 30, true, 'hiver'),
    (uid, a_conf, '2026-01-18', 'taille', 'Taille palmette 2026', 50, true, 'hiver'),
    (uid, a_will, '2026-01-18', 'taille', 'Taille palmette 2026', 50, true, 'hiver');

  -- Opérations planifiées 2026
  INSERT INTO operations_arbres (user_id, arbre_id, date_prevue, type, description, fait, saison_recommandee, recurrence) VALUES
    (uid, a_pg, '2026-03-10', 'traitement', 'Bouillie bordelaise débourrement prévu', false, 'printemps', 'annuelle'),
    (uid, a_rdr, '2026-03-10', 'traitement', 'Bouillie bordelaise débourrement prévu', false, 'printemps', 'annuelle'),
    (uid, a_burl, '2026-03-15', 'traitement', 'Anti-moniliose préventif prévu', false, 'printemps', 'annuelle');

  RAISE NOTICE 'Operations arbres done';

  -- ==========================================================
  -- VERGER - RÉCOLTES ARBRES (2024-2025)
  -- ==========================================================
  INSERT INTO recoltes_arbres (user_id, arbre_id, date, quantite, qualite) VALUES
    -- 2024
    (uid, a_pg, '2024-09-15', 18, 'bon'), (uid, a_rdr, '2024-09-20', 22, 'excellent'),
    (uid, a_gs, '2024-10-05', 12, 'bon'),
    (uid, a_conf, '2024-10-10', 15, 'bon'), (uid, a_will, '2024-08-25', 18, 'excellent'),
    (uid, a_burl, '2024-06-10', 12, 'excellent'), (uid, a_nap, '2024-07-05', 10, 'bon'),
    (uid, a_rc, '2024-08-15', 16, 'excellent'),
    (uid, a_berg, '2024-07-10', 14, 'bon'),
    (uid, a_fig, '2024-08-20', 8, 'excellent'), (uid, a_fig, '2024-09-10', 5, 'bon'),
    (uid, a_noyer, '2024-10-15', 18, 'bon'),
    (uid, a_fr1, '2024-06-15', 2.5, 'excellent'), (uid, a_fr1, '2024-09-05', 1.5, 'bon'),
    (uid, a_fr2, '2024-09-10', 2, 'bon'),
    (uid, a_cass, '2024-07-05', 2.8, 'bon'), (uid, a_gros, '2024-07-10', 2.2, 'bon'),
    -- 2025
    (uid, a_pg, '2025-09-12', 22, 'excellent'), (uid, a_rdr, '2025-09-18', 28, 'excellent'),
    (uid, a_gs, '2025-10-02', 15, 'bon'),
    (uid, a_conf, '2025-10-08', 18, 'bon'), (uid, a_will, '2025-08-22', 22, 'excellent'),
    (uid, a_burl, '2025-06-08', 15, 'excellent'), (uid, a_nap, '2025-07-02', 12, 'bon'),
    (uid, a_rc, '2025-08-12', 20, 'excellent'),
    (uid, a_berg, '2025-07-08', 16, 'excellent'),
    (uid, a_fig, '2025-08-18', 10, 'excellent'), (uid, a_fig, '2025-09-08', 6, 'bon'),
    (uid, a_noyer, '2025-10-12', 22, 'excellent'),
    (uid, a_fr1, '2025-06-12', 3, 'excellent'), (uid, a_fr1, '2025-09-02', 1.8, 'bon'),
    (uid, a_fr2, '2025-09-08', 2.5, 'bon'),
    (uid, a_cass, '2025-07-02', 3.2, 'excellent'), (uid, a_gros, '2025-07-08', 2.8, 'bon');

  -- ==========================================================
  -- VERGER - OBSERVATIONS SANTÉ
  -- ==========================================================
  INSERT INTO observations_sante (user_id, arbre_id, date, type, symptome, diagnostic, gravite, organe, traitement, resolu, date_resolution) VALUES
    (uid, a_pg, '2025-05-15', 'maladie', 'Taches brunes sur feuilles', 'Tavelure du pommier', 'moyenne', 'feuilles', 'Bouillie bordelaise 20g/L', true, '2025-06-10'),
    (uid, a_rdr, '2025-06-01', 'ravageur', 'Galeries dans les fruits', 'Carpocapse des pommes', 'moyenne', 'fruits', 'Piège à phéromones', true, '2025-07-15'),
    (uid, a_burl, '2025-06-20', 'maladie', 'Pourriture sur cerises mûres', 'Moniliose', 'grave', 'fruits', 'Retrait des fruits atteints', true, '2025-07-01'),
    (uid, a_berg, '2025-04-10', 'degat_climatique', 'Fleurs grillées par gel tardif', 'Gel printanier', 'moyenne', 'fleurs', 'Voile hivernage pour 2026', true, '2025-04-20'),
    (uid, a_will, '2025-07-15', 'ravageur', 'Feuilles enroulées, miellat', 'Pucerons verts', 'faible', 'feuilles', 'Purin de fougère', true, '2025-08-01'),
    (uid, a_fig, '2025-08-05', 'observation_generale', 'Feuillage dense et sain, bonne charge', NULL, 'faible', 'feuilles', NULL, true, NULL),
    (uid, a_noyer, '2025-09-10', 'maladie', 'Taches noires sur coques', 'Bactériose du noyer', 'faible', 'fruits', 'Taille sanitaire branches atteintes', false, NULL),
    (uid, a_pg, '2026-01-20', 'observation_generale', 'Arbre en repos, bon état général, lichens sur branches basses', NULL, 'faible', 'branches', NULL, true, NULL);

  -- Production bois
  INSERT INTO production_bois (user_id, arbre_id, date, type, poids_kg, statut, destination) VALUES
    (uid, a_pg, '2025-01-15', 'elagage', 12, 'utilise', 'BRF'),
    (uid, a_rdr, '2025-01-15', 'elagage', 15, 'utilise', 'BRF'),
    (uid, a_burl, '2025-02-01', 'elagage', 8, 'utilise', 'chauffage'),
    (uid, a_rc, '2025-02-05', 'elagage', 20, 'utilise', 'chauffage'),
    (uid, a_noyer, '2025-11-20', 'branchage', 35, 'en_stock', 'chauffage');

  RAISE NOTICE 'Verger complet done';

  -- ==========================================================
  -- ÉLEVAGE - LOTS
  -- ==========================================================
  INSERT INTO lots_animaux (user_id, espece_animale_id, nom, date_arrivee, quantite_initiale, quantite_actuelle, provenance, prix_achat_total, statut, notes, updated_at)
  VALUES (uid, 'poule_pondeuse', 'Pondeuses 2024', '2024-09-15', 12, 11, 'Couvoir du Moulin', 180, 'actif', '12 poules rousses ISA Brown, 18 semaines', now())
  RETURNING id INTO lid_pond;

  INSERT INTO lots_animaux (user_id, espece_animale_id, nom, date_arrivee, quantite_initiale, quantite_actuelle, provenance, prix_achat_total, statut, notes, updated_at)
  VALUES (uid, 'poulet_chair', 'Poulets été 2025', '2025-05-01', 10, 0, 'Couvoir du Moulin', 50, 'termine', '10 poussins chair, abattus sept 2025', now())
  RETURNING id INTO lid_poulet;

  INSERT INTO lots_animaux (user_id, espece_animale_id, nom, date_arrivee, quantite_initiale, quantite_actuelle, provenance, prix_achat_total, statut, notes, updated_at)
  VALUES (uid, 'lapin_chair', 'Lapins reproducteurs', '2024-04-10', 6, 5, 'Élevage Martin', 72, 'actif', '2 mâles + 4 femelles Fauve de Bourgogne', now())
  RETURNING id INTO lid_lapin;

  -- Assigner tous les lots à la parcelle élevage
  UPDATE lots_animaux SET parcelle_geo_id = parc_elevage WHERE user_id = uid AND parcelle_geo_id IS NULL;

  -- ==========================================================
  -- ÉLEVAGE - ANIMAUX INDIVIDUELS
  -- ==========================================================
  -- Poules
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, provenance, prix_achat, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Roussette', 'ISA Brown', 'femelle', '2024-05-15', '2024-09-15', 'Couvoir du Moulin', 15, 'actif', 2.3, 'Roux', now()) RETURNING id INTO ani1;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Blanchette', 'ISA Brown', 'femelle', '2024-05-15', '2024-09-15', 'actif', 2.4, 'Roux clair', now()) RETURNING id INTO ani2;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Grisette', 'ISA Brown', 'femelle', '2024-05-15', '2024-09-15', 'actif', 2.2, 'Roux foncé', now()) RETURNING id INTO ani3;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Noire', 'Marans', 'femelle', '2024-04-20', '2024-09-15', 'actif', 2.6, 'Noir cuivré', now()) RETURNING id INTO ani4;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, notes, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Picotine', 'ISA Brown', 'femelle', '2024-05-15', '2024-09-15', 'mort', 2.0, 'Roux', 'Morte en décembre 2025 - coccidiose', now()) RETURNING id INTO ani5;
  UPDATE animaux SET date_sortie = '2025-12-10', cause_sortie = 'maladie' WHERE id = ani5;

  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, notes, updated_at)
  VALUES (uid, 'poule_pondeuse', lid_pond, 'Napoléon', 'Marans', 'male', '2024-04-10', '2024-09-15', 'actif', 3.8, 'Noir cuivré', 'Coq du poulailler', now()) RETURNING id INTO ani6;

  -- Lapins
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'lapin_chair', lid_lapin, 'Pompon', 'Fauve de Bourgogne', 'male', '2024-01-10', '2024-04-10', 'actif', 4.2, 'Fauve', now()) RETURNING id INTO ani7;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'lapin_chair', lid_lapin, 'Caramel', 'Fauve de Bourgogne', 'femelle', '2024-01-15', '2024-04-10', 'actif', 3.8, 'Fauve clair', now()) RETURNING id INTO ani8;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, couleur_robe, updated_at)
  VALUES (uid, 'lapin_chair', lid_lapin, 'Neige', 'Fauve de Bourgogne', 'femelle', '2024-02-01', '2024-04-10', 'actif', 3.6, 'Fauve', now()) RETURNING id INTO ani9;
  INSERT INTO animaux (user_id, espece_animale_id, lot_id, nom, race, sexe, date_naissance, date_arrivee, statut, poids_actuel, updated_at)
  VALUES (uid, 'lapin_chair', lid_lapin, 'Noisette', 'Fauve de Bourgogne', 'femelle', '2024-02-10', '2024-04-10', 'actif', 3.5, now()) RETURNING id INTO ani10;

  -- Chèvres (pas de lot, individuelles)
  INSERT INTO animaux (user_id, espece_animale_id, nom, race, sexe, date_naissance, date_arrivee, provenance, prix_achat, statut, poids_actuel, couleur_robe, notes, updated_at)
  VALUES (uid, 'chevre_laitiere', 'Biquette', 'Alpine', 'femelle', '2022-03-15', '2023-09-01', 'GAEC des Collines', 280, 'actif', 52, 'Chamoisée', '2ème lactation, bonne laitière', now()) RETURNING id INTO ani11;
  INSERT INTO animaux (user_id, espece_animale_id, nom, race, sexe, date_naissance, date_arrivee, provenance, prix_achat, statut, poids_actuel, couleur_robe, notes, updated_at)
  VALUES (uid, 'chevre_laitiere', 'Marguerite', 'Saanen', 'femelle', '2023-02-20', '2024-03-15', 'GAEC des Collines', 250, 'actif', 48, 'Blanche', '1ère lactation 2025, docile', now()) RETURNING id INTO ani12;

  RAISE NOTICE 'Animaux done';

  -- ==========================================================
  -- ÉLEVAGE - PRODUCTION OEUFS (generate_series)
  -- ==========================================================
  INSERT INTO production_oeufs (user_id, lot_id, date, quantite, casses, sales, calibre)
  SELECT uid, lid_pond, d::date,
    CASE
      WHEN extract(month from d) IN (10,11) THEN (7 + floor(random()*3))::int
      WHEN extract(month from d) IN (12,1) THEN (4 + floor(random()*3))::int
      WHEN extract(month from d) = 2 THEN (5 + floor(random()*3))::int
      WHEN extract(month from d) IN (3,4,5) THEN (8 + floor(random()*3))::int
      ELSE (7 + floor(random()*4))::int
    END,
    CASE WHEN random() < 0.12 THEN 1 ELSE 0 END,
    CASE WHEN random() < 0.08 THEN 1 ELSE 0 END,
    'moyen'
  FROM generate_series('2024-10-01'::timestamp, '2026-02-18'::timestamp, interval '1 day') AS d;

  RAISE NOTICE 'Production oeufs done (~500 jours)';

  -- ==========================================================
  -- ÉLEVAGE - CONSOMMATION ALIMENTS (hebdomadaire)
  -- ==========================================================
  -- Granulés pondeuses
  INSERT INTO consommations_aliments (user_id, aliment_id, lot_id, date, quantite)
  SELECT uid, 'granules_pondeuses', lid_pond, d::date, round((8 + random()*3)::numeric, 1)
  FROM generate_series('2024-10-01'::timestamp, '2026-02-18'::timestamp, interval '7 days') AS d;

  -- Blé entier (complément)
  INSERT INTO consommations_aliments (user_id, aliment_id, lot_id, date, quantite)
  SELECT uid, 'ble_entier', lid_pond, d::date, round((2 + random()*1.5)::numeric, 1)
  FROM generate_series('2024-10-01'::timestamp, '2026-02-18'::timestamp, interval '7 days') AS d;

  -- Granulés lapin
  INSERT INTO consommations_aliments (user_id, aliment_id, lot_id, date, quantite)
  SELECT uid, 'granules_lapin', lid_lapin, d::date, round((3 + random()*2)::numeric, 1)
  FROM generate_series('2024-05-01'::timestamp, '2026-02-18'::timestamp, interval '7 days') AS d;

  -- Foin lapins
  INSERT INTO consommations_aliments (user_id, aliment_id, lot_id, date, quantite)
  SELECT uid, 'foin_prairie', lid_lapin, d::date, round((4 + random()*2)::numeric, 1)
  FROM generate_series('2024-05-01'::timestamp, '2026-02-18'::timestamp, interval '7 days') AS d;

  -- ==========================================================
  -- ÉLEVAGE - SOINS
  -- ==========================================================
  INSERT INTO soins_animaux (user_id, lot_id, date, type, description, produit, cout, veterinaire, fait) VALUES
    (uid, lid_pond, '2024-10-01', 'vermifuge', 'Vermifugation du lot pondeuses', 'Flubenol 5%', 12, NULL, true),
    (uid, lid_pond, '2025-04-01', 'vermifuge', 'Vermifugation printemps', 'Flubenol 5%', 12, NULL, true),
    (uid, lid_pond, '2025-10-01', 'vermifuge', 'Vermifugation automne', 'Flubenol 5%', 12, NULL, true),
    (uid, lid_lapin, '2024-06-15', 'vaccination', 'Vaccination myxomatose + VHD', 'Nobivac Myxo-RHD', 48, 'Dr. Lemaire', true),
    (uid, lid_lapin, '2025-06-15', 'vaccination', 'Rappel vaccin myxo + VHD', 'Nobivac Myxo-RHD', 48, 'Dr. Lemaire', true);

  INSERT INTO soins_animaux (user_id, animal_id, date, type, description, produit, cout, veterinaire, fait) VALUES
    (uid, ani5, '2025-12-08', 'traitement', 'Traitement coccidiose - trop tard', 'Baycox', 8, 'Dr. Lemaire', true),
    (uid, ani11, '2025-03-10', 'traitement', 'Parage des onglons', NULL, 0, NULL, true),
    (uid, ani12, '2025-03-10', 'traitement', 'Parage des onglons', NULL, 0, NULL, true),
    (uid, ani11, '2025-09-15', 'vermifuge', 'Vermifugation chèvres', 'Panacur', 15, NULL, true),
    (uid, ani12, '2025-09-15', 'vermifuge', 'Vermifugation chèvres', 'Panacur', 15, NULL, true);

  -- Soins planifiés 2026
  INSERT INTO soins_animaux (user_id, lot_id, date_prevue, type, description, fait) VALUES
    (uid, lid_pond, '2026-04-01', 'vermifuge', 'Vermifugation printemps 2026', false),
    (uid, lid_lapin, '2026-06-15', 'vaccination', 'Rappel vaccin myxo + VHD 2026', false);

  -- ==========================================================
  -- ÉLEVAGE - NAISSANCES
  -- ==========================================================
  INSERT INTO naissances_animales (user_id, mere_id, pere_identifiant, date, nombre_nes, nombre_vivants, nombre_males, nombre_femelles, poids_total, notes) VALUES
    (uid, ani8, 'Pompon', '2025-02-15', 7, 6, 3, 3, 0.35, 'Première portée Caramel - bonne mère'),
    (uid, ani9, 'Pompon', '2025-04-20', 8, 8, 4, 4, 0.42, 'Belle portée Neige'),
    (uid, ani10, 'Pompon', '2025-07-10', 6, 5, 2, 3, 0.30, 'Portée Noisette - 1 mort-né'),
    (uid, ani8, 'Pompon', '2025-10-05', 7, 7, 4, 3, 0.38, '2ème portée Caramel');

  -- ==========================================================
  -- ÉLEVAGE - ABATTAGES
  -- ==========================================================
  INSERT INTO abattages (user_id, lot_id, date, quantite, poids_vif, poids_carcasse, destination, prix_vente, lieu, notes) VALUES
    (uid, lid_poulet, '2025-08-15', 5, 17.5, 12.2, 'vente', 85, 'ferme', 'Premiers poulets - vente directe'),
    (uid, lid_poulet, '2025-09-01', 5, 18.2, 12.7, 'auto_consommation', NULL, 'ferme', 'Derniers du lot - congélateur');

  -- Abattage lapins
  INSERT INTO abattages (user_id, lot_id, date, quantite, poids_vif, poids_carcasse, destination, lieu, notes) VALUES
    (uid, lid_lapin, '2025-05-20', 4, 14, 7.7, 'vente', 'ferme', 'Lapereaux 1ère portée'),
    (uid, lid_lapin, '2025-08-15', 5, 17.5, 9.6, 'vente', 'ferme', 'Lapereaux 2ème portée'),
    (uid, lid_lapin, '2025-11-10', 3, 10.5, 5.8, 'auto_consommation', 'ferme', 'Lapereaux 3ème portée');

  -- ==========================================================
  -- ÉLEVAGE - VENTES PRODUITS
  -- ==========================================================
  INSERT INTO ventes_produits (user_id, date, type, description, quantite, unite, prix_unitaire, prix_total, client, paye) VALUES
    (uid, '2025-01-15', 'oeufs', 'Oeufs plein air', 6, 'douzaine', 4.50, 27, 'Martin Dupont', true),
    (uid, '2025-02-12', 'oeufs', 'Oeufs plein air', 4, 'douzaine', 4.50, 18, 'Marie Lecomte', true),
    (uid, '2025-03-20', 'oeufs', 'Oeufs plein air', 8, 'douzaine', 4.50, 36, 'Restaurant Le Potager', true),
    (uid, '2025-04-15', 'oeufs', 'Oeufs plein air', 6, 'douzaine', 4.50, 27, 'Martin Dupont', true),
    (uid, '2025-05-20', 'animal_vivant', 'Lapins vivants', 2, 'unite', 18, 36, 'Martin Dupont', true),
    (uid, '2025-06-10', 'oeufs', 'Oeufs plein air', 10, 'douzaine', 4.50, 45, 'AMAP Les Paniers Verts', true),
    (uid, '2025-06-15', 'lait', 'Fromage frais chèvre', 4, 'kg', 18, 72, 'Restaurant Le Potager', true),
    (uid, '2025-07-10', 'oeufs', 'Oeufs plein air', 8, 'douzaine', 4.50, 36, 'Martin Dupont', true),
    (uid, '2025-08-15', 'viande', 'Poulets fermiers', 5, 'kg', 12, 60, 'Restaurant Le Potager', true),
    (uid, '2025-09-01', 'lait', 'Fromage affiné chèvre', 3, 'kg', 22, 66, 'Épicerie Terre et Saveur', true),
    (uid, '2025-10-15', 'oeufs', 'Oeufs plein air', 6, 'douzaine', 4.50, 27, 'Marie Lecomte', true),
    (uid, '2025-11-10', 'viande', 'Lapins entiers', 3, 'kg', 15, 45, 'Restaurant Le Potager', true),
    (uid, '2026-01-15', 'oeufs', 'Oeufs plein air', 4, 'douzaine', 4.50, 18, 'Martin Dupont', true),
    (uid, '2026-02-10', 'lait', 'Fromage frais chèvre', 2, 'kg', 18, 36, 'Marie Lecomte', true);

  RAISE NOTICE 'Elevage complet done';

  -- ==========================================================
  -- COMPTABILITÉ - CLIENTS
  -- ==========================================================
  INSERT INTO clients (user_id, nom, type, email, telephone, adresse, ville, code_postal, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'Martin Dupont', 'particulier', 'martin.dupont@email.fr', '06 12 34 56 78', '12 rue des Lilas', 'Saint-Rémy', '13210', 0, 'Client régulier - oeufs et légumes', true, now())
  RETURNING id INTO cid1;
  INSERT INTO clients (user_id, nom, type, email, telephone, adresse, ville, code_postal, siret, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'Restaurant Le Potager', 'professionnel', 'contact@lepotager.fr', '04 90 12 34 56', '8 place du Marché', 'Saint-Rémy', '13210', '12345678900015', 15, 'Commandes régulières légumes et volailles', true, now())
  RETURNING id INTO cid2;
  INSERT INTO clients (user_id, nom, type, email, telephone, adresse, ville, code_postal, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'AMAP Les Paniers Verts', 'amap', 'contact@paniersverts.org', '04 90 56 78 90', '5 chemin des Oliviers', 'Eyragues', '13630', 0, 'Paniers hebdo - 15 adhérents', true, now())
  RETURNING id INTO cid3;
  INSERT INTO clients (user_id, nom, type, email, telephone, adresse, ville, code_postal, siret, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'Épicerie Terre et Saveur', 'professionnel', 'epicerie@terreetsaveur.fr', '04 90 78 90 12', '22 avenue de la République', 'Maillane', '13910', '98765432100012', 30, 'Dépôt-vente fromages et légumes', true, now())
  RETURNING id INTO cid4;
  INSERT INTO clients (user_id, nom, type, email, telephone, ville, code_postal, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'Marie Lecomte', 'particulier', 'marie.lecomte@email.fr', '06 98 76 54 32', 'Saint-Rémy', '13210', 0, 'Achète oeufs et fromage régulièrement', true, now())
  RETURNING id INTO cid5;
  INSERT INTO clients (user_id, nom, type, telephone, ville, code_postal, siret, conditions_paiement, notes, actif, updated_at)
  VALUES
    (uid, 'Camping Les Oliviers', 'professionnel', '04 90 34 56 78', 'Eyragues', '13630', '45678901200018', 0, 'Commandes estivales uniquement', true, now())
  RETURNING id INTO cid6;

  -- ==========================================================
  -- COMPTABILITÉ - FACTURES
  -- ==========================================================
  INSERT INTO factures (user_id, numero, type, client_id, client_nom, client_adresse, date, objet, total_ht, total_tva, total_ttc, statut, date_paiement, mode_paiement, updated_at)
  VALUES (uid, 'F-2025-001', 'facture', cid2, 'Restaurant Le Potager', '8 place du Marché, 13210 Saint-Rémy', '2025-03-31', 'Légumes et oeufs mars 2025', 142.50, 7.84, 150.34, 'payee', '2025-04-12', 'virement', now())
  RETURNING id INTO fid1;
  INSERT INTO lignes_factures (facture_id, ordre, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant_ttc) VALUES
    (fid1, 1, 'Panier légumes variés', 4, 'panier', 25, 5.5, 100, 5.50, 105.50),
    (fid1, 2, 'Oeufs plein air', 8, 'douzaine', 4.50, 5.5, 36, 1.98, 37.98),
    (fid1, 3, 'Herbes aromatiques', 2, 'botte', 3.25, 5.5, 6.50, 0.36, 6.86);

  INSERT INTO factures (user_id, numero, type, client_id, client_nom, client_adresse, date, objet, total_ht, total_tva, total_ttc, statut, date_paiement, mode_paiement, updated_at)
  VALUES (uid, 'F-2025-002', 'facture', cid3, 'AMAP Les Paniers Verts', '5 chemin des Oliviers, 13630 Eyragues', '2025-06-30', 'Paniers AMAP juin 2025', 375, 20.63, 395.63, 'payee', '2025-07-01', 'virement', now())
  RETURNING id INTO fid2;
  INSERT INTO lignes_factures (facture_id, ordre, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant_ttc) VALUES
    (fid2, 1, 'Panier légumes AMAP (15 paniers x 4 sem)', 60, 'panier', 6.25, 5.5, 375, 20.63, 395.63);

  INSERT INTO factures (user_id, numero, type, client_id, client_nom, client_adresse, date, objet, total_ht, total_tva, total_ttc, statut, date_paiement, mode_paiement, updated_at)
  VALUES (uid, 'F-2025-003', 'facture', cid2, 'Restaurant Le Potager', '8 place du Marché, 13210 Saint-Rémy', '2025-08-31', 'Poulets fermiers et légumes août', 215, 11.83, 226.83, 'payee', '2025-09-15', 'virement', now())
  RETURNING id INTO fid3;
  INSERT INTO lignes_factures (facture_id, ordre, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant_ttc) VALUES
    (fid3, 1, 'Poulets fermiers entiers', 5, 'kg', 12, 5.5, 60, 3.30, 63.30),
    (fid3, 2, 'Panier légumes variés', 4, 'panier', 25, 5.5, 100, 5.50, 105.50),
    (fid3, 3, 'Fromage chèvre frais', 2, 'kg', 18, 5.5, 36, 1.98, 37.98),
    (fid3, 4, 'Fruits du verger', 5, 'kg', 3.80, 5.5, 19, 1.05, 20.05);

  INSERT INTO factures (user_id, numero, type, client_id, client_nom, client_adresse, date, objet, total_ht, total_tva, total_ttc, statut, mode_paiement, updated_at)
  VALUES (uid, 'F-2025-004', 'facture', cid4, 'Épicerie Terre et Saveur', '22 av de la République, 13910 Maillane', '2025-11-30', 'Dépôt-vente novembre', 188, 10.34, 198.34, 'emise', NULL, now())
  RETURNING id INTO fid4;
  INSERT INTO lignes_factures (facture_id, ordre, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant_ttc) VALUES
    (fid4, 1, 'Fromage chèvre affiné', 4, 'kg', 22, 5.5, 88, 4.84, 92.84),
    (fid4, 2, 'Courges butternut', 15, 'kg', 3.50, 5.5, 52.50, 2.89, 55.39),
    (fid4, 3, 'Noix Franquette', 5, 'kg', 9.50, 5.5, 47.50, 2.61, 50.11);

  INSERT INTO factures (user_id, numero, type, client_id, client_nom, date, objet, total_ht, total_tva, total_ttc, statut, updated_at)
  VALUES (uid, 'F-2026-001', 'facture', cid2, 'Restaurant Le Potager', '2026-01-31', 'Légumes hiver janvier 2026', 95, 5.23, 100.23, 'emise', now())
  RETURNING id INTO fid5;
  INSERT INTO lignes_factures (facture_id, ordre, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant_ttc) VALUES
    (fid5, 1, 'Poireaux Bleu de Solaise', 8, 'kg', 4, 5.5, 32, 1.76, 33.76),
    (fid5, 2, 'Carottes conservation', 10, 'kg', 2.80, 5.5, 28, 1.54, 29.54),
    (fid5, 3, 'Oeufs plein air', 4, 'douzaine', 4.50, 5.5, 18, 0.99, 18.99),
    (fid5, 4, 'Épinards frais', 3, 'kg', 5.67, 5.5, 17, 0.94, 17.94);

  RAISE NOTICE 'Factures done';

  -- ==========================================================
  -- COMPTABILITÉ - VENTES MANUELLES
  -- ==========================================================
  INSERT INTO ventes_manuelles (user_id, date, categorie, description, quantite, unite, prix_unitaire, taux_tva, montant_ht, montant_tva, montant, client_id, client_nom, module, paye) VALUES
    (uid, '2025-04-05', 'legumes', 'Marché - salades et radis', 8, 'kg', 4.50, 5.5, 36, 1.98, 37.98, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-05-10', 'legumes', 'Marché - premiers légumes été', 12, 'kg', 5, 5.5, 60, 3.30, 63.30, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-06-14', 'legumes', 'Marché - tomates et courgettes', 15, 'kg', 4.80, 5.5, 72, 3.96, 75.96, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-07-05', 'legumes', 'Vente directe - panier', NULL, NULL, NULL, 5.5, 28.44, 1.56, 30, cid1, 'Martin Dupont', 'potager', true),
    (uid, '2025-07-12', 'legumes', 'Marché - pleine saison', 20, 'kg', 4.50, 5.5, 90, 4.95, 94.95, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-08-02', 'legumes', 'Marché - tomates abondance', 25, 'kg', 4, 5.5, 100, 5.50, 105.50, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-08-16', 'fruits', 'Vente cerises et abricots', 8, 'kg', 6, 5.5, 48, 2.64, 50.64, cid6, 'Camping Les Oliviers', 'verger', true),
    (uid, '2025-09-06', 'legumes', 'Marché - fin de saison', 18, 'kg', 4.50, 5.5, 81, 4.46, 85.46, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-09-20', 'fruits', 'Pommes et poires', 15, 'kg', 3.80, 5.5, 57, 3.14, 60.14, cid4, 'Épicerie Terre et Saveur', 'verger', true),
    (uid, '2025-10-04', 'legumes', 'Marché - courges et légumes racines', 22, 'kg', 3.50, 5.5, 77, 4.24, 81.24, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-10-18', 'fruits', 'Noix Franquette', 8, 'kg', 9.50, 5.5, 76, 4.18, 80.18, cid1, 'Martin Dupont', 'verger', true),
    (uid, '2025-11-08', 'legumes', 'Marché - poireaux et choux', 12, 'kg', 4, 5.5, 48, 2.64, 50.64, NULL, 'Marché du samedi', 'potager', true),
    (uid, '2025-12-06', 'fruits', 'Confitures maison', 6, 'pot', 5, 5.5, 30, 1.65, 31.65, cid5, 'Marie Lecomte', 'verger', true),
    (uid, '2026-01-10', 'legumes', 'Vente directe - légumes hiver', NULL, NULL, NULL, 5.5, 42.65, 2.35, 45, cid1, 'Martin Dupont', 'potager', true),
    (uid, '2026-02-01', 'legumes', 'Marché - épinards et mâche', 6, 'kg', 5.50, 5.5, 33, 1.82, 34.82, NULL, 'Marché du samedi', 'potager', true);

  -- ==========================================================
  -- COMPTABILITÉ - DÉPENSES MANUELLES
  -- ==========================================================
  INSERT INTO depenses_manuelles (user_id, date, categorie, description, taux_tva, montant_ht, montant_tva, montant, module, fournisseur_nom, paye) VALUES
    (uid, '2025-01-15', 'materiel', 'Sécateur et scie élagage', 20, 58.33, 11.67, 70, 'verger', 'Gamm Vert', true),
    (uid, '2025-02-10', 'autre', 'Semences printemps 2025', 5.5, 85.31, 4.69, 90, 'potager', 'Kokopelli', true),
    (uid, '2025-02-20', 'autre', 'Granulés pondeuses (50kg)', 5.5, 21.33, 1.17, 22.50, 'elevage', 'Moulin de Provence', true),
    (uid, '2025-03-15', 'autre', 'Terreau semis + godets', 20, 29.17, 5.83, 35, 'potager', 'Gamm Vert', true),
    (uid, '2025-04-01', 'carburant', 'Gasoil motoculteur', 20, 37.50, 7.50, 45, 'general', 'Station Total', true),
    (uid, '2025-05-01', 'autre', 'Poussins chair (10)', 5.5, 47.39, 2.61, 50, 'elevage', 'Couvoir du Moulin', true),
    (uid, '2025-05-15', 'materiel', 'Tuyau goutte-à-goutte 50m', 20, 33.33, 6.67, 40, 'potager', 'Irrijardin', true),
    (uid, '2025-06-01', 'autre', 'Foin prairie (200kg)', 5.5, 28.44, 1.56, 30, 'elevage', 'GAEC des Prés', true),
    (uid, '2025-07-15', 'autre', 'Traitement bio bouillie bordelaise', 20, 16.67, 3.33, 20, 'verger', 'Gamm Vert', true),
    (uid, '2025-08-20', 'main_oeuvre', 'Aide récolte saisonnière (2j)', 20, 200, 40, 240, 'potager', NULL, true),
    (uid, '2025-09-10', 'autre', 'Granulés pondeuses + lapin', 5.5, 42.65, 2.35, 45, 'elevage', 'Moulin de Provence', true),
    (uid, '2025-10-01', 'carburant', 'Gasoil automne', 20, 33.33, 6.67, 40, 'general', 'Station Total', true),
    (uid, '2025-11-15', 'materiel', 'Voile hivernage arbres', 20, 25, 5, 30, 'verger', 'Gamm Vert', true),
    (uid, '2025-12-01', 'abonnement', 'Cotisation MSA T4', 0, 320, 0, 320, 'general', 'MSA', true),
    (uid, '2026-01-10', 'autre', 'Semences 2026 (commande)', 5.5, 104.27, 5.73, 110, 'potager', 'Germinance', true),
    (uid, '2026-02-05', 'autre', 'Granulés pondeuses (50kg)', 5.5, 21.33, 1.17, 22.50, 'elevage', 'Moulin de Provence', true);

  RAISE NOTICE 'Compta done';

  -- ==========================================================
  -- INTERVENTIONS
  -- ==========================================================
  INSERT INTO interventions (user_id, date, type, planche_id, description, duree_minutes, nb_personnes, fait, updated_at) VALUES
    (uid, '2025-02-20', 'semis', pid_a, 'Semis tomates en godet sous serre', 60, 1, true, now()),
    (uid, '2025-03-10', 'semis', pid_b, 'Semis carottes en place', 45, 1, true, now()),
    (uid, '2025-03-15', 'semis', pid_aroma, 'Semis persil en place', 20, 1, true, now()),
    (uid, '2025-04-15', 'semis', pid_d, 'Semis courgettes en godet', 30, 1, true, now()),
    (uid, '2025-05-05', 'plantation', pid_a, 'Plantation tomates (tuteurs + paillage)', 120, 1, true, now()),
    (uid, '2025-05-05', 'paillage', pid_a, 'Paillage BRF autour des tomates', 45, 1, true, now()),
    (uid, '2025-05-15', 'plantation', pid_serre, 'Plantation poivrons en serre', 60, 1, true, now()),
    (uid, '2025-05-20', 'plantation', pid_d, 'Plantation courgettes', 40, 1, true, now()),
    (uid, '2025-06-01', 'desherbage', pid_b, 'Binage carottes - sarclage inter-rangs', 45, 1, true, now()),
    (uid, '2025-06-15', 'arrosage', pid_a, 'Arrosage goutte-à-goutte 2h', 15, 1, true, now()),
    (uid, '2025-07-01', 'recolte', pid_b, 'Récolte carottes printemps', 60, 1, true, now()),
    (uid, '2025-07-15', 'recolte', pid_a, 'Première récolte tomates', 45, 1, true, now()),
    (uid, '2025-08-01', 'traitement_phyto', pid_a, 'Traitement mildiou préventif', 30, 1, true, now()),
    (uid, '2025-08-20', 'recolte', pid_d, 'Récolte courgettes fin de saison', 30, 1, true, now()),
    (uid, '2025-09-22', 'recolte', pid_d, 'Récolte butternut', 60, 2, true, now()),
    (uid, '2025-10-05', 'recolte', pid_e, 'Récolte poireaux - premier passage', 45, 1, true, now()),
    (uid, '2025-11-01', 'autre', pid_a, 'Nettoyage fin de saison + engrais vert', 90, 1, true, now()),
    (uid, '2026-01-20', 'semis', pid_serre, 'Semis laitues sous serre', 30, 1, true, now()),
    (uid, '2026-02-01', 'semis', pid_e, 'Semis épinards en place', 30, 1, true, now()),
    (uid, '2026-02-10', 'plantation', pid_a, 'Plantation laitues sous voile', 45, 1, true, now()),
    (uid, '2026-02-15', 'semis', pid_serre, 'Semis tomates en godet (pépinière)', 60, 1, true, now());

  -- Interventions planifiées
  INSERT INTO interventions (user_id, date_prevue, type, planche_id, description, fait, updated_at) VALUES
    (uid, '2026-03-15', 'semis', pid_b, 'Semis carottes printemps prévu', false, now()),
    (uid, '2026-04-15', 'semis', pid_d, 'Semis courges en godet prévu', false, now()),
    (uid, '2026-05-01', 'plantation', pid_serre, 'Plantation tomates prévue', false, now());

  -- ==========================================================
  -- FERTILISATIONS
  -- ==========================================================
  INSERT INTO fertilisations (user_id, planche, fertilisant, date, quantite, notes) VALUES
    (uid, pid_a, 'Compost maison', '2025-03-01', 30, 'Apport printemps avant tomates'),
    (uid, pid_a, 'Corne broyée', '2025-03-01', 0.5, 'Complément azote'),
    (uid, pid_b, 'Compost maison', '2025-03-05', 15, 'Apport avant carottes'),
    (uid, pid_d, 'Fumier de cheval', '2025-04-01', 40, 'Fumier bien composté pour courges'),
    (uid, pid_e, 'Compost maison', '2025-02-15', 20, 'Apport avant alliacées'),
    (uid, pid_serre, 'Compost maison', '2025-03-01', 12, 'Enrichissement serre'),
    (uid, pid_serre, 'Sang séché', '2025-05-15', 0.3, 'Boost azote pour poivrons'),
    (uid, pid_tunnel, 'Compost maison', '2025-03-01', 15, 'Enrichissement tunnel'),
    (uid, pid_a, 'Purin d''ortie', '2025-06-15', 5, 'Arrosage purin dilué 1/10'),
    (uid, pid_a, 'Purin d''ortie', '2025-07-10', 5, 'Stimulation fructification'),
    (uid, pid_a, 'Compost maison', '2026-02-01', 25, 'Apport hivernal avant laitues'),
    (uid, pid_e, 'Compost maison', '2026-01-15', 18, 'Préparation sol épinards');

  RAISE NOTICE 'Interventions + fertilisations done';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ENRICHISSEMENT DEMO TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '========================================';

END;
$$;
