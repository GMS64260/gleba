import prisma from '@/lib/prisma'
import { createRecolteSchema } from '@/lib/validations/recolte'
import { snapshotStatutBio } from '@/lib/statut-bio'
import { ecrituresPassageAFait } from '@/lib/cultures/execution'
import { invalidateKpi } from '@/lib/kpi'
import { refusRecolteAvantDebut } from './date-coherente'
import { chargerSurchargesRendement, rendementEffectif } from './rendement-effectif'
import { uniteQuantiteRecolte } from './projection'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'

const schema = createRecolteSchema.extend({
  unite: z.enum(['kg', 'g', 'piece', 'tige', 'botte']).optional(),
})

export const MAX_RECOLTES_PAR_SAISIE = 20

/** Prépare tout le lot avant la première écriture. Les unités appartiennent
 * à la ferme ; seul le passage g → kg est une conversion certaine. */
export async function preparerRecoltes(userId: string, entrees: unknown[], uniteRequise = false) {
  if (entrees.length === 0 || entrees.length > MAX_RECOLTES_PAR_SAISIE) {
    return { ok: false as const, error: `Indiquez de 1 à ${MAX_RECOLTES_PAR_SAISIE} récoltes par saisie.` }
  }
  const donnees: z.infer<typeof schema>[] = []
  for (const [i, entree] of entrees.entries()) {
    const validation = schema.safeParse(entree)
    if (!validation.success) return { ok: false as const, error: `Récolte ${i + 1} : ${validation.error.issues[0].message}` }
    if (uniteRequise && !validation.data.unite) {
      return { ok: false as const, error: `Quelle unité pour la récolte ${i + 1} : kilos, pièces, bottes ou tiges ?` }
    }
    if (uniteRequise && validation.data.quantite <= 0) return { ok: false as const, error: `Récolte ${i + 1} : indiquez une quantité strictement positive.` }
    if (validation.data.date.getFullYear() < 1000 || validation.data.date.getFullYear() > 9999) {
      return { ok: false as const, error: `Récolte ${i + 1} : date invalide.` }
    }
    donnees.push(validation.data)
  }
  const cultures = await prisma.culture.findMany({
    where: { userId, id: { in: [...new Set(donnees.map(d => d.cultureId))] } },
    include: { espece: true, variete: { select: { nom: true, id: true } }, planche: { select: { nom: true, statutBio: true, dateDebutConversion: true } } },
  })
  const surcharges = await chargerSurchargesRendement(userId, [...new Set(donnees.map(d => d.especeId))])
  const preparees = []
  for (const [i, donnee] of donnees.entries()) {
    const culture = cultures.find(c => c.id === donnee.cultureId)
    if (!culture) return { ok: false as const, error: `Récolte ${i + 1} : culture introuvable dans cette exploitation.` }
    if (culture.especeId !== donnee.especeId) return { ok: false as const, error: `Récolte ${i + 1} : l'espèce ne correspond pas à la culture choisie.` }
    const unite = uniteQuantiteRecolte(rendementEffectif(culture.espece, surcharges.get(culture.especeId)).uniteRendement)
    const uniteSaisie = donnee.unite ?? unite
    if (uniteSaisie !== unite && !(uniteSaisie === 'g' && unite === 'kg')) {
      return { ok: false as const, error: `Cette culture se récolte en ${unite}. Quelle quantité dans cette unité ? Je ne peux pas convertir des pièces, bottes ou tiges en poids.` }
    }
    const quantite = uniteSaisie === 'g' ? donnee.quantite / 1000 : donnee.quantite
    if (uniteRequise && quantite <= 0) return { ok: false as const, error: `Récolte ${i + 1} : la quantité est trop petite pour être enregistrée.` }
    if (unite !== 'kg' && !Number.isInteger(quantite)) return { ok: false as const, error: `Récolte ${i + 1} : indiquez un nombre entier de ${unite}.` }
    const refus = refusRecolteAvantDebut(culture, donnee.date)
    if (refus) return { ok: false as const, error: refus, champ: 'date' }
    preparees.push({
      culture,
      data: { ...donnee, quantite, unite, userId, statutBioSnapshot: culture.planche ? snapshotStatutBio(culture.planche.statutBio, culture.planche.dateDebutConversion, donnee.date) : null },
    })
  }
  return { ok: true as const, recoltes: preparees }
}

/** Même écriture atomique pour le formulaire et l'assistant. Le stock est
 * calculé depuis les récoltes : aucun incrément parallèle de l'inventaire. */
export async function ecrireRecoltesPreparees(tx: Prisma.TransactionClient, preparees: Extract<Awaited<ReturnType<typeof preparerRecoltes>>, { ok: true }>['recoltes']) {
    const resultats = []
    // Une même culture peut être citée plusieurs fois : sa date initiale est
    // recalée sur la première récolte chronologique, puis conservée.
    const etats = new Map(preparees.map(r => [r.culture.id, r.culture]))
    for (const { culture, data } of [...preparees].sort((a, b) => a.data.date.getTime() - b.data.date.getTime())) {
      const recolte = await tx.recolte.create({ data, include: { espece: true, culture: true } })
      const etat = etats.get(culture.id)!
      const dates = ecrituresPassageAFait(etat, 'recolteFaite', data.date)
      if (!etat.recolteFaite || Object.keys(dates).length > 0) {
        await tx.culture.update({ where: { id: culture.id }, data: { recolteFaite: true, ...dates } })
        etats.set(culture.id, { ...etat, recolteFaite: true, ...dates })
      }
      resultats.push(recolte)
    }
    return resultats
}

export async function creerRecoltes(userId: string, entrees: unknown[], uniteRequise = false) {
  const preparation = await preparerRecoltes(userId, entrees, uniteRequise)
  if (!preparation.ok) return preparation
  const recoltes = await prisma.$transaction(tx => ecrireRecoltesPreparees(tx, preparation.recoltes))
  invalidateKpi(userId)
  return { ok: true as const, recoltes }
}
