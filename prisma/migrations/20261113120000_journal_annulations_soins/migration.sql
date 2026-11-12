-- Constats C9 et C10 de la revue réglementaire du 2026-11-12.
--
-- C9 : un soin administré ne disparaît plus sans trace. Journal en ajout seul
-- des annulations motivées (erreur de saisie) : original, date, auteur, motif.
-- C10 : nombre d'animaux d'un lot traités, figé au jour du soin.
--
-- Écrit à la main ; chaque contrainte et index est déclaré au même nom dans
-- prisma/schema.prisma (garde scripts/verifier-derive-schema.mjs).

ALTER TABLE "soins_animaux" ADD COLUMN "effectif_traite" INTEGER;

CREATE TABLE "annulations_soins_animaux" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "soin_id" INTEGER,
    "soin_id_origine" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "acteur_id" TEXT NOT NULL,
    "injection_numero" INTEGER,
    "instantane" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annulations_soins_animaux_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "annulations_soins_animaux_user_date_idx" ON "annulations_soins_animaux"("user_id", "created_at");

CREATE INDEX "annulations_soins_animaux_soin_idx" ON "annulations_soins_animaux"("soin_id");

ALTER TABLE "annulations_soins_animaux" ADD CONSTRAINT "annulations_soins_animaux_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "annulations_soins_animaux" ADD CONSTRAINT "annulations_soins_animaux_soin_fk"
    FOREIGN KEY ("soin_id") REFERENCES "soins_animaux"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ajout seul : seule la colonne de rattachement `soin_id` peut changer (mise à
-- NULL par la clé étrangère quand le soin est effacé, ou réécrite par un import
-- de compte qui renumérote les soins). La suppression reste possible : elle ne
-- vient que de l'effacement du compte (cascade depuis "users").
CREATE FUNCTION "annulations_soins_animaux_ajout_seul"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."id", NEW."user_id", NEW."soin_id_origine", NEW."action", NEW."nature",
      NEW."motif", NEW."acteur_id", NEW."injection_numero", NEW."instantane", NEW."created_at")
     IS NOT DISTINCT FROM
     (OLD."id", OLD."user_id", OLD."soin_id_origine", OLD."action", OLD."nature",
      OLD."motif", OLD."acteur_id", OLD."injection_numero", OLD."instantane", OLD."created_at")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Le journal des annulations de soins ne se modifie pas (ajout seul).';
END;
$$;

CREATE TRIGGER "annulations_soins_animaux_ajout_seul"
    BEFORE UPDATE ON "annulations_soins_animaux"
    FOR EACH ROW EXECUTE FUNCTION "annulations_soins_animaux_ajout_seul"();
