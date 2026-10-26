/** Conversations de terrain sur la DÉMO seulement. Aucune mutation exécutée.
 * npx tsx scripts/qa/serie-assistant-terrain.ts --etiquette avant [--liste]
 * Les rapports complets vont hors du dépôt. Les signalements sont simulés.
 */
import fs from 'node:fs'
import path from 'node:path'

const argument = (cle: string) => {
  const i = process.argv.indexOf(`--${cle}`)
  return i < 0 ? undefined : process.argv[i + 1]
}

async function main() {
  for (const ligne of fs.readFileSync('.env', 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  const url = new URL(process.env.DATABASE_URL!)
  url.hostname = '127.0.0.1'
  url.port = '5433'
  process.env.DATABASE_URL = url.toString()
  process.env.TZ = 'Europe/Paris'
  const { default: prisma } = await import('../../src/lib/prisma')
  const demo = await prisma.user.findUnique({ where: { email: 'demo@gleba.fr' }, select: { id: true } })
  if (!demo) throw new Error('Démo absente')
  const cultures = await prisma.culture.findMany({
    where: { userId: demo.id, annee: new Date().getFullYear() },
    select: { id: true, especeId: true, planche: { select: { nom: true } }, varieteId: true },
    orderBy: { id: 'asc' },
  })
  if (process.argv.includes('--liste')) {
    console.log(JSON.stringify(cultures))
    await prisma.$disconnect()
    return
  }
  const { requestNormalAssistance } = await import('../../src/lib/chat/advanced-reasoning')
  const { executeNormalReads, normalActionConfirmation, pendingActionMetadata, parsePendingAction } = await import('../../src/lib/chat/normal-agent')
  const { preparerActionRecoltes } = await import('../../src/lib/chat/recoltes-assistant')
  const { tenterSaisieRecolte } = await import('../../src/lib/chat/saisie-recolte')
  const tomate = cultures.find(c => /tomate/i.test(c.especeId) && c.planche)
  const carotte = cultures.find(c => /carotte/i.test(c.especeId) && c.planche)
  if (!tomate || !carotte) throw new Error('Cultures témoins absentes de la démo')
  if (process.argv.includes('--verifier-ecriture')) {
    const { preparerRecoltes, ecrireRecoltesPreparees } = await import('../../src/lib/recolte/creation')
    const preparation = await preparerRecoltes(demo.id, [
      { cultureId: tomate.id, especeId: tomate.especeId, quantite: 2.5, unite: 'kg' },
      { cultureId: carotte.id, especeId: carotte.especeId, quantite: 750, unite: 'g' },
    ], true)
    if (!preparation.ok) throw new Error(preparation.error)
    const temoin = new Error('ROLLBACK volontaire du banc terrain')
    let ids: number[] = []
    try {
      await prisma.$transaction(async tx => {
        const recoltes = await ecrireRecoltesPreparees(tx, preparation.recoltes)
        ids = recoltes.map(r => r.id)
        if (ids.length !== 2 || recoltes[1].quantite !== 0.75 || recoltes[1].unite !== 'kg') throw new Error('Écriture réelle non conforme')
        const nb = await tx.recolte.count({ where: { userId: demo.id, id: { in: ids } } })
        if (nb !== 2) throw new Error('Les deux récoltes ne sont pas visibles dans la transaction')
        throw temoin
      })
    } catch (e) { if (e !== temoin) throw e }
    if (!ids.length || await prisma.recolte.count({ where: { userId: demo.id, id: { in: ids } } }) !== 0) throw new Error('La transaction de contrôle n’a pas été annulée')
    console.log(JSON.stringify({ deuxRecoltesEcrites: true, grammesConvertis: true, transactionAnnulee: true, ecrituresPersistantes: 0 }))
    await prisma.$disconnect()
    return
  }
  const hier = new Date()
  hier.setDate(hier.getDate() - 1)
  const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const series = [
    { nom: 'recolte-et-correction', tours: [
      { question: `J'ai récolté deux kilos et demi de tomates sur ${tomate.planche!.nom}.`, attendu: { cultureId: tomate.id, quantite: 2.5 } },
      { question: "Non, trois kilos et demi, et c'était hier.", attendu: { cultureId: tomate.id, quantite: 3.5, date: jour(hier) } },
    ] },
    { nom: 'grammes', tours: [
      { question: `Note 750 grammes de carottes récoltées sur ${carotte.planche!.nom}.`, attendu: { cultureId: carotte.id, quantite: 0.75 } },
    ] },
    { nom: 'plusieurs-legumes', tours: [
      { question: `J'ai récolté 2 kilos de tomates sur ${tomate.planche!.nom} et 750 grammes de carottes sur ${carotte.planche!.nom}. Note tout.`, attendu: { lot: true } },
    ] },
    { nom: 'quantite-manquante', tours: [
      { question: `Je viens de récolter des tomates sur ${tomate.planche!.nom}.`, attendu: { clarification: true } },
      { question: 'Deux kilos.', attendu: { cultureId: tomate.id, quantite: 2 } },
    ] },
    { nom: 'unite-incompatible', tours: [
      { question: `Note douze carottes récoltées sur ${carotte.planche!.nom}.`, attendu: { clarification: true } },
      { question: 'Deux kilos.', attendu: { cultureId: carotte.id, quantite: 2 } },
    ] },
    { nom: 'quantite-absurde', tours: [
      { question: `Note moins trois kilos de tomates récoltées sur ${tomate.planche!.nom}.`, attendu: { clarification: true } },
    ] },
    { nom: 'quantites-dictees', tours: [
      { question: `Note deux virgule cinq kilos de tomates sur ${tomate.planche!.nom}.`, attendu: { cultureId: tomate.id, quantite: 2.5 } },
      { question: 'Non, un demi-kilo.', attendu: { cultureId: tomate.id, quantite: 0.5 } },
      { question: 'Plutôt un kilo cinq cents grammes.', attendu: { cultureId: tomate.id, quantite: 1.5 } },
    ] },
    { nom: 'correction-lot', tours: [
      { question: `Note 2 kilos de tomates sur ${tomate.planche!.nom} et 750 grammes de carottes sur ${carotte.planche!.nom}.`, attendu: { lot: true } },
      { question: 'Pour les carottes, plutôt un kilo.', attendu: { lot: true, quantitesLot: [2, 1] } },
      { question: 'Tout hier.', attendu: { lot: true, quantitesLot: [2, 1], dateLot: jour(hier) } },
    ] },
    { nom: 'petite-pesee', tours: [
      { question: `Note un gramme de tomates sur ${tomate.planche!.nom}.`, attendu: { cultureId: tomate.id, quantite: 0.001, contient: '1 g de' } },
    ] },
    { nom: 'planche-dictee', tours: [
      { question: `Note deux kilos de tomates sur ${tomate.planche!.nom.replace(/1$/, ' un')}.`, attendu: { cultureId: tomate.id, quantite: 2 } },
    ] },
  ]
  const rapport: unknown[] = []
  const etiquette = argument('etiquette') ?? 'mesure'
  const repertoire = '/home/tinky/gleba-sondes'
  fs.mkdirSync(repertoire, { recursive: true })
  const sortie = path.join(repertoire, `assistant-terrain-${etiquette.replace(/[^a-z0-9-]/gi, '')}-${Date.now()}.json`)
  let echecs = 0
  for (const serie of series.filter(s => !argument('serie') || s.nom === argument('serie'))) {
    const historique: Array<{ role: string; content: string; toolResults?: unknown }> = []
    for (const tour of serie.tours) {
      historique.push({ role: 'user', content: tour.question })
      const lectures: unknown[] = []
      const debut = Date.now()
      try {
        const precedent = [...historique.slice(0, -1)].reverse().find(m => m.role === 'assistant')
        const etat = precedent?.toolResults as { brouillonRecolte?: import('../../src/lib/chat/saisie-recolte').BrouillonRecolte } | undefined
        const terrain = process.argv.includes('--agent-seul') ? null : await tenterSaisieRecolte(tour.question, demo.id, { actionEnAttente: parsePendingAction(precedent?.toolResults), brouillon: etat?.brouillonRecolte })
        if (!terrain && process.argv.includes('--terrain-seul')) throw new Error('Question non reconnue par la voie terrain ; aucun appel fournisseur autorisé par ce passage.')
        const resultat = terrain ? { ...terrain, metrics: null, finalize: async () => {} } : await requestNormalAssistance({ userId: demo.id, section: 'potager', question: tour.question, recentMessages: historique }, {
          timeoutMs: 240_000,
          executeNormalReadCalls: async (calls, ctx) => {
            const reels = calls.filter(c => c.name !== 'signaler_blocage')
            const resultats = reels.length ? await executeNormalReads(reels, ctx) : []
            for (const c of calls.filter(c => c.name === 'signaler_blocage')) resultats.push({ id: c.id, name: c.name, ok: true, result: { success: true, ticketId: 'QA-SIMULE' } })
            lectures.push({ calls, resultats })
            return resultats
          },
        })
        if (resultat.action) {
          const preparation = await preparerActionRecoltes(resultat.action, demo.id)
          resultat.action = preparation.ok ? preparation.action : null
          if (!preparation.ok) resultat.content = preparation.error
        }
        const contenu = resultat.action ? normalActionConfirmation(resultat.action) : resultat.content
        historique.push({ role: 'assistant', content: contenu, toolResults: { ...(resultat.action ? pendingActionMetadata(resultat.action) : {}), ...(terrain?.brouillon ? { brouillonRecolte: terrain.brouillon } : {}) } })
        const attendu = tour.attendu as Record<string, unknown>
        const action = resultat.action
        let ok = attendu.clarification ? !action : attendu.lot ? action?.name === 'create_recoltes' : action?.name === 'create_recolte'
        if (ok && action && attendu.lot) {
          const lignes = action.args.recoltes as Array<Record<string, unknown>>
          const quantites = attendu.quantitesLot as number[] | undefined ?? [2, 0.75]
          ok = lignes.length === 2 && lignes.some(l => l.cultureId === tomate.id && l.quantite === quantites[0] && l.unite === 'kg') && lignes.some(l => l.cultureId === carotte.id && l.quantite === quantites[1] && l.unite === 'kg')
          if (attendu.dateLot) ok = ok && lignes.every(l => l.date === attendu.dateLot)
        }
        if (ok && attendu.clarification) ok = !lectures.some(l => JSON.stringify(l).includes('signaler_blocage')) && contenu.length < 400
        if (ok && action && !attendu.lot) {
          for (const cle of ['cultureId', 'quantite', 'unite', 'date']) if (cle in attendu) ok = ok && (cle === 'date' ? String(action.args[cle]).startsWith(String(attendu[cle])) : action.args[cle] === attendu[cle])
        }
        if (attendu.contient) ok = ok && contenu.includes(String(attendu.contient))
        if (!ok) echecs++
        const ligne = { serie: serie.nom, question: tour.question, attendu, ok, voie: terrain ? 'terrain' : 'agent', millisecondes: Date.now() - debut, secondes: Math.round((Date.now() - debut) / 1000), contenu, action, lectures, metrics: resultat.metrics }
        rapport.push(ligne)
        fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2))
        console.log(JSON.stringify({ serie: serie.nom, question: tour.question, ok, secondes: ligne.secondes, contenu, action }))
        await resultat.finalize()
      } catch (e) {
        echecs++
        rapport.push({ serie: serie.nom, question: tour.question, erreur: e instanceof Error ? e.message : String(e) })
        fs.writeFileSync(sortie, JSON.stringify(rapport, null, 2))
        console.log(JSON.stringify({ serie: serie.nom, erreur: e instanceof Error ? e.message : String(e) }))
      }
    }
  }
  console.log(JSON.stringify({ sortie, echecs, total: rapport.length }))
  await prisma.$disconnect()
  if (echecs) process.exitCode = 1
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Échec du banc'); process.exitCode = 1 })
