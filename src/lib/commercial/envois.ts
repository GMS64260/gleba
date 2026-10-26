import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendMail, smtpConfigure } from '@/lib/mail'
import { genererPdfFacture } from '@/lib/facture-pdf'
import { emetteurDeFacture } from '@/lib/facture-structuree'
import type { EmetteurSnapshot } from '@/lib/facture-utils'
import { estEmailDemo } from '@/lib/demo'
import { genererPdfCommercial } from './pdf'
import { relationsDocument } from './service'
import { ErreurCommerciale } from './regles'

export const cibleEnvoiSchema = z.object({ type: z.enum(['document', 'facture']), id: z.string().min(1).max(80) }).strict()
export const envoiSchema = cibleEnvoiSchema.extend({
  cle: z.string().uuid(),
  destinataire: z.email().max(254),
  message: z.string().trim().max(2000).default(''),
}).strict()
type Cible = z.infer<typeof cibleEnvoiSchema>

export function statutEnvoi(envoi: { statut: string; createdAt: Date }, maintenant = Date.now()) {
  return envoi.statut === 'en_cours' && maintenant - envoi.createdAt.getTime() > 15 * 60_000 ? 'a_verifier' : envoi.statut
}

const idFacture = (id: string) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new ErreurCommerciale('Facture introuvable', 404)
  return Number(id)
}

export async function chargerCible(userId: string, cible: Cible) {
  if (cible.type === 'document') {
    const d = await prisma.documentCommercial.findFirst({ where: { id: cible.id, userId }, include: relationsDocument })
    if (!d) throw new ErreurCommerciale('Document introuvable', 404)
    if (!['emis', 'accepte', 'livre'].includes(d.statut)) throw new ErreurCommerciale('Émettez ce document avant de l’envoyer. Les documents annulés ou refusés ne sont pas envoyables.')
    return { documentId: d.id, factureId: null, email: d.clientEmail, numero: d.numero, nom: d.clientNom,
      titre: d.type === 'devis' ? 'Devis' : 'Bon de livraison',
      emetteur: d.emetteurSnapshot as unknown as EmetteurSnapshot, pdf: () => genererPdfCommercial(d) }
  }
  const f = await prisma.facture.findFirst({ where: { id: idFacture(cible.id), userId }, include: { client: true, lignes: { orderBy: { ordre: 'asc' } } } })
  if (!f) throw new ErreurCommerciale('Facture introuvable', 404)
  if (!['emise', 'payee'].includes(f.statut)) throw new ErreurCommerciale('Seules les factures émises ou payées peuvent être envoyées')
  const emetteur = await emetteurDeFacture(f, userId)
  return { documentId: null, factureId: f.id, email: f.client?.email, numero: f.numero, nom: f.clientNom,
    titre: f.type === 'avoir' ? 'Avoir' : f.type === 'acompte' ? 'Facture d’acompte' : 'Facture',
    emetteur, pdf: () => genererPdfFacture(f, emetteur) }
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function messageCommercial(titre: string, numero: string, ferme: string, message: string) {
  return `<p>Bonjour,</p><p>Veuillez trouver en pièce jointe : ${echapper(titre)} ${echapper(numero)}.</p>${message ? `<p>${echapper(message).replace(/\n/g, '<br>')}</p>` : ''}<p>${echapper(ferme)}</p>`
}

export async function envoyerCommercial(userId: string, entree: z.infer<typeof envoiSchema>) {
  const compte = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (estEmailDemo(compte?.email)) throw new ErreurCommerciale('Les envois de courriels sont désactivés sur le compte de démonstration. Le PDF reste disponible.', 403)
  const cible = await chargerCible(userId, entree)
  if (!await smtpConfigure()) throw new ErreurCommerciale('L’envoi de courriels n’est pas configuré sur cette instance. Téléchargez le PDF pour le transmettre.', 503)
  const buffer = await cible.pdf()
  const preparation = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`envoi-commercial:${userId}`}, 0))`
    const ancien = await tx.envoiCommercial.findUnique({ where: { userId_cle: { userId, cle: entree.cle } } })
    if (ancien) {
      if (ancien.documentId !== cible.documentId || ancien.factureId !== cible.factureId || ancien.destinataire !== entree.destinataire) throw new ErreurCommerciale('Cette tentative correspond à un autre envoi')
      return { envoi: ancien, nouveau: false }
    }
    const where = { userId, documentId: cible.documentId, factureId: cible.factureId }
    const attente = await tx.envoiCommercial.findFirst({ where: { ...where, statut: 'en_cours' } })
    if (attente) {
      if (statutEnvoi(attente) === 'en_cours') throw new ErreurCommerciale('Un envoi est déjà en cours. Attendez son résultat avant de recommencer.')
      await tx.envoiCommercial.update({ where: { id: attente.id }, data: { statut: 'a_verifier' } })
    }
    const nombre = await tx.envoiCommercial.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600_000) } } })
    if (nombre >= 20) throw new ErreurCommerciale('La limite de 20 envois par heure est atteinte. Réessayez plus tard.', 429)
    // Les clés étrangères restent scopées : même la tentative appartient à l'exploitation.
    const envoi = await tx.envoiCommercial.create({ data: { ...where, cle: entree.cle, destinataire: entree.destinataire } })
    return { envoi, nouveau: true }
  })
  if (!preparation.nouveau) return preparation.envoi
  const ferme = cible.emetteur?.raisonSociale || 'Votre exploitation'
  try {
    const resultat = await sendMail({
      to: entree.destinataire, subject: `${cible.titre} ${cible.numero} · ${ferme}`.replace(/[\r\n]/g, ' '),
      html: messageCommercial(cible.titre, cible.numero, ferme, entree.message),
      ...(z.email().safeParse(cible.emetteur?.emailContact).success ? { replyTo: cible.emetteur!.emailContact } : {}),
      attachments: [{ filename: `${cible.numero.replace(/[^\w.-]/g, '_')}.pdf`, content: buffer, contentType: 'application/pdf' }],
    })
    if (!resultat.accepted?.length) {
      return await prisma.envoiCommercial.update({ where: { id: preparation.envoi.id }, data: { statut: 'refuse' } })
    }
    return await prisma.envoiCommercial.update({ where: { id: preparation.envoi.id }, data: { statut: 'envoye', messageId: resultat.messageId, envoyeAt: new Date() } })
  } catch {
    // Une coupure peut arriver après acceptation SMTP : ne jamais réessayer en silence.
    return prisma.envoiCommercial.update({ where: { id: preparation.envoi.id }, data: { statut: 'a_verifier' } })
  }
}

export const projectionEnvoi = { id: true, destinataire: true, statut: true, createdAt: true, envoyeAt: true } satisfies Prisma.EnvoiCommercialSelect
