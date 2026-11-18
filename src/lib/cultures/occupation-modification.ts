/**
 * Contrôle commun des mutations de culture (PUT, PATCH, bulk-fait, reporter),
 * sur leur état final et sous le verrou d'exploitation.
 */
import type { Culture, Prisma } from '@prisma/client'
import { evaluerModificationOccupation } from '@/lib/planche-validation'
import { selectCulturesOccupation } from '@/lib/planches/occupation'
import { debutOccupation, estVivaceEnPlace, finDeCycle } from '@/lib/cultures/fenetre-recolte'
import { jourCivilStocke } from '@/lib/jour-civil'

type Etat = Pick<Culture, 'id' | 'terminee' | 'plancheId' | 'itpId' | 'especeId' | 'longueur' | 'nbRangs'
  | 'dateSemis' | 'datePlantation' | 'dateRecolte' | 'finRecolte'>

/** Champs que `controlerOccupationModification` lit sur l'état avant/après. */
export const SELECT_ETAT_OCCUPATION = {
  id: true, terminee: true, plancheId: true, itpId: true, especeId: true, longueur: true, nbRangs: true,
  dateSemis: true, datePlantation: true, dateRecolte: true, finRecolte: true,
} as const satisfies Record<keyof Etat, true>

/**
 * Verrou d'exploitation commun à toute création ou modification d'occupation
 * (POST, creerCulturesBatch, PUT, PATCH, bulk-fait, reporter). À prendre en
 * tête de transaction, AVANT toute relecture : sinon deux mutations
 * concurrentes valident chacune contre un état que l'autre va changer.
 */
export async function verrouillerOccupationExploitation(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`gleba:creer-cultures:${userId}`}))`
}

export async function controlerOccupationModification(
  tx: Prisma.TransactionClient, userId: string, avant: Etat, apres: Etat,
) {
  // `especeId` : passer d'une annuelle à une vivace change la période occupée.
  const champsPlace = ['longueur', 'nbRangs', 'plancheId', 'itpId', 'especeId'] as const
  const champsPeriode = ['dateSemis', 'datePlantation', 'dateRecolte', 'finRecolte'] as const
  const occupationTouchee = apres.terminee == null && (
    avant.terminee != null ||
    champsPlace.some((c) => (apres[c] ?? null) !== (avant[c] ?? null)) ||
    champsPeriode.some((c) => jourCivilStocke(apres[c]) !== jourCivilStocke(avant[c]))
  )
  const warnings: string[] = []
  if (!apres.plancheId || (!apres.longueur && !occupationTouchee)) return { warnings, refus: null }

  // Une lecture impossible doit annuler la mutation, jamais contourner la garde.
  const planche = await tx.planche.findFirst({
    where: { id: apres.plancheId, userId },
    select: { nom: true, longueur: true, largeur: true,
      ...(occupationTouchee && { cultures: {
        where: { terminee: null, id: { not: avant.id } }, select: selectCulturesOccupation,
      } }),
    },
  })
  if (planche?.longueur && apres.longueur && apres.longueur > planche.longueur) {
    warnings.push(`Longueur de la culture (${apres.longueur} m) supérieure à la longueur de la planche ${planche.nom} (${planche.longueur} m).`)
  }
  if (!planche || !occupationTouchee) return { warnings, refus: null }
  const espacement = async (id: string | null) => id
    ? (await tx.iTP.findFirst({ where: { id }, select: { espacementRangs: true } }))?.espacementRangs ?? null
    : null
  const espacementApres = await espacement(apres.itpId)
  const espacementAvant = avant.itpId === apres.itpId ? espacementApres : await espacement(avant.itpId)
  // ADV33 (contre-revue PR #73) : la culture modifiée est lue comme ses
  // voisines (`selectCulturesOccupation` charge `espece.vivace`) : une vivace
  // occupe la planche sans fin de cycle, avant comme après. Sans cela, un report
  // de vivace sur une planche déjà prise passait, et la correction d'une vivace
  // en dépassement hérité était refusée comme une aggravation.
  const vivace = async (id: string) =>
    (await tx.espece.findFirst({ where: { id }, select: { vivace: true } }))?.vivace ?? null
  const vivaceApres = await vivace(apres.especeId)
  const vivaceAvant = avant.especeId === apres.especeId ? vivaceApres : await vivace(avant.especeId)
  const etat = (c: Etat, espacementRangs: number | null, especeVivace: boolean | null) => ({
    espacementRangs, nbRangs: c.nbRangs, longueur: c.longueur, debut: debutOccupation(c), fin: finDeCycle(c),
    vivace: estVivaceEnPlace({ terminee: c.terminee, espece: { vivace: especeVivace } }),
  })
  const refus = evaluerModificationOccupation({
    planche, autresCultures: planche.cultures ?? [],
    // Réactivation ou changement de planche : une arrivée, sans droit acquis.
    avant: avant.terminee == null && avant.plancheId === apres.plancheId ? etat(avant, espacementAvant, vivaceAvant) : null,
    apres: etat(apres, espacementApres, vivaceApres),
  })
  return { warnings, refus: refus ? {
    error: `${refus.message}. Espacement entre rangs de l'itinéraire technique : ${refus.espacementRangs} cm.`,
    suggestions: refus.ajustements.map((a) => a.message), ajustements: refus.ajustements,
    details: { largeurPlanche: refus.largeurPlanche, largeurOccupee: refus.largeurOccupee,
      largeurDisponible: refus.largeurDisponible, largeurNecessaire: refus.largeurNecessaire,
      espacementRangsItp: refus.espacementRangs },
  } : null }
}
