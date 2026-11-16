/**
 * Reprise des commandes de la boutique dont les produits n'étaient reliés à
 * aucun stock de l'élevage (règles : src/lib/boutique/reprise-stock-lie.ts).
 *
 * À blanc par défaut : rien n'est écrit, le journal dit ce qui le serait.
 *
 *   tsx scripts/reprise-boutique-stock-lie.ts --user <id> [--journal fichier.json] [--appliquer]
 *   tsx scripts/reprise-boutique-stock-lie.ts --tous      [--journal fichier.json] [--appliquer]
 *
 * Le journal ne porte que des identifiants, des quantités et des dates.
 */
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { reprendreStockLieExploitation, type JournalReprise } from '../src/lib/boutique/reprise-stock-lie'

async function main() {
  const args = process.argv.slice(2)
  const valeur = (nom: string) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined }
  const appliquer = args.includes('--appliquer')
  const userId = valeur('--user')
  if (!userId && !args.includes('--tous')) {
    console.error('Indiquez --user <id> ou --tous. Ajoutez --appliquer pour écrire ; sans lui, la reprise est jouée à blanc.')
    process.exit(2)
  }
  const prisma = new PrismaClient()
  try {
    const comptes = userId ? [userId] : (await prisma.produitBoutique.findMany({ distinct: ['userId'], select: { userId: true }, orderBy: { userId: 'asc' } })).map((p) => p.userId)
    const journaux: JournalReprise[] = []
    const fichier = valeur('--journal')
    const echecs: string[] = []
    const ecrire = () => { if (fichier) writeFileSync(fichier, JSON.stringify({ applique: appliquer, date: new Date().toISOString(), echecs, journaux }, null, 2)) }
    for (const id of comptes) {
      let journal: JournalReprise
      // Chaque compte a sa transaction : un compte en échec est annulé en entier,
      // nommé, et n'empêche ni les suivants ni la trace de ceux déjà traités.
      try { journal = await reprendreStockLieExploitation(prisma, id, appliquer) }
      catch (e) { echecs.push(id); ecrire(); console.error(`${id} : reprise annulée pour ce compte —`, e instanceof Error ? e.message : e); continue }
      if (journal.evenements.length) { journaux.push(journal); ecrire() }
      const compte = (issue: string) => journal.evenements.filter((e) => e.issue === issue).length
      console.log(`${id} : ${compte('relie')} produit(s) relié(s), ${compte('non_relie')} à relier à la main, ${compte('sortie')} ligne(s) sortie(s) dont ${journal.evenements.filter((e) => 'dateDeRepli' in e).length} à la date de la reprise, ${compte('deja_sortie')} déjà sortie(s), ${compte('stock_insuffisant')} sans stock suffisant`)
    }
    ecrire()
    if (!fichier) console.log(JSON.stringify(journaux, null, 2))
    if (echecs.length) { console.error(`${echecs.length} compte(s) en échec, non modifié(s) : ${echecs.join(', ')}`); process.exitCode = 1 }
    console.log(appliquer ? 'Reprise appliquée.' : 'Reprise jouée à blanc : rien n’a été écrit. Relancez avec --appliquer.')
  } finally { await prisma.$disconnect() }
}

main().catch((e) => { console.error(e); process.exit(1) })
