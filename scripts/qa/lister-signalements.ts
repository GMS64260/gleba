/**
 * Liste, en lecture seule, les signalements OPEN du registre `bug_reports`
 * (les plus récents en premier) et les `api_errors` depuis une date.
 * Aucune donnée nominative n'est affichée : seul le compte démo est reconnu.
 *
 *   npx tsx --env-file=.env scripts/qa/lister-signalements.ts
 *   npx tsx --env-file=.env scripts/qa/lister-signalements.ts --depuis=2026-10-23T13:31:00Z --statuts=OPEN,IN_PROGRESS
 */
import { PrismaClient, type BugStatus } from "@prisma/client"
import { DEMO_EMAIL } from "../../src/lib/demo"

const prisma = new PrismaClient()

function argument(nom: string): string | undefined {
  const prefixe = `--${nom}=`
  return process.argv.find((a) => a.startsWith(prefixe))?.slice(prefixe.length)
}

async function main() {
  const depuis = new Date(argument("depuis") ?? Date.now() - 14 * 24 * 3600 * 1000)
  const statuts = (argument("statuts") ?? "OPEN").split(",") as BugStatus[]

  const signalements = await prisma.bugReport.findMany({
    where: { status: { in: statuts } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, status: true, priority: true, url: true, viewport: true,
      userAgent: true, message: true, createdAt: true, adminNote: true,
      user: { select: { email: true, role: true } },
    },
  })
  console.log(`=== ${signalements.length} signalement(s) en ${statuts.join("/")} ===`)
  for (const s of signalements) {
    const compte = s.user.email.trim().toLowerCase() === DEMO_EMAIL ? "démo" : s.user.role === "ADMIN" ? "admin" : "utilisateur"
    const ua = (s.userAgent ?? "").replace(/Mozilla\/5\.0 \([^)]*\)\s*/, "").slice(0, 80)
    console.log(`\n--- ${s.id} · ${s.createdAt.toISOString()} · ${s.type} · ${s.priority} · ${compte}`)
    console.log(`url: ${s.url ?? "-"} · viewport: ${s.viewport ?? "-"} · ua: ${ua || "-"}`)
    console.log(s.message)
    if (s.adminNote) console.log(`[note admin] ${s.adminNote}`)
  }

  const erreurs = await prisma.apiError.groupBy({
    by: ["route", "source"],
    where: { createdAt: { gte: depuis } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { id: "desc" } },
  })
  console.log(`\n=== api_errors depuis ${depuis.toISOString()} : ${erreurs.length} route(s) ===`)
  for (const e of erreurs) {
    console.log(`${String(e._count._all).padStart(5)}  ${e.source.padEnd(8)} ${e.route ?? "-"}  (dernière ${e._max.createdAt?.toISOString()})`)
  }
  const exemples = await prisma.apiError.findMany({
    where: { createdAt: { gte: depuis } },
    orderBy: { createdAt: "desc" },
    distinct: ["route"],
    take: 40,
    select: { route: true, source: true, message: true, createdAt: true },
  })
  console.log(`\n=== dernier message par route ===`)
  for (const e of exemples) {
    console.log(`\n[${e.createdAt.toISOString()}] ${e.source} ${e.route ?? "-"}\n${e.message.slice(0, 600)}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
