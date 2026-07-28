-- Unifie le catalogue vétérinaire, les lots physiques de pharmacie et les
-- administrations. Les informations réglementaires du lot sont snapshotées
-- sur le soin afin de rester imprimables après évolution de l'inventaire.

ALTER TABLE soins_animaux
  ADD COLUMN IF NOT EXISTS stock_medicament_id TEXT,
  ADD COLUMN IF NOT EXISTS numero_lot_medicament TEXT,
  ADD COLUMN IF NOT EXISTS peremption_medicament TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS quantite_prelevee_stock DOUBLE PRECISION NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'soins_animaux_stock_medicament_fk'
  ) THEN
    ALTER TABLE soins_animaux
      ADD CONSTRAINT soins_animaux_stock_medicament_fk
      FOREIGN KEY (stock_medicament_id)
      REFERENCES stocks_medicaments_elevage(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stocks_medicaments_elevage_user_fk'
  ) THEN
    ALTER TABLE stocks_medicaments_elevage
      ADD CONSTRAINT stocks_medicaments_elevage_user_fk
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stocks_medicaments_elevage_produit_fk'
  ) THEN
    ALTER TABLE stocks_medicaments_elevage
      ADD CONSTRAINT stocks_medicaments_elevage_produit_fk
      FOREIGN KEY (produit_id)
      REFERENCES produits_veterinaires(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS soins_animaux_stock_medicament_idx
  ON soins_animaux(stock_medicament_id);

ALTER TABLE soins_animaux
  DROP CONSTRAINT IF EXISTS soins_animaux_quantite_prelevee_stock_check;
ALTER TABLE soins_animaux
  ADD CONSTRAINT soins_animaux_quantite_prelevee_stock_check
  CHECK (quantite_prelevee_stock >= 0);
