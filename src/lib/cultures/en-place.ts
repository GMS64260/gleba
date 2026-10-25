/**
 * Une culture est-elle sur sa planche AUJOURD'HUI ? Prédicat pur partagé.
 *
 * QA cmvnur8eu (2026-10-25) : à « qu'est-ce qui est planté sur la planche
 * B5 ? », l'assistant répondait « deux cultures actives », dont un poivron
 * seulement planifié pour 2027. Une première reprise inventait sa propre
 * définition de « en place » ; la revue l'a rejetée : trois règles existaient
 * déjà, chacune sur un écran. Elles sont réunies ici, sans en ajouter :
 *
 * - début sur la planche : `debutSurPlanche` (déplacé depuis
 *   `src/lib/irrigation/bilan-culture.ts`, qui le réexporte) : la plantation
 *   pour un plant repiqué, le semis pour un semis direct ; une date prévue
 *   PASSÉE mais non cochée est réputée faite à cette date ;
 * - fenêtre de récolte : miroir en mémoire de `whereCulturesEnPlace`
 *   (`src/lib/irrigation-conseil.ts`) : une annuelle de l'année en cours ou
 *   de la précédente reste en place jusqu'à `finRecolte` +
 *   `JOURS_APRES_FIN_RECOLTE` jours, ou, sans fin connue, `dateRecolte` +
 *   `JOURS_APRES_DEBUT_RECOLTE_SANS_FIN` jours ; sans date de récolte, la
 *   fenêtre est ouverte ;
 * - vivace non close : `estVivaceEnPlace` (`fenetre-recolte.ts`), sans fin de
 *   cycle ;
 * - état des cases : `etatCulture` (`etat.ts`).
 *
 * Quand les cases et les dates se contredisent, ou qu'une culture non close a
 * dépassé sa fenêtre, la réponse est `a_verifier` avec sa raison, jamais
 * « pas en place » : la base ne permet pas de trancher.
 *
 * #todo : `whereCulturesEnPlace` doit devenir le miroir Prisma exact de
 * `presenceSurPlanche`, avec un test de parité (comme `etat.ts` /
 * `whereEtatCulture`). Écarts connus au 2026-10-25 : l'irrigation exige
 * `annee` ∈ {N-1, N} (ici : N-1 et au-delà, une culture de N+1 déjà plantée
 * est sur la planche ; `annee` vide n'exclut pas), et ne retient ni une
 * culture seulement planifiée, ni `terminee = 'v'`.
 */
import { etatCulture, type EtatCulture } from './etat'
import { estVivaceEnPlace } from './fenetre-recolte'
import { JOURS_APRES_DEBUT_RECOLTE_SANS_FIN, JOURS_APRES_FIN_RECOLTE } from '@/lib/irrigation/seuils'

const JOUR_MS = 86_400_000

/** Champs lus par `debutSurPlanche`. */
export interface DatesMiseEnPlace {
  dateSemis: Date | null
  datePlantation: Date | null
  semisFait: boolean | null
  plantationFaite: boolean | null
}

/** Champs lus par `presenceSurPlanche` (sélection Prisma : `SELECT_EN_PLACE` + `espece.vivace`). */
export interface CultureEnPlace extends DatesMiseEnPlace {
  annee: number | null
  terminee: string | null
  recolteFaite: boolean | null
  dateRecolte: Date | null
  finRecolte: Date | null
  espece?: { vivace?: boolean | null } | null
}

/** Sélection Prisma des champs scalaires lus par `presenceSurPlanche` (ajouter `espece.vivace`). */
export const SELECT_EN_PLACE = {
  annee: true,
  terminee: true,
  semisFait: true,
  plantationFaite: true,
  recolteFaite: true,
  dateSemis: true,
  datePlantation: true,
  dateRecolte: true,
  finRecolte: true,
} as const

export type PresenceSurPlanche =
  /** Sur la planche ; `note` dit ce qui est réputé (date passée non cochée, vivace sans jalon). */
  | { statut: 'en_place'; etat: EtatCulture; depuis: string | null; note?: string }
  /** Pas encore sur la planche : mise en place prévue plus tard (ou planifiée sans date). */
  | { statut: 'a_venir'; etat: EtatCulture; debut: string | null }
  /** Close : `terminee` = 'x' ou 'NS'. */
  | { statut: 'close'; etat: EtatCulture }
  /** La base ne permet pas de trancher : la raison se dit telle quelle. */
  | { statut: 'a_verifier'; etat: EtatCulture; raison: string }

/**
 * Jour civil AAAA-MM-JJ du serveur (TZ Europe/Paris). Même calcul que
 * `jourLocalIso` de `irrigation/meteo-bilan.ts`, module non pur (cache,
 * appels météo) que ce prédicat ne peut pas importer.
 */
function jourCivil(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** JJ/MM/AAAA d'un jour AAAA-MM-JJ. */
function jourFr(iso: string): string {
  const [a, m, j] = iso.split('-')
  return `${j}/${m}/${a}`
}

/**
 * Jour (AAAA-MM-JJ) de mise en place sur la planche : la plantation pour un
 * plant repiqué, le semis pour un semis direct.
 * - Un plant encore en pépinière dont la plantation est prévue PLUS TARD
 *   n'est pas encore sur la planche et ne la dessèche pas.
 * - Une plantation prévue et PASSÉE mais non cochée est supposée faite à la
 *   date prévue (32 cas sur 383 le 2026-10-10 : oubli de cocher plutôt que
 *   retard de repiquage, on ne sait pas trancher).
 * - Une plantation ou un semis cochés en avance datent du jour du lieu.
 * Les dates de calendrier sont stockées à minuit (Paris ou UTC) : le jour
 * civil du serveur est le bon.
 */
export function debutSurPlanche(c: DatesMiseEnPlace, aujourdhui: string): string | null {
  const prevu = c.datePlantation ?? c.dateSemis
  if (!prevu) return null
  const fait = c.datePlantation ? c.plantationFaite : c.semisFait
  const jour = jourCivil(prevu)
  return fait && jour > aujourdhui ? aujourdhui : jour
}

/**
 * Fenêtre de récolte encore ouverte à `maintenant` : miroir en mémoire de la
 * seconde condition de `whereCulturesEnPlace` (annuelles).
 */
export function fenetreRecolteOuverte(
  c: Pick<CultureEnPlace, 'dateRecolte' | 'finRecolte'>,
  maintenant: Date,
): boolean {
  if (c.finRecolte) return c.finRecolte.getTime() >= maintenant.getTime() - JOURS_APRES_FIN_RECOLTE * JOUR_MS
  if (c.dateRecolte) return c.dateRecolte.getTime() >= maintenant.getTime() - JOURS_APRES_DEBUT_RECOLTE_SANS_FIN * JOUR_MS
  return true
}

/** « plantation prévue le … » ou « semis prévu le … ». */
function jalonPrevu(c: DatesMiseEnPlace, jour: string): string {
  return c.datePlantation ? `plantation prévue le ${jourFr(jour)}` : `semis prévu le ${jourFr(jour)}`
}

/** Où est la culture par rapport à sa planche, aujourd'hui. */
export function presenceSurPlanche(c: CultureEnPlace, maintenant: Date = new Date()): PresenceSurPlanche {
  const etat = etatCulture(c)
  // `etatCulture` dit « Terminée » ; l'onglet Historique dit « Vivace » ; le
  // plan et l'irrigation (`terminee: null`) la tiennent pour close.
  if (c.terminee === 'v') {
    return { statut: 'a_verifier', etat, raison: 'marquée « vivace (continue) », que le plan ne montre plus' }
  }
  if (c.terminee) return { statut: 'close', etat }

  const aujourdhui = jourCivil(maintenant)
  const anneeCourante = maintenant.getFullYear()
  const debut = debutSurPlanche(c, aujourdhui)

  if (debut && debut > aujourdhui) {
    // `debutSurPlanche` ramène à aujourd'hui un jalon coché : un jalon PLUS
    // avancé coché alors que la mise en place est à venir est une contradiction.
    if (c.recolteFaite || c.plantationFaite) {
      const coche = c.recolteFaite ? 'récolte cochée' : 'plantation cochée'
      return { statut: 'a_verifier', etat, raison: `${coche} alors que ${jalonPrevu(c, debut)}` }
    }
    return { statut: 'a_venir', etat, debut }
  }

  if (estVivaceEnPlace(c)) {
    return {
      statut: 'en_place',
      etat,
      depuis: debut,
      ...(etat === 'Planifiée' ? { note: debut ? 'aucun jalon coché' : 'sans date ni jalon coché' } : {}),
    }
  }

  if (debut === null && etat === 'Planifiée') {
    if (c.annee != null && c.annee < anneeCourante) {
      return { statut: 'a_verifier', etat, raison: `planifiée en ${c.annee}, sans date, jamais démarrée ni close` }
    }
    return { statut: 'a_venir', etat, debut: null }
  }

  // Mise en place passée, ou jalons cochés sans date (imports) : annuelle de
  // l'année en cours ou de la précédente seulement (`whereCulturesEnPlace`).
  if (c.annee != null && c.annee < anneeCourante - 1) {
    return { statut: 'a_verifier', etat, raison: `campagne ${c.annee} jamais close` }
  }
  if (etat === 'Planifiée' && debut) {
    return { statut: 'a_verifier', etat, raison: `${jalonPrevu(c, debut)} passé, aucun jalon coché` }
  }
  if (!fenetreRecolteOuverte(c, maintenant)) {
    const fin = c.finRecolte
      ? `récolte terminée le ${jourFr(jourCivil(c.finRecolte))}`
      : `récolte commencée le ${jourFr(jourCivil(c.dateRecolte as Date))}, il y a plus de ${JOURS_APRES_DEBUT_RECOLTE_SANS_FIN} jours, sans fin renseignée`
    return { statut: 'a_verifier', etat, raison: `${fin}, non close` }
  }
  if (etat === 'Semée' && c.datePlantation && debut) {
    return { statut: 'en_place', etat, depuis: debut, note: `${jalonPrevu(c, debut)} non cochée, réputée faite` }
  }
  return { statut: 'en_place', etat, depuis: debut }
}

/** Vrai si la culture est sur sa planche aujourd'hui (`presenceSurPlanche`). */
export function estEnPlace(c: CultureEnPlace, maintenant: Date = new Date()): boolean {
  return presenceSurPlanche(c, maintenant).statut === 'en_place'
}
