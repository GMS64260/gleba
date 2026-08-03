-- Fenêtre saisonnière des opérations d'entretien verger.
--
-- Le générateur de calendrier écrasait la fenêtre agronomique (« taille en vert,
-- juin-juillet ») en une date pivot au 15 du mois de début. Conséquences
-- observées en production le 2026-08-03 sur un verger de 86 arbres : 79 tâches
-- datées du même jour (2026-06-15), toutes basculées « en retard » ensemble, et
-- un briefing quotidien saturé de 100 lignes identiques.
--
-- Ces trois colonnes portent la réalité : la fenêtre pendant laquelle
-- l'opération est faisable, et le solde explicite d'une fenêtre fermée sans
-- réalisation. Additif et nullable : les lignes existantes et les saisies
-- manuelles gardent le comportement « échéance ferme ».

ALTER TABLE "operations_arbres" ADD COLUMN "fenetre_debut" TIMESTAMP(3);
ALTER TABLE "operations_arbres" ADD COLUMN "date_limite" TIMESTAMP(3);
ALTER TABLE "operations_arbres" ADD COLUMN "abandonnee_le" TIMESTAMP(3);

CREATE INDEX "operations_arbres_date_limite_idx" ON "operations_arbres"("date_limite");
