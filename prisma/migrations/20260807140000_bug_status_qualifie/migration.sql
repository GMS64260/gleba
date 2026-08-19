-- Deux états manquants pour le tri des signalements.
--
-- BugStatus ne connaissait que OPEN / IN_PROGRESS / RESOLVED : un signalement
-- qualifié « pas un défaut applicatif » restait donc OPEN indéfiniment, et le
-- badge de l'accueil admin (qui compte OPEN + IN_PROGRESS) ne pouvait jamais
-- redescendre. Mesuré le 2026-08-07 : les 9 signalements ouverts étaient TOUS
-- déjà triés et non actionnables — 4 demandes produit et 5 fois la latence du
-- pipeline Paperclip, hors code Gleba. Le compteur annonçait 9 travaux en
-- attente là où il n'y en avait aucun.
--
-- Additif et sans effet sur les lignes existantes. Le reclassement des lignes
-- se fait à part : PostgreSQL interdit d'UTILISER une valeur d'enum dans la
-- transaction qui l'ajoute.
ALTER TYPE "BugStatus" ADD VALUE IF NOT EXISTS 'EVOLUTION_PRODUIT';
ALTER TYPE "BugStatus" ADD VALUE IF NOT EXISTS 'HORS_PERIMETRE';
