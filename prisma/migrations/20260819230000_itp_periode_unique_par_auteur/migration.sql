-- Unicité de période par AUTEUR, et non globale.
--
-- `itps_periode_unique_idx` interdit deux itinéraires partageant (espèce,
-- semaine de semis, semaine de plantation, semaine de récolte, type de planche).
-- Utile pour empêcher un membre de saisir deux fois le même scénario. Mais
-- l'index est GLOBAL : il refuse aussi l'itinéraire d'un membre qui coïncide
-- avec celui du catalogue Gleba, ou avec celui d'un autre membre — y compris un
-- itinéraire privé qu'il ne peut pas voir.
--
-- Cas réel : un maraîcher saisit sa tomate sous abri (semis S7, plantation S11,
-- récolte S27, « Sous abri »). Ce sont les semaines de l'ITP officiel
-- `Tomate-printemps-hative-serre`. PostgreSQL rejette, l'écran affiche « Erreur
-- lors de la création de l'ITP », et rien ne lui dit que c'est un conflit de
-- période ni avec quoi — l'itinéraire fautif peut lui être invisible.
--
-- On ajoute `user_id` à la clé (via COALESCE, car NULL n'entre pas dans
-- l'unicité d'un index btree). L'unicité devient : un même scénario au plus par
-- auteur. L'index nouveau est strictement PLUS PERMISSIF que l'ancien, donc
-- aucune ligne existante ne peut le violer.
--
-- Le code applicatif attrape désormais la violation restante (P2002 / 23505) et
-- répond 409 en nommant l'itinéraire en conflit, au lieu d'un 500 muet.

DROP INDEX IF EXISTS "itps_periode_unique_idx";

CREATE UNIQUE INDEX "itps_periode_unique_idx"
  ON "itps" (
    COALESCE("user_id", '<officiel>'),
    "espece",
    COALESCE("s_semis", -1),
    COALESCE("s_plantation", -1),
    COALESCE("s_recolte", -1),
    COALESCE("type_planche", '<vide>')
  )
  WHERE "espece" IS NOT NULL AND "source_record_id" IS NULL;
