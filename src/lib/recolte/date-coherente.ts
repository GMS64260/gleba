/**
 * Une récolte ne peut pas précéder la mise en place de sa culture.
 *
 * QA cmv2r19al (2026-10-10) : une culture de zinnia semée le 10/10 et dont la
 * plantation était prévue le 21/11 acceptait, le 10/10, une récolte de
 * 25 tiges ; la culture passait alors « Récolte prévue : 10 octobre 2026 »,
 * avant sa propre plantation. Rien, ni à l'écran ni dans la route, ne
 * confrontait la date de récolte au cycle de la culture.
 *
 * Règle portée par les routes (motif « garde métier côté serveur ») : la date
 * de récolte, en journée civile locale, n'est pas antérieure au début du cycle
 * en place, c'est-à-dire la plantation si la culture en a une, sinon le semis.
 * Le jour même est accepté. Une date d'étape seulement prévue compte autant
 * qu'une étape faite : si la plantation a eu lieu plus tôt que prévu, c'est la
 * fiche de la culture qu'il faut corriger, le message le dit.
 *
 * Appelants : POST et PUT `/api/recoltes`, outil `create_recolte` de
 * l'assistant (et du MCP). L'import d'une sauvegarde (`/api/import`) en est
 * exempté : il restaure l'historique tel qu'il a été exporté.
 *
 * Seconde règle (défaut D52 de l'équipe debug, 2026-11-25) : la péremption
 * d'une récolte n'est jamais antérieure à sa récolte, le jour même étant
 * accepté. Rien ne la portait : une récolte se redatait après sa péremption.
 * Appelants : `preparerRecoltes` (POST, assistant, MCP), PUT et PATCH
 * `/api/recoltes/[id]`. Même exemption pour l'import d'une sauvegarde.
 */

import { format } from 'date-fns'
import { jourCivilLocal } from '@/lib/cultures/execution'
import { jourCivilStocke } from '@/lib/jour-civil'

/** Ce qu'il faut lire sur la culture pour décider. */
export interface DebutCultureRecolte {
  id: number
  dateSemis: Date | null
  datePlantation: Date | null
  semisFait: boolean
  plantationFaite: boolean
}

/**
 * Message de refus, ou `null` si la date de récolte est recevable.
 * Les dates s'affichent en heure locale (le conteneur tourne en Europe/Paris).
 */
export function refusRecolteAvantDebut(
  culture: DebutCultureRecolte,
  dateRecolte: Date,
): string | null {
  const plantation = culture.datePlantation != null
  const debut = plantation ? culture.datePlantation : culture.dateSemis
  if (!debut || Number.isNaN(dateRecolte.getTime())) return null
  if (jourCivilLocal(dateRecolte) >= jourCivilLocal(debut)) return null

  const jour = (d: Date) => format(d, 'dd/MM/yyyy')
  const faite = plantation ? culture.plantationFaite : culture.semisFait
  const etape = plantation ? 'la plantation' : 'le semis'
  const constat = faite
    ? `la culture #${culture.id} a été ${plantation ? 'plantée' : 'semée'} le ${jour(debut)}`
    : `${plantation ? 'la plantation' : 'le semis'} de la culture #${culture.id} est prévu${plantation ? 'e' : ''} le ${jour(debut)}`
  const conseil = faite
    ? ''
    : ` ${plantation ? 'Si elle' : "S'il"} a déjà eu lieu, corrigez d'abord sa date sur la fiche de la culture.`
  return `Date de récolte refusée : ${constat}, après le ${jour(dateRecolte)}. Une récolte ne peut pas précéder ${etape}.${conseil}`
}

/**
 * Message de refus si la péremption précède la récolte, sinon `null` (pas de
 * péremption, ou péremption le jour de la récolte ou après). Comparaison en
 * jours civils : la récolte peut porter une heure, la péremption est un jour.
 */
export function refusPeremptionAvantRecolte(
  dateRecolte: Date,
  datePeremption: Date | null | undefined,
): string | null {
  const recolte = jourCivilStocke(dateRecolte)
  const peremption = jourCivilStocke(datePeremption)
  if (!recolte || !peremption || peremption >= recolte) return null
  const jour = (iso: string) => iso.split('-').reverse().join('/')
  return `La péremption (${jour(peremption)}) précède la récolte (${jour(recolte)}). Une récolte se date au plus tard le jour de sa péremption : corrigez l'une des deux dates.`
}
