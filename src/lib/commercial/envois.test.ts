import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  user: vi.fn(), document: vi.fn(), ancien: vi.fn(), attente: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(),
  smtp: vi.fn(), send: vi.fn(), pdf: vi.fn(),
}))
vi.mock('@/lib/mail', () => ({ smtpConfigure: m.smtp, sendMail: m.send }))
vi.mock('./pdf', () => ({ genererPdfCommercial: m.pdf }))
vi.mock('@/lib/facture-pdf', () => ({ genererPdfFacture: m.pdf }))
vi.mock('@/lib/facture-structuree', () => ({ emetteurDeFacture: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ default: {
  user: { findUnique: m.user }, documentCommercial: { findFirst: m.document },
  envoiCommercial: { update: m.update },
  $transaction: (f: (tx: unknown) => unknown) => f({ $queryRaw: vi.fn(), envoiCommercial: {
    findUnique: m.ancien, findFirst: m.attente, count: m.count, create: m.create, update: m.update,
  } }),
} }))
import { envoiSchema, envoyerCommercial, messageCommercial, statutEnvoi } from './envois'

const entree = { type: 'document' as const, id: 'devis-1', cle: 'b35ae150-23ad-4d8d-9a87-56f47e128eee', destinataire: 'client@example.test', message: 'Voici le devis.' }
describe('Courriels commerciaux : traçabilité sans double envoi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.user.mockResolvedValue({ email: 'ferme@example.test' })
    m.document.mockResolvedValue({ id: 'devis-1', type: 'devis', statut: 'emis', numero: 'D-2026-0001', clientNom: 'Client', emetteurSnapshot: { raisonSociale: 'Ferme', emailContact: 'ferme@example.test' } })
    m.smtp.mockResolvedValue(true); m.pdf.mockResolvedValue(Buffer.from('%PDF'))
    m.ancien.mockResolvedValue(null); m.attente.mockResolvedValue(null); m.count.mockResolvedValue(0)
    m.create.mockResolvedValue({ id: 'envoi-1', statut: 'en_cours' })
    m.update.mockImplementation(async ({ data }) => ({ id: 'envoi-1', ...data }))
    m.send.mockResolvedValue({ accepted: ['client@example.test'], messageId: 'smtp-id' })
  })
  it('joint le PDF et n’annonce un envoi qu’après acceptation SMTP', async () => {
    expect(await envoyerCommercial('ferme', entree)).toMatchObject({ statut: 'envoye', messageId: 'smtp-id', envoyeAt: expect.any(Date) })
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'client@example.test', replyTo: 'ferme@example.test', attachments: [expect.objectContaining({ contentType: 'application/pdf', content: expect.any(Buffer) })] }))
  })
  it('rejoue une clé sans renvoyer le courriel', async () => {
    m.ancien.mockResolvedValue({ id: 'envoi-1', documentId: 'devis-1', factureId: null, destinataire: entree.destinataire, statut: 'envoye' })
    expect(await envoyerCommercial('ferme', entree)).toMatchObject({ statut: 'envoye' })
    expect(m.send).not.toHaveBeenCalled()
  })
  it('ne marque pas le PDF envoyé lorsque SMTP refuse le destinataire', async () => {
    m.send.mockResolvedValue({ accepted: [], rejected: [entree.destinataire] })
    expect(await envoyerCommercial('ferme', entree)).toMatchObject({ statut: 'refuse' })
  })
  it('rend un résultat incertain après coupure et ne lance aucun second envoi', async () => {
    m.send.mockRejectedValue(new Error('coupure'))
    expect(await envoyerCommercial('ferme', entree)).toMatchObject({ statut: 'a_verifier' })
    expect(m.send).toHaveBeenCalledTimes(1)
  })
  it('refuse la démo, un SMTP absent, un brouillon et un document étranger', async () => {
    m.user.mockResolvedValue({ email: 'demo@gleba.fr' })
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('démonstration')
    m.user.mockResolvedValue({ email: 'ferme@example.test' }); m.smtp.mockResolvedValue(false)
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('pas configuré')
    m.smtp.mockResolvedValue(true); m.document.mockResolvedValue({ statut: 'brouillon' })
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('Émettez')
    m.document.mockResolvedValue(null)
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('introuvable')
    expect(m.send).not.toHaveBeenCalled()
    expect(m.document).toHaveBeenCalledWith(expect.objectContaining({ where: { id: entree.id, userId: 'ferme' } }))
  })
  it('bloque une tentative concurrente et applique le quota horaire', async () => {
    m.attente.mockResolvedValue({ id: 'envoi-2', statut: 'en_cours', createdAt: new Date() })
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('déjà en cours')
    m.attente.mockResolvedValue(null); m.count.mockResolvedValue(20)
    await expect(envoyerCommercial('ferme', entree)).rejects.toThrow('20 envois')
    expect(m.send).not.toHaveBeenCalled()
  })
  it('permet une reprise explicite après interruption, en conservant le résultat incertain de la tentative précédente', async () => {
    const interrompu = { id: 'ancien', statut: 'en_cours', createdAt: new Date(Date.now() - 3600_000) }
    expect(statutEnvoi(interrompu)).toBe('a_verifier')
    m.attente.mockResolvedValue(interrompu)
    expect(await envoyerCommercial('ferme', entree)).toMatchObject({ statut: 'envoye' })
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'ancien' }, data: { statut: 'a_verifier' } })
    expect(m.send).toHaveBeenCalledTimes(1)
  })
  it('échappe le contenu et refuse plusieurs destinataires ou une injection d’en-têtes', () => {
    expect(messageCommercial('Devis', 'D-1', 'Ferme <test>', '<script>x</script>')).toContain('&lt;script&gt;')
    expect(envoiSchema.safeParse({ ...entree, destinataire: 'a@example.test,b@example.test' }).success).toBe(false)
    expect(envoiSchema.safeParse({ ...entree, destinataire: 'a@example.test\r\nBcc:b@example.test' }).success).toBe(false)
  })
})
