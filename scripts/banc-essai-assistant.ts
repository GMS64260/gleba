/**
 * Banc d'essai de l'assistant IA (lot 2-B 2026-08-11).
 *
 * Rejoue les questions canoniques issues des tickets QA sur le compte démo et
 * vérifie que la couche déterministe de l'assistant répond EXACTEMENT comme
 * les écrans (vérité = fonction d'écran, jamais une valeur codée en dur) :
 *
 *  A. Égalité outil == écran : chaque lecture assistant est comparée à la
 *     fonction SSOT que l'écran consomme (mêmes chiffres attendus).
 *  B. Routeur d'intentions : les questions rapides doivent être interceptées
 *     (et les questions d'action/analyse ne JAMAIS l'être).
 *  C. Réponses directes de bout en bout : la réponse formatée doit contenir
 *     les chiffres de l'écran.
 *
 * Usage (depuis le HOST, pas le container — cf. vault Exploitation) :
 *   TZ=Europe/Paris npx tsx scripts/banc-essai-assistant.ts [--email demo@gleba.fr]
 *
 * À rejouer avant/après chaque lot assistant. Sort avec un code ≠ 0 au
 * moindre écart.
 */

import prisma from '../src/lib/prisma'
import { executeTool } from '../src/lib/chat/tool-executor'
import {
  detecterIntentionDirecte,
  tenterReponseDirecte,
} from '../src/lib/chat/reponses-directes'
import { computeDateRange } from '../src/lib/chat/periodes'
import { getTachesPotager } from '../src/lib/taches-potager'
import { computeStocksUnifies } from '../src/lib/comptabilite/stocks-unifies'
import { computeCoutsProduction } from '../src/lib/comptabilite/couts-production'
import { computeStockOeufsParLots } from '../src/lib/elevage/stock-oeufs-lots'
import { computeProductionsRuche } from '../src/lib/elevage/productions-ruche-lecture'
import { computePollinisationVerger } from '../src/lib/pollinisation-verger'
import { getTachesVerger } from '../src/lib/taches-verger'
import { listerObservationsSante } from '../src/lib/observations-sante'
import { genererRegistrePhyto } from '../src/lib/tracabilite/registre-phyto'
import { getKpiCompta } from '../src/lib/kpi/compta'

const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

type Resultat = { nom: string; ok: boolean; detail: string }
const resultats: Resultat[] = []

function verifier(nom: string, ok: boolean, detail: string) {
  resultats.push({ nom, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${nom} — ${detail}`)
}

function egal(nom: string, outil: unknown, ecran: unknown) {
  const identiques = JSON.stringify(outil) === JSON.stringify(ecran)
  verifier(
    nom,
    identiques,
    identiques
      ? `outil == écran (${JSON.stringify(outil)})`
      : `ÉCART outil=${JSON.stringify(outil)} écran=${JSON.stringify(ecran)}`,
  )
}

async function lireOutil(
  nom: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<Record<string, any>> {
  return JSON.parse(await executeTool(nom, args, userId, 'general'))
}

async function main() {
  const email = arg('email') ?? 'demo@gleba.fr'
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) {
    console.error(`Compte ${email} introuvable — lancer sur la base de production depuis le host.`)
    process.exit(2)
  }
  const userId = user.id
  const annee = new Date().getFullYear()
  console.log(`Banc d'essai assistant — compte ${email}, année ${annee}, TZ=${process.env.TZ ?? 'système'}\n`)

  // ────────────────────────────────────────────────────────────────────
  console.log('A. Égalité outil == écran (fonctions SSOT)\n')

  // A1. Tâches potager : compteur de retard exact de l'écran (invariant 11=11)
  {
    const fenetre = computeDateRange({}, 'cette_semaine')
    const ecran = await getTachesPotager(userId, { ...fenetre, annee, persistAutoValidation: false })
    const outil = await lireOutil('get_taches', { periode: 'cette_semaine' }, userId)
    egal('A1 get_taches.enRetard', outil.resume?.enRetard, ecran.stats.enRetard)
    egal('A1b get_taches.aIrriguer', outil.resume?.aIrriguer, ecran.stats.aIrriguer)
  }

  // A2. Stocks valorisés : mêmes items et même valeur que l'écran Compta > Stocks
  {
    const ecran = await computeStocksUnifies(userId)
    const outil = await lireOutil('get_stocks_valorises', {}, userId)
    egal('A2 get_stocks_valorises.totalItems', outil.stats?.totalItems, ecran.stats.totalItems)
    egal('A2b get_stocks_valorises.valeurTotale', outil.stats?.valeurTotale, ecran.stats.valeurTotale)
  }

  // A3. Marges par atelier : mêmes chiffres que l'écran Coûts de production
  {
    const ecran = await computeCoutsProduction(userId, annee)
    const outil = await lireOutil('get_marges_ateliers', { annee }, userId)
    egal('A3 get_marges_ateliers.parModule', outil.parModule, ecran.parModule)
    egal('A3b get_marges_ateliers.margeFerme', outil.totauxFerme?.margeBrute, ecran.totaux.margeBrute)
  }

  // A4. Stock d'œufs par lot : mêmes statuts DCR que l'écran Production > Œufs
  {
    const ecran = await computeStockOeufsParLots(userId)
    const outil = await lireOutil('get_stock_oeufs', {}, userId)
    egal('A4 get_stock_oeufs.stats', outil.stats, ecran.stats)
  }

  // A5. Produits de la ruche : mêmes stocks disponibles que l'écran
  {
    const ecran = await computeProductionsRuche(userId, annee)
    const outil = await lireOutil('get_productions_ruche', { annee }, userId)
    egal(
      'A5 get_productions_ruche.stocks',
      outil.stocksDisponibles,
      ecran.stocks.map((s) => ({
        produit: s.produit,
        unite: s.unite,
        quantiteProduite: s.quantiteProduite,
        disponible: s.disponible,
      })),
    )
    egal('A5b get_productions_ruche.totaux', outil.totauxAnnee, ecran.stats)
  }

  // A6. Pollinisation : mêmes compteurs que l'écran Verger > Pollinisation
  {
    const ecran = await computePollinisationVerger(userId)
    const outil = await lireOutil('get_pollinisation', {}, userId)
    egal('A6 get_pollinisation.stats', outil.stats, ecran.stats)
  }

  // A7. Tâches verger : mêmes stats que le dashboard verger
  {
    const fenetre = computeDateRange({}, 'cette_semaine')
    const ecran = await getTachesVerger(userId, fenetre)
    const outil = await lireOutil('get_taches_verger', { periode: 'cette_semaine' }, userId)
    egal('A7 get_taches_verger.stats', outil.stats, ecran.stats)
  }

  // A8. Observations santé : même liste que l'écran Verger > Santé
  {
    const ecran = await listerObservationsSante(userId)
    const outil = await lireOutil('get_observations_sante', {}, userId)
    egal('A8 get_observations_sante.count', outil.count, ecran.length)
    egal('A8b nonResolues', outil.nonResolues, ecran.filter((o) => !o.resolu).length)
  }

  // A9. Registre phyto : compteur exact de l'écran Traçabilité (« surcompté » soldé)
  {
    const ecran = await genererRegistrePhyto(userId, annee)
    const outil = await lireOutil('get_registre_phyto', { annee }, userId)
    egal('A9 get_registre_phyto.total', outil.stats?.totalTraitements, ecran.stats.totalTraitements)
  }

  // A10. KPI compta : CA/dépenses/bénéfice de la SSOT (tous les écrans compta)
  {
    const kpi = await getKpiCompta(userId, annee, new Date())
    const outil = await lireOutil('get_compta_stats', { annee }, userId)
    egal('A10 get_compta_stats.ca', outil.chiffreAffairesTTC, Math.round(kpi.revenusYtd * 100) / 100)
    egal('A10b get_compta_stats.benefice', outil.margeTTC, Math.round(kpi.beneficeYtd * 100) / 100)
  }

  // ────────────────────────────────────────────────────────────────────
  console.log('\nB. Routeur d’intentions (questions canoniques des tickets)\n')

  const attendues: Array<[string, string]> = [
    ['Quelles tâches sont en retard ?', 'taches_en_retard'],
    ['Combien de tâches en retard ?', 'taches_en_retard'],
    ['Suis-je en retard sur mes tâches ?', 'taches_en_retard'],
    ['Que dois-je faire cette semaine ?', 'taches_semaine'],
    ['Mes tâches de la semaine', 'taches_semaine'],
    ['Quel est mon stock actuel ?', 'stock_valorise'],
    ['Valeur de mes stocks', 'stock_valorise'],
    // Formulation canonique des tickets QA du 2026-08-11 (partait vers l'agent).
    ['Quel est le stock actuel de la ferme ?', 'stock_valorise'],
    ["Quel est mon chiffre d'affaires 2026 ?", 'ca_depenses_benefice'],
    ['Mon CA', 'ca_depenses_benefice'],
    ['Quel est mon bénéfice ?', 'ca_depenses_benefice'],
    ['Quelle est la marge du maraîchage ?', 'marges_ateliers'],
    ['Rentabilité par atelier', 'marges_ateliers'],
    ['Rentabilité de mon exploitation', 'marges_ateliers'],
    ["Quel est l'atelier le plus rentable en 2026 ?", 'marges_ateliers'],
    ["Combien d'animaux ?", 'effectifs_elevage'],
    ['Mes effectifs', 'effectifs_elevage'],
    ["Combien d'œufs en stock ?", 'stock_oeufs'],
    ["Stock d'œufs", 'stock_oeufs'],
    ["Combien d'arbres productifs ?", 'arbres_productifs'],
  ]
  for (const [question, intention] of attendues) {
    const detectee = detecterIntentionDirecte(question)
    verifier(
      `B ${question}`,
      detectee === intention,
      detectee === intention ? `→ ${intention}` : `attendu ${intention}, obtenu ${detectee}`,
    )
  }

  const versAgent = [
    'Crée une planche Z1p4 de 0,8 par 17',
    'Pourquoi mes tomates ont-elles des taches ?',
    'Analyse la rentabilité de mes ateliers',
    'Marque mes tâches en retard comme faites',
    'Quel est mon stock de graines de tomates ?',
    'Quelles tâches du verger sont en retard ?',
  ]
  for (const question of versAgent) {
    const detectee = detecterIntentionDirecte(question)
    verifier(
      `B agent ${question}`,
      detectee === null,
      detectee === null ? '→ agent (non intercepté)' : `INTERCEPTÉ À TORT (${detectee})`,
    )
  }

  // ────────────────────────────────────────────────────────────────────
  console.log('\nC. Réponses directes de bout en bout (chiffres de l’écran dans la réponse)\n')

  {
    const fenetre = computeDateRange({}, 'cette_semaine')
    const ecran = await getTachesPotager(userId, { ...fenetre, annee, persistAutoValidation: false })
    const direct = await tenterReponseDirecte('Quelles tâches sont en retard ?', userId, 'potager')
    verifier(
      'C1 tâches en retard',
      direct !== null &&
        (ecran.stats.enRetard === 0
          ? direct.reponse.includes('Aucune tâche en retard')
          : direct.reponse.includes(`${ecran.stats.enRetard} tâche`)),
      direct ? `réponse directe rendue (écran: ${ecran.stats.enRetard} en retard)` : 'PAS de réponse directe',
    )
  }
  {
    const ecran = await computeStocksUnifies(userId)
    const direct = await tenterReponseDirecte('Quel est mon stock actuel ?', userId, 'compta')
    verifier(
      'C2 stock valorisé',
      direct !== null && direct.reponse.includes(`${ecran.stats.totalItems} articles`),
      direct ? `réponse directe rendue (écran: ${ecran.stats.totalItems} articles)` : 'PAS de réponse directe',
    )
  }
  {
    const kpi = await getKpiCompta(userId, annee, new Date())
    const direct = await tenterReponseDirecte("Quel est mon chiffre d'affaires ?", userId, 'compta')
    const caAffiche = (Math.round(kpi.revenusYtd * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    verifier(
      'C3 chiffre d’affaires',
      direct !== null && direct.reponse.includes(caAffiche),
      direct ? `réponse directe rendue (écran: ${caAffiche} €)` : 'PAS de réponse directe',
    )
  }
  {
    const ecran = await computeStockOeufsParLots(userId)
    const direct = await tenterReponseDirecte("Combien d'œufs en stock ?", userId, 'elevage')
    verifier(
      'C4 stock d’œufs',
      direct !== null && direct.reponse.includes(`${ecran.stats.stockPhysique} œufs`),
      direct ? `réponse directe rendue (écran: ${ecran.stats.stockPhysique} œufs)` : 'PAS de réponse directe',
    )
  }

  // ────────────────────────────────────────────────────────────────────
  const echecs = resultats.filter((r) => !r.ok)
  console.log(`\n${resultats.length - echecs.length}/${resultats.length} vérifications passées.`)
  if (echecs.length > 0) {
    console.error(`\n${echecs.length} ÉCART(S) :`)
    for (const echec of echecs) console.error(`  - ${echec.nom} : ${echec.detail}`)
    process.exit(1)
  }
}

main()
  .catch((error) => {
    console.error('Banc d’essai en échec :', error)
    process.exit(2)
  })
  .finally(() => prisma.$disconnect())
