-- Reprise : libellé d'avoir figé sur un numéro de facture périmé.
-- Ticket cmsx5zhke (campagne QA navigateur du 2026-08-17).
--
-- À la création d'un avoir, le numéro de la facture d'origine était RECOPIÉ dans
-- son `objet` (« Avoir sur facture F-2026-0002 — motif »). Les deux factures du
-- compte de démonstration ont vu leurs numéros ÉCHANGÉS le 2026-08-17 par une
-- reprise de données antérieure (scripts/fix-qa-20260817.sql) : depuis, quatre
-- avoirs nomment une facture qui n'est plus la leur, donc un autre client. La
-- relation `facture_origine_id` et le `client_id`, eux, sont restés justes.
--
-- L'affichage lit désormais le numéro par la relation (l'écart ne peut plus
-- réapparaître à l'écran), mais le texte stocké sert encore l'« Objet » du PDF :
-- on le réaligne. Idempotent — ne touche que les lignes réellement divergentes,
-- et conserve le motif tel quel.

BEGIN;

-- Avant
SELECT a.id, a.numero, a.objet, o.numero AS origine_numero
FROM factures a JOIN factures o ON o.id = a.facture_origine_id
WHERE a.type = 'avoir' AND a.objet LIKE 'Avoir sur facture %'
  AND a.objet NOT LIKE 'Avoir sur facture ' || o.numero || '%'
ORDER BY a.id;

UPDATE factures a
SET objet = 'Avoir sur facture ' || o.numero ||
            COALESCE(' — ' || NULLIF(split_part(a.objet, ' — ', 2), ''), '') ||
            COALESCE(' — ' || NULLIF(split_part(a.objet, ' — ', 3), ''), ''),
    updated_at = NOW()
FROM factures o
WHERE o.id = a.facture_origine_id
  AND a.type = 'avoir'
  AND a.objet LIKE 'Avoir sur facture %'
  AND a.objet NOT LIKE 'Avoir sur facture ' || o.numero || '%';

-- Après : doit renvoyer 0 ligne.
SELECT count(*) AS divergences_restantes
FROM factures a JOIN factures o ON o.id = a.facture_origine_id
WHERE a.type = 'avoir' AND a.objet LIKE 'Avoir sur facture %'
  AND a.objet NOT LIKE 'Avoir sur facture ' || o.numero || '%';

SELECT a.id, a.numero, a.objet FROM factures a WHERE a.type = 'avoir' ORDER BY a.id;

COMMIT;
