-- Stock d'œufs par lot de ponte : sorties typées et péremption calculable à
-- partir de production_oeufs.date (vente J+21, DCR J+28).

CREATE TABLE IF NOT EXISTS mouvements_stock_oeufs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  production_id INTEGER NOT NULL,
  date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL,
  quantite INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mouvements_stock_oeufs_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT mouvements_stock_oeufs_production_fk
    FOREIGN KEY (production_id) REFERENCES production_oeufs(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT mouvements_stock_oeufs_type_check
    CHECK (type IN ('vente','autoconsommation','don','destruction','casse','ajustement')),
  CONSTRAINT mouvements_stock_oeufs_quantite_check
    CHECK (quantite > 0)
);

CREATE INDEX IF NOT EXISTS mouvements_stock_oeufs_user_date_idx
  ON mouvements_stock_oeufs(user_id, date);
CREATE INDEX IF NOT EXISTS mouvements_stock_oeufs_production_idx
  ON mouvements_stock_oeufs(production_id);
