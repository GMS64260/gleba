/**
 * Script de création de l'administrateur initial
 * Usage: npx tsx prisma/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@potaleger.local'
  const password = process.env.ADMIN_PASSWORD || 'changeme'
  const name = process.env.ADMIN_NAME || 'Administrateur'

  console.log('Creation du compte administrateur...')
  console.log(`Email: ${email}`)

  // Vérifier si l'admin existe déjà
  const existing = await prisma.user.findUnique({
    where: { email },
  })

  if (existing) {
    console.log('Un utilisateur avec cet email existe deja.')
    console.log('Mise a jour du mot de passe et du role...')

    await prisma.user.update({
      where: { email },
      data: {
        password: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        active: true,
      },
    })

    console.log('Utilisateur mis a jour avec succes!')
  } else {
    // Créer l'admin
    const admin = await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name,
        role: 'ADMIN',
        active: true,
      },
    })

    console.log('Administrateur cree avec succes!')
    console.log(`ID: ${admin.id}`)
  }

  console.log('')
  console.log('IMPORTANT: Changez le mot de passe apres la premiere connexion!')
  console.log(`Mot de passe temporaire: ${password}`)
}

main()
  .catch((e) => {
    console.error('Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
