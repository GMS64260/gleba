import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'

async function main() {
  const url = process.env.GLEBA_COMMERCIAL_QA_DATABASE_URL
  if (!url || !/^\/gleba_devis_qa_[a-z0-9_]+$/.test(new URL(url).pathname)) throw new Error('Base jetable requise')
  process.env.DATABASE_URL = url
  const { default: db } = await import('../../src/lib/prisma')
  const password = randomUUID()
  const hash = await bcrypt.hash(password, 10)
  const user = await db.user.create({ data: { email: 'demo@gleba.fr', name: 'Démo QA stock', password: hash, emailVerified: true } })
  const autre = await db.user.create({ data: { email: 'autre-commercial@example.test', password: hash, emailVerified: true } })
  const lecteur = await db.user.create({ data: { email: 'lecture-commercial@example.test', password: hash, emailVerified: true } })
  await db.membreExploitation.create({ data: { proprietaireId: user.id, userId: lecteur.id, email: lecteur.email, role: 'CONSULTATION', accepteLe: new Date() } })
  await db.exploitation.create({ data: { userId: user.id, raisonSociale: 'Ferme QA stock', formeJuridique: 'EI', regimeFiscal: 'micro-BA', regimeTva: 'reel-normal', adresseSiege: '1 chemin QA', codePostal: '64000', ville: 'Essai', emailContact: 'qa@example.test' } })
  const client = await db.client.create({ data: { userId: user.id, nom: 'Restaurant QA stock', adresse: '2 chemin QA' } })
  const espece = await db.espece.create({ data: { userId: user.id, nom: 'Carottes QA interface', uniteRendement: 'kg_m2', prixKg: 3.165 } })
  const culture = await db.culture.create({ data: { userId: user.id, especeId: espece.id } })
  const recolte = await db.recolte.create({ data: { userId: user.id, cultureId: culture.id, especeId: espece.id, quantite: 20, date: new Date(new Date().setUTCHours(0, 0, 0, 0)), unite: 'kg', statutBioSnapshot: 'AB' } })
  writeFileSync('/tmp/gleba-stock-ui-fixture.json', JSON.stringify({ userId: user.id, autreId: autre.id, lecteurId: lecteur.id, password, clientId: client.id, recolteId: recolte.id, especeId: espece.id }), { mode: 0o600 })
  await db.$disconnect()
  console.log('Banc interface stock préparé (données synthétiques uniquement).')
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
