-- MC3 (revue globale du 2026-11-11) : une consultation administrateur porte
-- aussi la version de session de l'administrateur qui l'a ouverte. Les jetons
-- émis avant cette migration valent 0, comme la colonne users.session_version
-- par défaut.
ALTER TABLE "impersonation_grants" ADD COLUMN "admin_session_version" INTEGER NOT NULL DEFAULT 0;
