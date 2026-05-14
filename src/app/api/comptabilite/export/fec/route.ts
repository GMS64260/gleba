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

  const [ventes, depenses, factures, ventesBois, ventesFruits] = await Promise.all([
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
      include: { lignes: true },
    }),
    // DEV3 #5 - Audit Marc : Ventes directes ProductionBois SANS facture
    // (sinon double-comptage). Compte 701820 (Ventes de bois et produits forestiers).
    prisma.productionBois.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        statut: 'vendu',
        prixVente: { not: null },
        factureId: null,
      },
      include: { arbre: { select: { espece: true, nom: true } } },
      orderBy: { dateVente: 'asc' },
    }),
    // DEV3 #5 - Ventes directes RecolteArbre SANS facture (compte 701200 fruits)
    prisma.recolteArbre.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        statut: 'vendu',
        prixTotal: { not: null },
        factureId: null,
      },
      include: { arbre: { select: { espece: true, nom: true } } },
      orderBy: { dateVente: 'asc' },
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

  // DEV3 #5 - Injection des ventes ProductionBois (sans facture) au FEC.
  // Catégorie 'bois' → compte 701820. TVA 20% par défaut (bois énergie : 10%
  // si applicable mais conservons 20% en standard, l'opérateur peut éditer).
  // Numéro pièce = "BOIS-{id}" pour éviter collision avec les ventes manuelles.
  function categorieBois(qualite: string | null): string {
    if (!qualite) return 'bois'
    if (qualite === "Bois d'œuvre") return 'bois_oeuvre'
    if (qualite === 'Bois de chauffage') return 'bois_chauffage'
    if (qualite === 'BRF' || qualite === 'Plaquette') return 'bois_brf'
    return 'bois'
  }
  for (const b of ventesBois) {
    const ttc = b.prixVente as number
    const tauxTVA = 20
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    const desc = `Vente bois — ${b.arbre?.espece || b.arbre?.nom || b.qualiteBois || 'lot'} (${b.numLot ?? `#${b.id}`})`
    ventesIn.push({
      id: 1_000_000 + b.id,           // décalage pour éviter collision id
      date: b.dateVente ?? b.date,
      description: desc,
      categorie: categorieBois(b.qualiteBois),
      modeReglement: null,
      numeroPiece: `BOIS-${b.id}`,
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: b.clientNom,
      paye: true,
    })
  }
  // DEV3 #5 - Injection ventes RecolteArbre directes (sans facture)
  for (const r of ventesFruits) {
    const ttc = r.prixTotal as number
    const tauxTVA = 5.5  // Fruits frais : 5.5% TVA réduite
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    const desc = `Vente fruits — ${r.arbre?.espece || r.arbre?.nom || 'lot'} (${r.numLot ?? `#${r.id}`})`
    ventesIn.push({
      id: 2_000_000 + r.id,
      date: r.dateVente ?? r.date,
      description: desc,
      categorie: 'fruits',
      modeReglement: null,
      numeroPiece: `FRUIT-${r.id}`,
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: r.clientNom,
      paye: true,
    })
  }

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

  // POSTREVIEW — Heuristique de catégorisation des lignes de facture pour
  // ventilation comptable. Le modèle LigneFacture n'a pas de champ `categorie`
  // explicite : on déduit depuis la description.
  function categoriseLigne(description: string): string {
    const d = (description || "").toLowerCase()
    if (/légume|legume|carotte|tomate|courge|salade|poireau|chou|haricot|épinard/.test(d)) return "legumes"
    if (/fruit|pomme|poire|abricot|cerise|prune|fraise|raisin|figue/.test(d)) return "fruits"
    if (/œuf|oeuf/.test(d)) return "oeufs"
    if (/viande|poulet|porc|agneau|veau|bœuf|boeuf|lapin/.test(d)) return "viande"
    if (/bois|stère|stere/.test(d)) return "bois"
    if (/lait|fromage|tomme|crottin|brique/.test(d)) return "produits_transformes"
    if (/service|prestation|main-d'?œuvre|main d'?oeuvre|formation|conseil/.test(d)) return "service"
    return "autre"
  }

  const facturesIn = factures.map((f) => ({
    id: f.id,
    numero: f.numero,
    type: f.type,
    date: f.date,
    statut: f.statut,
    clientId: f.clientId,
    clientNom: f.clientNom,
    totalHT: f.totalHT,
    totalTVA: f.totalTVA,
    totalTTC: f.totalTTC,
    totauxParTauxTva: f.totauxParTauxTva as Record<string, { ht: number; tva: number }> | null,
    modePaiement: f.modePaiement,
    lignes: f.lignes.map((l) => ({
      description: l.description,
      categorie: categoriseLigne(l.description),
      montantHT: l.montantHT,
      montantTVA: l.montantTVA,
      tauxTVA: l.tauxTVA,
    })),
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
