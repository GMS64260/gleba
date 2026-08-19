-- Péremption des irrigations planifiées.
--
-- Un arrosage ne se rattrape pas : passé un cycle complet, le passage manqué
-- est abandonné plutôt que de rester dû indéfiniment. Sans cet état, le plan
-- de saison accumulait le retard et un seul clic le soldait en antidatant la
-- trace (30 lignes prévues sur six jours estampillées du même jour).
--
-- Additive : toutes les lignes existantes restent dues (`perimee = false`),
-- le balayage de lecture les qualifiera au premier affichage.
ALTER TABLE "irrigations_planifiees"
  ADD COLUMN "perimee" BOOLEAN NOT NULL DEFAULT false;

-- Sert les décomptes « encore dû » (écran Tâches, calendrier, briefing).
CREATE INDEX "irrigations_planifiees_user_id_fait_perimee_idx"
  ON "irrigations_planifiees" ("user_id", "fait", "perimee");
