/**
 * Reprise des commandes de la boutique dont les produits n'étaient reliés à
 * aucun stock de l'élevage (règles : src/lib/boutique/reprise-stock-lie.ts).
 *
 * À blanc par défaut : rien n'est écrit, le journal dit ce qui le serait.
 * Les lignes `a_rapprocher` et `non_reprise` restent exclues même avec --appliquer.
 * Leur présence rend un code de sortie 1 ; les mouvements existants ne sont jamais neutralisés.
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
    // Une exploitation peut n'avoir plus aucun produit, mais encore des lignes
    // historiques à signaler après suppression de leurs produits.
    const comptes = userId ? [userId] : [...new Set((await Promise.all([
      prisma.produitBoutique.findMany({ distinct: ['userId'], select: { userId: true } }),
      prisma.commandeBoutique.findMany({ distinct: ['userId'], select: { userId: true } }),
    ])).flat().map(p => p.userId))].sort()
    const journaux: JournalReprise[] = []
    const fichier = valeur('--journal')
    const echecs: string[] = []
    let aRapprocher = 0
    let nonReprises = 0
    const ecrire = () => { if (fichier) writeFileSync(fichier, JSON.stringify({ applique: appliquer, date: new Date().toISOString(), echecs, journaux }, null, 2)) }
    for (const id of comptes) {
      let journal: JournalReprise
      // Chaque compte a sa transaction : un compte en échec est annulé en entier,
      // nommé, et n'empêche ni les suivants ni la trace de ceux déjà traités.
      try { journal = await reprendreStockLieExploitation(prisma, id, appliquer) }
      catch (e) { echecs.push(id); ecrire(); console.error(`${id} : reprise annulée pour ce compte —`, e instanceof Error ? e.message : e); continue }
      if (journal.evenements.length) { journaux.push(journal); ecrire() }
      const compte = (issue: string) => journal.evenements.filter((e) => e.issue === issue).length
      aRapprocher += compte('a_rapprocher')
      nonReprises += compte('non_reprise')
      console.log(`${id} : ${compte('relie')} produit(s) relié(s), ${compte('non_relie')} à relier à la main, ${compte('sortie')} ligne(s) sortie(s) dont ${journal.evenements.filter((e) => 'dateDeRepli' in e).length} à la date de la reprise, ${compte('deja_sortie')} déjà sortie(s), ${compte('stock_insuffisant')} sans stock suffisant, ${compte('a_rapprocher')} à rapprocher (sortie suspendue), ${compte('non_reprise')} ligne(s) non reprise(s) (produit supprimé ou unité modifiée)`)
    }
    ecrire()
    if (!fichier) console.log(JSON.stringify(journaux, null, 2))
    if (echecs.length) { console.error(`${echecs.length} compte(s) en échec, non modifié(s) : ${echecs.join(', ')}`); process.exitCode = 1 }
    if (aRapprocher) { console.error(`${aRapprocher} ligne(s) à rapprocher : aucune sortie pour ces lignes, même avec --appliquer. Consultez les mouvements référencés au journal.`); process.exitCode = 1 }
    if (nonReprises) { console.error(`${nonReprises} ligne(s) non reprise(s) : produit supprimé ou unité modifiée. Aucun conditionnement déduit ; consultez les raisons au journal.`); process.exitCode = 1 }
    console.log(appliquer
      ? (aRapprocher || nonReprises || echecs.length ? 'Reprise partielle : consultez le journal.' : 'Reprise appliquée.')
      : 'Reprise jouée à blanc : rien n’a été écrit. --appliquer ne traite que les lignes sans ambiguïté.')
  } finally { await prisma.$disconnect() }
}

main().catch((e) => { console.error(e); process.exit(1) })
