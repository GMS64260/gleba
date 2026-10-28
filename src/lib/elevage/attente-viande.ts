import type { Prisma } from '@prisma/client'
import { floorDayUTC, lotALaDate, type AppartenanceDatee } from './attente-lait'
import { ErreurElevage } from './erreurs'

/** Un soin collectif suit les animaux présents à sa réalisation, même sortis du lot depuis. */
export async function verifierAttenteViande(
  db: Prisma.TransactionClient,
  userId: string,
  cible: { animalId: number | null; lotId: number | null; date: Date },
) {
  const debut = floorDayUTC(cible.date)
  const fin = new Date(debut.getTime() + 86_400_000)
  const soins = await db.soinAnimal.findMany({
    where: { userId, fait: true, date: { lt: fin }, finAttenteViande: { gte: debut } },
    include: { produitVeterinaire: { select: { nom: true } } },
  })
  if (!soins.length) return

  const historiques = new Map<number, AppartenanceDatee[]>()
  const lotsCourants = new Map<number, number | null>()
  if (cible.animalId != null && soins.some((s) => s.lotId != null)) {
    const animal = await db.animal.findFirst({ where: { id: cible.animalId, userId }, select: { lotId: true } })
    lotsCourants.set(cible.animalId, animal?.lotId ?? null)
    // Tout l'historique : une ligne hors de la fenêtre de soin interdit aussi
    // de retomber à tort sur le lot courant en l'absence de ligne couvrante.
    const lignes = await db.$queryRaw<AppartenanceDatee[]>`
      SELECT animal_id AS "animalId", lot_id AS "lotId", date_debut AS "dateDebut", date_fin AS "dateFin"
      FROM historique_lots_animaux WHERE user_id = ${userId} AND animal_id = ${cible.animalId}
      ORDER BY date_debut DESC`
    if (lignes.length) historiques.set(cible.animalId, lignes)
  }
  const bloquants = soins.filter((s) => cible.animalId != null
    ? s.animalId === cible.animalId || (s.lotId != null && lotALaDate(cible.animalId, s.date, historiques, lotsCourants) === s.lotId)
    // L'abattage collectif ne porte que sur les têtes anonymes. Les fiches
    // nominatives traitées doivent suivre leur propre parcours d'abattage.
    : cible.lotId != null && s.lotId === cible.lotId)
  if (bloquants.length) {
    const details = bloquants.map((s) => `${s.produit || s.produitVeterinaire?.nom || s.type} (jusqu'au ${s.finAttenteViande?.toLocaleDateString('fr-FR')} inclus)`).join(', ')
    throw new ErreurElevage("Abattage interdit : animal en temps d'attente vétérinaire", 409, 'ATTENTE_VIANDE_ACTIVE', `Traitement(s) : ${details}. Reportez l'abattage après la fin du temps d'attente viande.`)
  }
}
