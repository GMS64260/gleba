/**
 * Analyse de frictions, LECTURE SEULE, sur les 3 comptes actifs du 14/08/2026.
 * Reproduit le briefing tel qu'il serait servi maintenant (après la bascule
 * 16:57 UTC) et le compare à l'état des données. Aucune mutation, aucun ticket.
 */
import { loadDailyBriefing, formatDailyBriefing } from '@/lib/chat/daily-briefing'
import { dailyBriefingWindow } from '@/lib/chat/daily-opening'

const CIBLES: Array<[string, string]> = [
  ['jean-claude martin — maraîcher quotidien', 'cmsam60za002f137zzrpjfonw'],
  ['Cyril — éleveur + verger, revenu après 14 j', 'cmruohnjt000lv8w9ttd0w3s2'],
  ['Poujol — maraîcher, revenu après 15 j', 'cms63gbkl000bdd203qan649n'],
]

async function main() {
  const fenetre = dailyBriefingWindow(new Date())
  console.log(`fenêtre : ${fenetre.day} (${fenetre.timeZone})`)

  for (const [nom, id] of CIBLES) {
    const d = await loadDailyBriefing(id, fenetre)
    const parKind = new Map<string, number>()
    for (const t of d.tasks) parKind.set(t.kind, (parKind.get(t.kind) ?? 0) + 1)
    const enRetard = d.tasks.filter((t) => t.dueAt && t.dueAt < d.start)
    const plusVieille = d.tasks
      .filter((t) => t.dueAt)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0]

    console.log(`\n${'='.repeat(70)}\n${nom}\n${'='.repeat(70)}`)
    console.log(
      `tâches=${d.tasks.length} | en retard=${enRetard.length} | tronqué=${d.sourceTruncated} | plus ancienne=${plusVieille?.dueAt?.toISOString().slice(0, 10) ?? '-'}`
    )
    console.log(
      `par nature : ${[...parKind.entries()].map(([k, n]) => `${k}=${n}`).join(', ') || '(aucune)'}`
    )
    console.log(
      `prochaine échéance : ${d.nextUpcoming ? `${d.nextUpcoming.dueAt.toISOString().slice(0, 10)} (${d.nextUpcoming.count} tâches, ex. ${d.nextUpcoming.sample.domain}/${d.nextUpcoming.sample.kind})` : '-'}`
    )
    console.log(`suggestion compte vide : ${d.suggestionCompteVide ?? '-'}`)
    console.log(`\n--- texte servi ---\n${formatDailyBriefing(d, null)}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
