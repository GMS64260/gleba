/**
 * Seed du référentiel de races animales (idempotent).
 * Rattache un jeu de races françaises courantes à chaque EspeceAnimale existante,
 * selon sa catégorie déduite (volaille / bovin / ovin / caprin / lapin / porc).
 * Réexécutable sans doublon (upsert sur [especeAnimaleId, nom]).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Categorie = 'volaille' | 'bovin' | 'ovin' | 'caprin' | 'lapin' | 'porc'

const RACES: Record<Categorie, string[]> = {
  volaille: ['Sussex', 'Marans', 'Wyandotte', 'Orpington', 'Leghorn', 'Poule Rousse', 'Bresse Gauloise'],
  bovin: ['Limousine', 'Charolaise', 'Normande', 'Montbéliarde', 'Salers', 'Aubrac', 'Holstein'],
  ovin: ['Lacaune', 'Île-de-France', 'Mérinos', 'Romane', 'Solognote', 'Suffolk'],
  caprin: ['Alpine', 'Saanen', 'Poitevine', 'Rove', 'Provençale'],
  lapin: ['Néo-Zélandais', 'Californien', 'Fauve de Bourgogne', 'Géant des Flandres'],
  porc: ['Large White', 'Landrace', 'Duroc', 'Gascon', 'Cul Noir du Limousin'],
}

function categorieDe(esp: {
  id: string
  nom: string
  type: string
  production: string
  categorieReglementaire: string | null
}): Categorie | null {
  const c = (esp.categorieReglementaire || '').toLowerCase()
  const s = `${esp.id} ${esp.nom} ${esp.type} ${esp.production} ${c}`.toLowerCase()
  if (c.includes('volaille') || /poule|poulet|coq|volaille|pondeuse|chair/.test(s)) {
    if (/poule|poulet|coq|volaille|pondeuse|ponte|chair/.test(s)) return 'volaille'
  }
  if (c.includes('bovin') || /vache|bovin|boeuf|bœuf|veau|génisse|taureau/.test(s)) return 'bovin'
  if (c.includes('ovin') || /mouton|ovin|brebis|agneau|b[eé]lier/.test(s)) return 'ovin'
  if (c.includes('caprin') || /ch[eè]vre|caprin|bouc|chevreau/.test(s)) return 'caprin'
  if (c.includes('cunicul') || /lapin/.test(s)) return 'lapin'
  if (c.includes('porc') || /porc|cochon|truie|verrat/.test(s)) return 'porc'
  if (c.includes('volaille') || /volaille/.test(s)) return 'volaille'
  return null
}

async function main() {
  const especes = await prisma.especeAnimale.findMany({
    select: { id: true, nom: true, type: true, production: true, categorieReglementaire: true },
  })

  let créées = 0
  for (const esp of especes) {
    const cat = categorieDe(esp)
    if (!cat) continue
    for (const nom of RACES[cat]) {
      await prisma.raceAnimale.upsert({
        where: { especeAnimaleId_nom: { especeAnimaleId: esp.id, nom } },
        update: {},
        create: { especeAnimaleId: esp.id, nom, aptitudes: [] },
      })
      créées++
    }
  }
  console.log(`✓ Seed races : ${créées} associations race↔espèce upsertées (${especes.length} espèces).`)
}

main()
  .catch((e) => {
    console.error('Seed races échoué:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
