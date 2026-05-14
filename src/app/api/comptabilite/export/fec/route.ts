/**
 * Export FEC (Fichier des Écritures Comptables).
 *
 * GET /api/comptabilite/export/fec?exercice=2026
 *
 * Format conforme à l'arrêté du 29/07/2013 (art. L47 A-I LPF).
 * Génère un fichier `<SIREN>FEC<AAAAMMJJ_fin_exercice>.txt` en TSV UTF-8.
 *
 * Restriction métier : un exploitation valide (SIRET + SIREN) est requis,
 * sinon le fichier ne peut être nommé conformément au format imposé.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { genererFec, serialiserFec, validerEquilibre, type FecInputVente, type FecInputDepense } from '@/lib/comptabilite/fec'

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const exercice = parseInt(searchParams.get('exercice') || String(new Date().getFullYear()), 10)
  const check = searchParams.get('check') === '1'

  // Identité de l'exploitation requise
  const exploitation = await prisma.exploitation.findUnique({ where: { userId: session!.user.id } })
  if (!exploitation && !check) {
    return NextResponse.json(
      {
        error: 'Exploitation non configurée',
        details:
          "L'export FEC requiert l'identité légale (SIRET) de l'exploitation. Configurez-la dans /parametres/exploitation.",
      },
      { status: 409 }
    )
  }

  const start = new Date(exercice, 0, 1)
  const end = new Date(exercice, 11, 31, 23, 59, 59)
  const userId = session!.user.id

  const [ventes, depenses, factures] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: { userId, date: { gte: start, lte: end }, auto: { not: true } },
      orderBy: { date: 'asc' },
    }),
    prisma.depenseManuelle.findMany({
      where: { userId, date: { gte: start, lte: end }, auto: { not: true } },
      orderBy: { date: 'asc' },
    }),
    prisma.facture.findMany({
      where: { userId, date: { gte: start, lte: end }, statut: { not: 'annulee' } },
      orderBy: { date: 'asc' },
    }),
  ])

  const ventesIn: FecInputVente[] = ventes.map((v) => ({
    id: v.id,
    date: v.date,
    description: v.description,
    categorie: v.categorie,
    modeReglement: v.modeReglement,
    numeroPiece: v.numeroPiece,
    tauxTVA: v.tauxTVA,
    montant: v.montant,
    montantHT: v.montantHT,
    montantTVA: v.montantTVA,
    clientNom: v.clientNom,
    paye: v.paye,
  }))

  const depensesIn: FecInputDepense[] = depenses.map((d) => ({
    id: d.id,
    date: d.date,
    description: d.description,
    categorie: d.categorie,
    modeReglement: d.modeReglement,
    numeroPiece: d.numeroPiece,
    tauxTVA: d.tauxTVA,
    montant: d.montant,
    montantHT: d.montantHT,
    montantTVA: d.montantTVA,
    fournisseurNom: d.fournisseurNom,
    paye: d.paye,
  }))

  const facturesIn = factures.map((f) => ({
    id: f.id,
    numero: f.numero,
    type: f.type,
    date: f.date,
    statut: f.statut,
    clientNom: f.clientNom,
    totalHT: f.totalHT,
    totalTVA: f.totalTVA,
    totalTTC: f.totalTTC,
    totauxParTauxTva: f.totauxParTauxTva as Record<string, { ht: number; tva: number }> | null,
    modePaiement: f.modePaiement,
  }))

  const lignes = genererFec({ ventes: ventesIn, depenses: depensesIn, factures: facturesIn })
  const validation = validerEquilibre(lignes)

  if (check) {
    // Mode vérification : retourne JSON avec le résumé d'équilibre, sans fichier
    return NextResponse.json({
      exercice,
      nbEcritures: new Set(lignes.map((l) => l.EcritureNum)).size,
      nbLignes: lignes.length,
      validation,
      ventilation: {
        ventes: ventes.length,
        depenses: depenses.length,
        factures: factures.length,
      },
    })
  }

  const tsv = serialiserFec(lignes)
  const siren = exploitation!.siren
  const dateFin = `${exercice}1231`
  const filename = `${siren}FEC${dateFin}.txt`

  return new NextResponse(tsv, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // En-tête diagnostique non-standard mais utile pour debug
      'X-FEC-Equilibre': validation.equilibre ? 'OK' : `KO ecart=${validation.ecart}`,
      'X-FEC-Lignes': String(lignes.length),
    },
  })
}
