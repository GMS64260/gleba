-- Sentinelle « Communauté Gleba » : compte système NON connectable qui reprend
-- les entrées de référentiel PARTAGÉES d'un membre supprimé (décision produit #2).
-- Ainsi, supprimer un compte ne détruit plus ses contributions communautaires
-- (que d'autres membres utilisent peut-être) ; seules ses entrées PRIVÉES sont
-- supprimées (cascade sur user_id lors du delete).
--
-- - active=false + mot de passe verrouillé (jamais un hash bcrypt valide) → login impossible.
-- - email_opt_out=true → jamais destinataire d'un email.
-- - role laissé au défaut (USER). id fixe = 'gleba-communaute' (cf. account-lifecycle.ts).

INSERT INTO "users" (
  "id", "email", "password", "name",
  "active", "email_opt_out", "email_verified",
  "created_at", "updated_at"
) VALUES (
  'gleba-communaute',
  'communaute@gleba.fr',
  '!verrou-sentinelle-communaute-non-connectable',
  'Communauté Gleba',
  false, true, true,
  now(), now()
)
ON CONFLICT ("id") DO NOTHING;
