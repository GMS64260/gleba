-- Version de fiche, lot 0 : cultures.
--
-- Chaque fiche modifiable porte un numéro de version. L'écran le renvoie à
-- l'enregistrement et la route refuse (409) s'il a changé entre-temps : un
-- formulaire resté ouvert ailleurs ne réécrit plus une modification faite
-- depuis. Le numéro n'avance que sur une écriture qui change un champ de la
-- fiche (pas sur un arrosage noté), ce que `updated_at` ne permettait pas.
--
-- Colonne additive à valeur par défaut constante : PostgreSQL 16 ne réécrit
-- pas la table. Le verrou exclusif est bref ; `lock_timeout` fait échouer la
-- migration proprement plutôt que de bloquer les lectures derrière une longue
-- transaction. L'image précédente lit ce schéma sans changement (elle ignore
-- la colonne) : pas de retour arrière à prévoir sur la base.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "cultures" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
COMMIT;
