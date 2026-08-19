-- Reprise de données 2026-08-10 — QA cmsnobba5.
-- L'arbre « QA Pommier Jonagold Hélène v6 » (id 585, compte démo), planté le
-- 2026-08-10, est sorti « productif » à cause du défaut `true` (corrigé dans
-- POST /api/arbres : défaut dérivé de l'âge d'entrée en production).
-- Un pommier entre en production vers 3 ans. Idempotent.

BEGIN;

UPDATE arbres SET productif = false
WHERE id = 585
  AND user_id = 'cml3ygezz000010oxbdy53n8k'
  AND nom = 'QA Pommier Jonagold Hélène v6'
  AND date_plantation >= '2026-08-10';

SELECT id, nom, productif, date_plantation::date FROM arbres WHERE id = 585;

COMMIT;
