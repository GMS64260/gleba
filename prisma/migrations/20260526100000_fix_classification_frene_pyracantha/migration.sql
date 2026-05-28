-- ============================================================
-- Bug feedback testeur 2026-05-26 (cmplot63z) — Frêne (Fraxinus
-- excelsior, Oleaceae) est une essence forestière/bocagère, pas
-- un petit fruit ; Pyracantha (Rosaceae) produit des baies
-- ornementales légèrement toxiques pour l'humain, à reclasser en
-- ornemental.
--
-- En l'absence de type "forestier" dans le schéma actuel, on les
-- reclasse en "ornement" (le plus proche disponible). Une issue
-- de schéma séparée ajoutera un type "forestier" si besoin.
-- ============================================================

UPDATE especes
SET type = 'ornement'
WHERE espece IN ('Frêne', 'Pyracantha');
