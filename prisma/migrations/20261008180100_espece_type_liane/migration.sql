-- Catégorie « liane » du verger (demande communautaire du 2026-10-07) : les
-- plantes grimpantes fruitières (kiwi, vigne, kiwaï) ne se conduisent ni ne
-- s'emprisent comme un arbre. Le type rejoint `arbre_fruitier` et
-- `petit_fruit` dans ESPECE_TYPES_VERGER (src/lib/validations/espece.ts).
--
-- Le CHECK est le second garde-fou derrière le zod (piège du 2026-08-18 :
-- une valeur ajoutée au zod sans reprendre le CHECK échoue en 500 à la
-- création). L'ordre reproduit celui de src/lib/validations/espece.ts.
ALTER TABLE especes DROP CONSTRAINT IF EXISTS especes_type_check;
ALTER TABLE especes ADD CONSTRAINT especes_type_check CHECK (
  type = ANY (ARRAY[
    'legume'::text,
    'aromatique'::text,
    'fleur'::text,
    'engrais_vert'::text,
    'arbre_fruitier'::text,
    'petit_fruit'::text,
    'liane'::text,
    'ornement'::text
  ])
);

-- Les grimpantes du catalogue officiel passent en liane ; les espèces des
-- membres ne sont pas réinterprétées (ils choisissent eux-mêmes).
UPDATE especes SET type = 'liane'
WHERE user_id IS NULL AND espece IN ('Kiwi', 'Vigne');
