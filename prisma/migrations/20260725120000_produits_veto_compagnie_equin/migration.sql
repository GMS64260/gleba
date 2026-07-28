-- Référentiel vétérinaire : produits compagnie (chien/chat) + équins.
-- Le catalogue initial ne ciblait que la rente (bovin/ovin/caprin/porcin/
-- volaille/lapin/équin). Pour que la pharmacie et les soins d'un atelier
-- « Chiens & chats » / « Équins » proposent des produits pertinents (et non un
-- vermifuge ovin pour un chien), on ajoute les vaccins / vermifuges /
-- antiparasitaires courants. Aucun délai d'attente (denrées non concernées).
-- Additif et idempotent (WHERE NOT EXISTS sur le nom). AMM laissée NULL
-- (l'éleveur la complète ; on n'invente pas de numéro officiel).

INSERT INTO produits_veterinaires
  (id, nom, substance_active, amm, especes_cibles, temps_attente_lait_j, temps_attente_viande_j, ordonnance_obligatoire, autorise_ab, voies_admin, description, created_at)
SELECT gen_random_uuid()::text, v.nom, v.sa, NULL, v.codes, 0, 0, v.ord, false, v.voies, v.descr, now()
FROM (VALUES
  -- Chien
  ('Nobivac DHPPi',        'Valences CHPPi (Carré, hépatite, parvovirose, parainfluenza)', ARRAY['chien']::text[],        true,  ARRAY['SC']::text[],    'Vaccin chien (primo-vaccination + rappels)'),
  ('Milbemax chien',       'Milbémycine oxime + praziquantel',                             ARRAY['chien']::text[],        true,  ARRAY['PO']::text[],    'Vermifuge chien (nématodes + cestodes)'),
  ('Drontal Plus',         'Pyrantel + fébantel + praziquantel',                           ARRAY['chien']::text[],        true,  ARRAY['PO']::text[],    'Vermifuge chien'),
  ('NexGard',              'Afoxolaner',                                                   ARRAY['chien']::text[],        true,  ARRAY['PO']::text[],    'Antiparasitaire externe (puces, tiques)'),
  ('Advantix',             'Imidaclopride + perméthrine',                                  ARRAY['chien']::text[],        false, ARRAY['spot-on']::text[], 'Antiparasitaire externe chien (ne pas utiliser chez le chat)'),
  -- Chat
  ('Purevax RCP',          'Valences RCP (typhus, coryza)',                                ARRAY['chat']::text[],         true,  ARRAY['SC']::text[],    'Vaccin chat (primo-vaccination + rappels)'),
  ('Milbemax chat',        'Milbémycine oxime + praziquantel',                             ARRAY['chat']::text[],         true,  ARRAY['PO']::text[],    'Vermifuge chat'),
  ('Profender',            'Emodepside + praziquantel',                                    ARRAY['chat']::text[],         true,  ARRAY['spot-on']::text[], 'Vermifuge chat (spot-on)'),
  -- Chien & chat
  ('Nobivac Rage',         'Virus rabique inactivé',                                       ARRAY['chien','chat']::text[], true,  ARRAY['SC','IM']::text[], 'Vaccin antirabique'),
  ('Bravecto',             'Fluralaner',                                                   ARRAY['chien','chat']::text[], true,  ARRAY['PO','spot-on']::text[], 'Antiparasitaire externe longue durée'),
  ('Frontline Combo',      'Fipronil + (S)-méthoprène',                                    ARRAY['chien','chat']::text[], false, ARRAY['spot-on']::text[], 'Antiparasitaire externe (puces, tiques)'),
  ('Stronghold',           'Sélamectine',                                                  ARRAY['chien','chat']::text[], true,  ARRAY['spot-on']::text[], 'Antiparasitaire (puces, gale, vers)'),
  -- Équin
  ('Eqvalan',              'Ivermectine',                                                  ARRAY['équin']::text[],        true,  ARRAY['PO']::text[],    'Vermifuge cheval'),
  ('Equimax',              'Ivermectine + praziquantel',                                   ARRAY['équin']::text[],        true,  ARRAY['PO']::text[],    'Vermifuge cheval (dont ténias)'),
  ('Panacur équin',        'Fenbendazole',                                                 ARRAY['équin']::text[],        true,  ARRAY['PO']::text[],    'Vermifuge cheval'),
  ('Equilis Prequenza Te', 'Grippe équine + anatoxine tétanique',                          ARRAY['équin']::text[],        true,  ARRAY['IM']::text[],    'Vaccin grippe + tétanos du cheval')
) AS v(nom, sa, codes, ord, voies, descr)
WHERE NOT EXISTS (SELECT 1 FROM produits_veterinaires p WHERE p.nom = v.nom);
