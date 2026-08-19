-- Classement de la 2e campagne QA navigateur du 2026-08-17 (15 signalements
-- déposés entre 07:26 et 07:53 UTC, soit APRÈS la bascule de 07:01 — donc tous
-- contre l'image `8baa6f94c245`).
-- Écrit en SQL et non via l'API admin (qui enverrait un mail au compte démo).
-- Recompter les restants après COMMIT.

BEGIN;

-- ── RESOLVED : corrigés, déployés et prouvés en production ────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé. L''année du hub Planification vivait dans 9 implémentations différentes : 2 écrans lisaient l''URL, 7 la gardaient en état local (un rechargement ou un lien partagé revenait à l''année courante) et chacun recalculait sa plage. Un hook unique (useAnneePlanification) impose la règle : deep-link ?annee= prioritaire, sinon saison mémorisée du module (même clé que le dashboard maraîchage), sinon année courante ; les chargements attendent la restauration pour ne pas afficher une autre saison. La plage est désormais commune au module (N-5..N+5), donc 2028 existe partout.'
WHERE id = 'cmswwu5cc0001z0uvto7gc16c' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. La fenêtre glissante du taux de ponte était calculée en millisecondes (fin - 6x24h), donc bornée à l''heure courante : une collecte datée du 7e jour à minuit tombait AVANT le début de fenêtre et sortait du numérateur, alors que le dénominateur comptait bien 7 jours. Le taux portait en réalité sur 6 jours de collecte. Les deux bornes sont désormais alignées sur le jour civil local (helper partagé fenetrePonteGlissante), comme la décision d''irrigation. Prouvé en prod : 32,2 % = 88 œufs / 39 pondeuses / 7 j (les 88 œufs du 11 au 17/08 sont bien comptés ; l''ancien calcul en donnait 68).'
WHERE id = 'cmswwvsoj0005z0uv7qis74af' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. getAvailableYears (plage pensée pour la compta) s''arrêtait à N+1 alors que les écrans de planification proposaient N-5..N+5 et que le moteur de rotation matérialise des cultures plusieurs saisons à l''avance : une culture créée pour 2028 était PERSISTÉE mais INACCESSIBLE, aucun sélecteur du module ne proposant l''année. Le module Maraîchage couvre désormais l''horizon des rotations (anneesMaraichage, N-5..N+5), plage unique partagée par le dashboard et les 9 écrans de planification. Prouvé en prod : /api/cultures?annee=2028 renvoie la Phacélie C4.'
WHERE id = 'cmswwx0nj0007z0uvp590gqxl' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. Le décès d''une fiche nominative rattachée à un lot ne décrémentait rien : quantiteActuelle (comptage anonyme) ne bouge pas à la mort d''un individu, et le plafond reconstitué (initial + naissances - abattages) ignorait les sorties nominatives. Le lot restait donc à 4 têtes après la mort de la 4e, et le dashboard comptait un actif de trop. reconstituerEffectifsLots retranche désormais les sorties de fiches (morte, vendue, abattue), sans double compter un abattage déjà porté par le lot. Prouvé en prod : lot « Pintades perle A3 1708 » à 3 (était 4), dashboard 13 hors lot + 106 en lots.'
WHERE id = 'cmswxat0n000kz0uvofgn4gzb' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé. La surface totale était affichée telle quelle : cumul de flottants, donc « 1849.8999999999999 m² ». Arrondi à la source (générateur du registre, partagé par l''écran, l''export et l''outil assistant) et formatage fr-FR sur l''écran, cartes et lignes. Prouvé en prod : 1 849,9 m².'
WHERE id = 'cmswxf83f000qz0uvrqqw0ck8' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug réglementaire, corrigé. Le registre phyto lit trois tables : Intervention, ObservationSante (formulaire Verger > Santé & Phyto, qui porte AMM/dose/DAR/ZNT/EPI/certiphyto) et OperationArbre de type traitement. Seule la première survivait à la suppression de l''arbre ; les deux autres portent un arbre_id OBLIGATOIRE en cascade, donc le traitement disparaissait du registre avec la fiche. Le message d''avertissement, lui, était exact mais annonçait cette purge — ce qui reste inacceptable pour une obligation de conservation. Désormais toute trace phyto est versée au registre en intervention détachée (identité de l''arbre snapshotée, champs réglementaires conservés) avant la suppression, et le registre relit ce snapshot pour nommer la ligne au lieu d''afficher « Non renseigné ». Avertissement de suppression réécrit en conséquence. Prouvé en prod (écritures de vérification nettoyées) : registre 17 -> 18 à la saisie, 18 après suppression définitive de l''arbre, ligne conservée avec dose 0,5 L/ha, DAR 7 j, ZNT 20 m.'
WHERE id = 'cmswxinhf000tz0uvl9fcp820' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé. La ligne titre de /interventions ne repliait pas : titre (~180 px) + sélecteur d''année + bouton « Nouvelle intervention » (~195 px) ne tiennent pas dans les 344 px utiles d''un écran de 375 px, et aucun de ces blocs n''est réductible (min-width auto). Le tableau était bien dans un conteneur défilant ; c''est cette ligne qui poussait le document à 502 px. Passée en flex-wrap avec gouttière.'
WHERE id = 'cmswxlath000vz0uvxepeu9xh' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé sur les deux plans. (1) Code : une culture planifiée dont le référentiel ne permet aucun calcul retombait dans le statut IGNORE (« rien à commander »), filtré des trois tableaux et des totaux — elle disparaissait donc sans le moindre message, alors que l''en-tête la comptait toujours (« 3 espèces » pour 2 lignes). Nouveau statut DONNEE_MANQUANTE : la ligne reste listée avec le badge « Dose manquante » et un bandeau nomme les espèces concernées. (2) Référentiel : aucun engrais vert du catalogue ne portait de dose de semis ; les 7 doses sont renseignées par la migration 20260817083000 (Phacélie 1 g/m2 = 10 kg/ha, Vesce 10, Trèfle blanc 1, Trèfle incarnat 2,5, Trèfle violet 2, Mélilot 2, Mélange 3). Prouvé en prod : Semences 2028 liste bien 4 espèces dont la Phacélie, besoin 55,34 g pour 48,1 m2. Reste ouvert (hors périmètre de ce ticket) : 83 autres espèces planifiables du catalogue sans dose, désormais visibles au lieu d''être escamotées.'
WHERE id = 'cmswxo3ri000zz0uvfgip59ow' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. L''en-tête et les trois cartes lisaient getRecoltesAnneeAggregat, borné aux cultures RÉELLEMENT créées, tandis que le tableau mensuel projette aussi les cultures suggérées par les rotations : en 2028, une seule culture créée donnait « 0,0 kg » face à 361,9 kg en juillet. Le total couvre désormais ce que l''écran montre, et la part encore à créer est nommée sous la carte « Projection restante » (même parti que Semences et Plants). Prouvé en prod : total attendu 370,95 kg = 361,9 (juillet) + 9,0 (août), dont 370,95 kg de rotations non créées.'
WHERE id = 'cmswxpaer0011z0uvzh5a2d84' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai manque de données, corrigé et généralisé. La chasse au motif a trouvé 27 espèces officielles sans nom botanique (et pas seulement les 2 signalées) : migration 20260817083000, additive et idempotente, sur le seul catalogue Gleba et les seules valeurs vides. Mûrier sans épine = Rubus fruticosus, Physalis = Physalis peruviana. Restent volontairement sans nom latin : « Mélange » et « Mesclun », qui sont des mélanges d''espèces et non des taxons. Prouvé en prod.'
WHERE id = 'cmswxphw60013z0uvrpkcuij9' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug de fond, corrigé. calculerDateDepuisSemaine — la fonction qui ÉCRIT les dates en base pour « Créer les cultures » — ancrait la semaine 1 sur « la semaine contenant le 1er janvier » (convention date-fns getWeek), alors que toute l''application relit les dates en semaine ISO (getISOWeek, ancrage 4 janvier). Les deux conventions divergent dès que le 1er janvier tombe un vendredi, samedi ou dimanche : 2027, 2028, 2032, 2033… D''où S31/S43 à la suggestion et S30/S42 après création, avec des dates réelles une semaine trop tôt ; une culture en S01 sortait même de la vue annuelle (getISOWeekYear renvoyant l''année précédente). Convention unifiée sur l''ISO pour l''écriture comme pour la lecture (assistant compris), invariant d''aller-retour verrouillé par test sur 9 années x 52 semaines. Reprise de données : 5 cultures recalées d''une semaine (4 haricot sec 2027, la Phacélie C4 2028), sur critère strict — la date stockée devait être exactement celle produite par l''ancienne convention, calibrage ITP par zone compris, de sorte qu''aucune saisie manuelle ne soit touchée. Prouvé en prod : Phacélie C4 créée affiche S31/S43, comme C1, C2 et C3.'
WHERE id = 'cmswxqnaz0015z0uvm6lrhyfd' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Corrigé. Les trois filtres masquaient leur libellé sous 640 px sans aucun équivalent accessible : trois icônes ambiguës. « Toutes / À faire / Réalisées » tiennent largement dans 375 px, les libellés sont donc toujours affichés, avec aria-label et title en renfort. Le même motif (libellé masqué sans nom accessible) a été traité partout où il existait : référentiel maraîchage, liste Cultures, arbres, référentiel verger et catégories de l''assistant.'
WHERE id = 'cmswxt8a80017z0uvsklri8ov' AND status = 'OPEN';

-- ── RESOLVED, non reproductible ───────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Non reproductible : la date de rappel n''a jamais atteint le serveur, et le chemin serveur est prouvé fonctionnel le même matin. Preuves : le soin 115 (« Vaccin test rappel A3 1708 », 07:40) a date_prevue NULL et aucune ligne de rappel, alors que le soin 110 saisi à 05:59 sur le même formulaire a bien produit son rappel 111 daté du 24/08 (fait=false, visible aux soins à faire et au calendrier). La matérialisation du rappel ne dépend ni du produit libre ni du type de soin, seulement de fait=true + datePrevue > date du soin. Le champ « Rappel planifié » porte déjà un name= et un filet FormData lu au submit (QA cmsp5ckbx) : une saisie clavier ou calendrier est donc conservée. Cause probable du signalement : valeur posée directement dans le DOM sans événement, que React réécrase au rendu suivant (l''input est contrôlé) — artefact d''instrumentation, pas un défaut du produit. Aucun correctif : à rejouer par une saisie réelle si le cas se reproduit.'
WHERE id = 'cmswxdmtv000oz0uv87k7xu5w' AND status = 'OPEN';

-- ── HORS_PERIMETRE : faux positif retiré par son auteur ───────────────────

UPDATE bug_reports SET status = 'HORS_PERIMETRE', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Faux positif, retiré par son auteur (signalement cmswxmbo2000xz0uve77406i1). Le bouton Plantation du référentiel verger ouvre bien la modale « Assistant Plantation » ; un F5 la referme, ce qui est le comportement normal d''une fenêtre modale et non une panne de navigation. Vérifié au code : aucune modale de l''application n''est adressable par l''URL. Aucun correctif.'
WHERE id = 'cmswwuqqm0003z0uvsr2n5v9r' AND status = 'OPEN';

UPDATE bug_reports SET status = 'HORS_PERIMETRE', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Note administrative et non un défaut : retrait par son auteur du signalement cmswwuqqm0003z0uvsr2n5v9r (« Bouton Plantation inopérant »), lui-même classé hors périmètre. Aucune action produit.'
WHERE id = 'cmswxmbo2000xz0uve77406i1' AND status = 'OPEN';

-- ── Journal de statut (traçabilité du classement) ─────────────────────────

INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, note, changed_at)
SELECT gen_random_uuid()::text, id, 'OPEN', status,
       'Campagne QA navigateur du 2026-08-17 (2e lot, 07:26-07:53) : classement après correctifs déployés et prouvés en production.',
       NOW()
FROM bug_reports
WHERE id IN (
  'cmswwu5cc0001z0uvto7gc16c','cmswwuqqm0003z0uvsr2n5v9r','cmswwvsoj0005z0uv7qis74af',
  'cmswwx0nj0007z0uvp590gqxl','cmswxat0n000kz0uvofgn4gzb','cmswxdmtv000oz0uv87k7xu5w',
  'cmswxf83f000qz0uvrqqw0ck8','cmswxinhf000tz0uvl9fcp820','cmswxlath000vz0uvxepeu9xh',
  'cmswxmbo2000xz0uve77406i1','cmswxo3ri000zz0uvfgip59ow','cmswxpaer0011z0uvzh5a2d84',
  'cmswxphw60013z0uvrpkcuij9','cmswxqnaz0015z0uvm6lrhyfd','cmswxt8a80017z0uvsklri8ov'
);

-- Contrôles avant COMMIT. Les OPEN restants sont les signalements déposés
-- APRÈS ce lot (07:56 et suivants), traités séparément.
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 2 DESC;
SELECT count(*) AS lot_non_classe FROM bug_reports
  WHERE status IN ('OPEN','IN_PROGRESS')
    AND created_at BETWEEN '2026-08-17 07:20:00' AND '2026-08-17 07:55:00';
SELECT count(*) AS notes_vides FROM bug_reports
  WHERE created_at BETWEEN '2026-08-17 07:20:00' AND '2026-08-17 07:55:00'
    AND (admin_note IS NULL OR admin_note = '');

COMMIT;
