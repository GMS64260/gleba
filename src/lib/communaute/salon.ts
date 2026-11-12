/**
 * Salon de discussion de la page Communauté : forme d'un message à l'écran et
 * règles pures partagées par la route et le composant (aucun import serveur).
 *
 * Le fil se rafraîchit par interrogation : chaque passage relit la FENÊTRE des
 * derniers messages plutôt que les seuls nouveaux. C'est ce qui fait
 * disparaître chez tout le monde un message supprimé par son auteur ou par
 * l'équipe, sans journal des suppressions.
 */

/** Nombre de messages par page (fenêtre récente comme historique). */
export const TAILLE_PAGE_SALON = 50

/** Intervalle d'interrogation du fil quand l'onglet est visible. */
export const INTERVALLE_SALON_MS = 5000

/** Nom affiché d'un auteur sans nom renseigné. */
export const NOM_PAR_DEFAUT_SALON = "Membre de Gleba"

export interface MessageSalonVue {
  id: string
  contenu: string
  /** ISO 8601 (`toISOString`), donc comparable comme une chaîne. */
  createdAt: string
  auteur: {
    nom: string
    estMoi: boolean
    /** Compte administrateur : affiché « Équipe Gleba ». */
    equipe: boolean
  }
  /** L'auteur ou un administrateur peut retirer le message. */
  supprimable: boolean
}

export interface PageSalon {
  /** Ordre chronologique : le plus ancien d'abord. */
  messages: MessageSalonVue[]
  /** Des messages plus anciens existent au-delà de cette page. */
  plusAnciens: boolean
}

/**
 * Nom montré aux autres membres : le nom du compte, jamais l'adresse e-mail
 * (ni même sa partie locale, souvent « prénom.nom »).
 */
export function nomAuteurSalon(nom: string | null | undefined): string {
  const propre = (nom ?? "").trim()
  return propre || NOM_PAR_DEFAUT_SALON
}

/**
 * Fusionne la fenêtre récente relue par l'interrogation dans le fil affiché,
 * qui peut contenir des pages plus anciennes chargées à la demande.
 *
 * - Fenêtre complète (`plusAnciens` faux) : elle contient tout le salon, elle
 *   remplace le fil.
 * - Sinon, on garde les messages affichés antérieurs à la fenêtre et on lui
 *   laisse tout le reste : un message supprimé dans la fenêtre disparaît, un
 *   nouveau apparaît.
 */
export function fusionnerFenetreSalon(
  affiches: MessageSalonVue[],
  fenetre: PageSalon,
): MessageSalonVue[] {
  if (!fenetre.plusAnciens || fenetre.messages.length === 0) return fenetre.messages
  const borne = fenetre.messages[0].createdAt
  const dansFenetre = new Set(fenetre.messages.map((m) => m.id))
  const anterieurs = affiches.filter((m) => m.createdAt <= borne && !dansFenetre.has(m.id))
  return [...anterieurs, ...fenetre.messages]
}

/** Ajoute une page d'historique en tête du fil, sans doublon. */
export function ajouterPageAncienneSalon(
  affiches: MessageSalonVue[],
  anciens: MessageSalonVue[],
): MessageSalonVue[] {
  const presents = new Set(affiches.map((m) => m.id))
  return [...anciens.filter((m) => !presents.has(m.id)), ...affiches]
}

/** Clé de jour local (AAAA-MM-JJ) d'une date, pour séparer le fil par jour. */
export function cleJourSalon(date: Date): string {
  const a = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const j = String(date.getDate()).padStart(2, "0")
  return `${a}-${m}-${j}`
}

/** « Aujourd'hui », « Hier », sinon la date en toutes lettres. */
export function libelleJourSalon(date: Date, maintenant: Date = new Date()): string {
  const jour = cleJourSalon(date)
  if (jour === cleJourSalon(maintenant)) return "Aujourd'hui"
  const hier = new Date(maintenant)
  hier.setDate(hier.getDate() - 1)
  if (jour === cleJourSalon(hier)) return "Hier"
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() !== maintenant.getFullYear() ? { year: "numeric" } : {}),
  })
}
