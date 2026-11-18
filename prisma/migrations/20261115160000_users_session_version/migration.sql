-- MC3 (revue globale du 2026-11-11) : changer ou réinitialiser le mot de passe
-- doit couper toutes les autres sessions. Chaque jeton de session porte la
-- version lue à la connexion ; la valeur 0 par défaut vaut pour les jetons
-- émis avant cette migration (aucune déconnexion massive au déploiement).
ALTER TABLE "users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
