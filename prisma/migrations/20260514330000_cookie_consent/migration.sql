-- ====================================================================
-- DEV2 audit Larcher - P0 #2 — RGPD
-- Stockage du consentement cookies (durée max 13 mois selon CNIL).
-- Table dédiée plutôt qu'un champ User car le consentement existe aussi
-- pour les visiteurs anonymes (avant connexion).
-- ====================================================================
CREATE TABLE IF NOT EXISTS cookie_consents (
  id              TEXT PRIMARY KEY,
  user_id         TEXT,                          -- null pour anonyme
  session_id      TEXT,                          -- cookie technique anonyme
  ip_hash         TEXT,                          -- IP hashée (RGPD)
  user_agent      TEXT,
  -- Choix de l'utilisateur
  essentiel       BOOLEAN NOT NULL DEFAULT TRUE,  -- toujours TRUE (techniquement nécessaire)
  analytics       BOOLEAN NOT NULL DEFAULT FALSE,
  marketing       BOOLEAN NOT NULL DEFAULT FALSE,
  personnalisation BOOLEAN NOT NULL DEFAULT FALSE,
  -- Traçabilité
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP(3) NOT NULL,         -- created_at + 13 mois (CNIL)
  revoked_at      TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS cookie_consents_user_idx ON cookie_consents (user_id);
CREATE INDEX IF NOT EXISTS cookie_consents_session_idx ON cookie_consents (session_id);
CREATE INDEX IF NOT EXISTS cookie_consents_expires_idx ON cookie_consents (expires_at);

ALTER TABLE cookie_consents
  DROP CONSTRAINT IF EXISTS cookie_consents_user_fkey,
  ADD  CONSTRAINT cookie_consents_user_fkey
    FOREIGN KEY (user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL;
