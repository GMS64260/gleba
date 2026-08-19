-- Classement des 4 derniers signalements de la 2e campagne QA du 2026-08-17
-- (déposés entre 07:56 et 08:06, pendant le traitement du lot précédent).
-- Écrit en SQL et non via l'API admin (qui enverrait un mail au compte démo).

BEGIN;

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. L''atelier apicole portait ses coûts mais aucune production : la ventilation ne connaissait que les œufs, les litres de lait livrés et les kg de carcasse. Le miel entre désormais au dénominateur (récoltes en kg ou en g ramenées au kilogramme). Deux corrections complémentaires trouvées à la vérification : (1) une récolte saisie sans ruche désignée tombait dans le fourre-tout « Non affecté » alors que le produit désigne l''atelier — elle est ventilée sous « Miel — ruche non renseignée », même parti que le lait livré sans espèce renseignée ; (2) un atelier sans coût imputé n''annonce plus « 0,000 € / kg », qui se lisait comme une production gratuite alors que c''est l''imputation qui manque. Prouvé en prod : « Ruche (abeille domestique) » 3,00 € / 4,3 kg = 0,698 €/kg, et les 15 kg récoltés sans ruche isolés sur leur propre ligne sans coût unitaire trompeur. L''écart avec les 19,3 kg annuels du signalement est donc désormais expliqué à l''écran : seuls 4,3 kg sont rattachés à la ruche qui porte les coûts.'
WHERE id = 'cmswxw80j001az0uv9e9tdnum' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé. Le sélecteur d''espèce est un Select Radix, qui rend un <select> natif caché (SelectBubbleInput) : une valeur posée sur ce select sans passer par onValueChange laisse l''état React à null, et l''ITP partait « Aucune espèce » alors que le choix semblait fait — l''ITP créé à 07:58 est bien en base avec espece NULL. Même filet que les autres formulaires de l''application (OperationsTab, AlimentationTab) : le Select porte un name= et le DOM soumis fait foi quand l''état React est vide, à la création comme à la modification. Le chemin serveur était sain (POST /api/itps mappe especeId, valide la visibilité de l''espèce parente et la cohérence semis direct). Prouvé en prod : ITP créé avec especeId = Phacélie.'
WHERE id = 'cmswxy73g001gz0uveqgkrtjf' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Vrai bug, corrigé — mais l''ITP n''avait pas disparu. Il est bien en base (cmswxxflj001cz0uv7rgv7wof), avec ses semaines, sa durée, ses rangs et ses notes : c''est son NOM qui avait été réécrit. `cleanReferentielName` servait à la fois de clé de déduplication et de libellé stocké ; son remplacement des tirets et underscores par des espaces est indispensable à la première (« Carotte-Nantaise » et « Carotte Nantaise » sont bien un doublon) et faux pour la seconde. « TEST-Marc-Phacelie-v7 » était donc enregistré « TEST Marc Phacelie v7 », et la recherche par le nom exact tapé ne rendait rien — d''où la conclusion, compréhensible, que la saisie était perdue. Deux corrections : (1) le libellé est conservé tel que saisi (trim et espaces multiples réduites, rien d''autre) pour les ITP, les espèces et les variétés, la clé de dédup restant normalisée ; (2) les trois recherches interrogent en plus la colonne nomNormalise avec la saisie normalisée, donc insensibles à la ponctuation, aux accents et à la casse. Prouvé en prod : nom stocké « VERIF-Lot2-Phacelie-v7 » à l''identique, retrouvé aussi bien par le nom tapé que par sa graphie sans tiret. Règle du brain confirmée : un libellé appartient à celui qui le saisit, il n''est jamais une clé.'
WHERE id = 'cmswxyuoi001iz0uvc5ctdmi6' AND status = 'OPEN';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW(), admin_note =
  'Constat exact, cause légitime, défaut de transparence réel — corrigé. Deux planches sur la même rotation DOIVENT pouvoir être à des étapes différentes : c''est le principe de l''étalement d''un cycle, et la phase est ancrée sur l''année de départ du cycle de chaque planche (Planche.annee). Ici C1 à C4 portent 2026 (étape 1 en 2026) tandis que TEST-MARC-V7 n''a aucune année de départ : le calcul retombe alors sur un epoch fixe (2000), donc sur une phase arbitraire — étape 3 sur 3. Rien n''exposait ni l''ancrage ni la position dans le cycle, et le champ existant s''intitulait « Année rotation » sans dire ce qu''il décide. Corrigé : la position dans le cycle et son ancrage sont exposés par l''API et affichés dans la vue Cultures prévues par planches (« étape 1/3 · départ 2026 » vs « étape 3/3 · départ non défini (phase arbitraire) »), y compris pour les planches déjà cultivées qui passaient par un autre chemin de calcul ; la fiche planche nomme le champ « Année de départ du cycle de rotation », explique qu''il décale le cycle d''une planche à l''autre, et signale en clair l''ancrage manquant. Prouvé en prod sur les 5 planches du signalement. L''utilisateur peut désormais lire la cause et la corriger en renseignant l''année de départ.'
WHERE id = 'cmswy9fyr001sz0uv62cmybpm' AND status = 'OPEN';

INSERT INTO bug_status_logs (id, bug_report_id, from_status, to_status, note, changed_at)
SELECT gen_random_uuid()::text, id, 'OPEN', status,
       'Campagne QA navigateur du 2026-08-17 (lot 3, tickets 07:56-08:06) : classement après correctifs déployés et prouvés en production.',
       NOW()
FROM bug_reports
WHERE id IN (
  'cmswxw80j001az0uv9e9tdnum','cmswxy73g001gz0uveqgkrtjf',
  'cmswxyuoi001iz0uvc5ctdmi6','cmswy9fyr001sz0uv62cmybpm'
);

-- Contrôles avant COMMIT
SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY 2 DESC;
SELECT count(*) AS restants_open_ou_encours FROM bug_reports WHERE status IN ('OPEN','IN_PROGRESS');
SELECT count(*) AS notes_vides FROM bug_reports
  WHERE created_at > '2026-08-17 07:55:00' AND (admin_note IS NULL OR admin_note = '');

COMMIT;
