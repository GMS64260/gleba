/**
 * Script de création du compte démo
 * Email: demo@gleba.fr
 * Password: demo2026
 *
 * Ce script est idempotent (peut être executé plusieurs fois)
 */

import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'demo@gleba.fr'
  const password = 'demo2026'
  const name = 'Compte Démo'

  // Vérifier si le compte démo existe déjà
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log(`✓ Compte démo existe déjà: ${email}`)
    return
  }

  // Créer le compte démo
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'USER',
      active: true,
    },
  })

  console.log(`✓ Compte démo créé: ${email}`)
  console.log(`  ID: ${user.id}`)
  console.log(`  Nom: ${user.name}`)
  console.log(`  Rôle: ${user.role}`)
  console.log(`  Mot de passe: demo2026`)
  console.log('')
  console.log('💡 Les utilisateurs peuvent se connecter avec:')
  console.log(`   Email: demo@gleba.fr`)
  console.log(`   Mot de passe: demo2026`)
}

main()
  .catch((error) => {
    console.error('Erreur création compte démo:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
