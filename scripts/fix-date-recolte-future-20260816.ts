/**
 * Réparation 2026-08-16 — cultures « récolte faite » datées dans le futur.
 *
 * QA cmsw98kx1 : la saisie d'une récolte réelle (POST /api/recoltes, outil
 * assistant) marquait `recolteFaite=true` sans recaler `Culture.dateRecolte`
 * (la SSOT dateExecutionARecaler du 2026-08-12 n'était branchée que sur le
 * PATCH culture et bulk-fait). L'écran /interventions affichait donc des
 * actions « Fait » datées au futur. Le code est corrigé ; ce script recale
 * les lignes créées avant le correctif.
 *
 * Règle : uniquement les cultures recolteFaite=true dont dateRecolte est
 * FUTURE et qui ont au moins une récolte réelle → dateRecolte = date de la
 * dernière récolte réelle. Les cultures sans récolte enregistrée ne sont pas
 * touchées (aucune date réelle fiable).
 *
 * Usage :
 *   npx tsx --env-file=.env scripts/fix-date-recolte-future-20260816.ts [--apply]
 */

import prisma from "../src/lib/prisma"

const APPLY = process.argv.includes("--apply")

async function main() {
  const cultures = await prisma.culture.findMany({
    where: { recolteFaite: true, dateRecolte: { gt: new Date() } },
    select: {
      id: true,
      userId: true,
      especeId: true,
      dateRecolte: true,
      recoltes: { select: { date: true }, orderBy: { date: "desc" }, take: 1 },
    },
    orderBy: { id: "asc" },
  })

  const aRecaler = cultures.filter((c) => c.recoltes.length > 0)
  const sansRecolte = cultures.filter((c) => c.recoltes.length === 0)

  for (const c of aRecaler) {
    console.log(
      `- culture #${c.id} (${c.especeId}, user ${c.userId}) : ` +
        `${c.dateRecolte?.toISOString().slice(0, 10)} → ${c.recoltes[0].date.toISOString().slice(0, 10)}`
    )
  }
  for (const c of sansRecolte) {
    console.log(`- culture #${c.id} (${c.especeId}) : aucune récolte réelle — NON touchée`)
  }

  if (!APPLY) {
    console.log(`\nDry-run : ${aRecaler.length} recalage(s) prévu(s). Relancer avec --apply.`)
    return
  }

  for (const c of aRecaler) {
    await prisma.culture.update({
      where: { id: c.id },
      data: { dateRecolte: c.recoltes[0].date },
    })
    console.log(`✔ culture #${c.id} recalée`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
