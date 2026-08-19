-- Reprises de données — campagne QA du 2026-08-11 (50 signalements, lot du soir).
-- Idempotent : chaque écriture est gardée par son état fautif.
-- À jouer AVANT la bascule, d'abord en transaction close par ROLLBACK (procédure vault Exploitation).
--
-- Périmètre :
--   A. Référentiel verger partagé (tickets cmsog7qjr, cmsog8uu4, cmsog9mys, cmsoeqlnm)
--   B. Référentiel élevage partagé (ticket cmsoff8j2)
--   C. Données du compte démo (tickets cmsoge7t9, cmsogchrf, cmsoevxrj, cmsoexauc, cmsog7jf6)

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- A1. cmsog7qjr — OHxF est résistant au feu bactérien, pas sensible.
UPDATE porte_greffes
SET sensibilites = array_remove(sensibilites, 'feu_bacterien'),
    notes = 'Old Home × Farmingdale — franc de poirier, résistant au feu bactérien.',
    updated_at = now()
WHERE id = 'pg-poirier-ohf' AND 'feu_bacterien' = ANY(sensibilites);

-- A2. cmsog9mys — scission Sainte-Lucie (Prunus mahaleb) / F12-1 (clone de merisier).
-- L'id historique reste Sainte-Lucie (7+ arbres utilisateurs rattachés côté OHF,
-- 2 arbres admin ici avec texte libre « Sainte-Lucie » : cohérent).
UPDATE porte_greffes
SET nom = 'Cerisier Sainte-Lucie', vigueur = 3, precocite = 3,
    notes = 'Prunus mahaleb — semi-vigoureux, sols secs et calcaires, verger non irrigué.',
    updated_at = now()
WHERE id = 'pg-cerisier-sainte-lucie' AND nom = 'Cerisier Sainte-Lucie F12/1';

INSERT INTO porte_greffes (id, nom, vigueur, precocite, sensibilites, drageonnement, notes, updated_at)
SELECT 'pg-cerisier-f12-1', 'Cerisier F12/1', 5, 2, ARRAY['asphyxie'], false,
       'Clone de merisier (Prunus avium) — très vigoureux, hautes tiges.', now()
WHERE NOT EXISTS (SELECT 1 FROM porte_greffes WHERE id = 'pg-cerisier-f12-1');

INSERT INTO porte_greffe_especes (porte_greffe_id, espece_id)
SELECT 'pg-cerisier-f12-1', 'Cerisier'
WHERE NOT EXISTS (
  SELECT 1 FROM porte_greffe_especes WHERE porte_greffe_id = 'pg-cerisier-f12-1' AND espece_id = 'Cerisier'
);

-- A3. cmsog8uu4 — Venturia inaequalis = pommier seulement ; le poirier relève de V. pyrina.
UPDATE bioagresseurs
SET nom_commun = 'Tavelure du pommier', updated_at = now()
WHERE id = 'ba-tavelure' AND nom_commun = 'Tavelure';

DELETE FROM bioagresseur_especes
WHERE bioagresseur_id = 'ba-tavelure' AND espece_id = 'Poirier';

INSERT INTO bioagresseurs (id, nom_commun, nom_latin, type, organe_cible, periode_pression, methodes_pbi, updated_at)
SELECT 'ba-tavelure-poirier', 'Tavelure du poirier', 'Venturia pyrina', 'Maladie', 'Feuille',
       ARRAY['S12-S25'], ARRAY['biocontrôle', 'traitement_AB'], now()
WHERE NOT EXISTS (SELECT 1 FROM bioagresseurs WHERE id = 'ba-tavelure-poirier');

INSERT INTO bioagresseur_especes (bioagresseur_id, espece_id)
SELECT 'ba-tavelure-poirier', 'Poirier'
WHERE NOT EXISTS (
  SELECT 1 FROM bioagresseur_especes WHERE bioagresseur_id = 'ba-tavelure-poirier' AND espece_id = 'Poirier'
);

-- A4. cmsoeqlnm — « Fraise »/« Framboise » ressuscitées par le seed après la fusion
-- 20260514280000 (Fraisier/Framboisier canoniques). Zéro objet rattaché (vérifié le
-- 2026-08-11) ; les gardes NOT EXISTS re-vérifient au moment de l'exécution.
-- NB : « Kiwi » a le même problème mais PORTE des données (5 variétés, 1 culture) —
-- re-fusion à traiter dans un travail dédié, ne pas le supprimer ici.
DELETE FROM especes e
WHERE e.espece IN ('Fraise', 'Framboise')
  AND e.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM varietes v WHERE v.espece = e.espece)
  AND NOT EXISTS (SELECT 1 FROM cultures c WHERE c.espece = e.espece)
  AND NOT EXISTS (SELECT 1 FROM arbres a WHERE a.espece = e.espece)
  AND NOT EXISTS (SELECT 1 FROM itps i WHERE i.espece = e.espece);

-- ────────────────────────────────────────────────────────────────────────────
-- B1. cmsoff8j2 — la chèvre laitière est un grand mammifère (comme les 4 autres
-- profils chèvre) ; ligne héritée jamais corrigée (seed ON CONFLICT DO NOTHING).
UPDATE especes_animales
SET type = 'mammifere_grand'
WHERE espece_animale = 'chevre_laitiere' AND type = 'mammifere_petit';

-- ────────────────────────────────────────────────────────────────────────────
-- C. Compte démo.
-- C1. cmsoge7t9 — les 3 ventes de fromage du seed caprin n'ont pas leur sortie de
-- cave : créer les MouvementFromage manquants et aligner le type de vente sur le
-- chemin applicatif (le POST réel crée type='fromage' + mouvement).
INSERT INTO mouvements_fromage (id, user_id, lot_fromage_id, date, type, nb_pieces, poids_kg, notes, vente_produit_id)
SELECT 'repare-qa20260811-vf-' || v.id,
       v.user_id, v.lot_fromage_id, v.date, 'sortie_vente', 0, v.quantite,
       'Reprise 2026-08-11 : sortie de cave manquante (vente seed sans mouvement)',
       v.id
FROM ventes_produits v
JOIN users u ON u.id = v.user_id AND u.email = 'demo@gleba.fr'
WHERE v.id IN (98, 99, 100)
  AND v.lot_fromage_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM mouvements_fromage m WHERE m.vente_produit_id = v.id);

UPDATE ventes_produits v
SET type = 'fromage'
FROM users u
WHERE u.id = v.user_id AND u.email = 'demo@gleba.fr'
  AND v.id IN (98, 99, 100) AND v.type = 'autre' AND v.lot_fromage_id IS NOT NULL;

-- C2. cmsogchrf — la vente « Tomme » (98) est liée à la facture F-2026-0001 encore
-- émise (échéance future) : la facture fait foi, la vente ne peut pas être « payée ».
UPDATE ventes_produits v
SET paye = false
FROM users u, factures f
WHERE u.id = v.user_id AND u.email = 'demo@gleba.fr'
  AND v.id = 98 AND v.paye = true
  AND f.id = v.facture_id AND f.statut = 'emise';

-- C3. cmsoevxrj — filiation absurde posée le 2026-08-07 : Oslo (né 2021) avait pour
-- mère Nala (née 2022), ce qui bloquait en cycle toute filiation de Nala.
UPDATE animaux SET mere_id = NULL
WHERE id = 274 AND mere_id = 273
  AND user_id = (SELECT id FROM users WHERE email = 'demo@gleba.fr');

-- C4. cmsoexauc — identifiants IPG des chèvres démo invalides (FR85001 : FR+5
-- chiffres au lieu de FR+11) : alignés sur le nouveau seed (FR85000000001…04).
UPDATE animaux
SET identifiant = 'FR85' || lpad(right(identifiant, 3), 9, '0')
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@gleba.fr')
  AND identifiant ~ '^FR85[0-9]{3}$'
  AND type_identifiant = 'IPG caprin';

-- C4b. Même défaut sur les cochons démo (IPG porcin = FR+12 chiffres) :
-- FR859001/FR859002 → FR859000000001/02, comme le nouveau seed.
UPDATE animaux
SET identifiant = 'FR859' || lpad(right(identifiant, 3), 9, '0')
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@gleba.fr')
  AND identifiant ~ '^FR859[0-9]{3}$'
  AND type_identifiant = 'IPG porcin';

-- C5. cmsog7jf6 — stock boutique déclaratif de la démo incohérent avec la
-- production (53 œufs commercialisables ≈ 8 boîtes de 6, pas 40).
UPDATE produits_boutique pb
SET stock_dispo = 8
FROM users u
WHERE u.id = pb.user_id AND u.email = 'demo@gleba.fr'
  AND pb.id = 83 AND pb.stock_dispo = 40;

COMMIT;
