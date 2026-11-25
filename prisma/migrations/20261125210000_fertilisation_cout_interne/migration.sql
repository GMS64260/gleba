-- Fertilisations : coût interne, pas charge comptable (2026-11-25).
-- Le miroir comptable d'une fertilisation (créé par l'import d'une sauvegarde
-- ou par la reprise 20260531120000) valorise un engrais déjà acheté. Laissé
-- `comptable`, il comptait l'achat de l'engrais puis sa consommation, et
-- déduisait une TVA sans facture, dans les rapports, le FEC et la TVA.
-- Même règle et même reprise que les consommations d'aliment et les soins
-- (20260726200000) : la valorisation reste consultable, hors comptabilité.
-- Aucune ligne n'est supprimée ni son montant modifié.
--
-- Un miroir qui porte un dossier de règlement reste comptable : le sortir de
-- la comptabilité laisserait un règlement sans pièce, impossible à annuler.
-- La clé est celle de `cleSourceReglement` (JSON sans espace).
BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE "depenses_manuelles" AS d
SET "comptable" = false,
    "tva_inferee" = true
WHERE d."auto" = true
  AND d."source_type" = 'fertilisation'
  AND d."comptable" = true
  AND NOT EXISTS (
    SELECT 1 FROM "cibles_reglement" AS c
    WHERE c."user_id" = d."user_id"
      AND c."cle" = '["depense","fertilisation","id","' || d."source_id" || '"]'
  );

COMMIT;
