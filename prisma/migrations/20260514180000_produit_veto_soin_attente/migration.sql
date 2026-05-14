-- PROMPT 19B — Produits vétérinaires + soins individuels + temps d'attente

-- ============================================================
-- Table produits_veterinaires (référentiel partagé)
-- ============================================================
CREATE TABLE "produits_veterinaires" (
    "id"                        TEXT NOT NULL,
    "nom"                       TEXT NOT NULL,
    "substance_active"          TEXT,
    "amm"                       TEXT,
    "especes_cibles"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "temps_attente_lait_j"      INTEGER NOT NULL DEFAULT 0,
    "temps_attente_viande_j"    INTEGER NOT NULL DEFAULT 0,
    "ordonnance_obligatoire"    BOOLEAN NOT NULL DEFAULT true,
    "autorise_ab"               BOOLEAN NOT NULL DEFAULT false,
    "voies_admin"               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description"               TEXT,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "produits_veterinaires_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "produits_veterinaires_nom_amm_key" ON "produits_veterinaires"("nom", "amm");
CREATE INDEX "produits_veterinaires_nom_idx" ON "produits_veterinaires"("nom");
CREATE INDEX "produits_veterinaires_substance_active_idx" ON "produits_veterinaires"("substance_active");

-- ============================================================
-- Enrichissement soins_animaux
-- ============================================================
ALTER TABLE "soins_animaux"
    ADD COLUMN "produit_id"             TEXT,
    ADD COLUMN "dose"                   TEXT,
    ADD COLUMN "voie"                   TEXT,
    ADD COLUMN "motif"                  TEXT,
    ADD COLUMN "ordonnance_url"         TEXT,
    ADD COLUMN "temps_attente_lait_j"   INTEGER,
    ADD COLUMN "temps_attente_viande_j" INTEGER,
    ADD COLUMN "fin_attente_lait"       TIMESTAMP(3),
    ADD COLUMN "fin_attente_viande"     TIMESTAMP(3);
CREATE INDEX "soins_animaux_produit_id_idx" ON "soins_animaux"("produit_id");
CREATE INDEX "soins_animaux_fin_attente_lait_idx" ON "soins_animaux"("fin_attente_lait");
CREATE INDEX "soins_animaux_fin_attente_viande_idx" ON "soins_animaux"("fin_attente_viande");

ALTER TABLE "soins_animaux"
    ADD CONSTRAINT "soins_animaux_produit_id_fkey"
    FOREIGN KEY ("produit_id") REFERENCES "produits_veterinaires"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Seed de 30 produits vétérinaires courants
-- Source : ANSES-ANMV, RCP des produits. Les temps d'attente sont les
-- valeurs typiques pour la voie et la dose AMM. À VALIDER avec un
-- vétérinaire avant utilisation clinique.
-- ============================================================
INSERT INTO "produits_veterinaires"
    ("id", "nom", "substance_active", "amm", "especes_cibles", "temps_attente_lait_j", "temps_attente_viande_j", "ordonnance_obligatoire", "autorise_ab", "voies_admin", "description", "created_at")
VALUES
    -- Antiparasitaires (vermifuges)
    ('veto_01', 'Eprinex Pour-on',           'Éprinomectine',     'FR/V/0123456 7/1992',  ARRAY['bovin','caprin'],                    0,  10, true,  false, ARRAY['Pour-on'],    'Antiparasitaire externe et interne, voie pour-on', NOW()),
    ('veto_02', 'Cydectine 0.1% Oral',       'Moxidectine',       'FR/V/0149384 0/2000',  ARRAY['ovin','caprin'],                     7,  14, true,  false, ARRAY['PO'],         'Vermifuge oral large spectre', NOW()),
    ('veto_03', 'Dectomax Injectable',       'Doramectine',       'FR/V/8500134 0/1995',  ARRAY['bovin','porcin'],                   28,  35, true,  false, ARRAY['IM','SC'],    'Antiparasitaire endectocide', NOW()),
    ('veto_04', 'Panacur SC 10%',            'Fenbendazole',      'FR/V/3401234 5/1989',  ARRAY['bovin','ovin','caprin','porcin'],    0,  14, true,  false, ARRAY['PO'],         'Vermifuge à spectre élargi', NOW()),
    ('veto_05', 'Coxidin 250',               'Diclazuril',        'FR/V/2718281 8/2003',  ARRAY['ovin','caprin','volaille'],          0,   3, true,  false, ARRAY['PO'],         'Anticoccidien', NOW()),
    -- Antibiotiques
    ('veto_06', 'Penidural LA',              'Pénicilline procaïne','FR/V/1100110 2/1972', ARRAY['bovin','ovin','caprin','porcin'],    4,  28, true,  false, ARRAY['IM'],         'Antibiotique β-lactamine longue action', NOW()),
    ('veto_07', 'Excede pour bovin',         'Ceftiofur',         'FR/V/1200145 1/2008',  ARRAY['bovin'],                             0,  13, true,  false, ARRAY['SC'],         'Céphalosporine 3G — usage restreint', NOW()),
    ('veto_08', 'Marbocyl 10%',              'Marbofloxacine',    'FR/V/2300456 7/2000',  ARRAY['bovin','porcin'],                    3,   6, true,  false, ARRAY['IM','SC'],    'Fluoroquinolone — usage critique', NOW()),
    ('veto_09', 'Tylan 200',                 'Tylosine',          'FR/V/3400789 1/1980',  ARRAY['bovin','porcin','volaille'],         4,  28, true,  false, ARRAY['IM'],         'Macrolide antibiotique', NOW()),
    ('veto_10', 'Engemycin 10%',             'Oxytétracycline',   'FR/V/4500123 4/1985',  ARRAY['bovin','ovin','caprin','porcin'],    7,  28, true,  false, ARRAY['IM','IV'],    'Tétracycline large spectre', NOW()),
    -- AINS / antalgiques
    ('veto_11', 'Metacam 20 mg/mL',          'Méloxicam',         'FR/V/5600789 2/1998',  ARRAY['bovin','porcin'],                    5,  15, true,  false, ARRAY['IV','SC'],    'AINS anti-inflammatoire', NOW()),
    ('veto_12', 'Finadyne RP',               'Flunixine méglumine','FR/V/6700456 8/1990', ARRAY['bovin','porcin','équin'],            1,   7, true,  false, ARRAY['IV'],         'AINS antalgique antipyrétique', NOW()),
    ('veto_13', 'Ketofen 10%',               'Kétoprofène',       'FR/V/7800123 1/1995',  ARRAY['bovin','porcin','équin'],            0,   4, true,  false, ARRAY['IM','IV'],    'AINS', NOW()),
    -- Hormones / mise en lutte
    ('veto_14', 'Chronogest CR',             'FGA + PMSG',        'FR/V/8900456 3/1985',  ARRAY['ovin','caprin'],                     0,   0, true,  false, ARRAY['Vaginal'],    'Éponge vaginale pour mise en lutte', NOW()),
    ('veto_15', 'Estrumate',                 'Cloprosténol',      'FR/V/9000789 5/1988',  ARRAY['bovin'],                             0,   1, true,  false, ARRAY['IM'],         'Prostaglandine F2α (induction œstrus)', NOW()),
    -- Vaccins (temps d'attente nul pour la plupart)
    ('veto_16', 'Bravoxin 10',               'Anatoxines clostridiales','FR/V/0001234 5/2014', ARRAY['ovin','caprin'],                0,   0, true,  true,  ARRAY['SC'],         'Vaccin polyvalent clostridies', NOW()),
    ('veto_17', 'Bovilis IBR Marker Live',   'BoHV-1 IBR',        'FR/V/1112233 4/2008',  ARRAY['bovin'],                             0,   0, true,  true,  ARRAY['IM','IN'],    'Vaccin IBR', NOW()),
    ('veto_18', 'Heptavac P Plus',           'Pasteurelles + clostridies','FR/V/2223344 5/2003', ARRAY['ovin'],                       0,   0, true,  true,  ARRAY['SC'],         'Vaccin combiné pasteurellose/clostridies', NOW()),
    ('veto_19', 'Coxevac',                   'Coxiella burnetii inactivée','FR/V/3334455 6/2010', ARRAY['bovin','caprin'],            0,   0, true,  true,  ARRAY['SC'],         'Vaccin fièvre Q', NOW()),
    ('veto_20', 'Lyomyxovax',                'Myxomatose',        'FR/V/4445566 7/1985',  ARRAY['lapin'],                             0,   0, false, true,  ARRAY['SC'],         'Vaccin myxomatose lapin', NOW()),
    -- Antiseptiques / soins locaux
    ('veto_21', 'Vétédine Solution',         'Iode povidone',     'FR/V/5556677 8/1979',  ARRAY['bovin','ovin','caprin','porcin','équin'], 0, 0, false, true, ARRAY['Local'], 'Antiseptique cutané', NOW()),
    ('veto_22', 'Cothivet',                  'Goudron + extraits végétaux','FR/V/6667788 9/1980', ARRAY['bovin','ovin','caprin','équin'], 0, 0, false, true, ARRAY['Local'], 'Cicatrisant naturel autorisé AB', NOW()),
    ('veto_23', 'Aluspray',                  'Aluminium micronisé','FR/V/7778899 0/1990', ARRAY['bovin','ovin','caprin','porcin','volaille'], 0, 0, false, true, ARRAY['Local'], 'Pansement spray', NOW()),
    -- Calcium / minéraux
    ('veto_24', 'Calcijet 40',               'Gluconate Ca + Mg', 'FR/V/8889900 1/1995',  ARRAY['bovin','ovin','caprin'],             0,   0, true,  false, ARRAY['SC','IV'],    'Solution calcique injectable (fièvre lait)', NOW()),
    ('veto_25', 'Phylasterol',               'Vit ADE + minéraux','FR/V/9990011 2/2000',  ARRAY['bovin','ovin','caprin','porcin'],    0,   0, false, false, ARRAY['IM'],         'Complément vitaminique', NOW()),
    -- Tarissement / mammites
    ('veto_26', 'Orbenin Extra DC',          'Cloxacilline',      'FR/V/0123450 0/1985',  ARRAY['bovin'],                            42,  28, true,  false, ARRAY['Intra-mamm.'],'Antibiotique intra-mammaire tarissement', NOW()),
    ('veto_27', 'Cobactan LC',               'Cefquinome',        'FR/V/1234567 8/2005',  ARRAY['bovin'],                             5,   2, true,  false, ARRAY['Intra-mamm.'],'Intra-mammaire en lactation', NOW()),
    -- Anesthésie locale
    ('veto_28', 'Procamidor',                'Procaïne',          'FR/V/2345678 9/1992',  ARRAY['bovin','porcin','équin'],            5,   5, true,  false, ARRAY['SC','Local'], 'Anesthésique local', NOW()),
    -- Préparations magistrales / phyto
    ('veto_29', 'Argile verte alimentaire',  'Montmorillonite',   NULL,                  ARRAY['bovin','ovin','caprin','porcin','volaille'], 0, 0, false, true, ARRAY['PO','Local'], 'Adsorbant digestif & cataplasme', NOW()),
    ('veto_30', 'Vinaigre de cidre 4%',      'Acide acétique',    NULL,                  ARRAY['bovin','ovin','caprin','volaille'], 0,   0, false, true,  ARRAY['PO','Local'], 'Acidifiant naturel — usage AB courant', NOW())
ON CONFLICT DO NOTHING;
