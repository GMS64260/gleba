import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit"
import { z } from "zod"
import { requireAuthApi } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import { csvCell, empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"
import { reconstituerEffectifsLots } from "@/lib/elevage/effectif"
import {
  dessinerEnteteTableauPdf,
  dessinerLigneTableauPdf,
  hauteurLignePdf,
  lignePdfEstTronquee,
  type ColonnePdf,
} from "@/lib/pdf-table"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const formatSchema = z.enum(["pdf", "csv"]).default("pdf")

function dateUtc(value: string) {
  const date = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null
  }
  return date
}

function dateCouranteUtc() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: Date | null | undefined) {
  return value?.toLocaleDateString("fr-FR", { timeZone: "UTC" }) ?? "—"
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error

  const params = new URL(request.url).searchParams
  const parsed = z.object({
    date: dateSchema.default(dateCouranteUtc()),
    format: formatSchema,
  }).safeParse({
    date: params.get("date") ?? undefined,
    format: params.get("format") ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Date ou format invalide" }, { status: 400 })
  }

  const situationAu = dateUtc(parsed.data.date)
  if (!situationAu || parsed.data.date > dateCouranteUtc()) {
    return NextResponse.json(
      { error: "La date d’inventaire doit être valide et ne peut pas être future" },
      { status: 400 },
    )
  }

  const userId = session.user.id
  const [animauxBruts, lotsBruts, exploitation] = await Promise.all([
    prisma.animal.findMany({
      where: { userId },
      orderBy: [{ especeAnimaleId: "asc" }, { identifiant: "asc" }, { id: "asc" }],
      select: {
        id: true,
        identifiant: true,
        nom: true,
        sexe: true,
        dateNaissance: true,
        dateArrivee: true,
        dateSortie: true,
        createdAt: true,
        race: true,
        pereIdentifiant: true,
        mereIdentifiant: true,
        especeAnimale: { select: { nom: true, categorieReglementaire: true } },
        raceAnimale: { select: { nom: true } },
        lot: { select: { nom: true } },
        mere: { select: { identifiant: true, nom: true } },
        pere: { select: { identifiant: true, nom: true } },
      },
    }),
    prisma.lotAnimaux.findMany({
      where: { userId },
      orderBy: [{ especeAnimaleId: "asc" }, { nom: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nom: true,
        dateArrivee: true,
        dateReforme: true,
        createdAt: true,
        statut: true,
        quantiteInitiale: true,
        quantiteActuelle: true,
        especeAnimale: { select: { nom: true, categorieReglementaire: true } },
      },
    }),
    prisma.exploitation.findUnique({
      where: { userId },
      select: {
        raisonSociale: true,
        numeroEde: true,
        adresseSiege: true,
        codePostal: true,
        ville: true,
      },
    }),
  ])

  const animaux = animauxBruts.filter((animal) => {
    const entree = animal.dateArrivee ?? animal.dateNaissance ?? animal.createdAt
    return entree <= situationAu && (!animal.dateSortie || animal.dateSortie > situationAu)
  })
  const estDateCourante = parsed.data.date === dateCouranteUtc()
  const lotsPresents = lotsBruts.filter((lot) => {
    const entree = lot.dateArrivee ?? lot.createdAt
    if (entree > situationAu || lot.quantiteActuelle <= 0) return false
    if (lot.dateReforme && lot.dateReforme <= situationAu) return false
    if (estDateCourante && lot.statut !== "actif") return false
    return true
  })
  // QA caprin cms1v227a — les fiches nominatives rattachées à un lot sont déjà
  // listées en lignes INDIVIDU : la quantité du lot ne doit compter que la part
  // collective (effectif reconstitué − nominatifs), sinon double comptage.
  const effectifsInventaire = await reconstituerEffectifsLots(userId, lotsPresents)
  const quantiteCollective = (lotId: number, fallback: number) => {
    const eff = effectifsInventaire.get(lotId)
    return eff ? Math.max(0, eff.effectifCalcule - eff.nominatifsActifs) : fallback
  }
  const lots = lotsPresents.map((lot) => ({
    ...lot,
    quantiteCollective: quantiteCollective(lot.id, lot.quantiteActuelle),
  }))

  const snapshot = {
    version: 1,
    situationAu: parsed.data.date,
    numeroEde: exploitation?.numeroEde ?? null,
    animaux: animaux.map((animal) => ({
      id: animal.id,
      identifiant: animal.identifiant,
      espece: animal.especeAnimale.nom,
      dateArrivee: animal.dateArrivee?.toISOString() ?? null,
      dateSortie: animal.dateSortie?.toISOString() ?? null,
    })),
    lots: lots.map((lot) => ({
      id: lot.id,
      espece: lot.especeAnimale.nom,
      quantite: lot.quantiteCollective,
      dateArrivee: lot.dateArrivee?.toISOString() ?? null,
      dateReforme: lot.dateReforme?.toISOString() ?? null,
    })),
  }
  const snapshotHash = empreinteDeclaration(snapshot)
  const avertissements = [
    !exploitation?.numeroEde ? "Numéro EDE de l’exploitation manquant." : null,
    !estDateCourante && lots.length
      ? "Les quantités des lots collectifs sont les quantités courantes : Gleba ne dispose pas encore d’un historique suffisant pour reconstituer leur effectif exact à cette date."
      : null,
    "Cet inventaire est reconstitué depuis les données Gleba et doit être rapproché de l’inventaire physique et des données EDE.",
  ].filter((item): item is string => Boolean(item))

  const journaliserGeneration = () => journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: `inventaire:${parsed.data.date}`,
    action: "INVENTAIRE_CHEPTEL_GENERE",
    actorUserId: acteurReglementaire(session.user),
    snapshotHash,
    metadata: {
      date: parsed.data.date,
      format: parsed.data.format,
      animauxIndividuels: animaux.length,
      animauxEnLots: lots.reduce((total, lot) => total + lot.quantiteCollective, 0),
      avertissements,
    },
  })

  if (parsed.data.format === "csv") {
    const entete = [
      "Type",
      "Espèce",
      "Catégorie réglementaire",
      "Identifiant / lot",
      "Nom",
      "Sexe",
      "Date de naissance",
      "Race",
      "Lot de rattachement",
      "Quantité",
    ]
    const lignes = [
      ...animaux.map((animal) => [
        "INDIVIDU",
        animal.especeAnimale.nom,
        animal.especeAnimale.categorieReglementaire,
        animal.identifiant || `#${animal.id}`,
        animal.nom,
        animal.sexe,
        animal.dateNaissance?.toISOString().slice(0, 10),
        animal.raceAnimale?.nom || animal.race,
        animal.lot?.nom,
        1,
      ]),
      ...lots.map((lot) => [
        "LOT_COLLECTIF",
        lot.especeAnimale.nom,
        lot.especeAnimale.categorieReglementaire,
        `lot:${lot.id}`,
        lot.nom,
        null,
        null,
        null,
        null,
        lot.quantiteCollective,
      ]),
    ]
    const commentaires = avertissements.map((item) => [csvCell(`# ${item}`)])
    const csv = `\uFEFF${[
      ...commentaires,
      entete.map(csvCell),
      ...lignes.map((ligne) => ligne.map(csvCell)),
    ].map((ligne) => ligne.join(";")).join("\r\n")}\r\n`
    await journaliserGeneration()
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventaire-cheptel-${parsed.data.date}.csv"`,
        "Cache-Control": "private, no-store",
      },
    })
  }

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 30,
    bufferPages: true,
  })
  const chunks: Buffer[] = []
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a")
      .text("Inventaire reconstitué du cheptel")
    doc.font("Helvetica").fontSize(9).fillColor("#475569")
      .text(`Situation au ${formatDate(situationAu)}`)
    if (exploitation) {
      doc.text(
        `${exploitation.raisonSociale}${exploitation.numeroEde ? ` · EDE ${exploitation.numeroEde}` : ""} · ${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`,
      )
    }
    doc.moveDown(0.6)
    for (const avertissement of avertissements) {
      doc.fillColor("#9a3412").text(`• ${avertissement}`)
    }

    type AnimalInventaire = (typeof animaux)[number]
    const colonnesAnimaux: ColonnePdf<AnimalInventaire>[] = [
      { titre: "Espèce", x: 30, largeur: 75, valeur: (animal) => animal.especeAnimale.nom },
      {
        titre: "Identifiant / nom",
        x: 110,
        largeur: 140,
        valeur: (animal) => `${animal.identifiant || `#${animal.id}`}${animal.nom ? ` (${animal.nom})` : ""}`,
      },
      { titre: "Sexe", x: 255, largeur: 45, valeur: (animal) => animal.sexe || "—" },
      { titre: "Naissance", x: 305, largeur: 60, valeur: (animal) => formatDate(animal.dateNaissance) },
      { titre: "Race", x: 370, largeur: 80, valeur: (animal) => animal.raceAnimale?.nom || animal.race || "—" },
      { titre: "Lot", x: 455, largeur: 90, valeur: (animal) => animal.lot?.nom || "—" },
      {
        titre: "Mère",
        x: 550,
        largeur: 110,
        valeur: (animal) => animal.mere?.identifiant
          || animal.mere?.nom
          || animal.mereIdentifiant
          || "—",
      },
      {
        titre: "Père",
        x: 665,
        largeur: 110,
        valeur: (animal) => animal.pere?.identifiant
          || animal.pere?.nom
          || animal.pereIdentifiant
          || "—",
      },
    ]
    let y = Math.max(doc.y + 18, 130)
    y = dessinerEnteteTableauPdf(doc, colonnesAnimaux, y)
    const animauxTronques: AnimalInventaire[] = []
    for (const animal of animaux) {
      const hauteur = hauteurLignePdf(doc, animal, colonnesAnimaux, {
        taillePolice: 7,
        hauteurMax: 40,
      })
      if (y + hauteur > 540) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
          .text(`Inventaire individuel au ${formatDate(situationAu)} · suite`)
        y = dessinerEnteteTableauPdf(doc, colonnesAnimaux, 58)
      }
      if (lignePdfEstTronquee(doc, animal, colonnesAnimaux, {
        taillePolice: 7,
        hauteurMax: 40,
      })) {
        animauxTronques.push(animal)
      }
      y = dessinerLigneTableauPdf(doc, animal, colonnesAnimaux, y, {
        taillePolice: 7,
        hauteurMax: 40,
        fond: animal.id % 2 === 0 ? "#f8fafc" : undefined,
      })
    }

    y += 12
    if (y > 520) {
      doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
      y = 42
    }
    doc.font("Helvetica-Bold").fontSize(12).text("Animaux suivis collectivement", 30, y)
    y += 20
    type LotInventaire = (typeof lots)[number]
    const colonnesLots: ColonnePdf<LotInventaire>[] = [
      { titre: "Espèce", x: 30, largeur: 120, valeur: (lot) => lot.especeAnimale.nom },
      { titre: "Lot", x: 155, largeur: 500, valeur: (lot) => lot.nom || `Lot #${lot.id}` },
      {
        titre: "Effectif collectif courant",
        x: 660,
        largeur: 115,
        valeur: (lot) => String(lot.quantiteCollective),
        align: "right",
      },
    ]
    y = dessinerEnteteTableauPdf(doc, colonnesLots, y)
    const lotsTronques: LotInventaire[] = []
    for (const lot of lots) {
      const hauteur = hauteurLignePdf(doc, lot, colonnesLots, {
        taillePolice: 8,
        hauteurMax: 32,
      })
      if (y + hauteur > 540) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
          .text(`Inventaire collectif au ${formatDate(situationAu)} · suite`)
        y = dessinerEnteteTableauPdf(doc, colonnesLots, 58)
      }
      if (lignePdfEstTronquee(doc, lot, colonnesLots, {
        taillePolice: 8,
        hauteurMax: 32,
      })) {
        lotsTronques.push(lot)
      }
      y = dessinerLigneTableauPdf(doc, lot, colonnesLots, y, {
        taillePolice: 8,
        hauteurMax: 32,
        fond: lot.id % 2 === 0 ? "#f8fafc" : undefined,
      })
    }
    if (!animaux.length && !lots.length) {
      doc.text("Aucun animal présent selon les données disponibles à cette date.", 30, y)
    }
    if (animauxTronques.length || lotsTronques.length) {
      doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a")
        .text("Annexe · valeurs intégrales des cellules abrégées")
      doc.font("Helvetica").fontSize(8).fillColor("#475569")
        .text("Le tableau limite la hauteur des lignes pour rester lisible. Les valeurs complètes concernées sont reproduites ci-dessous.")
      y = doc.y + 12
      const detail = (contenu: string) => {
        doc.font("Helvetica").fontSize(8)
        const hauteur = doc.heightOfString(contenu, { width: 760 }) + 7
        if (y + hauteur > 535) {
          doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
          doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a")
            .text("Annexe inventaire · suite")
          y = 58
        }
        doc.font("Helvetica").fontSize(8).fillColor("#1e293b")
          .text(contenu, 30, y, { width: 760 })
        y += hauteur
      }
      for (const animal of animauxTronques) {
        detail(
          `${animal.identifiant || `#${animal.id}`} · ${animal.nom || "sans nom"} · ${animal.especeAnimale.nom} · ${animal.sexe || "sexe non renseigné"} · naissance ${formatDate(animal.dateNaissance)} · race ${animal.raceAnimale?.nom || animal.race || "non renseignée"} · lot ${animal.lot?.nom || "—"} · mère ${animal.mere?.identifiant || animal.mere?.nom || animal.mereIdentifiant || "—"} · père ${animal.pere?.identifiant || animal.pere?.nom || animal.pereIdentifiant || "—"}`,
        )
      }
      for (const lot of lotsTronques) {
        detail(
          `Lot ${lot.id} · ${lot.especeAnimale.nom} · ${lot.nom || "sans nom"} · effectif collectif courant ${lot.quantiteCollective}`,
        )
      }
    }

    const range = doc.bufferedPageRange()
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index)
      doc.font("Helvetica").fontSize(7).fillColor("#64748b")
        .text(
          `Page ${index + 1}/${range.count} · Empreinte ${snapshotHash}`,
          30,
          550,
          { width: 780, align: "right", lineBreak: false },
        )
    }
    doc.end()
  })
  await journaliserGeneration()

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inventaire-cheptel-${parsed.data.date}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
