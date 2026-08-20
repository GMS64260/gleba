-- Mémoire de la date PRÉVISIONNELLE d'une étape de culture.
--
-- Marquer une étape faite ramène sa date au jour courant quand elle était
-- datée dans le futur (règle QA cmsp66tdm, `src/lib/cultures/execution.ts`).
-- Aucun chemin ne restituait la date de plan quand l'étape était décochée :
-- cocher puis décocher détruisait silencieusement la date planifiée.
-- Ces trois colonnes gardent la valeur d'origine le temps du recalage.
-- null = la date portée par le champ est la date de plan.
ALTER TABLE "cultures" ADD COLUMN IF NOT EXISTS "date_semis_plan" TIMESTAMP(3);
ALTER TABLE "cultures" ADD COLUMN IF NOT EXISTS "date_plantation_plan" TIMESTAMP(3);
ALTER TABLE "cultures" ADD COLUMN IF NOT EXISTS "date_recolte_plan" TIMESTAMP(3);
