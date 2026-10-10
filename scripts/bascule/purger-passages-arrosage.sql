-- Refonte de l'arrosage (2026-10-10) : suppression des passages planifiés EN
-- ATTENTE (non faits, non périmés), générés par l'ancien plan à cadence fixe.
-- Aucun n'est un arrosage réel. Restent intacts : les arrosages notés (fait)
-- et les passages périmés (reliquats que plus aucun écran n'affiche : le
-- registre d'interventions ne lit que les arrosages notés, cf.
-- src/lib/irrigation/arrosages-notes.ts). Aucune table ne référence
-- irrigations_planifiees.
--
-- À lancer APRÈS le démarrage de la NOUVELLE image (et après le dump) :
-- l'ancienne régénère un plan de saison (etendrePlanArrosage) à chaque
-- modification de culture, des passages purgés trop tôt reviendraient.
--   sudo -n docker exec -i gleba_db psql -U gleba -d gleba -v ON_ERROR_STOP=1 \
--     < scripts/bascule/purger-passages-arrosage.sql
BEGIN;

SELECT count(*) AS en_attente_avant, count(DISTINCT user_id) AS comptes
FROM irrigations_planifiees
WHERE fait = false AND perimee = false;

SELECT count(*) FILTER (WHERE fait) AS faits_avant,
       count(*) FILTER (WHERE perimee AND NOT fait) AS perimes_avant
FROM irrigations_planifiees;

DELETE FROM irrigations_planifiees
WHERE fait = false AND perimee = false;

SELECT count(*) AS en_attente_apres
FROM irrigations_planifiees
WHERE fait = false AND perimee = false;

SELECT count(*) FILTER (WHERE fait) AS faits_apres,
       count(*) FILTER (WHERE perimee AND NOT fait) AS perimes_apres
FROM irrigations_planifiees;

COMMIT;
