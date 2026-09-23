-- Traitement des 15 signalements OPEN du registre bug_reports — 2026-09-19.
-- Partie A (à exécuter MAINTENANT, avant déploiement) :
--   * 1 ticket déjà résolu en production → RESOLVED ;
--   * 14 tickets corrigés dans l'arbre de travail (non déployés) → IN_PROGRESS,
--     avec note admin. Ils passent RESOLVED APRÈS la bascule, de préférence
--     depuis /admin/bugs (le PATCH envoie le mail de résolution aux 4 comptes
--     déclarants ; un UPDATE SQL ne l'envoie pas — leçon du 18/08).
-- Exécution : sudo -n docker exec -i gleba_db psql -U gleba -d gleba -v ON_ERROR_STOP=1 < scripts/classement-bugs-20260919.sql
BEGIN;

-- 1. HEAD /api/auth → 405 : commit ceb39c6 (31/08), déployé dans fe36b15 le
--    09/09 ; 0 UnknownAction dans api_errors depuis la bascule (35 avant).
UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(),
  admin_note = 'Déjà corrigé et déployé (commit ceb39c6 du 31/08, image fe36b15 du 09/09) : HEAD répond 405 sans passer par Auth.js. 0 UnknownAction dans api_errors depuis la bascule.'
WHERE id = 'vigied6d47ebd96acd5e843a2af19' AND status = 'OPEN';
INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, changed_by_id, note, changed_at)
SELECT 'bsl20260919' || substr(md5(id), 1, 18), id, 'OPEN', 'RESOLVED', 'admin_gleba_2026',
  'Vérifié le 2026-09-19 : correctif en production depuis le 09/09, compteur à 0.', NOW()
FROM bug_reports WHERE id = 'vigied6d47ebd96acd5e843a2af19' AND status = 'RESOLVED';

-- 2..15. Corrigés dans l'arbre de travail le 2026-09-19 (ou par la vigie les
--        12 et 18/09), en attente de déploiement.
WITH notes(id, note) AS (VALUES
  ('cmtyjtvk3001ns509dspdtg4q', 'Outil assistant create_cultures (lot confirmé, une entrée par planche) présent dans l''arbre depuis le 12/09, non déployé. Le calendrier complet se saisit en un appel.'),
  ('cmu4mp12y002m1wcbytujre49', 'Plan 2D : angle libre au demi-degré (champ de saisie) + boutons ±5° et 90° pour planches et objets (RotationControl). Corrigé le 19/09, à déployer.'),
  ('cmu6mw1dn003n1wcbqzgw7dzy', 'Onglets Élevage sur mobile/tablette : le menu déroulant fermé n''affichait que « Calendrier », les autres sections étaient introuvables. Remplacé par une rangée d''onglets visibles (ModuleTabBar, 18/09). À déployer.'),
  ('vigie5388491193fadcb7e8e383c4', 'Carte : bouton Dupliquer dans le panneau d''une parcelle (copie de même tracé posée juste à l''est, nom « (copie) » numéroté), carte de l''application mise à jour. Corrigé le 19/09, à déployer.'),
  ('vigie0abcc08c8662d23884ad2516', 'Plan 2D : rotation libre au demi-degré + ±5°, type d''objet « Tunnel / abri » (8 × 30 m) ajouté au catalogue, reclassement d''une planche en serre ou tunnel. Corrigé le 19/09, à déployer.'),
  ('vigie459b2072dc5bb29c48ebb74d', 'Une culture reste rattachée à UNE planche (modèle). L''assistant crée désormais la même culture sur plusieurs planches en un lot (create_cultures, sourceCultureId pour copier T11 vers T12/T13 à l''identique). À déployer.'),
  ('vigie233671876a4be8fa207a69eb', 'get_cultures expose itp, longueur, quantite, espacement, finRecolte ; create_culture(s) les acceptent et sourceCultureId copie une culture existante à l''identique (ITP, dates, rangs, longueur, quantité, espacement, irrigation, notes). Corrigé le 19/09, à déployer.'),
  ('cmu6tpz930005y8vmmf0u47ji', 'Cause : le fond de Tunnel 1 et le fond commun sont deux images aux réglages indépendants ; aligner en déplaçant les PLANCHES désalignait l''autre. Nouveau : outil « Déplacer le fond » (glisser l''image sous les planches), champs Décalage X/Y, texte explicite dans le dialogue. Corrigé le 19/09, à déployer.'),
  ('vigiebd964114c562a64c96f2bbd0', 'Outil « Déplacer le fond » (glisser l''image, offsetX/offsetY persistés), champs Décalage X/Y dans le dialogue, libellé « Retirer (revenir au fond commun) » pour un fond de parcelle, explication parcelle/commun. Corrigé le 19/09, à déployer.'),
  ('cmu6w626e0021y8vmtb7fw1xi', 'update_planches_ilot accepte typeSol et retentionEau (« forte » → « Élevée ») sur toutes les planches ou un sous-ensemble ; create_planches_serie aussi. Présent dans l''arbre depuis le 18/09, non déployé.'),
  ('cmu6wifjt0025y8vmieroil53', 'Nouvel outil assistant update_planches_position : pose des planches côte à côte (noms ou plage I301..I325), sens droite/gauche/haut/bas, écart en m, orientation. get_planches expose posX/posY/rotation2D. Corrigé le 19/09, à déployer.'),
  ('vigie3cad49684a85fd96829b7aa5', 'Nouvel outil assistant update_planches_position (posX/posY/rotation2D par lot, même convention que la duplication du plan). Corrigé le 19/09, à déployer.'),
  ('cmu75dtu80003poajra2xkcxi', 'Nouvel outil assistant delete_planches (noms ou plage) : supprime les planches sans culture, conserve et nomme celles qui en portent. Carte de l''application : suppression unitaire dans /maraichage/planches. Corrigé le 19/09, à déployer.'),
  ('vigiedfad0de0b0df1580120619ce', 'Nouvel outil assistant delete_planches, même règle que DELETE /api/planches/[id] (refus si cultures), appliquée planche par planche. Corrigé le 19/09, à déployer.')
)
UPDATE bug_reports b SET status = 'IN_PROGRESS', admin_note = n.note, updated_at = NOW()
FROM notes n WHERE b.id = n.id AND b.status = 'OPEN';

INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, changed_by_id, note, changed_at)
SELECT 'bsl20260919' || substr(md5(id), 1, 18), id, 'OPEN', 'IN_PROGRESS', 'admin_gleba_2026',
  'Correctif dans l''arbre de travail le 2026-09-19, en attente de déploiement.', NOW()
FROM bug_reports
WHERE status = 'IN_PROGRESS'
  AND id IN ('cmtyjtvk3001ns509dspdtg4q','cmu4mp12y002m1wcbytujre49','cmu6mw1dn003n1wcbqzgw7dzy','vigie5388491193fadcb7e8e383c4','vigie0abcc08c8662d23884ad2516','vigie459b2072dc5bb29c48ebb74d','vigie233671876a4be8fa207a69eb','cmu6tpz930005y8vmmf0u47ji','vigiebd964114c562a64c96f2bbd0','cmu6w626e0021y8vmtb7fw1xi','cmu6wifjt0025y8vmieroil53','vigie3cad49684a85fd96829b7aa5','cmu75dtu80003poajra2xkcxi','vigiedfad0de0b0df1580120619ce');

SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 1;
COMMIT;
