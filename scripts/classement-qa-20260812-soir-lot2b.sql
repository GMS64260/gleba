-- Correctif du classement : id mal recopié dans le lot 2 (0079 ≠ 007p).
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproductible le 2026-08-14 en navigateur headless : /jardin?usage=verger rechargé deux fois restaure Demo-V, sélecteur présent, plan peuplé. La restauration par URL (?parcelle/?usage) est en place.'
WHERE id='cmsqn0mh5007pk4gsbiuxv8a3' AND status='OPEN';
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY status;
