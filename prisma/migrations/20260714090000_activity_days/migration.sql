-- Jours d'activité par utilisateur (stats admin /admin/usage)
-- 1 ligne = 1 jour (UTC) où l'utilisateur a utilisé l'application.
CREATE TABLE "activity_days" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "activity_days_pkey" PRIMARY KEY ("user_id", "day")
);

CREATE INDEX "activity_days_day_idx" ON "activity_days"("day");

ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill historique : connexions réussies + jours de création de contenu
-- (created_at uniquement : updated_at peut avoir été touché par des scripts
-- d'administration et fausserait l'historique) + jour d'inscription.
-- Exclues : tables système (sessions, sequences_*, cookie_consents,
-- feedback_tokens), irrigations_planifiees (générées automatiquement),
-- commandes_boutique (créées par des acheteurs publics, pas par le compte).
INSERT INTO "activity_days" ("user_id", "day")
SELECT DISTINCT t.user_id, t.day
FROM (
    SELECT id AS user_id, date(created_at) AS day FROM users
    UNION ALL
    SELECT user_id, date(created_at) FROM login_logs WHERE success = true
    UNION ALL SELECT user_id, date(created_at) FROM abattages
    UNION ALL SELECT user_id, date(created_at) FROM animaux
    UNION ALL SELECT user_id, date(created_at) FROM arbres
    UNION ALL SELECT user_id, date(created_at) FROM avis
    UNION ALL SELECT user_id, date(created_at) FROM boutiques
    UNION ALL SELECT user_id, date(created_at) FROM bug_reports
    UNION ALL SELECT user_id, date(created_at) FROM campagnes_plantation
    UNION ALL SELECT user_id, date(created_at) FROM clients
    UNION ALL SELECT user_id, date(created_at) FROM collectes_lait
    UNION ALL SELECT user_id, date(created_at) FROM consommations
    UNION ALL SELECT user_id, date(created_at) FROM consommations_aliments
    UNION ALL SELECT user_id, date(created_at) FROM conversations
    UNION ALL SELECT user_id, date(created_at) FROM cultures
    UNION ALL SELECT user_id, date(created_at) FROM depenses_manuelles
    UNION ALL SELECT user_id, date(created_at) FROM essences_bocageres
    UNION ALL SELECT user_id, date(created_at) FROM essences_forestieres
    UNION ALL SELECT user_id, date(created_at) FROM etapes_campagne
    UNION ALL SELECT user_id, date(created_at) FROM evolution_votes
    UNION ALL SELECT user_id, date(created_at) FROM evolutions
    UNION ALL SELECT user_id, date(created_at) FROM exploitations
    UNION ALL SELECT user_id, date(created_at) FROM factures
    UNION ALL SELECT user_id, date(created_at) FROM feedback_responses
    UNION ALL SELECT user_id, date(created_at) FROM fertilisations
    UNION ALL SELECT user_id, date(created_at) FROM interventions
    UNION ALL SELECT user_id, date(created_at) FROM lots_animaux
    UNION ALL SELECT user_id, date(created_at) FROM lots_fromage
    UNION ALL SELECT user_id, date(created_at) FROM mouvements_cheptel
    UNION ALL SELECT user_id, date(created_at) FROM naissances_animales
    UNION ALL SELECT user_id, date(created_at) FROM notes
    UNION ALL SELECT user_id, date(created_at) FROM objets_jardin
    UNION ALL SELECT user_id, date(created_at) FROM observations_campagne
    UNION ALL SELECT user_id, date(created_at) FROM observations_sante
    UNION ALL SELECT user_id, date(created_at) FROM operations_arbres
    UNION ALL SELECT user_id, date(created_at) FROM parcelles_geo
    UNION ALL SELECT user_id, date(created_at) FROM porte_greffes
    UNION ALL SELECT user_id, date(created_at) FROM production_bois
    UNION ALL SELECT user_id, date(created_at) FROM production_oeufs
    UNION ALL SELECT user_id, date(created_at) FROM produits_boutique
    UNION ALL SELECT user_id, date(created_at) FROM races_animales
    UNION ALL SELECT user_id, date(created_at) FROM recoltes
    UNION ALL SELECT user_id, date(created_at) FROM recoltes_arbres
    UNION ALL SELECT user_id, date(created_at) FROM saillies
    UNION ALL SELECT user_id, date(created_at) FROM signalements
    UNION ALL SELECT user_id, date(created_at) FROM soins_animaux
    UNION ALL SELECT user_id, date(created_at) FROM stations_meteo
    UNION ALL SELECT user_id, date(created_at) FROM user_preferences
    UNION ALL SELECT user_id, date(created_at) FROM ventes_manuelles
    UNION ALL SELECT user_id, date(created_at) FROM ventes_produits
    UNION ALL SELECT user_id, date(created_at) FROM zones_verger
) t
JOIN users u ON u.id = t.user_id
WHERE t.user_id IS NOT NULL AND t.day IS NOT NULL
ON CONFLICT DO NOTHING;
