-- Itinéraires officiels recréés en double sous leurs anciens identifiants.
--
-- La migration 20260515180000_itp_nomenclature_unifiee a renommé les
-- itinéraires « ITP-… ». Le seed listait encore les anciens identifiants et
-- ne retrouvait pas les fiches renommées : il les recréait à chaque base où
-- il allait jusqu'aux itinéraires. Le seed est corrigé dans le même lot.
--
-- Pour chaque ancien identifiant officiel encore présent :
--   - si la fiche actuelle existe, cultures et rotations qui pointeraient sur
--     le double sont rattachées à elle, puis le double est supprimé ;
--   - sinon (base créée par l'ancien seed seul), le double est simplement
--     renommé : il devient la fiche actuelle.
-- Les itinéraires des utilisateurs (user_id renseigné) ne sont pas touchés.
DO $$
DECLARE
  paire RECORD;
BEGIN
  FOR paire IN
    SELECT * FROM (VALUES
    ('ITP-Tomate-printemps', 'Tomate-printemps'),
    ('ITP-Tomate-tardive', 'Tomate-automne-tardive'),
    ('ITP-Courgette', 'Courgette-ete-tardive'),
    ('ITP-Carotte-printemps', 'Carotte-printemps-plein-champ'),
    ('ITP-Carotte-automne', 'Carotte-ete-conservation-plein-champ'),
    ('ITP-Haricot-vert', 'Haricot-vert-ete'),
    ('ITP-Haricot-sec', 'Haricot-ete-sec'),
    ('ITP-Laitue-printemps', 'Laitue-printemps'),
    ('ITP-Laitue-ete', 'Laitue-ete'),
    ('ITP-Laitue-automne', 'Laitue-automne'),
    ('ITP-Poivron', 'Poivron-printemps'),
    ('ITP-Aubergine', 'Aubergine-plein-champ'),
    ('ITP-Butternut', 'Courge-butternut'),
    ('ITP-Potimarron', 'Potimarron'),
    ('ITP-Oignon', 'Oignon-printemps'),
    ('ITP-Poireau', 'Poireau-printemps'),
    ('ITP-Ail', 'Ail-printemps'),
    ('ITP-Chou-kale', 'Chou-kale-ete'),
    ('ITP-Brocoli', 'Chou-brocoli-ete'),
    ('ITP-Epinard', 'Épinard-printemps'),
    ('ITP-Betterave', 'Betterave-printemps'),
    ('ITP-Petit-pois', 'Petit-pois-printemps'),
    ('ITP-Radis', 'Radis-printemps'),
    ('ITP-Phacelie', 'EV-Phacelie-automne'),
    ('ITP-Moutarde', 'EV-Moutarde-automne')
    ) AS v(ancien, actuel)
  LOOP
    CONTINUE WHEN paire.ancien = paire.actuel;
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM itps WHERE it_plante = paire.ancien AND user_id IS NULL);
    IF EXISTS (SELECT 1 FROM itps WHERE it_plante = paire.actuel) THEN
      UPDATE cultures SET it_plante = paire.actuel WHERE it_plante = paire.ancien;
      UPDATE rotations_details SET it_plante = paire.actuel WHERE it_plante = paire.ancien;
      DELETE FROM itps WHERE it_plante = paire.ancien AND user_id IS NULL;
    ELSE
      UPDATE itps SET it_plante = paire.actuel WHERE it_plante = paire.ancien AND user_id IS NULL;
    END IF;
  END LOOP;
END $$;
