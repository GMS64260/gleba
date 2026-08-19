-- Classement de la campagne QA du 2026-08-12 au soir (47 signalements déposés
-- APRÈS le solde du registre ce matin-là, donc jamais traités).
--
-- Écrit en SQL et non via l'API admin : celle-ci envoie un mail de résolution
-- au rapporteur, qui est ici le compte de démonstration.
--
-- Seuls les tickets dont le verdict est PROUVÉ sont classés. Les autres
-- restent OPEN / IN_PROGRESS : un statut posé sans preuve vaut moins que rien.
BEGIN;

-- ── CORRIGÉS, preuve à l'appui ───────────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 : consommationHebdoTotale (src/lib/irrigation/consommation.ts) est désormais la source unique, appelée par irrigation-conseil.ts ET par irriguer/page.tsx. Le KPI et les groupes dérivent du même calcul, la double sommation par culture a disparu.'
WHERE id = 'cmsqlstoi005nk4gssfx4zb17';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 sur l''API de production : /api/comptabilite/stocks renvoie Tomate stock=10.8. Plus aucune quantité à décimales longues dans la charge utile.'
WHERE id IN ('cmsqlr6jb005lk4gsq7c7wb9u', 'cmsqlu096005tk4gsy48ka9jw');

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 : plus aucune occurrence de « Utilise (» ni de « Marquer comme utilise » sans accent dans src/.'
WHERE id = 'cmsqlpgsz005fk4gsyxgdk904';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 : plus aucune occurrence de « Mortalite » sans accent dans src/.'
WHERE id = 'cmsqlupl2005xk4gs3t4j55zm';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 : DELETE /api/arbres/[id] snapshote l''identité de l''arbre (snapshotArbre) et détache les traitements phyto au lieu de les supprimer, conformément à la promesse de la confirmation.'
WHERE id = 'cmsqm294j006jk4gs5wkavhk7';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 en base de production : les 40 espèces arbre_fruitier du référentiel officiel portent toutes unite_rendement = kg_arbre, aucune sans unité. L''unité n''est plus kg/m2. NOTE : la JUSTESSE des valeurs tempérées reste un défaut distinct, suivi par cmsqn2l09007tk4gsc9u69w5y.'
WHERE id = 'cmsqlu3os005vk4gsdidadyqd';

-- ── ÉCART PRODUIT ASSUMÉ, pas un défaut ──────────────────────────────────────

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', updated_at = now(),
  admin_note = 'Vérifié 2026-08-14 : POST /api/comptabilite/fournisseurs passe par requireAdminApi, 403 reproduit en session réelle. Le refus est VOULU — le référentiel fournisseurs est partagé entre comptes (décision produit du 2026-08-07). L''écart réel est produit : un exploitant ne peut pas tenir ses propres fournisseurs. À trancher, pas à corriger comme un bug.'
WHERE id = 'cmsqlixl2004zk4gs7qub6533';

COMMIT;

-- Contrôle
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY status;
