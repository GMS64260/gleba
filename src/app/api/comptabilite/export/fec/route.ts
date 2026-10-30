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
import { montantVenteFruit, periodeVenteVerger } from '@/lib/verger/montant-vente'
import { TAUX_TVA_BOIS_PAR_DEFAUT } from '@/lib/verger/tva-bois'
import { genererFec, serialiserFec, validerEquilibre, type FecInputVente, type FecInputDepense } from '@/lib/comptabilite/fec'
import { getTerritoire, collecteTvaFrancaise } from '@/lib/territoires'
import { chargerSuiviDesSources, cleSource } from '@/lib/comptabilite/suivi-ecriture'
import { formatMontantFec } from '@/lib/comptabilite/fec-affichage'
import { chargerSoldesReglements } from '@/lib/comptabilite/reglements'
import { cleMiroirReglement, cleSourceReglement } from '@/lib/comptabilite/cle-reglement'
import { chargerFecReglements, verifierDeviseFec } from '@/lib/comptabilite/banque/fec-reglements'
import { deviseFactureReglement } from '@/lib/comptabilite/devise-reglement'
import { deviseDuTerritoire } from '@/lib/territoires'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'

export async function GET(request: NextRequest) {
  try { return await exporterFec(request) }
  catch (e) {
    if (e instanceof ErreurReglement) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
async function exporterFec(request: NextRequest) {
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

  if (exploitation && !/^\d{9}$/.test(exploitation.siren || '') && !check) {
    return NextResponse.json(
      { error: 'SIREN invalide', details: "L’export FEC exige un SIREN valide à 9 chiffres." },
      { status: 409 }
    )
  }

  // Le FEC est une obligation fiscale métropole + DROM (arrêté du 29/07/2013).
  // Les COM (Nouvelle-Calédonie, Polynésie, Wallis-et-Futuna…) relèvent d'une
  // fiscalité propre : l'export FEC métropolitain n'y est pas applicable.
  if (exploitation && !getTerritoire(exploitation.territoire).fecApplicable && !check) {
    const terr = getTerritoire(exploitation.territoire)
    return NextResponse.json(
      {
        error: 'FEC non applicable',
        details: `L'export FEC (format fiscal métropolitain) ne s'applique pas à ${terr.label}, qui relève d'une fiscalité propre.`,
      },
      { status: 422 }
    )
  }

  const start = new Date(exercice, 0, 1)
  const end = new Date(exercice, 11, 31, 23, 59, 59, 999)
  const userId = session!.user.id

  const [
    ventes,
    depenses,
    factures,
    ventesBois,
    ventesFruits,
    ventesElevage,
    ventesPotager,
    abattagesVendus,
  ] = await Promise.all([
    prisma.venteManuelle.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        OR: [
          { auto: { not: true } },
          {
            auto: true,
            sourceType: { in: ['commande_boutique', 'paie_lait', 'reservation_elevage'] },
          },
        ],
      },
      orderBy: { date: 'asc' },
    }),
    prisma.depenseManuelle.findMany({
      // Audit compta 2026-06 (lot 5) : SSOT dépenses = Σ DepenseManuelle AUTO
      // INCLUSES (aucune source brute de dépense n'est injectée par ailleurs,
      // contrairement aux ventes). Le FEC est ainsi aligné sur le KPI et la TVA.
      where: { userId, date: { gte: start, lte: end }, comptable: true },
      orderBy: { date: 'asc' },
    }),
    prisma.facture.findMany({
      // Audit compta 2026-06 : un brouillon (numéro provisoire BR-) n'est pas
      // une pièce comptable — il ne doit pas sortir dans le FEC.
      where: { userId, date: { gte: start, lte: end }, statut: { notIn: ['annulee', 'brouillon'] } },
      orderBy: { date: 'asc' },
      include: { lignes: true },
    }),
    // DEV3 #5 - Audit Marc : Ventes directes ProductionBois SANS facture
    // (sinon double-comptage). Compte 701820 (Ventes de bois et produits forestiers).
    prisma.productionBois.findMany({
      where: {
        userId,
        ...periodeVenteVerger(start, end),
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
        ...periodeVenteVerger(start, end),
        statut: 'vendu',
        factureId: null,
      },
      include: { arbre: { select: { espece: true, nom: true } } },
      orderBy: { dateVente: 'asc' },
    }),
    // BUG #14 (audit compta 2026-05-15) — Ventes élevage directes
    // (VenteProduit, type=oeufs/viande/lait/…) SANS facture. Avant elles
    // étaient comptées via VenteManuelle.auto=true puis FILTRÉES au FEC
    // (auto != true) → 1 vente perdue.
    prisma.venteProduit.findMany({
      where: { userId, date: { gte: start, lte: end }, factureId: null, annule: false },
      orderBy: { date: 'asc' },
    }),
    // BUG #14 — Récoltes potager vendues SANS facture.
    prisma.recolte.findMany({
      where: {
        userId,
        statut: 'vendu',
        dateVente: { gte: start, lte: end },
        OR: [{ prixTotal: { not: null } }, { prixKg: { not: null } }],
        factureId: null,
      },
      include: { espece: { select: { id: true } } },
      orderBy: { dateVente: 'asc' },
    }),
    // BUG #14 — Abattages vendus SANS facture liée.
    prisma.abattage.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
        prixVente: { not: null },
        factureId: null,
        annule: false,
        destination: 'vente',
      },
      orderBy: { date: 'asc' },
    }),
  ])

  // Ticket cmvgdzsf7 (revue du 2026-10-20) — le suivi d'une vente générée
  // (pièce, mode de règlement) vit sur son miroir `VenteManuelle`, que le FEC
  // n'exporte pas : il réinjecte la source brute ci-dessous. Sans relecture du
  // miroir, la pièce saisie dans Transactions n'atteignait jamais le FEC
  // (`ELEV-167` au lieu de `CHQ-0042`). Même helper que la liste Transactions.
  const suiviSources = await chargerSuiviDesSources(userId, {
    sources: [
      ...ventesBois.map((b) => ({ sourceType: 'production_bois', sourceId: b.id })),
      ...ventesFruits.map((r) => ({ sourceType: 'recolte_arbre', sourceId: r.id })),
      ...ventesElevage.map((v) => ({ sourceType: 'vente_produit', sourceId: v.id })),
      ...ventesPotager.map((r) => ({ sourceType: 'recolte', sourceId: r.id })),
      ...abattagesVendus.map((a) => ({ sourceType: 'abattage', sourceId: a.id })),
    ],
  })
  /**
   * Pièce et règlement d'une source réinjectée : ceux de son miroir quand ils
   * sont saisis, sinon la référence technique (`ELEV-<id>`…) et aucun mode.
   * La référence de la source reste lisible dans le libellé.
   */
  const deviseComptable = exploitation?.devise || deviseDuTerritoire(exploitation?.territoire)
  for (const f of factures) verifierDeviseFec(deviseFactureReglement(f.emetteurSnapshot, deviseComptable), deviseComptable)
  const [soldesDetail, journalReglements] = await Promise.all([
    chargerSoldesReglements(userId, [
      ...ventes.map((v) => cleMiroirReglement('vente', v)),
      ...depenses.map((d) => cleMiroirReglement('depense', d)),
      ...ventesBois.map((v) => cleSourceReglement('vente', 'production_bois', v.id)),
      ...ventesFruits.map((v) => cleSourceReglement('vente', 'recolte_arbre', v.id)),
      ...ventesElevage.map((v) => cleSourceReglement('vente', 'vente_produit', v.id)),
      ...ventesPotager.map((v) => cleSourceReglement('vente', 'recolte', v.id)),
      ...abattagesVendus.map((v) => cleSourceReglement('vente', 'abattage', v.id)),
    ]),
    chargerFecReglements(userId, start, end),
  ])
  function suiviDeLaSource(sourceType: string, sourceId: number, refSource: string, description: string) {
    const ecriture = suiviSources.parSource.get(cleSource(sourceType, sourceId))
    const suivi = ecriture?.suivi
    const piece = suivi?.numeroPiece?.trim()
    return {
      paye: ecriture?.paye ?? true,
      reglementDetaille: soldesDetail.has(cleSourceReglement('vente', sourceType, sourceId)),
      modeReglement: suivi?.modeReglement ?? null,
      numeroPiece: piece || refSource,
      description: piece ? `${description} (${refSource})` : description,
    }
  }

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
    reglementDetaille: soldesDetail.has(cleMiroirReglement('vente', v)),
  }))

  // DEV3 #5 - Injection des ventes ProductionBois (sans facture) au FEC.
  // Catégorie 'bois' → compte 701820 ; même taux par défaut que la vente native.
  // Numéro pièce = celle saisie sur le miroir, sinon "BOIS-{id}" pour éviter
  // la collision avec les ventes manuelles.
  function categorieBois(qualite: string | null): string {
    if (!qualite) return 'bois'
    if (qualite === "Bois d'œuvre") return 'bois_oeuvre'
    if (qualite === 'Bois de chauffage') return 'bois_chauffage'
    if (qualite === 'BRF' || qualite === 'Plaquette') return 'bois_brf'
    return 'bois'
  }
  for (const b of ventesBois) {
    const ttc = b.prixVente as number
    // Audit compta 2026-06 : 10 % — aligné sur l'écriture auto et la facture
    // bois (auto-compta.ts, arbres/bois/[id]) ; le FEC sortait 20 %.
    const tauxTVA = TAUX_TVA_BOIS_PAR_DEFAUT
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    const desc = `Vente bois — ${b.arbre?.espece || b.arbre?.nom || b.qualiteBois || 'lot'} (${b.numLot ?? `#${b.id}`})`
    ventesIn.push({
      id: 1_000_000 + b.id,           // décalage pour éviter collision id
      date: b.dateVente ?? b.date,
      categorie: categorieBois(b.qualiteBois),
      ...suiviDeLaSource('production_bois', b.id, `BOIS-${b.id}`, desc),
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: b.clientNom,
    })
  }
  // DEV3 #5 - Injection ventes RecolteArbre directes (sans facture)
  for (const r of ventesFruits) {
    const ttc = montantVenteFruit(r)
    if (ttc <= 0) continue
    const tauxTVA = 5.5  // Fruits frais : 5.5% TVA réduite
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    const desc = `Vente fruits — ${r.arbre?.espece || r.arbre?.nom || 'lot'} (${r.numLot ?? `#${r.id}`})`
    ventesIn.push({
      id: 2_000_000 + r.id,
      date: r.dateVente ?? r.date,
      categorie: 'fruits',
      ...suiviDeLaSource('recolte_arbre', r.id, `FRUIT-${r.id}`, desc),
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: r.clientNom,
    })
  }

  // BUG #14 (audit compta 2026-05-15) — Injection des sources élevage,
  // potager et abattage SANS facture. Avant : ces sources généraient une
  // VenteManuelle auto qui était ensuite filtrée du FEC → vente perdue.
  // Maintenant chacune apparaît avec son compte 701 dédié.
  function categorieElevage(type: string | null): string {
    switch (type) {
      case 'oeufs': return 'oeufs'
      case 'viande': return 'viande'
      case 'animal_vivant': return 'animaux_vivants'
      case 'lait': return 'produits_transformes'
      case 'fromage': return 'produits_transformes'
      case 'miel':
      case 'cire':
      case 'propolis':
      case 'pollen':
      case 'gelee_royale':
      case 'autre_ruche':
        return 'produits_ruche'
      case 'autre':
      default: return 'autre'
    }
  }
  for (const v of ventesElevage) {
    const ttc = v.prixTotal
    // Audit compta 2026-06 : taux réel de la vente (le FEC hardcodait 5,5 %
    // même pour une vente saisie à 10/20 %)
    const tauxTVA = v.tauxTVA ?? 5.5
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    ventesIn.push({
      id: 3_000_000 + v.id,
      date: v.date,
      categorie: categorieElevage(v.type),
      ...suiviDeLaSource('vente_produit', v.id, `ELEV-${v.id}`, v.description || `Vente ${v.type} (${v.quantite} ${v.unite})`),
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: v.client,
      paye: v.paye,
    })
  }
  for (const r of ventesPotager) {
    const ttc = r.prixTotal || r.quantite * (r.prixKg || 0)
    const tauxTVA = 5.5
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    ventesIn.push({
      id: 4_000_000 + r.id,
      date: r.dateVente ?? r.date,
      categorie: 'legumes',
      ...suiviDeLaSource('recolte', r.id, `RECOLTE-${r.id}`, `Vente récolte — ${r.espece?.id || r.especeId || 'lot'} (#${r.id})`),
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: r.clientNom,
      paye: true,
    })
  }
  for (const a of abattagesVendus) {
    const ttc = a.prixVente as number
    const tauxTVA = 5.5
    const ht = Math.round((ttc / (1 + tauxTVA / 100)) * 100) / 100
    const tva = Math.round((ttc - ht) * 100) / 100
    ventesIn.push({
      id: 5_000_000 + a.id,
      date: a.date,
      categorie: 'viande',
      ...suiviDeLaSource('abattage', a.id, `ABATT-${a.id}`, `Vente viande abattage #${a.id}${a.poidsCarcasse ? ` (${a.poidsCarcasse} kg)` : ''}`),
      tauxTVA,
      montant: ttc,
      montantHT: ht,
      montantTVA: tva,
      clientNom: null, // Abattage n'a pas de clientNom au modèle
      // Pointage du miroir ; sans miroir, vente présumée payée (décision du 2026-10-30).
      paye: suiviSources.parSource.get(cleSource('abattage', a.id))?.paye ?? true,
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
    reglementDetaille: soldesDetail.has(cleMiroirReglement('depense', d)),
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
    if (/miel|cire|propolis|pollen|gelée royale|gelee[_ ]royale|autre_ruche|produit de la ruche/.test(d)) return "produits_ruche"
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

  // Régime hors champ TVA française (293B, non-assujetti, TGC) : pas de ligne
  // de TVA au FEC (les écritures auto/manuelles ont un taux 5,5/20 par défaut
  // qui contredirait le régime déclaré — audit 2026-07 #10).
  const sansTva = !collecteTvaFrancaise(exploitation?.regimeTva)
  const lignes = genererFec({ ventes: ventesIn, depenses: depensesIn, factures: facturesIn, sansTva, exercice, ...journalReglements })
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

  if (!validation.equilibre) {
    return NextResponse.json(
      { error: 'FEC déséquilibré', details: `Écart débit/crédit : ${formatMontantFec(validation.ecart)}` },
      { status: 422 }
    )
  }

  const tsv = serialiserFec(lignes)
  const siren = exploitation!.siren!
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
