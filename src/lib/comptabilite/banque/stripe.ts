import { estCompteDemo } from '@/lib/demo-garde'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { ErreurReglement, entierCentimes } from '../monnaie'
import { verrouillerReglements } from '../reglements'

const API_VERSION = '2025-06-30.basil'
export const CLEFS = /^rk_(test|live)_[A-Za-z0-9_]{10,}$/
/**
 * Jeton enregistré illisible avec la clé de chiffrement actuelle : la clé
 * (`STRIPE_TOKEN_ENCRYPTION_KEY`, ou `AUTH_SECRET`/`NEXTAUTH_SECRET` de repli)
 * a changé depuis l'enregistrement. Seule une reconnexion le remplace (revue du
 * 2026-10-29 : une rotation cassait les connexions en silence).
 */
export class ErreurJetonStripe extends ErreurReglement {
  constructor() {
    super(
      'L’accès Stripe enregistré ne peut plus être lu : la clé de chiffrement du serveur a changé. Reconnectez Stripe pour reprendre la synchronisation.',
      409,
    )
    this.name = 'ErreurJetonStripe'
  }
}
/** Désactivée sans déconnexion volontaire (qui efface le jeton) : jeton devenu illisible. */
export function erreurConnexionStripe(c: { actif: boolean; jetonChiffre: string }) {
  return !c.actif && c.jetonChiffre !== '' ? new ErreurJetonStripe().message : null
}
function cleChiffrement() {
  const secret =
    process.env.STRIPE_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 32)
    throw new ErreurReglement(
      'Le chiffrement des connexions doit être configuré sur le serveur.',
      503,
    )
  return createHash('sha256')
    .update('gleba:stripe:tokens:v1\0' + secret)
    .digest()
}
export function chiffrerJeton(jeton: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', cleChiffrement(), iv)
  const contenu = Buffer.concat([cipher.update(jeton, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    contenu.toString('hex'),
  ].join(':')
}
export function dechiffrerJeton(texte: string) {
  // Configuration absente : erreur serveur explicite, pas un jeton à renouveler.
  const cle = cleChiffrement()
  try {
    const [version, iv, tag, chiffre] = texte.split(':')
    if (
      version !== 'v1' ||
      !/^[0-9a-f]{24}$/.test(iv) ||
      !/^[0-9a-f]{32}$/.test(tag) ||
      !/^(?:[0-9a-f]{2})+$/.test(chiffre)
    )
      throw new Error('Format')
    const decipher = createDecipheriv('aes-256-gcm', cle, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(chiffre, 'hex')), decipher.final()]).toString(
      'utf8',
    )
  } catch {
    throw new ErreurJetonStripe()
  }
}
export async function lireStripe<T>(chemin: string, jeton: string): Promise<T> {
  if (!/^\/v1\/[a-z_]+(?:\/[A-Za-z0-9_]+)?(?:\?.*)?$/.test(chemin))
    throw new ErreurReglement('Requête Stripe invalide.', 400)
  let response: Response
  try {
    response = await fetch('https://api.stripe.com' + chemin, {
      headers: { Authorization: 'Bearer ' + jeton, 'Stripe-Version': API_VERSION },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    throw new ErreurReglement(
      'Stripe est momentanément injoignable. Réessayez la synchronisation.',
      502,
    )
  }
  if (!response.ok)
    throw new ErreurReglement(
      response.status === 401 || response.status === 403
        ? 'L’accès Stripe ne permet pas de lire le compte, les soldes et les opérations. Vérifiez les droits de la connexion.'
        : 'Stripe a refusé la synchronisation. Réessayez plus tard.',
      502,
    )
  return response.json() as Promise<T>
}
interface CompteStripe {
  id: string
  business_profile?: { name?: string | null }
  business_type?: string
}
interface SoldeStripe {
  available: Array<{ amount: number; currency: string }>
  pending: Array<{ amount: number; currency: string }>
}
export interface TransactionStripe {
  id: string
  amount: number
  fee: number
  net: number
  currency: string
  created: number
  description: string | null
  type: string
  status: 'available' | 'pending'
}
interface PageStripe {
  data: TransactionStripe[]
  has_more: boolean
}
const DEVISES_ZERO = new Set([
  'bif',
  'clp',
  'djf',
  'gnf',
  'jpy',
  'kmf',
  'krw',
  'mga',
  'pyg',
  'rwf',
  'vnd',
  'vuv',
  'xaf',
  'xof',
  'xpf',
])
export function centimesStripe(montant: number, devise: string) {
  if (!/^[a-z]{3}$/.test(devise) || ['bhd', 'jod', 'kwd', 'omr', 'tnd'].includes(devise))
    throw new ErreurReglement('Cette précision de devise Stripe n’est pas prise en charge.', 422)
  return entierCentimes(DEVISES_ZERO.has(devise) ? montant * 100 : montant)
}
export function verifierTransactionStripe(t: TransactionStripe) {
  if (
    !/^txn_[A-Za-z0-9]+$/.test(t.id) ||
    !['available', 'pending'].includes(t.status) ||
    typeof t.type !== 'string' ||
    !/^[a-z_]{1,80}$/.test(t.type) ||
    (t.description !== null && typeof t.description !== 'string') ||
    !Number.isSafeInteger(t.created) ||
    t.created < 631152000 ||
    t.created > Math.floor(Date.now() / 1000) + 86400
  )
    throw new ErreurReglement('Une opération Stripe a un format invalide.', 502)
  const brut = centimesStripe(t.amount, t.currency),
    frais = centimesStripe(t.fee, t.currency),
    net = centimesStripe(t.net, t.currency)
  if (brut - frais !== net)
    throw new ErreurReglement('Le brut, les frais et le net Stripe sont incohérents.', 502)
  return { brut, frais, net }
}
/** Refus 409 : le compte Stripe est actif dans une autre exploitation de l'instance. */
export const MESSAGE_STRIPE_ACTIF_AILLEURS =
  'Ce compte Stripe est déjà connecté à une autre exploitation Gleba. Déconnectez-le de cette exploitation avant de le relier ici.'
/** Classe dédiée : le retour OAuth la reconnaît pour afficher ce refus à l'écran. */
export class ErreurStripeActifAilleurs extends ErreurReglement {
  constructor() {
    super(MESSAGE_STRIPE_ACTIF_AILLEURS, 409)
    this.name = 'ErreurStripeActifAilleurs'
  }
}
export async function enregistrerConnexionStripe(userId: string, jeton: string, modeTest: boolean) {
  if (await estCompteDemo(userId))
    throw new ErreurReglement(
      'Créez votre propre compte pour connecter Stripe ; la démonstration est partagée.',
      403,
    )
  cleChiffrement()
  const compte = await lireStripe<CompteStripe>('/v1/account', jeton)
  if (!/^acct_[A-Za-z0-9]+$/.test(compte.id))
    throw new ErreurReglement('Le compte Stripe est invalide.', 502)
  // Vérifier les droits avant d'enregistrer un accès inutilisable.
  await lireStripe<SoldeStripe>('/v1/balance', jeton)
  await lireStripe<PageStripe>('/v1/balance_transactions?limit=1', jeton)
  // Revue du 2026-10-30 : une ligne par exploitation (userId, compte, mode) et
  // une seule connexion ACTIVE par compte Stripe sur l'instance (index partiel
  // SQL `connexions_stripe_compte_stripe_id_mode_test_actif_key`). Une
  // connexion déconnectée ailleurs ne bloque plus ; une connexion active
  // ailleurs est refusée explicitement.
  const cle = { userId, compteStripeId: compte.id, modeTest }
  try {
    return await prisma.$transaction(async (db) => {
      await verrouillerReglements(db, userId)
      if (
        await db.connexionStripe.count({
          where: { compteStripeId: compte.id, modeTest, actif: true, userId: { not: userId } },
        })
      )
        throw new ErreurStripeActifAilleurs()
      const existante = await db.connexionStripe.findUnique({
        where: { userId_compteStripeId_modeTest: cle },
        select: { verrouSynchroJusqua: true },
      })
      if (existante?.verrouSynchroJusqua && existante.verrouSynchroJusqua > new Date())
        throw new ErreurReglement(
          'Attendez la fin de la synchronisation avant de renouveler la connexion.',
        )
      const data = { jetonChiffre: chiffrerJeton(jeton), actif: true }
      const connexion = await db.connexionStripe.upsert({
        where: { userId_compteStripeId_modeTest: cle },
        create: { ...cle, ...data },
        update: data,
      })
      return { id: connexion.id, modeTest: connexion.modeTest, actif: connexion.actif }
    })
  } catch (e) {
    // Deux exploitations qui connectent le même compte au même instant : le
    // verrou des règlements est propre à chaque exploitation, l'index partiel
    // tranche. Le perdant reçoit le même refus explicite.
    if ((e as { code?: string } | null)?.code === 'P2002')
      throw new ErreurStripeActifAilleurs()
    throw e
  }
}
export async function connecterCleStripe(userId: string, cle: string) {
  const m = CLEFS.exec(cle)
  if (!m)
    throw new ErreurReglement(
      'Utilisez une clé Stripe restreinte de lecture (rk_test_ ou rk_live_).',
      400,
    )
  return enregistrerConnexionStripe(userId, cle, m[1] === 'test')
}
export function configurationStripe() {
  return {
    oauthDisponible: Boolean(process.env.STRIPE_CONNECT_CLIENT_ID && process.env.STRIPE_SECRET_KEY),
    chiffrementDisponible: Boolean(
      (
        process.env.STRIPE_TOKEN_ENCRYPTION_KEY ||
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        ''
      ).length >= 32,
    ),
  }
}

export async function synchroniserStripe(userId: string, connexionId: string) {
  const maintenant = new Date(),
    bail = new Date(maintenant.getTime() + 120000)
  const verifierDuree = () => {
    if (Date.now() - maintenant.getTime() > 65000)
      throw new ErreurReglement(
        'Lot partiellement synchronisé. Relancez pour poursuivre sans doublon.',
      )
  }
  const prise = await prisma.connexionStripe.updateMany({
    where: {
      id: connexionId,
      userId,
      actif: true,
      OR: [{ verrouSynchroJusqua: null }, { verrouSynchroJusqua: { lt: maintenant } }],
    },
    data: { verrouSynchroJusqua: bail },
  })
  if (prise.count !== 1)
    throw new ErreurReglement('Connexion introuvable ou synchronisation déjà en cours.')
  let importees = 0
  try {
    const connexion = await prisma.connexionStripe.findFirstOrThrow({
      where: { id: connexionId, userId },
    })
    let jeton: string
    try {
      jeton = dechiffrerJeton(connexion.jetonChiffre)
    } catch (e) {
      if (e instanceof ErreurJetonStripe) {
        // Connexion mise en erreur : désactivée, jeton illisible conservé comme
        // marqueur (une déconnexion volontaire l'efface). Ni jeton ni clé au journal.
        console.error(
          `[banque] Connexion Stripe ${connexion.id} : jeton indéchiffrable, la clé de chiffrement (STRIPE_TOKEN_ENCRYPTION_KEY, ou AUTH_SECRET/NEXTAUTH_SECRET de repli) a changé depuis son enregistrement. Connexion désactivée ; le propriétaire doit reconnecter Stripe.`,
        )
        await prisma.connexionStripe.updateMany({
          where: { id: connexion.id, userId, verrouSynchroJusqua: bail },
          data: { actif: false },
        })
      }
      throw e
    }
    const compteVerifie = await lireStripe<CompteStripe>('/v1/account', jeton)
    if (compteVerifie.id !== connexion.compteStripeId)
      throw new ErreurReglement('Le compte renvoyé ne correspond plus à cette connexion.')
    const comptes = new Map<string, string>()
    const obtenirCompte = async (currency: string) => {
      if (!/^[a-z]{3}$/.test(currency)) throw new ErreurReglement('Devise bancaire invalide.', 502)
      const devise = currency.toUpperCase()
      if (comptes.has(devise)) return comptes.get(devise)!
      const c = await prisma.compteBancaire.upsert({
        where: { connexionStripeId_devise: { connexionStripeId: connexion.id, devise } },
        update: {},
        create: {
          userId,
          nom: 'Stripe' + (connexion.modeTest ? ' test' : '') + ' · ' + devise,
          devise,
          connexionStripeId: connexion.id,
        },
      })
      comptes.set(devise, c.id)
      return c.id
    }
    const importer = async (t: TransactionStripe) => {
      verifierDuree()
      const sommes = verifierTransactionStripe(t),
        compteId = await obtenirCompte(t.currency)
      await prisma.$transaction(async (db) => {
        await verrouillerReglements(db, userId)
        if (
          !(await db.connexionStripe.count({
            where: { id: connexion.id, userId, actif: true, verrouSynchroJusqua: bail },
          }))
        )
          throw new ErreurReglement('Cette synchronisation n’est plus active.')
        const ancienne = await db.operationBancaire.findFirst({
          where: { userId, compte: { connexionStripeId: connexion.id }, referenceExterne: t.id },
        })
        if (ancienne && ancienne.compteId !== compteId)
          throw new ErreurReglement(
            'La devise d’une opération Stripe a changé. Une vérification de ce compte est nécessaire.',
          )
        const donnees = {
          userId,
          compteId,
          referenceExterne: t.id,
          date: new Date(t.created * 1000),
          libelle: (t.description || 'Stripe · ' + t.type).slice(0, 500),
          famille: t.type,
          statut: t.status === 'available' ? 'comptabilisee' : 'en_attente',
          montantCentimes: BigInt(sommes.net),
          brutCentimes: BigInt(sommes.brut),
          fraisCentimes: BigInt(sommes.frais),
        }
        if (!ancienne) {
          await db.operationBancaire.create({ data: donnees })
          importees++
        } else {
          const different =
            ancienne.date.getTime() !== donnees.date.getTime() ||
            ancienne.famille !== donnees.famille ||
            ancienne.montantCentimes !== donnees.montantCentimes ||
            ancienne.brutCentimes !== donnees.brutCentimes ||
            ancienne.fraisCentimes !== donnees.fraisCentimes
          // Aucun règlement ne change lors d'une synchronisation ; une correction
          // du fournisseur doit être examinée avant de rapprocher à nouveau.
          await db.operationBancaire.update({
            where: { id: ancienne.id, userId },
            data: {
              ...donnees,
              statut: ancienne.statut === 'ignoree' ? 'ignoree' : donnees.statut,
              aVerifier: ancienne.aVerifier || different,
            },
          })
        }
      })
    }
    const page = async (curseur?: string | null) => {
      verifierDuree()
      const lot = await lireStripe<PageStripe>(
        '/v1/balance_transactions?' +
          new URLSearchParams({ limit: '100', ...(curseur ? { starting_after: curseur } : {}) }),
        jeton,
      )
      if (
        !Array.isArray(lot.data) ||
        lot.data.length > 100 ||
        (lot.has_more && !lot.data.length) ||
        (curseur && lot.data.some((t) => t.id === curseur)) ||
        new Set(lot.data.map((t) => t.id)).size !== lot.data.length
      )
        throw new ErreurReglement('Pagination Stripe invalide.', 502)
      return lot
    }
    if (!connexion.historiqueComplet) {
      // Ne pas avancer la tête historique : les nouveaux mouvements arrivés
      // pendant le rattrapage seront intégralement repris ensuite.
      if (connexion.curseurHistorique) for (const t of (await page()).data) await importer(t)
      let curseur = connexion.curseurHistorique,
        tete = connexion.dernierTransactionId
      for (let p = 0; p < 5; p++) {
        const lot = await page(curseur)
        if (!Array.isArray(lot.data) || (lot.has_more && !lot.data.length))
          throw new ErreurReglement('Pagination Stripe invalide.', 502)
        if (!tete && lot.data.length) tete = lot.data[0].id
        for (const t of lot.data) await importer(t)
        curseur = lot.data.at(-1)?.id ?? curseur
        await prisma.connexionStripe.update({
          where: { id: connexion.id, userId },
          data: {
            curseurHistorique: lot.has_more ? curseur : null,
            historiqueComplet: !lot.has_more,
            dernierTransactionId: tete,
          },
        })
        if (!lot.has_more) break
      }
    } else {
      let curseur = connexion.curseurNouveaux,
        tete = connexion.teteNouveaux
      for (let p = 0; p < 5; p++) {
        const lot = await page(curseur)
        if (!Array.isArray(lot.data) || (lot.has_more && !lot.data.length))
          throw new ErreurReglement('Pagination Stripe invalide.', 502)
        if (!tete && lot.data.length) tete = lot.data[0].id
        let fini = !lot.has_more
        for (const t of lot.data) {
          if (t.id === connexion.dernierTransactionId) {
            fini = true
            break
          }
          await importer(t)
        }
        curseur = lot.data.at(-1)?.id ?? curseur
        await prisma.connexionStripe.update({
          where: { id: connexion.id, userId },
          data: {
            dernierTransactionId: fini
              ? (tete ?? connexion.dernierTransactionId)
              : connexion.dernierTransactionId,
            curseurNouveaux: fini ? null : curseur,
            teteNouveaux: fini ? null : tete,
          },
        })
        if (fini) break
      }
    }
    // Les fonds Stripe peuvent devenir disponibles après leur première lecture.
    const attentes = await prisma.operationBancaire.findMany({
      where: { userId, compte: { connexionStripeId: connexion.id }, statut: 'en_attente' },
      orderBy: { updatedAt: 'asc' },
      take: 5,
    })
    for (const o of attentes) {
      verifierDuree()
      await importer(
        await lireStripe<TransactionStripe>(
          '/v1/balance_transactions/' + o.referenceExterne,
          jeton,
        ),
      )
    }
    verifierDuree()
    const soldes = await lireStripe<SoldeStripe>('/v1/balance', jeton)
    if (!Array.isArray(soldes.available)) throw new ErreurReglement('Solde Stripe invalide.', 502)
    for (const s of soldes.available) {
      const compteId = await obtenirCompte(s.currency)
      await prisma.compteBancaire.update({
        where: { id: compteId, userId },
        data: { soldeCentimes: BigInt(centimesStripe(s.amount, s.currency)), soldeAu: new Date() },
      })
    }
    await prisma.connexionStripe.update({
      where: { id: connexion.id, userId },
      data: { derniereSynchro: new Date() },
    })
    return {
      importees,
      historiqueComplet: (
        await prisma.connexionStripe.findUniqueOrThrow({
          where: { id: connexion.id, userId },
          select: { historiqueComplet: true },
        })
      ).historiqueComplet,
    }
  } finally {
    await prisma.connexionStripe.updateMany({
      where: { id: connexionId, userId, verrouSynchroJusqua: bail },
      data: { verrouSynchroJusqua: null },
    })
  }
}
