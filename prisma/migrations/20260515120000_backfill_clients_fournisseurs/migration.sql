-- ====================================================================
-- QA 2026-05-15 — Bug #6 + #11 : backfill des référentiels Clients et
-- Fournisseurs depuis l'historique de transactions.
--
-- Sur la démo "Ferme du Bois Joli", la fiche Clients restait à 0 alors
-- que ventes manuelles + factures + commandes boutique citaient ≥ 17
-- clients distincts. Idem pour Fournisseurs (3 noms cités en dépenses
-- absents de la fiche).
--
-- Les flux POST (ventes manuelles, factures, commandes confirmées,
-- dépenses) appellent désormais `ensureClientForUser` /
-- `ensureFournisseurForUser` côté backend. Cette migration corrige
-- l'historique pour aligner l'état actuel.
-- ====================================================================

-- ====================================================================
-- 1. CLIENTS
-- ====================================================================

-- 1a. Clients depuis VenteManuelle.clientNom (par user, nom dédupliqué)
WITH ventes_clients AS (
  SELECT DISTINCT
    v.user_id,
    TRIM(v.client_nom) AS nom,
    -- On prend le premier email/tel non-null trouvé pour ce nom
    (SELECT v2.notes FROM ventes_manuelles v2
       WHERE v2.user_id = v.user_id AND TRIM(v2.client_nom) = TRIM(v.client_nom)
       LIMIT 1) AS notes
    FROM ventes_manuelles v
   WHERE v.client_nom IS NOT NULL
     AND TRIM(v.client_nom) <> ''
     AND v.client_id IS NULL
)
INSERT INTO clients (user_id, nom, type, pays, actif, created_at, updated_at)
SELECT user_id, nom, 'particulier', 'France', true, now(), now()
  FROM ventes_clients vc
 WHERE NOT EXISTS (
   SELECT 1 FROM clients c
    WHERE c.user_id = vc.user_id
      AND LOWER(c.nom) = LOWER(vc.nom)
 );

-- 1b. Clients depuis CommandeBoutique.clientNom (avec email!)
INSERT INTO clients (user_id, nom, type, email, telephone, pays, actif, created_at, updated_at)
SELECT DISTINCT
  c.user_id,
  TRIM(c.client_nom) AS nom,
  'particulier',
  c.client_email,
  c.client_telephone,
  'France',
  true,
  now(),
  now()
  FROM commandes_boutique c
 WHERE c.client_nom IS NOT NULL
   AND TRIM(c.client_nom) <> ''
   AND NOT EXISTS (
     SELECT 1 FROM clients cl
      WHERE cl.user_id = c.user_id
        AND LOWER(cl.nom) = LOWER(TRIM(c.client_nom))
   );

-- 1c. Réaffecter ventes_manuelles.client_id (idempotent par nom normalisé)
UPDATE ventes_manuelles v
   SET client_id = c.id
  FROM clients c
 WHERE v.client_id IS NULL
   AND v.client_nom IS NOT NULL
   AND c.user_id = v.user_id
   AND LOWER(c.nom) = LOWER(TRIM(v.client_nom));

-- ====================================================================
-- 2. FOURNISSEURS (table globale, pas multi-tenant)
-- ====================================================================

-- 2a. Création des fournisseurs cités dans depenses_manuelles.fournisseur_nom
INSERT INTO fournisseurs (fournisseur, contact, actif, created_at)
SELECT DISTINCT TRIM(d.fournisseur_nom), TRIM(d.fournisseur_nom), true, now()
  FROM depenses_manuelles d
 WHERE d.fournisseur_nom IS NOT NULL
   AND TRIM(d.fournisseur_nom) <> ''
   AND d.fournisseur_id IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM fournisseurs f
      WHERE LOWER(f.fournisseur) = LOWER(TRIM(d.fournisseur_nom))
   );

-- 2b. Réaffecter depenses_manuelles.fournisseur_id (idempotent)
UPDATE depenses_manuelles d
   SET fournisseur_id = f.fournisseur
  FROM fournisseurs f
 WHERE d.fournisseur_id IS NULL
   AND d.fournisseur_nom IS NOT NULL
   AND LOWER(f.fournisseur) = LOWER(TRIM(d.fournisseur_nom));
