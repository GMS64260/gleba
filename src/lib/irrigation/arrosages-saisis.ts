/**
 * Tous les arrosages saisis qui nourrissent le bilan hydrique (`bilan-sol.ts`).
 *
 * Un arrosage se saisit de deux façons (ticket QA cmv2rdmdn, 2026-10-10 : seule
 * la première était lue, 312 L saisis en intervention restaient « Jamais ») :
 * - « Noter » : trace `IrrigationPlanifiee` close, sans volume (la planche a
 *   eu son eau : le bilan remet le sol plein) ;
 * - une intervention « arrosage » réalisée (table `Intervention`), avec son
 *   volume en litres quand il est saisi (`intrantQuantite`, unité L ou m³).
 *
 * Comme « Noter », une intervention arrose la PLANCHE : celle qu'elle désigne,
 * sinon celle de sa culture ; toutes les cultures de la planche la reçoivent,
 * le volume rapporté à la surface de la planche (le formulaire remplit culture
 * ET planche : arroser la seule culture laissait une colocataire « critique »).
 * Sans planche, la culture seule, sur sa surface. Sans volume ou sans surface
 * connue : un arrosage plein, comme « Noter ».
 *
 * Tout est chargé, y compris un arrosage daté d'après aujourd'hui : le bilan
 * s'arrête au jour du LIEU, et le dernier arrosage affiché se juge aussi dans
 * le jour du lieu (`dernierArrosageDuLieu`, `bilan-culture.ts`). Filtrer ici
 * au jour de Paris écartait le matin l'arrosage du jour à Nouméa.
 */
import prisma from '@/lib/prisma'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { whereArrosageNote } from './arrosages-notes'
import { apresDemain } from '@/lib/interventions/date-realisee'

export interface ArrosageSaisi {
  date: Date
  /** Date de calendrier sans heure (intervention) plutôt qu'horodatage (Noter). */
  calendaire: boolean
  /** L/m² versés ; null = volume inconnu, le sol est remis plein. */
  litresParM2: number | null
}

export interface CultureArrosee {
  id: number
  plancheId: string | null
  longueur?: number | null
  planche?: { surface?: number | null; largeur?: number | null; longueur?: number | null } | null
}

/**
 * Litres d'une saisie d'intervention, ou null si l'unité n'est pas une
 * quantité d'eau. Le formulaire propose « kg » par défaut : pour de l'eau,
 * 1 kg = 1 L (20 kg saisis valaient un arrosage plein).
 */
export function litresSaisis(quantite: number | null, unite: string | null): number | null {
  if (quantite === null || !(quantite > 0)) return null
  const u = (unite ?? '').trim().toLowerCase()
  if (u === 'l' || u.startsWith('litre') || u === 'kg') return quantite
  if (u === 'm3' || u === 'm³' || u === 't') return quantite * 1000
  if (u === 'g' || u === 'ml') return quantite / 1000
  return null
}

function ajouter(map: Map<number, ArrosageSaisi[]>, cultureId: number, a: ArrosageSaisi) {
  map.set(cultureId, [...(map.get(cultureId) ?? []), a])
}

export async function chargerArrosagesSaisis(
  userId: string,
  cultures: CultureArrosee[],
  depuis: Date,
): Promise<Map<number, ArrosageSaisi[]>> {
  const parCulture = new Map<number, ArrosageSaisi[]>()
  if (cultures.length === 0) return parCulture
  const ids = cultures.map((c) => c.id)
  const plancheIds = Array.from(new Set(cultures.map((c) => c.plancheId).filter((p): p is string => Boolean(p))))

  const [traces, interventions] = await Promise.all([
    prisma.irrigationPlanifiee.findMany({
      where: { userId, cultureId: { in: ids }, AND: [whereArrosageNote(), { dateEffective: { gte: depuis } }] },
      select: { cultureId: true, dateEffective: true },
    }),
    prisma.intervention.findMany({
      where: {
        userId,
        type: { equals: 'arrosage', mode: 'insensitive' },
        fait: true,
        // Toutes celles du compte : une intervention sur une culture finie
        // arrose encore ses colocataires de planche.
        date: { gte: depuis },
      },
      select: { date: true, cultureId: true, plancheId: true, intrantQuantite: true, intrantUnite: true },
    }),
  ])

  // Planche d'une intervention posée sur une culture hors de la liste (filtres
  // propres à chaque écran) : lue en base, pour que les deux écrans tranchent pareil.
  const idsConnus = new Set(ids)
  const culturesHorsListe = Array.from(
    new Set(interventions.map((i) => i.cultureId).filter((id): id is number => id !== null && !idsConnus.has(id))),
  )
  const plancheDesHorsListe = new Map(
    (culturesHorsListe.length
      ? await prisma.culture.findMany({ where: { userId, id: { in: culturesHorsListe } }, select: { id: true, plancheId: true } })
      : []
    ).map((c) => [c.id, c.plancheId]),
  )
  // `Intervention.plancheId` historique : id OU nom de planche (cf. registre).
  const refsPlanches = Array.from(
    new Set([
      ...plancheIds,
      ...interventions.map((i) => i.plancheId).filter((p): p is string => Boolean(p)),
      ...Array.from(plancheDesHorsListe.values()).filter((p): p is string => Boolean(p)),
    ]),
  )
  const planches = await prisma.planche.findMany({
    where: { userId, OR: [{ id: { in: refsPlanches } }, { nom: { in: refsPlanches } }] },
    select: { id: true, nom: true, surface: true, largeur: true, longueur: true },
  })

  for (const t of traces) {
    if (t.dateEffective) ajouter(parCulture, t.cultureId, { date: t.dateEffective, calendaire: false, litresParM2: null })
  }

  const planchesParRef = new Map<string, (typeof planches)[number]>()
  for (const p of planches) {
    planchesParRef.set(p.id, p)
    if (p.nom) planchesParRef.set(p.nom, p)
  }
  const culturesParId = new Map(cultures.map((c) => [c.id, c]))
  const culturesParPlanche = new Map<string, CultureArrosee[]>()
  for (const c of cultures) {
    if (c.plancheId) culturesParPlanche.set(c.plancheId, [...(culturesParPlanche.get(c.plancheId) ?? []), c])
  }

  for (const i of interventions) {
    const litres = litresSaisis(i.intrantQuantite, i.intrantUnite)
    const culture = i.cultureId ? culturesParId.get(i.cultureId) : undefined
    const refPlanche =
      i.plancheId ?? culture?.plancheId ?? (i.cultureId ? plancheDesHorsListe.get(i.cultureId) ?? null : null)
    const planche = refPlanche ? planchesParRef.get(refPlanche) : undefined
    if (planche) {
      const surface = surfaceCultureM2({ planche })
      for (const c of culturesParPlanche.get(planche.id) ?? []) {
        ajouter(parCulture, c.id, {
          date: i.date,
          calendaire: true,
          litresParM2: litres !== null && surface > 0 ? litres / surface : null,
        })
      }
    } else if (culture) {
      const surface = surfaceCultureM2(culture)
      ajouter(parCulture, culture.id, {
        date: i.date,
        calendaire: true,
        litresParM2: litres !== null && surface > 0 ? litres / surface : null,
      })
    }
  }
  return parCulture
}

/**
 * Dernier arrosage connu d'une culture : le plus récent entre
 * `derniereIrrigation` et ses saisies. Repli sans météo (donc sans jour du
 * lieu) : au plus demain au jour de Paris, la marge de la route Interventions
 * (`apresDemain`). Avec la météo : `dernierArrosageDuLieu`.
 */
export function dernierArrosage(
  derniereIrrigation: Date | null,
  saisis: ArrosageSaisi[],
  maintenant: Date = new Date(),
): Date | null {
  let dernier: Date | null = null
  for (const date of [derniereIrrigation, ...saisis.map((a) => a.date)]) {
    if (date && !apresDemain(date, maintenant) && (!dernier || date > dernier)) dernier = date
  }
  return dernier
}
