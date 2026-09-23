-- Partie B — APRÈS la bascule de l'image contenant le lot du 2026-09-19.
-- Préférer /admin/bugs (bouton Résolu) pour que les 4 comptes déclarants
-- reçoivent le mail de résolution ; ce script est le repli SANS mail.
-- Exécution : sudo -n docker exec -i gleba_db psql -U gleba -d gleba -v ON_ERROR_STOP=1 < scripts/classement-bugs-20260919-post-deploy.sql
BEGIN;
UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW()
WHERE status = 'IN_PROGRESS'
  AND id IN ('cmtyjtvk3001ns509dspdtg4q','cmu4mp12y002m1wcbytujre49','cmu6mw1dn003n1wcbqzgw7dzy','vigie5388491193fadcb7e8e383c4','vigie0abcc08c8662d23884ad2516','vigie459b2072dc5bb29c48ebb74d','vigie233671876a4be8fa207a69eb','cmu6tpz930005y8vmmf0u47ji','vigiebd964114c562a64c96f2bbd0','cmu6w626e0021y8vmtb7fw1xi','cmu6wifjt0025y8vmieroil53','vigie3cad49684a85fd96829b7aa5','cmu75dtu80003poajra2xkcxi','vigiedfad0de0b0df1580120619ce');
INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, changed_by_id, note, changed_at)
SELECT 'bslpost' || substr(md5(id || 'post'), 1, 22), id, 'IN_PROGRESS', 'RESOLVED', 'admin_gleba_2026',
  'Lot du 2026-09-19 déployé.', NOW()
FROM bug_reports WHERE status = 'RESOLVED' AND resolved_at > NOW() - interval '1 minute'
  AND id IN ('cmtyjtvk3001ns509dspdtg4q','cmu4mp12y002m1wcbytujre49','cmu6mw1dn003n1wcbqzgw7dzy','vigie5388491193fadcb7e8e383c4','vigie0abcc08c8662d23884ad2516','vigie459b2072dc5bb29c48ebb74d','vigie233671876a4be8fa207a69eb','cmu6tpz930005y8vmmf0u47ji','vigiebd964114c562a64c96f2bbd0','cmu6w626e0021y8vmtb7fw1xi','cmu6wifjt0025y8vmieroil53','vigie3cad49684a85fd96829b7aa5','cmu75dtu80003poajra2xkcxi','vigiedfad0de0b0df1580120619ce');
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 1;
COMMIT;
