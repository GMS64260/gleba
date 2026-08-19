/**
 * Statistiques d'instrumentation de l'assistant IA (lot 2-B 2026-08-11).
 *
 * Lit les métriques persistées dans ChatMessage.toolResults.stats (mode,
 * section, rounds, wakeups, durée, tailles snapshot/description, plafond) et
 * publie p50/p95 par mode/section, le taux de réponses sans lot de lecture et
 * la part de réponses directes (sans LLM).
 *
 * Usage (depuis le HOST) : npx tsx scripts/stats-assistant.ts [--jours 14]
 */

import prisma from '../src/lib/prisma'

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

interface Stats {
  mode: string
  section: string
  rounds?: number
  wakeups?: number
  durationMs?: number
  snapshotChars?: number
  descriptionChars?: number
  plafondAtteint?: boolean
}

function percentile(valeurs: number[], p: number): number {
  if (valeurs.length === 0) return 0
  const triees = [...valeurs].sort((a, b) => a - b)
  const index = Math.min(triees.length - 1, Math.ceil((p / 100) * triees.length) - 1)
  return triees[Math.max(0, index)]
}

const secondes = (ms: number) => `${(ms / 1000).toFixed(1)}s`

async function main() {
  const jours = Number(arg('jours')) || 14
  const depuis = new Date(Date.now() - jours * 24 * 3600 * 1000)

  const messages = await prisma.chatMessage.findMany({
    where: {
      role: 'assistant',
      createdAt: { gte: depuis },
      toolResults: { not: undefined },
    },
    select: { toolResults: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 20000,
  })

  const stats: Stats[] = []
  for (const message of messages) {
    const toolResults = message.toolResults as Record<string, unknown> | null
    const brut = toolResults?.stats as Stats | undefined
    if (brut && typeof brut.mode === 'string') stats.push(brut)
  }

  if (stats.length === 0) {
    console.log(
      `Aucune métrique sur ${jours} jours (les stats ne sont persistées que depuis le lot du 2026-08-11).`,
    )
    return
  }

  console.log(`Assistant IA — ${stats.length} réponses instrumentées sur ${jours} jours\n`)

  // Vue globale : part des réponses directes (< 1 s, sans LLM)
  const directes = stats.filter((s) => s.mode === 'direct')
  console.log(
    `Réponses directes (sans LLM) : ${directes.length}/${stats.length} (${Math.round((directes.length / stats.length) * 100)} %)\n`,
  )

  // Par mode puis section
  const groupes = new Map<string, Stats[]>()
  for (const stat of stats) {
    const cle = `${stat.mode} · ${stat.section}`
    groupes.set(cle, [...(groupes.get(cle) ?? []), stat])
  }

  const lignes: string[][] = [[
    'mode · section', 'n', 'p50', 'p95', '0 lot', 'lots moy.', 'plafond', 'snapshot moy.',
  ]]
  for (const [cle, groupe] of [...groupes.entries()].sort()) {
    const durees = groupe.map((s) => s.durationMs ?? 0).filter((d) => d > 0)
    const avecRounds = groupe.filter((s) => typeof s.rounds === 'number')
    const zeroRound = avecRounds.filter((s) => s.rounds === 0).length
    const plafonds = groupe.filter((s) => s.plafondAtteint).length
    const snapshots = groupe.map((s) => s.snapshotChars ?? 0).filter((c) => c > 0)
    lignes.push([
      cle,
      String(groupe.length),
      secondes(percentile(durees, 50)),
      secondes(percentile(durees, 95)),
      avecRounds.length > 0 ? `${Math.round((zeroRound / avecRounds.length) * 100)} %` : '—',
      avecRounds.length > 0
        ? (avecRounds.reduce((somme, s) => somme + (s.rounds ?? 0), 0) / avecRounds.length).toFixed(2)
        : '—',
      String(plafonds),
      snapshots.length > 0
        ? `${Math.round(snapshots.reduce((a, b) => a + b, 0) / snapshots.length / 1000)}k`
        : '—',
    ])
  }

  const largeurs = lignes[0].map((_, col) => Math.max(...lignes.map((l) => l[col].length)))
  for (const [index, ligne] of lignes.entries()) {
    console.log(ligne.map((cellule, col) => cellule.padEnd(largeurs[col] + 2)).join(''))
    if (index === 0) console.log(largeurs.map((l) => '─'.repeat(l + 2)).join(''))
  }
}

main()
  .catch((error) => {
    console.error('Stats assistant en échec :', error)
    process.exit(2)
  })
  .finally(() => prisma.$disconnect())
