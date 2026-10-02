/**
 * Calendrier des injections d'un soin et datation d'une injection — écriture
 * partagée par les routes `/api/elevage/soins` (PATCH), `/api/elevage/soins/[id]/
 * injections` (PATCH) et l'assistant (outils `update_soin`, `dater_injection`).
 *
 * Tickets vigie2cc83585 / cmupz9djj / cmulnl0wk (2026-10-01, éleveur caprin) :
 * un traitement ressaisi après coup (Ubrolexin, 4 injections) restait daté des
 * 28-29/09 à 12 h d'intervalle alors que l'éleveur l'avait recalé au 10/07 à
 * 24 h. Deux causes dans le code :
 *
 *  1. La resynchronisation du PATCH soin CONSERVAIT `date_prevue` des
 *     injections déjà réalisées (`CASE WHEN statut = 'realisee' THEN
 *     date_prevue`) et ne touchait jamais `date_realisee`. Le protocole affiché
 *     (×4 /24 h depuis le 10/07) contredisait donc les lignes, et la fin
 *     d'attente — calée sur la dernière injection réalisée — restait ancrée sur
 *     la date du clic.
 *  2. Le bouton « Faite » horodatait toujours l'instant du clic. Pour un
 *     historique ressaisi (chèvre morte en mars, vermifuge d'avril 2025 validé
 *     en septembre 2026), la fin d'attente lait tombait en octobre 2026.
 *
 * Règles retenues :
 *  - Le calendrier (`date_prevue`) est une DÉRIVATION PURE de (date du soin,
 *    nombre, intervalle) : il est recalculé pour TOUTES les injections, réalisées
 *    comprises.
 *  - Quand le protocole change (date de départ, nombre ou intervalle), les
 *    injections réalisées prennent la nouvelle date prévue comme date réelle :
 *    l'éleveur déclare le déroulement du traitement. Une date réelle qui
 *    s'écarte du calendrier se corrige ensuite injection par injection
 *    (`daterInjection`). Quand le protocole ne change pas (passage fait /
 *    délais d'attente), les dates réelles saisies sont conservées.
 *  - Une injection réalisée peut être redatée individuellement ; redater la
 *    première déplace la date du soin (elle EST la date d'administration).
 */

import { Prisma } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { calendrierInjections, derniereInjectionActive, ajouterJours, type InjectionEtat } from './injections'

type Db = Prisma.TransactionClient

export interface InjectionLigne extends InjectionEtat {
  id: string
  dateRealisee: Date | null
}

export async function lireInjections(tx: Db, userId: string, soinId: number): Promise<InjectionLigne[]> {
  return tx.$queryRaw<InjectionLigne[]>`
    SELECT id, numero, date_prevue AS "datePrevue", date_realisee AS "dateRealisee", statut
    FROM injections_soins WHERE soin_id = ${soinId} AND user_id = ${userId}
    ORDER BY numero
  `
}

export interface ParametresCalendrier {
  debut: Date
  nombre: number
  intervalleHeures: number | null
}

export interface OptionsSynchronisation {
  /** Le protocole (départ, nombre, intervalle) a changé : les dates réelles suivent le calendrier. */
  protocoleChange: boolean
  /** `fait` passe explicitement à true : la première injection devient réalisée. */
  marquerPremiereFaite: boolean
  /** `fait` passe explicitement à false : la première injection est rouverte. */
  rouvrirPremiere: boolean
  /** Date réelle à poser sur la première injection quand elle devient réalisée. */
  dateRealiseePremiere: Date
}

/**
 * Aligne les lignes `injections_soins` d'un soin sur son protocole.
 * Les lignes excédentaires non réalisées sont supprimées ; les autres sont
 * créées ou mises à jour (clé (soin_id, numero)). Ne renvoie rien : relire
 * ensuite avec `lireInjections`.
 */
export async function synchroniserInjections(
  tx: Db,
  userId: string,
  soinId: number,
  calendrier: ParametresCalendrier,
  options: OptionsSynchronisation,
): Promise<void> {
  const lignes = calendrierInjections(calendrier.debut, calendrier.nombre, calendrier.intervalleHeures, false)
  await tx.$executeRaw`
    DELETE FROM injections_soins
    WHERE soin_id = ${soinId} AND user_id = ${userId} AND numero > ${lignes.length} AND statut <> 'realisee'
  `
  for (const injection of lignes) {
    // Chaque drapeau interpolé dans le SQL brut doit être un VRAI booléen
    // (api_errors du 2026-09-19 : un objet jsonb ne se caste pas en booléen).
    const marquerPremiereFaite = injection.numero === 1 && options.marquerPremiereFaite === true
    const rouvrirPremiere = injection.numero === 1 && options.rouvrirPremiere === true
    const protocoleChange = options.protocoleChange === true
    const statut = marquerPremiereFaite ? 'realisee' : rouvrirPremiere ? 'a_faire' : injection.statut
    const dateRealisee = marquerPremiereFaite ? options.dateRealiseePremiere : null
    await tx.$executeRaw`
      INSERT INTO injections_soins
        (id, user_id, soin_id, numero, date_prevue, date_realisee, statut, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${soinId}, ${injection.numero}, ${injection.datePrevue},
         ${dateRealisee}, ${statut}, NOW(), NOW())
      ON CONFLICT (soin_id, numero) DO UPDATE SET
        date_prevue = EXCLUDED.date_prevue,
        statut = CASE
          WHEN ${marquerPremiereFaite}::boolean THEN 'realisee'
          WHEN ${rouvrirPremiere}::boolean THEN 'a_faire'
          ELSE injections_soins.statut
        END,
        date_realisee = CASE
          WHEN ${marquerPremiereFaite}::boolean THEN ${dateRealisee}
          WHEN ${rouvrirPremiere}::boolean THEN NULL
          WHEN ${protocoleChange}::boolean AND injections_soins.statut = 'realisee' THEN EXCLUDED.date_prevue
          ELSE injections_soins.date_realisee
        END,
        updated_at = NOW()
    `
  }
}

export interface DelaisAttente {
  tempsAttenteLaitJ: number | null
  tempsAttenteOeufsJ: number | null
  tempsAttenteViandeJ: number | null
}

/** Fenêtres d'attente dérivées des injections : ancrées sur la dernière administration active. */
export function fenetresAttenteDepuisInjections(injections: InjectionEtat[], delais: DelaisAttente) {
  const commence = injections.some((i) => i.statut === 'realisee')
  const derniere = derniereInjectionActive(injections)
  return {
    fait: commence,
    finAttenteLait: commence && derniere ? ajouterJours(derniere, delais.tempsAttenteLaitJ) : null,
    finAttenteOeufs: commence && derniere ? ajouterJours(derniere, delais.tempsAttenteOeufsJ) : null,
    finAttenteViande: commence && derniere ? ajouterJours(derniere, delais.tempsAttenteViandeJ) : null,
  }
}

// ---------------------------------------------------------------------------
// Écritures complètes (transaction, fenêtres d'attente, écartement du lait),
// partagées par les routes et l'assistant.
// ---------------------------------------------------------------------------

import prisma from '@/lib/prisma'
import { ciblesAffectees, resyncEcartementLait } from './attente-lait'
import { fenetreSoin } from './suppression-soin'
import { invalidateKpi } from '@/lib/kpi'

export type ResultatEcriture<T> =
  | { ok: true; soin: T }
  | { ok: false; status: number; error: string }

export interface DatationInjection {
  injectionId?: string
  numero?: number
  statut?: 'a_faire' | 'realisee' | 'annulee'
  dateRealisee?: Date | null
}

/**
 * Change le statut et/ou la date réelle d'une injection, puis recale les
 * fenêtres d'attente du soin sur sa dernière administration active.
 *
 * - `statut` absent : le statut courant est conservé (simple redatation).
 * - `realisee` sans `dateRealisee` : la date réelle existante est conservée,
 *   sinon l'instant courant.
 * - Redater la PREMIÈRE injection déplace la date du soin (c'est la date
 *   d'administration) ; la date prévue d'origine est conservée dans
 *   `datePrevue` du soin si elle n'y était pas (même convention que le PATCH
 *   soin, bug cmp8rwths).
 *
 * Le décompte de pharmacie (prélèvement / restitution) reste à la charge de
 * l'appelant qui le gère déjà (route injections) : cette fonction n'y touche
 * pas, pour que l'assistant ne décompte jamais un stock à l'insu de l'éleveur.
 */
export async function daterInjection(
  userId: string,
  soinId: number,
  datation: DatationInjection,
  options: { gererStock?: boolean } = {},
): Promise<ResultatEcriture<Prisma.SoinAnimalGetPayload<Record<string, never>> & { injections: InjectionLigne[] }>> {
  const soin = await prisma.soinAnimal.findFirst({ where: { id: soinId, userId } })
  if (!soin) return { ok: false, status: 404, error: 'Soin introuvable' }
  const injections = await lireInjections(prisma, userId, soinId)
  const cible = datation.injectionId
    ? injections.find((i) => i.id === datation.injectionId)
    : datation.numero != null
      ? injections.find((i) => i.numero === datation.numero)
      : undefined
  if (!cible) return { ok: false, status: 404, error: 'Injection introuvable' }

  const statut = datation.statut ?? cible.statut
  if (statut !== 'realisee' && datation.dateRealisee) {
    return { ok: false, status: 400, error: 'Seule une injection réalisée porte une date réelle.' }
  }
  const dateRealisee = statut === 'realisee'
    ? datation.dateRealisee ?? cible.dateRealisee ?? new Date()
    : null
  if (dateRealisee && Number.isNaN(dateRealisee.getTime())) {
    return { ok: false, status: 400, error: 'Date réelle invalide.' }
  }

  const beforeMax = soin.finAttenteLait
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE injections_soins
        SET statut = ${statut}, date_realisee = ${dateRealisee}, updated_at = NOW()
        WHERE id = ${cible.id} AND soin_id = ${soinId} AND user_id = ${userId}
      `
      const apres = await lireInjections(tx, userId, soinId)
      const fenetres = fenetresAttenteDepuisInjections(apres, soin)
      const data: Prisma.SoinAnimalUncheckedUpdateInput = { ...fenetres }

      // Première injection réalisée et datée : la date du soin la suit.
      if (cible.numero === 1 && statut === 'realisee' && dateRealisee && dateRealisee.getTime() !== soin.date.getTime()) {
        data.date = dateRealisee
        if (soin.datePrevue == null) data.datePrevue = soin.date
      }

      let quantitePreleveeStock = soin.quantitePreleveeStock
      if (options.gererStock) {
        const commence = fenetres.fait
        if (commence && !soin.fait && soin.stockMedicamentId && quantitePreleveeStock <= 0) {
          const quantite = soin.quantite ?? 0
          if (quantite <= 0) throw new Error('QUANTITE_MEDICAMENT_REQUISE')
          const decremente = await tx.stockMedicamentElevage.updateMany({
            where: {
              id: soin.stockMedicamentId,
              userId,
              quantite: { gte: quantite },
              OR: [
                { datePeremption: null },
                { datePeremption: { gte: dateRealisee ?? soin.date } },
              ],
            },
            data: { quantite: { decrement: quantite } },
          })
          if (decremente.count !== 1) throw new Error('STOCK_MEDICAMENT_INDISPONIBLE')
          quantitePreleveeStock = quantite
        } else if (!commence && soin.fait && soin.stockMedicamentId && quantitePreleveeStock > 0) {
          await tx.stockMedicamentElevage.update({
            where: { id: soin.stockMedicamentId },
            data: { quantite: { increment: quantitePreleveeStock } },
          })
          quantitePreleveeStock = 0
        }
        data.quantitePreleveeStock = quantitePreleveeStock
      }

      const updated = await tx.soinAnimal.update({ where: { id: soinId }, data })
      const cibles = await ciblesAffectees(tx, userId, soin.animalId, soin.lotId)
      const f = fenetreSoin(soin.date, updated.date, beforeMax, updated.finAttenteLait)
      if (f) await resyncEcartementLait(tx, userId, cibles, f.min, f.max)
      return { ...updated, injections: apres }
    })
    invalidateKpi(userId)
    return { ok: true, soin: result }
  } catch (error) {
    if (error instanceof Error && error.message === 'QUANTITE_MEDICAMENT_REQUISE') {
      return { ok: false, status: 422, error: "Renseignez la quantité de médicament avant de réaliser l'injection." }
    }
    if (error instanceof Error && error.message === 'STOCK_MEDICAMENT_INDISPONIBLE') {
      return { ok: false, status: 422, error: 'Le lot de pharmacie est épuisé, insuffisant ou périmé.' }
    }
    throw error
  }
}

export interface ProtocoleSoin {
  date?: Date
  nbInjections?: number
  intervalleInjectionsHeures?: number | null
  produit?: string | null
  description?: string | null
  notes?: string | null
  veterinaire?: string | null
  tempsAttenteLaitJ?: number | null
  tempsAttenteOeufsJ?: number | null
  tempsAttenteViandeJ?: number | null
}

/**
 * Recale le protocole d'un soin (date de départ, nombre d'injections,
 * intervalle) et ses libellés, pour l'assistant. Même règle que le PATCH de
 * l'écran : le calendrier est recalculé pour toutes les injections et, quand
 * le protocole change, les injections réalisées prennent leur nouvelle date.
 * Ne touche ni au statut `fait`, ni à la pharmacie, ni à la cible.
 */
export async function mettreAJourProtocoleSoin(
  userId: string,
  soinId: number,
  protocole: ProtocoleSoin,
): Promise<ResultatEcriture<Prisma.SoinAnimalGetPayload<Record<string, never>> & { injections: InjectionLigne[] }>> {
  const existing = await prisma.soinAnimal.findFirst({ where: { id: soinId, userId } })
  if (!existing) return { ok: false, status: 404, error: 'Soin introuvable' }

  const nombre = protocole.nbInjections ?? existing.nbInjections ?? 1
  const intervalle = protocole.intervalleInjectionsHeures !== undefined
    ? protocole.intervalleInjectionsHeures
    : existing.intervalleInjectionsHeures
  const debut = protocole.date ?? existing.date
  if (Number.isNaN(debut.getTime())) return { ok: false, status: 400, error: 'Date invalide.' }
  if (nombre < 1 || nombre > 30) return { ok: false, status: 400, error: 'Le nombre d’injections va de 1 à 30.' }
  if (nombre > 1 && (!intervalle || intervalle < 1 || intervalle > 2160)) {
    return { ok: false, status: 400, error: 'Un intervalle en heures (1 à 2160) est requis pour plusieurs injections.' }
  }

  const dateChangee = debut.getTime() !== existing.date.getTime()
  const protocoleChange = dateChangee
    || nombre !== (existing.nbInjections ?? 1)
    || (nombre > 1 && intervalle !== existing.intervalleInjectionsHeures)

  const data: Prisma.SoinAnimalUncheckedUpdateInput = {
    date: debut,
    nbInjections: nombre,
    intervalleInjectionsHeures: nombre > 1 ? intervalle : null,
  }
  for (const champ of ['produit', 'description', 'notes', 'veterinaire'] as const) {
    if (protocole[champ] !== undefined) data[champ] = protocole[champ]
  }
  const delais = {
    tempsAttenteLaitJ: protocole.tempsAttenteLaitJ !== undefined ? protocole.tempsAttenteLaitJ : existing.tempsAttenteLaitJ,
    tempsAttenteOeufsJ: protocole.tempsAttenteOeufsJ !== undefined ? protocole.tempsAttenteOeufsJ : existing.tempsAttenteOeufsJ,
    tempsAttenteViandeJ: protocole.tempsAttenteViandeJ !== undefined ? protocole.tempsAttenteViandeJ : existing.tempsAttenteViandeJ,
  }
  if (protocole.tempsAttenteLaitJ !== undefined || protocole.tempsAttenteOeufsJ !== undefined || protocole.tempsAttenteViandeJ !== undefined) {
    Object.assign(data, delais, { delaiAttenteSource: 'prescription' })
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.soinAnimal.update({ where: { id: soinId }, data })
    const avant = await lireInjections(tx, userId, soinId)
    const premiereRealisee = avant.some((i) => i.numero === 1 && i.statut === 'realisee')
    await synchroniserInjections(tx, userId, soinId, { debut, nombre, intervalleHeures: nombre > 1 ? intervalle : null }, {
      protocoleChange,
      // Un soin déjà fait sans ligne d'injection (anciennes données) : la
      // première injection est matérialisée comme réalisée à la date du soin.
      marquerPremiereFaite: existing.fait && !premiereRealisee,
      rouvrirPremiere: false,
      dateRealiseePremiere: debut,
    })
    const injections = await lireInjections(tx, userId, soinId)
    const fenetres = fenetresAttenteDepuisInjections(injections, delais)
    const updated = await tx.soinAnimal.update({
      where: { id: soinId },
      data: { finAttenteLait: fenetres.finAttenteLait, finAttenteOeufs: fenetres.finAttenteOeufs, finAttenteViande: fenetres.finAttenteViande },
    })
    const cibles = await ciblesAffectees(tx, userId, existing.animalId, existing.lotId)
    const f = fenetreSoin(existing.date, existing.finAttenteLait, updated.date, updated.finAttenteLait)
    if (f) await resyncEcartementLait(tx, userId, cibles, f.min, f.max)
    return { ...updated, injections }
  })
  invalidateKpi(userId)
  return { ok: true, soin: result }
}
