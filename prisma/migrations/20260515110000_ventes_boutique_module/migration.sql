-- ====================================================================
-- QA 2026-05-15 — Bug #19 : commandes boutique rattachées au module
-- "general" au lieu de "boutique". Cassait Bug #3 (total revenus
-- global ≠ somme par module = 406,50 € manquants côté Bois Joli) car
-- les bandeaux par module ne lisent que potager/verger/elevage/boutique.
--
-- On corrige toutes les VenteManuelle issues d'une CommandeBoutique :
--   sourceType='commande_boutique' → module='boutique'
--
-- Le seed est mis à jour en parallèle (seed-demo.ts) pour les
-- prochains déploiements.
-- ====================================================================

UPDATE ventes_manuelles
   SET module = 'boutique'
 WHERE source_type = 'commande_boutique'
   AND (module = 'general' OR module IS NULL);
