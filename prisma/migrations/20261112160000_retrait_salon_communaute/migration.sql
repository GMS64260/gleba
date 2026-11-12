-- Retrait de l'ancien salon de discussion de la page Communauté (2026-11-12).
-- Son interface avait été remplacée par le forum le 2026-10-26 ; ses routes, sa
-- validation et le modèle `MessageSalon` sont retirés du code avec cette
-- migration, qui supprime la table "messages_salon" (et, avec elle, ses index
-- et sa clé étrangère vers "users").
--
-- Destructive : les messages de l'ancien salon sont supprimés définitivement.
-- Le forum (tables des discussions et réponses de l'encyclopédie) n'est pas
-- touché.
--
-- Retour arrière : le seul possible est la restauration de la table
-- "messages_salon" depuis la sauvegarde de la base prise avant le déploiement.

DROP TABLE "messages_salon";
