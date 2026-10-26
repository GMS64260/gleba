/** Banc de conseil : démo seule, lectures bornées, aucune écriture métier.
 * DATABASE_URL et configuration IA injectées par --env-file, jamais affichées.
 * --photo /chemin.jpg --question "..." [--section elevage] [--rapport /chemin.json]
 */
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const option = (cle: string) => { const i = process.argv.indexOf(`--${cle}`); return i < 0 ? undefined : process.argv[i + 1] }

async function main() {
  const db = new URL(process.env.DATABASE_URL!)
  db.hostname = '127.0.0.1'
  db.port = '5433'
  process.env.DATABASE_URL = db.toString()
  process.env.TZ = 'Europe/Paris'
  const { default: prisma } = await import('../../src/lib/prisma')
  try {
    const demo = await prisma.user.findUnique({ where: { email: 'demo@gleba.fr' }, select: { id: true } })
    if (!demo) throw new Error('Compte démo absent')
    const { normaliserPhotos } = await import('../../src/lib/chat/photos')
    const { requestNormalAssistance, getPaperclipNormalConfig } = await import('../../src/lib/chat/advanced-reasoning')
    const { executeNormalReads } = await import('../../src/lib/chat/normal-agent')
    const question = option('question') || 'Que reconnais-tu sur ces photos ? Donne les indices visibles et les vérifications utiles.'
    const image = option('photo')
    const images = [image, option('photo2')].filter((v): v is string => Boolean(v))
    const entrees = []
    for (const fichier of images) {
      // Simule la préparation faite par canvas dans le navigateur.
      const data = await sharp(fs.readFileSync(fichier), { limitInputPixels: 32_000_000 }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
      entrees.push({ dataUrl: `data:image/jpeg;base64,${data.toString('base64')}` })
    }
    const photos = await normaliserPhotos(entrees)
    const sectionDemandee = option('section')
    const section = sectionDemandee === 'verger' || sectionDemandee === 'elevage' || sectionDemandee === 'potager' ? sectionDemandee : 'general'
    const debut = Date.now()
    const signalements: unknown[] = []
    const config = getPaperclipNormalConfig()
    const etatAgent = async () => {
      const reponse = await fetch(`${config.apiUrl}/api/agents/${encodeURIComponent(config.agentId)}`, { headers: { Authorization: `Bearer ${config.apiKey}` } })
      if (!reponse.ok) throw new Error('État de l’agent inaccessible')
      const agent = await reponse.json()
      return createHash('sha256').update(JSON.stringify(agent.adapterConfig)).digest('hex')
    }
    const avant = await etatAgent()
    const issuesCreees: string[] = []
    const transferts: Array<{ methode: string; status: number }> = []
    const resultat = await requestNormalAssistance({ userId: demo.id, section, question, recentMessages: [], photos }, {
      fetchImpl: async (input, init) => {
        const reponse = await fetch(input, init)
        const url = String(input)
        if (init?.method === 'POST' && url.endsWith('/issues') && reponse.ok) {
          const issue = await reponse.clone().json()
          issuesCreees.push(issue.id)
        }
        if ((init?.method === 'POST' && url.endsWith('/attachments')) || (init?.method === 'DELETE' && url.includes('/attachments/'))) transferts.push({ methode: init.method, status: reponse.status })
        return reponse
      },
      executeNormalReadCalls: async (calls, userId, domaine) => {
        const lectures = calls.filter(c => c.name !== 'signaler_blocage')
        signalements.push(...calls.filter(c => c.name === 'signaler_blocage'))
        return executeNormalReads(lectures, userId, domaine)
      },
    })
    await resultat.finalize()
    const nettoyage = []
    for (const id of issuesCreees) {
      const reponse = await fetch(`${config.apiUrl}/api/issues/${encodeURIComponent(id)}/attachments`, { headers: { Authorization: `Bearer ${config.apiKey}` } })
      if (!reponse.ok) throw new Error('Contrôle des copies de travail impossible')
      nettoyage.push({ issueId: id, piecesRestantes: (await reponse.json()).length })
    }
    const rapport = { date: new Date().toISOString(), section, question, nombrePhotos: photos.length, dureeMs: Date.now() - debut, reponse: resultat.content, action: resultat.action, lectures: resultat.reads, signalementsSimules: signalements, configurationAgentInchangee: avant === await etatAgent(), transferts, nettoyage }
    const chemin = option('rapport')
    if (chemin) fs.writeFileSync(chemin, JSON.stringify(rapport, null, 2))
    console.log(JSON.stringify(rapport, null, 2))
    if (resultat.action) throw new Error('Le banc de diagnostic ne doit proposer aucune écriture sans demande explicite.')
  } finally { await prisma.$disconnect() }
}
main().catch(error => { console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'Banc interrompu'); process.exitCode = 1 })
