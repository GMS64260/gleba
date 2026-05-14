-- ====================================================================
-- Reprise migration ref agronomique : les UPDATE de dose_semis et
-- taux_germination de la première migration ont été partiellement
-- écrasés par une opération concurrente (seed ou import) qui a remis
-- les anciennes valeurs (Carotte=100, Radis=80, Tomate=2.5...).
--
-- Cette migration ré-applique uniquement les doses et taux de
-- germination, sans toucher au reste (unite_dose, type_culture_semis,
-- famille, ITPs, associations sont déjà bons).
-- ====================================================================

-- === SEMIS DIRECT (g/m²) ===
UPDATE especes SET dose_semis = 0.8,  taux_germination = 70  WHERE espece = 'Carotte';
UPDATE especes SET dose_semis = 1.5,  taux_germination = 90  WHERE espece = 'Radis';
UPDATE especes SET dose_semis = 1.5,  taux_germination = 85  WHERE espece = 'Radis noir';
UPDATE especes SET dose_semis = 0.5,  taux_germination = 85  WHERE espece = 'Laitue';
UPDATE especes SET dose_semis = 12,   taux_germination = 85  WHERE espece IN ('Pois','Petit pois');
UPDATE especes SET dose_semis = 12,   taux_germination = 90  WHERE espece IN ('Haricot','Haricot vert','Haricot sec');
UPDATE especes SET dose_semis = 20,   taux_germination = 85  WHERE espece = 'Fève';
UPDATE especes SET dose_semis = 2,    taux_germination = 80  WHERE espece = 'Betterave';
UPDATE especes SET dose_semis = 1,    taux_germination = 80  WHERE espece = 'Blette';
UPDATE especes SET dose_semis = 4,    taux_germination = 80  WHERE espece = 'Épinard';
UPDATE especes SET dose_semis = 1,    taux_germination = 80  WHERE espece = 'Navet';
UPDATE especes SET dose_semis = 1.5,  taux_germination = 85  WHERE espece = 'Roquette';
UPDATE especes SET dose_semis = 2,    taux_germination = 80  WHERE espece = 'Mâche';
UPDATE especes SET dose_semis = 1,    taux_germination = 60  WHERE espece = 'Panais';
UPDATE especes SET dose_semis = 3,    taux_germination = 70  WHERE espece = 'Salsifis';
UPDATE especes SET dose_semis = 0.5,  taux_germination = 65  WHERE espece IN ('Chicorée frisée','Chicorée sauvage');
UPDATE especes SET dose_semis = 0.5,  taux_germination = 65  WHERE espece = 'Persil';
UPDATE especes SET dose_semis = 1,    taux_germination = 80  WHERE espece = 'Aneth';
UPDATE especes SET dose_semis = 2,    taux_germination = 75  WHERE espece = 'Coriandre';
UPDATE especes SET dose_semis = 8,    taux_germination = 90  WHERE espece = 'Maïs';
UPDATE especes SET dose_semis = 1.5,  taux_germination = 75  WHERE espece = 'Fenouil';
UPDATE especes SET dose_semis = 5,    taux_germination = 80  WHERE espece = 'Bourrache';
UPDATE especes SET dose_semis = 1.5,  taux_germination = 75  WHERE espece = 'Capucine';
UPDATE especes SET dose_semis = 0.5,  taux_germination = 80  WHERE espece = 'Camomille';
UPDATE especes SET dose_semis = 0.5,  taux_germination = 75  WHERE espece IN ('Souci','Tagètes','Cosmos');

-- === PÉPINIÈRE PUIS REPIQUAGE (graines / godet) ===
UPDATE especes SET dose_semis = 2,   taux_germination = 90 WHERE espece = 'Tomate';
UPDATE especes SET dose_semis = 2,   taux_germination = 75 WHERE espece = 'Aubergine';
UPDATE especes SET dose_semis = 2,   taux_germination = 80 WHERE espece IN ('Poivron','Poivron piment');
UPDATE especes SET dose_semis = 2,   taux_germination = 85 WHERE espece = 'Concombre';
UPDATE especes SET dose_semis = 1.5, taux_germination = 90 WHERE espece = 'Courgette';
UPDATE especes SET dose_semis = 2,   taux_germination = 85 WHERE espece IN ('Courge','Courge butternut','Potiron','Potimarron','Chayote','Melon');
UPDATE especes SET dose_semis = 2,   taux_germination = 85 WHERE espece IN ('Chou','Chou brocoli','Chou de Bruxelles','Chou de Chine','Chou frisé','Chou kale','Chou pommé','Chou-fleur','Chou-rave');
UPDATE especes SET dose_semis = 3,   taux_germination = 70 WHERE espece IN ('Céleri','Céleri-rave');
UPDATE especes SET dose_semis = 2,   taux_germination = 75 WHERE espece IN ('Fenouil','Artichaut');
UPDATE especes SET dose_semis = 1,   taux_germination = 70 WHERE espece = 'Poireau';
UPDATE especes SET dose_semis = 3,   taux_germination = 70 WHERE espece = 'Basilic';

-- === PLANTATION CAIEUX / BULBES / TUBERCULES (unités / m²) ===
UPDATE especes SET dose_semis = 20,  taux_germination = 95 WHERE espece = 'Ail';
UPDATE especes SET dose_semis = 70,  taux_germination = 95 WHERE espece = 'Oignon';
UPDATE especes SET dose_semis = 40,  taux_germination = 95 WHERE espece = 'Échalote';
UPDATE especes SET dose_semis = 4,   taux_germination = 95 WHERE espece = 'Pomme de terre';
UPDATE especes SET dose_semis = 3,   taux_germination = 95 WHERE espece = 'Topinambour';
UPDATE especes SET dose_semis = 4,   taux_germination = 95 WHERE espece = 'Patate douce';

-- Marge de sécurité re-calibrée sur les nouveaux taux
UPDATE especes SET marge_securite_pct = 30 WHERE taux_germination IS NOT NULL AND taux_germination < 65;
UPDATE especes SET marge_securite_pct = 25 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 65 AND 74;
UPDATE especes SET marge_securite_pct = 20 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 75 AND 84;
UPDATE especes SET marge_securite_pct = 15 WHERE taux_germination IS NOT NULL AND taux_germination BETWEEN 85 AND 92;
UPDATE especes SET marge_securite_pct = 10 WHERE taux_germination IS NOT NULL AND taux_germination >= 93;

-- ====================================================================
-- Purge références aux familles francisées disparues dans seed-data
-- (le seed n'est pas exécuté en prod, mais on garde un trigger de
-- garde-fou : si quelqu'un POST une espèce avec famille = 'Solanacées',
-- on rejette plutôt que de SetNull silencieusement).
-- ====================================================================
CREATE OR REPLACE FUNCTION enforce_famille_latine() RETURNS TRIGGER AS $$
DECLARE
  obsolete_fr TEXT[] := ARRAY[
    'Solanacées','Brassicacées','Alliacées','Apiacées','Astéracées',
    'Fabacées','Cucurbitacées','Rosacées','Chénopodiacées'
  ];
BEGIN
  IF NEW.famille = ANY(obsolete_fr) THEN
    RAISE EXCEPTION 'Famille "%": utiliser le nom latin (APG IV). Solanacées -> Solanaceae, Brassicacées -> Brassicaceae, etc.', NEW.famille;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS especes_famille_latine ON especes;
CREATE TRIGGER especes_famille_latine
  BEFORE INSERT OR UPDATE ON especes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_famille_latine();
