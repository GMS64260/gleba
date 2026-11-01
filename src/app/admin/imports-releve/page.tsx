/**
 * Admin — tentatives d'import de relevés bancaires CSV (30 derniers jours).
 *
 * Origine (2026-11-01) : un relevé refusé ne laissait aucune trace, impossible
 * de reproduire l'échec signalé par une utilisatrice. Chaque import garde
 * désormais son fichier d'origine 30 jours (src/lib/comptabilite/banque/tentatives.ts).
 */
import { requireAdmin } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChevronLeft, FileSpreadsheet } from 'lucide-react'
import { CONSERVATION_JOURS, limiteConservation } from '@/lib/comptabilite/banque/tentatives'
import { TentativesImport } from './TentativesImport'

export const dynamic = 'force-dynamic'

export default async function AdminImportsRelevePage() {
  await requireAdmin()
  const where = { createdAt: { gte: limiteConservation() } }
  const [tentatives, avecContenu] = await Promise.all([
    prisma.tentativeImportReleve.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        id: true,
        createdAt: true,
        nomFichier: true,
        tailleOctets: true,
        source: true,
        statut: true,
        message: true,
        importees: true,
        dejaPresentes: true,
        user: { select: { email: true } },
      },
    }),
    prisma.tentativeImportReleve.findMany({
      where: { ...where, contenu: { not: null } },
      select: { id: true },
      take: 300,
    }),
  ])
  const conserves = new Set(avecContenu.map((t) => t.id))
  const lignes = tentatives.map((t) => ({
    id: t.id,
    quand: t.createdAt.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
    email: t.user.email,
    nomFichier: t.nomFichier,
    tailleOctets: t.tailleOctets,
    source: t.source,
    statut: t.statut,
    message: t.message,
    importees: t.importees,
    dejaPresentes: t.dejaPresentes,
    fichierConserve: conserves.has(t.id),
  }))
  const refus = lignes.filter((l) => l.statut !== 'importe').length

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-emerald-700" />
          <div>
            <h1 className="text-2xl font-bold">Imports de relevés</h1>
            <p className="text-sm text-muted-foreground">
              {lignes.length} tentatives sur {CONSERVATION_JOURS} jours, dont {refus} refusées ·
              fichiers effacés après {CONSERVATION_JOURS} jours · données bancaires : à n’ouvrir que
              pour une demande d’assistance
            </p>
          </div>
        </div>
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Admin
          </Button>
        </Link>
      </div>
      <TentativesImport lignes={lignes} />
    </div>
  )
}
