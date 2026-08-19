/**
 * Vérification post-bascule, LECTURE SEULE : le briefing cesse-t-il d'annoncer
 * comme dus des arrosages abandonnés depuis plus d'un cycle ?
 * Aucune mutation, aucun ticket créé.
 */
import { loadDailyBriefing } from '@/lib/chat/daily-briefing'
import { dailyBriefingWindow } from '@/lib/chat/daily-opening'

const CIBLES: Array<[string, string]> = [
  ['compte A — parcelle restée à Paris', 'cmsam60za002f137zzrpjfonw'],
  ['compte B — plus gros retard d arrosage', 'cmmxlj7c700291edmazsrsrep'],
]

async function main() {
  const fenetre = dailyBriefingWindow(new Date())
  console.log(`fenêtre : ${fenetre.day} (${fenetre.timeZone})\n`)

  for (const [nom, id] of CIBLES) {
    const d = await loadDailyBriefing(id, fenetre)
    const irr = d.tasks.filter((t) => t.kind === 'Irrigation')
    const enRetard = d.tasks.filter((t) => t.dueAt && t.dueAt < new Date(fenetre.start))
    console.log(`${nom} :`)
    console.log(`  total tâches annoncées : ${d.tasks.length}`)
    console.log(`  dont irrigation        : ${irr.length}`)
    console.log(`  dont antérieures au jour : ${enRetard.length}`)
    const plusVieille = d.tasks
      .filter((t) => t.dueAt)
      .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime())[0]
    console.log(`  échéance la plus ancienne : ${plusVieille?.dueAt?.toISOString().slice(0, 10) ?? '-'}`)
    console.log()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
