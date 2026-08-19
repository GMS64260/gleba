-- Classement — campagne QA du 2026-08-12 soir, second lot (2026-08-14 soir).
-- En SQL, jamais par l'API admin (elle enverrait un mail au compte démo).
-- Chaque verdict est adossé soit à un correctif déployé ce soir (image
-- 4faf4277627c), soit à un correctif du 2026-08-12 22h déjà en production,
-- soit à une preuve de non-reproduction en navigateur réel.
BEGIN;

-- ── Corrigés par la session du 2026-08-12 22h (marqueurs + tests, en prod) ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h (en prod depuis le 13/08) : planche-validation.ts n''invente plus un espacement de 30 cm — la création n''est plus refusée sur un chiffre invisible. Tests qa-20260812-soir.test.ts.'
WHERE id='cmsqla9c2004bk4gsjscsn7j6';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h : lot unique prérempli dans l''état React + relecture du DOM au submit (ProductionTab, motif Select Radix connu).'
WHERE id='cmsqlacc2004ek4gsajnhg1c3';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h : une association en étoile n''émet plus que les paires contenant le pivot — « Chou brocoli + » ne justifie plus « concombre ↔ oignon ». Tests dédiés.'
WHERE id='cmsqlhv0c004xk4gss3831cly';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h : le soin exécuté garde SA date (datePrevue nulle quand le rappel est matérialisé en soin distinct) ; plus de « Fait en avance » ni de double échéance. Complément 2026-08-14 : le rappel planifié n''hérite plus du coût.'
WHERE id='cmsqlj7bn0051k4gs5db0oy8l';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h (facture-utils) : la séquence s''amorce sur le plus grand numéro déjà utilisé au lieu d''un 1 codé en dur qui heurtait l''index unique — la première facture émise passait en boucle d''échec et le numéro proposé changeait à chaque rechargement.'
WHERE id='cmsqln4om0058k4gscklxtjgs';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Même cause que cmsqlixl2 : le répertoire fournisseurs est un référentiel GLOBAL, l''API réserve l''écriture aux admins. Corrigé côté écran le 2026-08-12 22h (les actions ne sont plus proposées aux non-admins — plus de dialogue muet). L''écart restant est produit : fournisseurs par exploitant, à trancher.'
WHERE id='cmsqlpeoq005dk4gste0wzjrl';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h (lib/comptabilite/impayees.ts) : une vente rattachée à une facture n''est plus comptée deux fois, et les avoirs sont imputés sur leur facture d''origine. Tests dédiés (147,86 € sur le jeu du ticket).'
WHERE id IN ('cmsqlqcuq005jk4gsuijj5eq7','cmsqmbfxs006yk4gss53qh98t');

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-12 22h : Transactions et Rapports lisent getAvailableYears() (SSOT year-selector), qui inclut l''année courante + 1 — 2027 est proposé partout, comme dans Interventions.'
WHERE id IN ('cmsqltuok005rk4gsk7h3liop','cmsqm3cry006lk4gs39pmlvsw');

-- ── Corrigés ce soir (image 4faf4277627c), prouvés en production ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : bornes du filtre comparées en JOURS CIVILS LOCAUX des deux côtés (la borne basse était parsée en UTC, la haute en local) — l''arrosage planifié du 12/08 00:00 local n''est plus perdu. Prouvé en prod : 5 lignes rendues sur 5.'
WHERE id='cmsqmoqno0076k4gs1eb6t8sz';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : les cumuls d''heures repartent des minutes brutes (champ minutesTravaillees) au lieu d''additionner des dixièmes arrondis. Prouvé en prod : 10+15+15 min → 0,7 h (avant 0,8).'
WHERE id='cmsqm7fun006sk4gsl3bj7rwb';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : recherche serveur /api/especes passée par unaccent (même extension que l''index des variétés) — « Mache », « Epinard », « Celeri » sans accent trouvent leurs espèces. Prouvé en prod (1/4/3 résultats).'
WHERE id='cmsqn2b36007rk4gs8plls0hr';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : (1) le nombre de plants reprend la quantité ENREGISTRÉE par la fiche culture quand elle existe ; (2) le prorata 1/N par planche partagée, conçu pour les surfaces, ne s''applique plus au nombre de plants d''une culture qui porte sa propre longueur (198×1/3=66 et 100×1/3=33 : les chiffres exacts du ticket).'
WHERE id='cmsqm5f3f006qk4gseci4tci1';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : un ITP personnel est calé sur la zone climatique de son auteur (à la création, et en lecture pour le stock historique sans zone) — ses semaines ne sont plus transposées de -1 comme s''il décrivait le référentiel métropole. Les ITP officiels gardent la transposition de zone, voulue.'
WHERE id='cmsqmujo9007ik4gs7a893crf';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : le bandeau météo d''en-tête lit la même clé localStorage que la page Météo (gleba_meteo_parcelle) et se recale sans rechargement (événement partagé) — plus de contradiction permanente entre les deux affichages.'
WHERE id='cmsqmf6om0071k4gsy8jssvtd';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : le calendrier d''entretien généré à la création d''un arbre démarre à la DATE DE PLANTATION quand elle est future (plus d''opérations antérieures à la mise en terre), et aucune récolte n''est planifiée sur un arbre non productif.'
WHERE id='cmsqmamcv006wk4gsox9z8ufx';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : la taille de formation d''une campagne verger est calée dans la première fenêtre hivernale (janv.-mars) qui suit « plantation + 1 an », au lieu du jour anniversaire brut (20/11, feuilles en place).'
WHERE id='cmsqm0tlw006dk4gsm4f5n7zd';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : axe des mois forcé (interval=0) sur les deux graphiques mensuels du calendrier verger — « Nov » ne saute plus.'
WHERE id='cmsqn3n9s007vk4gs649m6von';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : l''alerte de saisonnalité regarde la date PRÉVUE quand « opération réalisée » est décochée — planifier une taille au 15/01 ne crie plus « hors période (Août) ». Le double point « Juil.. » est corrigé à la source.'
WHERE id='cmsqn4nmi007zk4gsbo2ps9y1';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : « Volume bouillie (L total) » se calcule réellement (surface × L/ha) dès que les deux facteurs sont saisis, sauf si un total a été saisi à la main (il prime).'
WHERE id='cmsqn4u8n0081k4gsggwtnpom';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : (a) ploïdies documentées complétées au référentiel (triploïdes connus : Reinette du Canada, Gravenstein, Jonagold, Bramley… ; diploïdes courants pommes/poires/cerises douces) ; (b) légende de l''astérisque ajoutée sous le tableau ; (d) message reformulé « Aucune autre variété compatible » au lieu du faux « Aucun autre cerisier ». Le point (b, variété sans groupe) relève du référentiel : données complétables au fil de l''eau.'
WHERE id='cmsqn5lh40083k4gs6ox7z5yt';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : porte-greffe, type de plant et conduite (bien persistés depuis toujours) sont restitués dans l''Aperçu de la campagne.'
WHERE id='cmsqn6gds0087k4gslkihuq4a';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : même alerte de fenêtre que la taille sur la saisie de récolte (non bloquante — l''écart est DIT). Rendements référentiels réalignés (données) ; le seed démo actuel a des dates plausibles (cerises juin, prunes juillet), les lignes de mai n''existent plus en base.'
WHERE id='cmsqn6n460089k4gs8w102zau';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 (données) : rendements des fruitiers tempérés réalignés sur le seed du dépôt et le bas des fourchettes documentées (Pommier 30, Poirier 25, Cerisier 30, Noyer 30, Châtaignier 50…) — l''ordre de grandeur kg/m² recopié en kg/arbre est purgé, 12 lignes corrigées en production.'
WHERE id='cmsqn2l09007tk4gsc9u69w5y';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : sélecteurs Mère/Père comparés par ESPÈCE DE BASE (brebis_lacaune = brebis), comme le sélecteur de lot — la liste n''est plus vide et la généalogie redevient possible.'
WHERE id='cmsqmp5ep0078k4gs5gr88sk4';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : les soins de lot remontés sur la fiche d''un animal sont bornés par sa date d''arrivée (à défaut de naissance) — le carnet sanitaire n''affirme plus des traitements antérieurs à sa présence.'
WHERE id='cmsqmpqzx007ak4gsygts5bsh';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : tri chronologique décroissant (les rappels planifiés, datés de leur échéance, remontent naturellement) au lieu de l''entrelacement fait/datePrevue illisible.'
WHERE id='cmsqmq9q6007ck4gs65svlcei';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : le rappel planifié n''hérite plus du coût du soin exécuté (coût saisi à la validation, comme le stock) — le coût sanitaire ne double plus à chaque rappel. Le redatage était déjà corrigé le 12/08 22h.'
WHERE id='cmsqmqwn9007ek4gs2vdxcxyb';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : « Lot des petits » filtré par l''espèce de base de la mère choisie — plus de poussins versables dans un lot de chèvres.'
WHERE id='cmsqmty0u007gk4gsaf7zs0d5';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Vérifié le 2026-08-14 : le libellé est déjà conditionné à l''espèce (dureeCouvaison → « Éclosion » ; poule_pondeuse = 21 j en base). Correctif du 12/08 22h, en production.'
WHERE id='cmsqmuogw007kk4gs9r6ifayq';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : en-tête de Transactions en flex-wrap — plus de dépassement horizontal à 375 px, les filtres Année/Module passent à la ligne.'
WHERE id='cmsqlx0t70062k4gsn9lwqadf';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : la ligne comptable d''une commande livrée reflète le statut de paiement du modèle (paye = paiementStatut === Confirmé) — « livrée » n''implique plus « encaissée ».'
WHERE id='cmsqlzvw90066k4gs0o1ta8lr';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : phase de lune visible dans l''en-tête de TOUT le module maraîchage (25 pages, comme le verger), en plus de l''encart biodynamique du calendrier des ITP et de /api/lunaire. La promesse des Paramètres a désormais un écran.'
WHERE id='cmsqna2wr008bk4gsx6gfx2m2';

-- ── Non reproductibles sur le build actuel, prouvé en navigateur réel ──
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproductible le 2026-08-14 en navigateur headless (mère sélectionnée + lot + nés 3/vivants 2 + 55 caractères tapés dans Notes) : aucun React #185, aucun écran d''erreur. 4 bascules depuis le signalement, dont les correctifs d''hydratation. À rouvrir avec une repro si le plantage revient.'
WHERE id='cmsqmoc240074k4gs75hswf56';

UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Non reproductible le 2026-08-14 en navigateur headless : /jardin?usage=verger rechargé deux fois restaure Demo-V, sélecteur présent, plan peuplé. La restauration par URL (?parcelle/?usage) est en place.'
WHERE id='cmsqn0mh50079k4gsbiuxv8a3';

-- ── Écarts produit, pas des défauts techniques ──
UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='Même famille que les doublons SSOT du CA, décision comptable déjà tranchée (07-10/08) : la TVA déduplique mécaniquement les ventes portant factureId ; le résidu vient des ventes manuelles jamais rattachées à leur facture — rapprochement à concevoir côté produit, pas un correctif ponctuel.'
WHERE id='cmsqm43ek006ok4gsvue7qpbi';

UPDATE bug_reports SET status='EVOLUTION_PRODUIT', updated_at=now(),
  admin_note='La génération automatique d''une facture pour une commande boutique livrée n''existe pas par conception (la facturation Gleba est un geste volontaire du producteur). Fonctionnalité à décider, pas une régression.'
WHERE id='cmsqm1ay0006gk4gs7llrafjr';

-- Accents verger (déjà partiellement corrigé au fil de l'eau)
UPDATE bug_reports SET status='RESOLVED', resolved_at=now(), updated_at=now(),
  admin_note='Corrigé le 2026-08-14 : placeholder « Chêne » accentué, saison « été » accentuée au Gantt, espace « position sur » restaurée (défaut SWC multiligne connu), double point « Juil.. » corrigé à la source.'
WHERE id='cmsqn3tux007xk4gsj6t1b3ud';

COMMIT;

SELECT status, count(*) FROM bug_reports GROUP BY status ORDER BY status;
SELECT count(*) AS restants FROM bug_reports WHERE status IN ('OPEN','IN_PROGRESS');
