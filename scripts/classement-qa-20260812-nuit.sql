-- Classement de la campagne QA du 2026-08-11 soir (18 signalements du compte démo),
-- traitée et déployée le 2026-08-12 au matin (image construite à 07:39 UTC).
--
-- Écriture en SQL et NON via l'API admin : celle-ci envoie un mail de résolution
-- au rapporteur, qui est ici le compte de démonstration.
-- Chaque ticket porte la trace de son correctif ou le motif de sa requalification.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- RESOLVED — 16 tickets corrigés et prouvés en production
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Garde serveur d''unicité cadastrale ajoutée au POST /api/carte (commune + section + numéro) : le ré-import répond 409 au lieu de créer un homonyme. Prouvé en prod (409 sur Mellionnec WK 0016, import d''une référence neuve toujours accepté). Le bouton d''import du panneau cadastre se désactive après usage. Les 7 doublons du 2026-08-10 supprimés (aucune des 13 FK ne les référençait) : 2 parcelles Mellionnec restantes.'
WHERE id = 'cmsp57mck0008ucz83ukc67qf';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Le garde-fou doublon (lot, date) du POST /api/elevage/production-oeufs était le seul des trois à ignorer overrideCoherence : la confirmation « Ajouter une 2e ligne » rejouait le POST et se faisait refuser à l''identique, donc une seconde collecte du jour était impossible. Prouvé en prod : 422 DOUBLON_DATE_LOT sans confirmation, création acceptée avec confirmation (ligne de test supprimée).'
WHERE id = 'cmsp58ce5000aucz8041a6mu3';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'La création était bien REFUSÉE par le serveur (400 occupation de planche), mais le refus ne vivait que dans un toast de 5 s et le corps de la réponse était lu deux fois (« body already read ») sur un 409 sans rotationViolation. Deux correctifs : l''occupation de la planche ne compte plus que les cultures dont le cycle CHEVAUCHE la période demandée (une culture d''une saison passée jamais clôturée saturait la planche à vie), et le refus + ses suggestions d''ajustement s''affichent désormais en erreur persistante près du bouton Enregistrer.'
WHERE id = 'cmsp5927v000cucz8czjmzbz9';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Le filtre SQL et la cascade d''état affichée divergeaient : « Planifiée » ne testait que semisFait, alors que l''affichage fait primer recolteFaite. Source de vérité unique créée (src/lib/cultures/etat.ts : etatCulture + whereEtatCulture, miroirs l''un de l''autre), câblée sur les 6 emplacements dont l''assistant IA, avec 13 tests de parité. Prouvé en prod : l''onglet Planifiées renvoie 6 cultures, toutes à l''état Planifiée ; les cultures 991 et 823 en sont absentes.'
WHERE id = 'cmsp59tdu000eucz8estg5nqr';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Le champ « Rappel planifié » était contrôlé sans attribut name ni filet : une saisie qui ne déclenche pas onChange envoyait datePrevue à null, sans message. Le serveur, lui, matérialisait correctement le rappel. Ajout du name, d''une resynchronisation au blur, d''un filet FormData bidirectionnel et d''une erreur persistante au pied du formulaire. Prouvé en prod : un soin fait le 12/08 avec rappel au 18/08 crée le soin planifié du 18/08 (fait=false), visible au calendrier sur la semaine 17-23/08 pour Juliette A3 (soins de test supprimés).'
WHERE id = 'cmsp5ckbx000jucz8gtyv6oen';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Les plans de rotation sont un référentiel GLOBAL (le modèle Prisma n''a pas de userId, les plans sont partagés entre comptes) : l''API réserve donc l''écriture aux administrateurs et répondait 403, message noyé dans un toast de 5 s. L''écran ne propose plus les actions Ajouter/Modifier/Supprimer aux comptes sans droit d''écriture, le message du serveur n''est plus écrasé, et le formulaire affiche une explication persistante. Une ouverture de la création aux utilisateurs demande un userId au modèle (migration + unicité, l''id valant aujourd''hui le nom) : décision produit distincte.'
WHERE id = 'cmsp5fzf8000vucz8lixt04ny';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Cause réelle : la date de plantation posée par un remplissage programmatique n''était pas dans l''état React ; le choix de la parcelle déclenchait le premier re-render, qui réalignait l''input contrôlé sur une valeur vide. Le submit devenait ensuite muet car la validation native bloquait l''envoi avant le handler (bulle hors écran dans le dialogue). Correctifs : resynchronisation au blur des deux champs date, 17 mises à jour d''état passées en forme fonctionnelle, name sur le champ Nom avec relecture FormData, noValidate sur le formulaire et erreur affichée en role="alert".'
WHERE id = 'cmsp5gx9u001aucz8mw85lljo';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Le filet FormData de la date de naissance était à sens unique : FormData.get() renvoie toujours une chaîne pour un champ présent (vide comprise), donc le DOM gagnait même vide et l''état React n''était jamais consulté — la date partait en NULL. Filet rendu bidirectionnel (DOM si renseigné, sinon état), et une date illisible pour le navigateur est désormais refusée avec un message au lieu d''être avalée (le formulaire est en noValidate). Donnée réparée : l''animal 399 « Bocage A3 » porte à nouveau le 14/06/2026.'
WHERE id = 'cmsp5hxl8001tucz87vg83lwv';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Deux définitions d''effectif cohabitaient : l''écran Lots utilisait l''effectif reconstitué du helper partagé (fiches nominatives rattachées incluses), le bloc pondeuses de /api/elevage/stats lisait quantiteActuelle brut. Le dénominateur du taux de ponte et le taux attendu pondéré passent au helper, en réutilisant l''appel déjà fait pour les lots actifs (aucune requête supplémentaire). Prouvé en prod : nbPondeuses = 30, « attendu ~70 % ». Le taux observé baisse mécaniquement (dénominateur 29 → 30), c''est le comportement correct.'
WHERE id = 'cmsp5lzye0020ucz8ktiyyo0p';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Diagnostic du rapporteur exact : le pas de 0,1 kg invalidait 0,25 et la validation native annulait la soumission avant le handler, donc sans message perceptible (bulle masquée dans ce dialogue défilant). Poids adulte, prix d''achat et consommation par jour passent en step="any" ; le formulaire passe en noValidate avec des contrôles explicites qui remplacent les min/max natifs et alimentent l''erreur inline déjà en place.'
WHERE id = 'cmsp5omse0024ucz83p2fc79u';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'L''année vivait dans un état local jamais reflété dans l''URL : un rechargement (ou le partage du lien) revenait à l''année de départ. L''URL devient la source de vérité via resolveDashboardYear + router.replace, motif déjà retenu pour le filtre module de Transactions, appliqué aux trois vues liées par onglets (global, par îlots, par planches) pour que la navigation conserve l''année. Prouvé dans le chunk servi au navigateur.'
WHERE id = 'cmsp5p3v40026ucz81ggdzbfl';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Confirmé et corrigé : la détection « aucune activité » ne regardait que les revenus de l''année N et de N-1 plus les dépenses de N-1 — jamais les dépenses de N. Une année à 0 € de revenus et 4 700 € d''achats d''élevage était donc annoncée sans activité, à côté d''une carte Dépenses affichant ces mêmes 4 700 €. Nouvel état « dépenses seules » avec un libellé vrai (« 2024 : 0 € de revenus, 4 700,00 € de dépenses ») ; « Aucune activité » ne subsiste que si revenus et dépenses sont nuls sur les deux exercices. Prouvé en prod : dépenses 2024 remontées à 6 483,80 €.'
WHERE id = 'cmsp5ti6m002cucz8jv1mi32n';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Vraie faute de frappe dans la source (vérifiée à l''octet : « arrose » sans accent, pas un artefact de compilation), présente depuis l''ajout de l''écran. Corrigée en « Tout est arrosé ! », marqueur vérifié dans l''image déployée. Deux accents manquants du même défaut corrigés au passage dans l''assistant maraîcher (« Élevée »).'
WHERE id = 'cmsp5ts17002eucz8565npd7z';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Le tableau des arbres imposait 985 px dans une zone de 311 px. DataTable accepte désormais une classe par colonne, et les 7 colonnes secondaires (type, espèce, variété, porte-greffe, plantation, parcelle, productif, calendrier) sont masquées sous md ; espèce et variété sont repliées sous le nom pour ne rien perdre. Il reste Nom · État · actions, et la largeur minimale ne s''applique qu''à partir de md. Le raccourci « calendrier d''entretien » reste accessible depuis la fiche de l''arbre.'
WHERE id = 'cmsp5yry4002gucz8m05bl5l4';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Bug d''affichage confirmé : ZNT et justification étaient bien saisies, validées et persistées (elles revenaient dans le formulaire Modifier), mais le détail déplié ne les rendait pas. Ajoutées avec les libellés du registre phyto verger (distance en mètres + badge Respectée / Non respectée). Bug adjacent trouvé et corrigé : le PATCH ne persistait pas justification, donc toute correction de ce champ était silencieusement ignorée. Prouvé dans le chunk servi au navigateur.'
WHERE id = 'cmsp65qct002jucz8ie41s3d0';

UPDATE bug_reports SET status = 'RESOLVED', resolved_at = now(), admin_note =
  'Confirmé : aucun des chemins de complétion n''écrivait de date d''exécution, la date prévisionnelle restait donc au registre — un semis « fait » daté du 15/08 alors qu''il a été réalisé le 11/08. Règle posée dans un helper partagé et appliquée aux deux points d''écriture serveur (PATCH unitaire et action en masse) : une étape marquée faite ne peut pas porter une date future, elle est ramenée au jour courant ; une date passée n''est pas touchée pour ne pas réécrire l''historique des tâches en retard. Comparaison en journées civiles locales (conteneur Europe/Paris), 6 tests. Prouvé en prod, et la culture 831 (Mâche) redatée au 11/08. Sans effet sur la convention SEMAINE du décompte de retard.'
WHERE id = 'cmsp66tdm002lucz8irrfjrdc';

-- ─────────────────────────────────────────────────────────────────────────────
-- EVOLUTION_PRODUIT — 2 tickets requalifiés (décisions déjà tranchées)
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', admin_note =
  'Doublon du ticket cmsoeqc5l (2026-08-11), lui-même rattaché à la décision SSOT du CA du 07/08. L''écart de 14,30 € est l''avoir AV-2026-0001 (facture 27 du 08/08/2026) : il est déduit du KPI de référence et absent de la liste Transactions, qui somme les sources brutes sans ligne d''avoir. Reproduit au centime ce jour (25 132,02 € contre 25 146,32 €). L''écart est déjà signalé à l''écran par le bandeau de cohérence des Rapports, comme l''observe le rapporteur. Aligner le total de la liste sur le KPI recréerait le défaut « les lignes affichées ne s''additionnent plus au total » corrigé auparavant : la seule sortie est d''afficher l''avoir comme ligne négative dans Transactions, décision comptable ouverte.'
WHERE id = 'cmsp5s1cx0028ucz8znwidolg';

UPDATE bug_reports SET status = 'EVOLUTION_PRODUIT', admin_note =
  'Doublon du ticket cmsoepefg (2026-08-11), tranché le même jour : chaque module garde SA propre année, parce que la saison culturale, l''exercice comptable et l''année d''élevage ou de verger sont des notions distinctes. Aucune « année de pilotage » globale n''existe dans le code (une clé de persistance par module), et l''unifier ré-ouvrirait les tickets qui exigeaient précisément la persistance par module. Comportement voulu, pas un défaut.'
WHERE id = 'cmsp5t6vb002aucz8i5km4fii';

-- Contrôle attendu avant COMMIT : 0 OPEN, 16 RESOLVED et 2 EVOLUTION_PRODUIT
-- sur les 18 tickets de la campagne (déposés entre 18:58 et 19:26 le 11/08).

COMMIT;
