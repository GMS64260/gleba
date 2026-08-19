/**
 * LECTURE SEULE — état des ateliers des 3 comptes actifs du 14/08/2026.
 * N'imprime que des agrégats (comptes et dates), aucun contenu personnel.
 * Sert à qualifier : le briefing est-il vide parce que rien n'est dû, ou
 * parce qu'il ne regarde pas au bon endroit ?
 */
import prisma from '@/lib/prisma'
import { compterCulturesSansPlan } from '@/lib/irrigation-scheduler'

const CIBLES: Array<[string, string]> = [
  ['jean-claude martin', 'cmsam60za002f137zzrpjfonw'],
  ['Cyril', 'cmruohnjt000lv8w9ttd0w3s2'],
  ['Poujol', 'cms63gbkl000bdd203qan649n'],
]

function ligne(label: string, n: number, date?: Date | null) {
  console.log(`  ${label.padEnd(34)} ${String(n).padStart(4)}${date ? `   plus ancienne échéance : ${date.toISOString().slice(0, 10)}` : ''}`)
}

async function main() {
  for (const [nom, userId] of CIBLES) {
    console.log(`\n=== ${nom} ===`)

    const soinsDus = await prisma.soinAnimal.findMany({
      where: { userId, fait: false },
      select: { datePrevue: true },
      orderBy: { datePrevue: 'asc' },
    })
    ligne('soins non faits', soinsDus.length, soinsDus[0]?.datePrevue ?? null)

    const proph = await prisma.prophylaxieElevage.findMany({
      where: { userId, dateRealisee: null },
      select: { datePrevue: true },
      orderBy: { datePrevue: 'asc' },
    })
    ligne('prophylaxies non réalisées', proph.length, proph[0]?.datePrevue ?? null)

    const taches = await prisma.tacheTerrainElevage.count({ where: { userId } })
    ligne('tâches terrain élevage', taches)

    const admin = await prisma.echeanceAdministrativeElevage.count({ where: { userId } })
    ligne('échéances administratives', admin)

    const animaux = await prisma.animal.count({ where: { userId } })
    ligne('animaux', animaux)

    const arbres = await prisma.arbre.count({ where: { userId } })
    ligne('arbres', arbres)

    const opsArbres = await prisma.operationArbre.count({ where: { userId } })
    ligne('opérations verger', opsArbres)

    const cultures = await prisma.culture.count({ where: { userId } })
    ligne('cultures', cultures)

    const planches = await prisma.planche.count({ where: { userId } })
    ligne('planches', planches)

    const irrDues = await prisma.irrigationPlanifiee.count({ where: { userId, fait: false, perimee: false } })
    ligne('irrigations non faites (non périmées)', irrDues)

    const sansPlan = await compterCulturesSansPlan(userId)
    ligne('cultures irrigables SANS plan', sansPlan)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
