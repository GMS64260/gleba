/**
 * Identité du compte de démonstration public (bouton « Essayer la démo »).
 *
 * Module volontairement pur (constantes + prédicat, zéro import) : il est
 * importé par auth.ts, donc atteignable depuis le middleware — il doit
 * rester compatible Edge.
 */

export const DEMO_EMAIL = "demo@gleba.fr"

/** Vrai si cette adresse est celle du compte de démonstration partagé. */
export function estEmailDemo(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL
}

const PARTAGE = "Le compte de démonstration est partagé par tous les visiteurs"

/**
 * Refus des gestes de niveau compte sur la démo, un texte par geste. Ici et non
 * dans `demo-garde.ts` (serveur) pour que l'écran Paramètres affiche le même
 * texte que la route sans importer Prisma.
 */
export const MESSAGES_REFUS_DEMO = {
  preferences: `${PARTAGE} : ses réglages sont figés pour que chaque visiteur voie la même ferme. Créez un compte gratuit pour conserver vos préférences.`,
  viderDonnees: `${PARTAGE} : ses données ne peuvent pas être vidées. Créez un compte gratuit pour essayer cette action sur votre propre ferme.`,
  supprimerCompte: `${PARTAGE} : il ne peut pas être supprimé. Créez un compte gratuit pour essayer cette action sur votre propre ferme.`,
  importer: `${PARTAGE} : on ne peut pas y importer de données, elles remplaceraient celles de la ferme de démonstration. Créez un compte gratuit pour importer vos données.`,
  motDePasse: `${PARTAGE} : son mot de passe ne peut pas être changé, sinon les visiteurs suivants ne pourraient plus entrer. Créez un compte gratuit pour choisir votre mot de passe.`,
  exploitation: `${PARTAGE} : l'identité de son exploitation (nom, SIRET, coordonnées) est figée, elle s'imprime sur les factures de démonstration. Créez un compte gratuit pour renseigner la vôtre.`,
  inviterMembre: `${PARTAGE} : il ne peut pas inviter de membres, un courriel partirait au nom de la ferme de démonstration. Créez un compte gratuit pour inviter votre équipe.`,
  jetonApi: `${PARTAGE} : son jeton d'accès (MCP) ne se génère ni ne se révoque, il est commun à tous les visiteurs. Créez un compte gratuit pour obtenir le vôtre.`,
  /** Encadré de la « Zone de danger » de l'écran Paramètres (vider + supprimer). */
  zoneDanger: `${PARTAGE} : ses données ne peuvent pas être vidées ni le compte supprimé. Créez un compte gratuit pour essayer ces actions sur votre propre ferme.`,
  /** Onglet « Salon » de la page Communauté : ni lecture ni écriture. */
  salon: `${PARTAGE} : le salon de discussion est réservé aux comptes personnels, pour que chacun sache à qui il parle. Créez un compte gratuit pour lire et écrire dans le salon.`,
} as const
