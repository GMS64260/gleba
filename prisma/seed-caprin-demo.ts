/**
 * Seed caprin laitier pour le compte démo (PROMPT 20-22).
 *
 * Rend démontrables les vues Lait (collecte, lactation, qualité/cellules,
 * palmarès) et Économie lait/fromage : le module lait était vide partout.
 *
 * IDEMPOTENT + non destructif : ne touche que le compte démo, s'arrête si des
 * collectes de lait existent déjà. N'affecte aucune autre donnée.
 * Lancement : `npx tsx prisma/seed-caprin-demo.ts`
 * Nettoyage : cf. `prisma/seed-caprin-demo-clean.ts`.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"

function atMidnightUTC(base: Date, addDays = 0): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + addDays)
  return d
}
const iso = (s: string) => new Date(s + "T00:00:00.000Z")

/** Courbe de lactation caprine réaliste (L/jour) : montée ~45 j puis déclin. */
function litresJour(dim: number, peak: number): number {
  if (dim <= 3) return Math.round(peak * 0.5 * 100) / 100
  const rise = Math.min(1, 0.5 + (dim / 45) * 0.5)
  const decline = dim <= 45 ? 1 : Math.exp(-(dim - 45) * 0.0045)
  const wobble = 1 + ((dim % 7) - 3) * 0.015 // ±4,5 % déterministe
  return Math.max(0.3, Math.round(peak * rise * decline * wobble * 100) / 100)
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: DEMO_EMAIL }, select: { id: true } })
  if (!user) {
    console.log(`Compte démo ${DEMO_EMAIL} introuvable — rien à faire.`)
    return
  }
  const userId = user.id

  // Garde d'idempotence
  const dejaLait = await prisma.collecteLait.count({ where: { userId } })
  if (dejaLait > 0) {
    console.log(`Le compte démo a déjà ${dejaLait} collectes de lait — seed ignoré (idempotent).`)
    return
  }

  // 1) Espèce caprine : catégorie réglementaire + productions multivaluées
  await prisma.especeAnimale.upsert({
    where: { id: "chevre_alpine" },
    update: { categorieReglementaire: "Caprin", productions: ["Lait", "Saillie"], production: "lait" },
    create: {
      id: "chevre_alpine",
      nom: "Chèvre Alpine chamoisée",
      type: "mammifere_grand",
      production: "lait",
      productions: ["Lait", "Saillie"],
      categorieReglementaire: "Caprin",
      dureeGestation: 150,
      poidsAdulte: 65,
      prixAchat: 350,
      couleur: "#a07050",
      description: "Chèvre laitière (~ 700 L/lactation)",
    },
  })

  // 2) Chèvres existantes
  const chevres = await prisma.animal.findMany({
    where: { userId, especeAnimaleId: "chevre_alpine", statut: "actif" },
    select: { id: true, nom: true },
    orderBy: { id: "asc" },
  })
  if (chevres.length === 0) {
    console.log("Aucune chèvre Alpine sur le compte démo — lancez d'abord le seed démo principal.")
    return
  }
  console.log(`${chevres.length} chèvres trouvées : ${chevres.map((c) => c.nom).join(", ")}`)

  // 3) Lot laitier + rattachement (pour affecter le coût alimentaire à 100 %)
  let lot = await prisma.lotAnimaux.findFirst({ where: { userId, nom: "Chèvres laitières 2026" } })
  if (!lot) {
    lot = await prisma.lotAnimaux.create({
      data: {
        userId,
        especeAnimaleId: "chevre_alpine",
        nom: "Chèvres laitières 2026",
        dateArrivee: iso("2026-01-01"),
        quantiteInitiale: chevres.length,
        quantiteActuelle: chevres.length,
        provenance: "Troupeau ferme",
        statut: "actif",
        notes: "Lot de conduite laitière (traite, alimentation).",
      },
    })
  }
  await prisma.animal.updateMany({
    where: { id: { in: chevres.map((c) => c.id) } },
    data: { lotId: lot.id },
  })

  // 4) Aliments (référentiel) + consommations mensuelles sur le lot
  // Valeurs INRA (par kg brut) pour le calculateur de ration (P25)
  const aliments = [
    { id: "foin_prairie_demo", nom: "Foin de prairie", type: "foin", prix: 0.18, especesCibles: "caprin", proteines: 9, ufl: 0.55, pdin: 50, pdie: 70, uel: 1.05 },
    { id: "granules_chevre_demo", nom: "Granulés chèvre laitière", type: "granules", prix: 0.42, especesCibles: "caprin", proteines: 17, ufl: 1.0, pdin: 115, pdie: 108, uel: 0.45 },
  ]
  for (const a of aliments) {
    const { id, ...rest } = a
    await prisma.aliment.upsert({ where: { id }, update: rest, create: a })
  }

  const now = new Date()
  const refToday = atMidnightUTC(now)

  // Profil de chaque chèvre : pic de lactation + date de mise-bas + cellules
  const profils = [
    { nom: "Bergère", peak: 4.5, miseBas: "2026-02-10", cellBase: 480, cellPente: 3 }, // top, saine
    { nom: "Clochette", peak: 3.6, miseBas: "2026-02-20", cellBase: 950, cellPente: 22 }, // mammite subclinique → alerte
    { nom: "Vanille", peak: 4.1, miseBas: "2026-03-05", cellBase: 620, cellPente: 9 }, // surveillance en fin de courbe
    { nom: "Praline", peak: 3.3, miseBas: "2026-03-15", cellBase: 520, cellPente: 4 }, // primipare, plus modeste
  ]

  let nbCollectes = 0
  let nbNaiss = 0

  for (const c of chevres) {
    const profil = profils.find((p) => p.nom === c.nom) || profils[profils.length - 1]
    const debut = iso(profil.miseBas)

    // 4a) Saillie ~150 j avant + mise-bas
    const dateSaillie = new Date(debut)
    dateSaillie.setUTCDate(dateSaillie.getUTCDate() - 150)
    const saillie = await prisma.saillie.create({
      data: {
        userId,
        date: dateSaillie,
        femelleId: c.id,
        type: "Monte naturelle",
        pereExterneRef: "Bouc Câlin (GAEC du Bocage)",
        dateMiseBasAttendue: debut,
        dateTarissementPrevue: (() => {
          const t = new Date(debut)
          t.setUTCFullYear(t.getUTCFullYear() + 1)
          t.setUTCDate(t.getUTCDate() - 60)
          return t
        })(),
        statut: "Mise-bas réalisée",
        notes: "Lutte automne 2025",
      },
    })
    const nbChevreaux = profil.nom === "Praline" ? 1 : 2
    await prisma.naissanceAnimale.create({
      data: {
        userId,
        mereId: c.id,
        pereIdentifiant: "Bouc Câlin",
        date: debut,
        nombreNes: nbChevreaux,
        nombreVivants: nbChevreaux,
        nombreMales: nbChevreaux === 2 ? 1 : 0,
        nombreFemelles: nbChevreaux === 2 ? 1 : 1,
        notes: "Mise-bas — origine lactation 2026",
        saillieId: saillie.id,
      },
    })
    nbNaiss++

    // 4b) Collectes matin/soir quotidiennes sur toute la lactation en cours
    const dimMax = Math.floor((refToday.getTime() - debut.getTime()) / 86_400_000)
    for (let dim = 0; dim <= dimMax; dim++) {
      const jour = atMidnightUTC(debut, dim)
      const total = litresJour(dim, profil.peak)
      const matin = Math.round(total * 0.54 * 100) / 100
      const soir = Math.round((total - matin) * 100) / 100

      // Analyses ~ mensuelles (contrôle laitier) sur la traite du matin
      const controle = dim % 30 <= 1
      const cellules = controle ? Math.round(profil.cellBase + profil.cellPente * dim) : null
      const mg = controle ? Math.round((36 + (dim % 5)) * 10) / 10 : null
      const mp = controle ? Math.round((30.5 + (dim % 4) * 0.4) * 10) / 10 : null

      await prisma.collecteLait.create({
        data: {
          userId, date: jour, traite: "Matin", animalId: c.id,
          quantiteLitres: matin, mgGpl: mg, mpGpl: mp, cellulesParMl: cellules,
        },
      })
      await prisma.collecteLait.create({
        data: {
          userId, date: jour, traite: "Soir", animalId: c.id, quantiteLitres: soir,
        },
      })
      nbCollectes += 2
    }
  }

  // 5) Consommations d'aliment mensuelles sur le lot (jan→juil)
  //    ~2,5 kg foin + 1 kg granulés / chèvre / jour → base 30 j × effectif.
  const nbTetes = chevres.length
  for (let m = 0; m < 7; m++) {
    const date = iso(`2026-0${m + 1}-05`)
    await prisma.consommationAliment.create({
      data: { userId, alimentId: "foin_prairie_demo", lotId: lot.id, date, quantite: Math.round(2.5 * 30 * nbTetes) },
    })
    await prisma.consommationAliment.create({
      data: { userId, alimentId: "granules_chevre_demo", lotId: lot.id, date, quantite: Math.round(1.0 * 30 * nbTetes) },
    })
  }

  // 6) Fabrications de fromage à partir de collectes non affectées
  const collectesLibres = await prisma.collecteLait.findMany({
    where: { userId, lotFromageId: null, ecarteAttente: false },
    orderBy: { date: "asc" },
    select: { id: true, date: true, quantiteLitres: true },
  })
  // Répartit les collectes en 3 lots chronologiques
  const fabricationsSpec = [
    { type: "Tomme de chèvre", semaine: "W16", rendement: 0.13, prixKg: 24 },
    { type: "Crottin", semaine: "W20", rendement: 0.16, prixKg: 32 },
    { type: "Bûche cendrée", semaine: "W24", rendement: 0.15, prixKg: 28 },
  ]
  const tiers = Math.floor(collectesLibres.length / 4) // ~1/4 du lait transformé par lot
  let curseur = 0
  const lotsFromageIds: { id: string; type: string; kg: number; prixKg: number }[] = []
  for (let i = 0; i < fabricationsSpec.length; i++) {
    const spec = fabricationsSpec[i]
    const slice = collectesLibres.slice(curseur, curseur + tiers)
    curseur += tiers
    if (slice.length === 0) continue
    const volume = Math.round(slice.reduce((s, c) => s + Number(c.quantiteLitres), 0) * 100) / 100
    const kg = Math.round(volume * spec.rendement * 100) / 100
    const nbPieces = Math.max(1, Math.round(kg / (spec.type === "Crottin" ? 0.09 : 0.25)))
    const dateFab = slice[slice.length - 1].date
    const dluo = new Date(dateFab)
    dluo.setUTCDate(dluo.getUTCDate() + (spec.type === "Tomme de chèvre" ? 60 : 21))
    const lf = await prisma.lotFromage.create({
      data: {
        userId,
        numeroLot: `L-2026-${spec.semaine}-01`,
        dateFabrication: dateFab,
        typeFromage: spec.type,
        volumeLaitUtiliseL: volume,
        nbPieces,
        poidsTotalKg: kg,
        dluo,
        traitementThermique: "cru",
        statutBioSnapshot: "Conventionnel",
      },
    })
    await prisma.collecteLait.updateMany({
      where: { id: { in: slice.map((c) => c.id) } },
      data: { lotFromageId: lf.id },
    })
    lotsFromageIds.push({ id: lf.id, type: spec.type, kg, prixKg: spec.prixKg })
  }

  // 7) Ventes : fromage (80 % écoulé) + un peu de lait cru
  for (const f of lotsFromageIds) {
    const kgVendus = Math.round(f.kg * 0.8 * 100) / 100
    if (kgVendus <= 0) continue
    await prisma.venteProduit.create({
      data: {
        userId,
        date: iso("2026-07-05"),
        type: "autre",
        description: f.type,
        quantite: kgVendus,
        unite: "kg",
        prixUnitaire: f.prixKg,
        prixTotal: Math.round(kgVendus * f.prixKg * 100) / 100,
        client: "Marché de La Roche-sur-Yon",
        paye: true,
        tauxTVA: 5.5,
        lotFromageId: f.id,
      },
    })
  }
  await prisma.venteProduit.create({
    data: {
      userId, date: iso("2026-06-15"), type: "lait", description: "Lait cru de chèvre",
      quantite: 120, unite: "L", prixUnitaire: 1.1, prixTotal: 132, client: "Fromagerie voisine",
      paye: true, tauxTVA: 5.5,
    },
  })

  console.log(`✅ Seed caprin : ${nbNaiss} mises-bas, ${nbCollectes} collectes, ${lotsFromageIds.length} lots fromage, ventes créées.`)
}

main()
  .catch((e) => { console.error("❌ ERREUR seed caprin:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
