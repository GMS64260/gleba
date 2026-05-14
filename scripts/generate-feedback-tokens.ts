/**
 * Génère des tokens de feedback pour des utilisateurs ciblés
 * et affiche les liens à envoyer.
 *
 * Usage :
 *   # Top N par engagement (auto)
 *   docker compose exec -T app npx tsx scripts/generate-feedback-tokens.ts --top 10
 *
 *   # Liste d'emails explicite
 *   docker compose exec -T app npx tsx scripts/generate-feedback-tokens.ts \
 *     --emails a@b.fr,c@d.fr,...
 *
 * Le script est idempotent : si un user a déjà un token non utilisé,
 * il le réutilise au lieu d'en créer un nouveau.
 */

import { PrismaClient } from "@prisma/client"
import { randomBytes } from "crypto"

const prisma = new PrismaClient()

const BASE_URL = process.env.FEEDBACK_BASE_URL || "https://gleba.fr"

function parseArgs() {
  const args = process.argv.slice(2)
  const out: { top?: number; emails?: string[] } = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--top") {
      out.top = Number(args[++i])
    } else if (args[i] === "--emails") {
      out.emails = args[++i]
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    }
  }
  return out
}

async function pickTopUsers(n: number): Promise<string[]> {
  // Engagement = records créés (planches + cultures + récoltes + arbres + ...)
  // On exclut les admins et le compte démo.
  const rows = await prisma.$queryRaw<{ email: string; score: bigint }[]>`
    SELECT
      u.email,
      (
        (SELECT COUNT(*) FROM planches WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM cultures WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM recoltes WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM arbres   WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM animaux  WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM interventions WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM ventes_manuelles WHERE user_id = u.id)
      + (SELECT COUNT(*) FROM depenses_manuelles WHERE user_id = u.id)
      ) AS score
    FROM users u
    WHERE u.role = 'USER'
      AND u.email <> 'demo@gleba.fr'
    ORDER BY score DESC
    LIMIT ${n}
  `
  return rows.filter((r) => Number(r.score) > 0).map((r) => r.email)
}

async function getOrCreateToken(userId: string): Promise<string> {
  const existing = await prisma.feedbackToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (existing) return existing.token

  const token = randomBytes(24).toString("base64url")
  await prisma.feedbackToken.create({ data: { userId, token } })
  return token
}

async function main() {
  const { top, emails: rawEmails } = parseArgs()

  let emails: string[] = []
  if (rawEmails && rawEmails.length > 0) {
    emails = rawEmails
  } else if (top) {
    emails = await pickTopUsers(top)
  } else {
    console.error("Usage : --top N | --emails a@b.fr,c@d.fr")
    process.exit(1)
  }

  if (emails.length === 0) {
    console.error("Aucun utilisateur trouvé.")
    process.exit(1)
  }

  console.log(`\n🌱 Génération de tokens pour ${emails.length} utilisateur(s)\n`)

  const results: { email: string; name: string | null; url: string; status: string }[] = []

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      results.push({ email, name: null, url: "", status: "❌ introuvable" })
      continue
    }
    const existing = await prisma.feedbackToken.findFirst({
      where: { userId: user.id, usedAt: null },
    })
    const token = await getOrCreateToken(user.id)
    const url = `${BASE_URL}/feedback/${token}`
    results.push({
      email: user.email,
      name: user.name,
      url,
      status: existing ? "♻️  réutilisé" : "✨ créé",
    })
  }

  // Tableau lisible
  console.log("Email".padEnd(40), "Nom".padEnd(25), "Statut")
  console.log("-".repeat(95))
  for (const r of results) {
    console.log(
      r.email.padEnd(40),
      (r.name || "—").padEnd(25),
      r.status
    )
  }

  console.log("\n📨 Liens à envoyer :\n")
  for (const r of results) {
    if (!r.url) continue
    console.log(`# ${r.name || r.email}`)
    console.log(`  ${r.url}\n`)
  }

  // Lignes prêtes pour mailing (CSV-like)
  console.log("\n📋 CSV (email,nom,lien) :\n")
  for (const r of results) {
    if (!r.url) continue
    console.log(`${r.email},${r.name || ""},${r.url}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
