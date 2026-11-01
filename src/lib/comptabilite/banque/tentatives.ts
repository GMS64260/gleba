import { createHash } from 'node:crypto'
import cron from 'node-cron'
import prisma from '@/lib/prisma'
import { decoderReleve } from './decodage-releve'
import { lireReleveCsv } from './releve'
import { ErreurReglement } from '../monnaie'

// Chaque import de relevé CSV, réussi ou non, garde ses octets d'origine pour
// l'assistance et pour rejouer un lecteur corrigé sur les vrais fichiers.
// Données bancaires : conservation bornée, accès administrateur seulement.
export const CONSERVATION_JOURS = 30
// Au-delà, la tentative est tracée sans son contenu : un compte ne peut pas
// remplir la base à coups de fichiers d'1 Mo.
export const CONTENUS_PAR_JOUR = 30

export type SourceTentative = 'fichier' | 'texte'
export type StatutTentative = 'importe' | 'refuse' | 'erreur'

export function limiteConservation(maintenant = new Date()) {
  return new Date(maintenant.getTime() - CONSERVATION_JOURS * 86_400_000)
}

export async function purgerTentativesImport(maintenant = new Date()) {
  const { count } = await prisma.tentativeImportReleve.deleteMany({
    where: { createdAt: { lt: limiteConservation(maintenant) } },
  })
  return count
}

export async function enregistrerTentativeImport(t: {
  userId: string
  compteId: string
  nomFichier?: string | null
  octets: Uint8Array
  source: SourceTentative
  statut: StatutTentative
  message?: string | null
  importees?: number
  dejaPresentes?: number
}) {
  // Jamais bloquant : l'import a déjà réussi ou échoué, la trace n'y change rien.
  try {
    await purgerTentativesImport()
    const recentes = await prisma.tentativeImportReleve.count({
      where: { userId: t.userId, createdAt: { gte: new Date(Date.now() - 86_400_000) }, contenu: { not: null } },
    })
    await prisma.tentativeImportReleve.create({
      data: {
        userId: t.userId,
        compteId: t.compteId.slice(0, 100),
        nomFichier: t.nomFichier?.slice(0, 255) || null,
        contenu: recentes < CONTENUS_PAR_JOUR ? Buffer.from(t.octets) : null,
        tailleOctets: t.octets.byteLength,
        empreinte: createHash('sha256').update(t.octets).digest('hex'),
        source: t.source,
        statut: t.statut,
        message: t.message?.slice(0, 1000) || null,
        importees: t.importees ?? null,
        dejaPresentes: t.dejaPresentes ?? null,
      },
    })
  } catch {
    // Ni le contenu ni l'identité dans les journaux.
    console.warn('[banque] Tentative d’import de relevé non conservée.')
  }
}

export function texteTentative(contenu: Uint8Array, source: string) {
  return source === 'fichier' ? decoderReleve(contenu) : new TextDecoder('utf-8').decode(contenu)
}

/** Relit un fichier conservé avec le lecteur en service, sans rien écrire. */
export function rejouerTentativeImport(contenu: Uint8Array, source: string) {
  try {
    const lignes = lireReleveCsv(texteTentative(contenu, source))
    const dates = lignes.map((l) => l.date.getTime())
    return {
      lisible: true as const,
      operations: lignes.length,
      du: new Date(Math.min(...dates)).toISOString().slice(0, 10),
      au: new Date(Math.max(...dates)).toISOString().slice(0, 10),
      netCentimes: lignes.reduce((s, l) => s + l.montantCentimes, 0),
    }
  } catch (e) {
    return {
      lisible: false as const,
      message: e instanceof ErreurReglement ? e.message : 'Erreur inattendue du lecteur.',
    }
  }
}

let planifie = false
export function initPurgeTentativesImport() {
  if (planifie || process.env.NEXT_PHASE === 'phase-production-build') return
  planifie = true
  // Purge quotidienne, même sans nouvel import (la purge suit aussi chaque import).
  cron.schedule('17 3 * * *', () => {
    purgerTentativesImport().catch(() =>
      console.warn('[banque] Purge des tentatives d’import différée.'),
    )
  })
}
