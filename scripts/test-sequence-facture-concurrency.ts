/**
 * Test de concurrence sur SequenceFacture.
 * Lance N créations de facture en parallèle pour le même user/exercice
 * et vérifie qu'aucun doublon de numéro n'est généré.
 *
 * Usage : docker compose exec -T app node /app/scripts/test-sequence-facture-concurrency.js
 */
import { PrismaClient } from '@prisma/client'
import { creerFacture } from '../src/lib/facture-utils'

const prisma = new PrismaClient()

async function main() {
  const userId = process.argv[2]
  const n = parseInt(process.argv[3] || '5', 10)

  if (!userId) {
    console.error('Usage: ts-node test-sequence-facture-concurrency.ts <userId> [n=5]')
    process.exit(1)
  }

  console.log(`Lancement de ${n} créations de facture en parallèle pour user ${userId}...`)

  const promises = Array.from({ length: n }, (_, i) =>
    prisma.$transaction(async (tx) =>
      creerFacture(tx, {
        userId,
        type: 'facture',
        clientNom: `TestClient${i}`,
        objet: `Test concurrence #${i}`,
        totalHT: 100,
        totalTVA: 5.5,
        totalTTC: 105.5,
        lignes: [
          {
            description: `Test ${i}`,
            quantite: 1,
            unite: 'unité',
            prixUnitaire: 100,
            tauxTVA: 5.5,
            montantHT: 100,
            montantTVA: 5.5,
            montantTTC: 105.5,
          },
        ],
      })
    )
  )

  const results = await Promise.allSettled(promises)
  const ok = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ numero: string; id: number }>[]
  const ko = results.filter((r) => r.status === 'rejected')

  const numeros = ok.map((r) => r.value.numero).sort()
  const doublons = numeros.filter((v, i) => numeros.indexOf(v) !== i)

  console.log('Succès :', ok.length, '/', n)
  console.log('Numéros générés :', numeros)
  if (doublons.length) {
    console.error('❌ DOUBLONS DÉTECTÉS :', doublons)
    process.exit(2)
  } else {
    console.log('✅ Aucun doublon — séquence intègre.')
  }
  if (ko.length) {
    console.warn('Erreurs :', ko.map((r) => (r as PromiseRejectedResult).reason))
  }

  // Cleanup : supprime les factures de test
  await prisma.facture.deleteMany({
    where: {
      userId,
      objet: { startsWith: 'Test concurrence #' },
    },
  })
  console.log('🧹 Factures de test nettoyées.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
