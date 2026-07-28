import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@gleba.local").trim().toLowerCase()
  const expected = [adminEmail, "demo@gleba.fr"]
  const users = await prisma.user.findMany({
    where: { email: { in: expected } },
    select: { email: true, active: true, emailVerified: true },
  })

  for (const email of expected) {
    const user = users.find((candidate) => candidate.email === email)
    if (!user) {
      throw new Error(`Compte bootstrap absent : ${email}`)
    }
    if (!user.active || !user.emailVerified) {
      throw new Error(`Compte bootstrap inutilisable : ${email}`)
    }
  }

  console.log("✓ Comptes admin et démo actifs, emails vérifiés")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
