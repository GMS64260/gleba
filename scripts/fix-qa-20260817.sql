-- Reprise de données QA 2026-08-17 — ticket cmswtt0ee.
-- Le lot vétérinaire COB-A3-1708 (compte démo) a été créé avec une
-- péremption saisie (17/08/2027) mais perdue par le formulaire
-- (input[type=date] contrôlé sans filet — corrigé dans le code).
-- Restitue la valeur saisie documentée dans le signalement, plus le
-- snapshot réglementaire des soins rattachés. Idempotent.

BEGIN;

UPDATE stocks_medicaments_elevage
   SET date_peremption = TIMESTAMP '2027-08-17 00:00:00',
       updated_at      = NOW()
 WHERE id = 'cmswtq2jy0008h51mnhip63ty'   -- COB-A3-1708, demo@gleba.fr
   AND date_peremption IS NULL;

UPDATE soins_animaux
   SET peremption_medicament = TIMESTAMP '2027-08-17 00:00:00'
 WHERE stock_medicament_id = 'cmswtq2jy0008h51mnhip63ty'
   AND peremption_medicament IS NULL;

SELECT id, numero_lot, date_peremption
  FROM stocks_medicaments_elevage
 WHERE id = 'cmswtq2jy0008h51mnhip63ty';

-- Ticket cmswug6di — collecte de 1 œuf créée SANS sélection de lot (le
-- SelectBubbleInput Radix soumettait le premier lot de la liste). Aucun
-- mouvement de stock ne la référence (vérifié) : suppression simple.
DELETE FROM production_oeufs
 WHERE id = 1507
   AND quantite = 1
   AND lot_id = 70;

-- Ticket cmswu8thr — « Véraison » (terme viticole) remplacé par le libellé
-- générique fruitiers dans le sélecteur BBCH ; réaligne la valeur stockée
-- pour que l'édition d'une observation existante retrouve son option.
UPDATE observations_sante
   SET stade_bbch = 'BBCH 81 - Début de maturation'
 WHERE stade_bbch = 'BBCH 81 - Véraison';

-- Ticket cmswu8roo — le seed numérotait les factures démo dans l'ordre du
-- code : F-2026-0001 (16/07) postérieure à F-2026-0002 (20/06). Échange des
-- deux numéros (index unique (user_id, numero) → numéro temporaire).
-- Idempotent : gardé par l'appariement id+numéro actuel.
UPDATE factures SET numero = 'F-2026-TMP'  WHERE id = 21 AND numero = 'F-2026-0001';
UPDATE factures SET numero = 'F-2026-0001' WHERE id = 22 AND numero = 'F-2026-0002';
UPDATE factures SET numero = 'F-2026-0002' WHERE id = 21 AND numero = 'F-2026-TMP';

COMMIT;
