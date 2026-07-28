import { NextRequest, NextResponse } from "next/server"
import PDFDocument from "pdfkit"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { requireAuthApi } from "@/lib/auth-utils"
import { reconstituerEffectifsLots } from "@/lib/elevage/effectif"
import prisma from "@/lib/prisma"
import {
  construireArchiveRegistre,
  type PieceArchiveRegistre,
} from "@/lib/elevage/archive-registre.server"
import {
  acteurReglementaire,
  journaliserEvenementReglementaire,
} from "@/lib/elevage/audit-reglementaire"
import {
  LABELS_ROLE_INTERVENANT,
  LABELS_STATUT_INTERVENANT,
  LABELS_TYPE_LIEU,
  manquesCadreReglementaire,
  type RoleIntervenantElevage,
  type StatutIntervenantElevage,
} from "@/lib/elevage/cadre-reglementaire"
import { empreinteDeclaration } from "@/lib/elevage/declarations-reglementaires"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"
import {
  LABELS_TYPE_JUSTIFICATIF_ALIMENT,
  type TypeJustificatifAliment,
} from "@/lib/elevage/justificatifs-aliments"
import {
  LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE,
  type TypeJustificatifEquarrissage,
} from "@/lib/elevage/justificatifs-equarrissage"
import { identifiantLegalAffichage } from "@/lib/territoires"

const currentYear = () => new Date().getUTCFullYear()
const yearSchema = z.coerce.number().int().min(1990).max(currentYear() + 1)
const formatSchema = z.enum(["pdf", "archive"]).default("pdf")

const formatDate = (date: Date | string | null | undefined) =>
  date ? new Date(date).toLocaleDateString("fr-FR") : "—"

const texteNormalise = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

type LigneMouvement = {
  date: Date
  type: string
  espece: string
  cible: string
  origine: string
  destination: string
  motif: string
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const params = new URL(request.url).searchParams
  const rawYear = params.get("year") ?? String(currentYear())
  const parsedYear = yearSchema.safeParse(rawYear)
  if (!parsedYear.success) {
    return NextResponse.json({ error: "Année invalide" }, { status: 400 })
  }
  const parsedFormat = formatSchema.safeParse(params.get("format") ?? "pdf")
  if (!parsedFormat.success) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 })
  }
  const year = parsedYear.data
  const format = parsedFormat.data
  const userId = session.user.id
  const debut = new Date(Date.UTC(year, 0, 1))
  const fin = new Date(Date.UTC(year + 1, 0, 1))
  const maintenant = new Date()

  const [
    exploitation,
    animaux,
    lots,
    naissances,
    abattages,
    soins,
    prophylaxies,
    pharmacie,
    consommationsAliments,
    justificatifsAliments,
    justificatifsEquarrissage,
    declarations,
  ] = await Promise.all([
    prisma.exploitation.findUnique({
      where: { userId },
      include: {
        lieuxDetentionElevage: {
          orderBy: [{ type: "asc" }, { nom: "asc" }],
          include: { parent: { select: { nom: true } } },
        },
        intervenantsElevage: {
          orderBy: [{ role: "asc" }, { nom: "asc" }],
        },
      },
    }),
    prisma.animal.findMany({
      where: {
        userId,
        OR: [
          { statut: "actif" },
          { dateArrivee: { gte: debut, lt: fin } },
          { dateSortie: { gte: debut, lt: fin } },
        ],
      },
      orderBy: [{ especeAnimaleId: "asc" }, { identifiant: "asc" }],
      select: {
        id: true,
        identifiant: true,
        nom: true,
        sexe: true,
        race: true,
        statut: true,
        dateNaissance: true,
        dateArrivee: true,
        dateSortie: true,
        provenance: true,
        nExploitationOrigine: true,
        nExploitationDestination: true,
        motifSortie: true,
        causeSortie: true,
        ficheNaissance: { select: { id: true } },
        lot: { select: { nom: true } },
        especeAnimale: { select: { nom: true } },
        raceAnimale: { select: { nom: true } },
      },
    }),
    prisma.lotAnimaux.findMany({
      where: {
        userId,
        OR: [
          { statut: "actif" },
          { dateArrivee: { gte: debut, lt: fin } },
          { dateReforme: { gte: debut, lt: fin } },
        ],
      },
      orderBy: [{ especeAnimaleId: "asc" }, { nom: "asc" }],
      include: { especeAnimale: { select: { nom: true } } },
    }),
    prisma.naissanceAnimale.findMany({
      where: { userId, date: { gte: debut, lt: fin } },
      orderBy: { date: "asc" },
      include: {
        mere: { select: { identifiant: true, nom: true, especeAnimale: { select: { nom: true } } } },
        lot: { select: { id: true, nom: true, especeAnimale: { select: { nom: true } } } },
        petits: { select: { boucleDefinitive: true, boucleProvisoire: true, sexe: true, vivant: true } },
      },
    }),
    prisma.abattage.findMany({
      where: { userId, annule: false, date: { gte: debut, lt: fin } },
      orderBy: { date: "asc" },
      include: {
        animal: { select: { id: true, identifiant: true, nom: true, especeAnimale: { select: { nom: true } } } },
        lot: { select: { id: true, nom: true, especeAnimale: { select: { nom: true } } } },
      },
    }),
    prisma.soinAnimal.findMany({
      where: { userId, date: { gte: debut, lt: fin } },
      orderBy: { date: "asc" },
      include: {
        animal: { select: { id: true, identifiant: true, nom: true } },
        lot: { select: { id: true, nom: true } },
        produitVeterinaire: {
          select: { nom: true, amm: true, substanceActive: true, ordonnanceObligatoire: true },
        },
        injections: {
          orderBy: { numero: "asc" },
          select: { numero: true, datePrevue: true, dateRealisee: true, statut: true },
        },
      },
    }),
    prisma.prophylaxieElevage.findMany({
      where: { userId, datePrevue: { gte: debut, lt: fin } },
      orderBy: { datePrevue: "asc" },
    }),
    prisma.stockMedicamentElevage.findMany({
      where: { userId },
      orderBy: [{ datePeremption: "asc" }, { produitId: "asc" }],
      include: { produit: { select: { nom: true, amm: true } } },
    }),
    prisma.consommationAliment.findMany({
      where: { userId, date: { gte: debut, lt: fin } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: {
        aliment: { select: { id: true, nom: true } },
        animal: { select: { id: true, identifiant: true, nom: true } },
        lot: { select: { id: true, nom: true } },
      },
    }),
    prisma.justificatifAlimentElevage.findMany({
      where: {
        userId,
        archivedAt: null,
        dateDocument: { gte: debut, lt: fin },
      },
      orderBy: [{ dateDocument: "asc" }, { createdAt: "asc" }],
      include: { aliment: { select: { id: true, nom: true } } },
    }),
    prisma.justificatifEquarrissageElevage.findMany({
      where: {
        userId,
        archivedAt: null,
        OR: [
          { dateEnlevement: { gte: debut, lt: fin } },
          {
            animaux: {
              some: { animal: { dateSortie: { gte: debut, lt: fin } } },
            },
          },
        ],
      },
      orderBy: [{ dateEnlevement: "asc" }, { createdAt: "asc" }],
      include: {
        animaux: {
          include: {
            animal: {
              select: {
                id: true,
                identifiant: true,
                nom: true,
                dateSortie: true,
                causeSortie: true,
                especeAnimale: { select: { nom: true } },
              },
            },
          },
        },
      },
    }),
    chargerDeclarationsReglementaires(userId, { year, maintenant }),
  ])

  const inventaireAnimaux = animaux.filter((animal) => animal.statut === "actif")
  const inventaireLots = lots.filter((lot) => lot.statut === "actif" && lot.quantiteActuelle > 0)
  // QA caprin cms1v227a — les fiches nominatives rattachees a un lot sont deja
  // listees individuellement : le lot n'affiche que sa part collective.
  const effectifsRegistre = await reconstituerEffectifsLots(userId, inventaireLots)
  const partCollective = (lot: { id: number; quantiteActuelle: number }) => {
    const eff = effectifsRegistre.get(lot.id)
    return eff ? Math.max(0, eff.effectifCalcule - eff.nominatifsActifs) : lot.quantiteActuelle
  }
  const lieuxPeriode = (exploitation?.lieuxDetentionElevage ?? []).filter((lieu) =>
    lieu.createdAt < fin && (!lieu.archivedAt || lieu.archivedAt >= debut),
  )
  const intervenantsPeriode = (exploitation?.intervenantsElevage ?? []).filter((intervenant) =>
    (intervenant.dateDebut ?? intervenant.createdAt) < fin
    && (!intervenant.dateFin || intervenant.dateFin >= debut)
    && (!intervenant.archivedAt || intervenant.archivedAt >= debut),
  )
  const veterinaireSanitaireStructure = (exploitation?.intervenantsElevage ?? []).find(
    (intervenant) =>
      intervenant.role === "VETERINAIRE_SANITAIRE"
      && intervenant.statut === "ACTIF"
      && !intervenant.archivedAt,
  )
  const veterinaireSanitaireAffichage = [
    veterinaireSanitaireStructure?.nom,
    veterinaireSanitaireStructure?.organisme,
  ].filter(Boolean).join(" · ")
  const lieuPrincipalStructure = (exploitation?.lieuxDetentionElevage ?? []).find(
    (lieu) => lieu.type === "SITE" && !lieu.archivedAt,
  ) ?? (exploitation?.lieuxDetentionElevage ?? []).find((lieu) => !lieu.archivedAt)
  const lieuPrincipalAffichage = lieuPrincipalStructure
    ? [
        lieuPrincipalStructure.nom,
        lieuPrincipalStructure.adresse,
        lieuPrincipalStructure.codePostal,
        lieuPrincipalStructure.ville,
      ].filter(Boolean).join(", ")
    : ""
  const mouvements: LigneMouvement[] = []

  for (const naissance of naissances) {
    const espece = naissance.mere?.especeAnimale.nom ?? naissance.lot?.especeAnimale.nom ?? "—"
    mouvements.push({
      date: naissance.date,
      type: "Naissance",
      espece,
      cible: naissance.mere
        ? naissance.mere.identifiant || naissance.mere.nom || `Mère #${naissance.id}`
        : naissance.lot?.nom || `Lot #${naissance.lot?.id ?? naissance.id}`,
      origine: "Exploitation",
      destination: "",
      motif: `${naissance.nombreVivants}/${naissance.nombreNes} vivant(s)`,
    })
  }
  for (const animal of animaux) {
    const cible = animal.identifiant || animal.nom || `Animal #${animal.id}`
    if (
      animal.dateArrivee
      && animal.dateArrivee >= debut
      && animal.dateArrivee < fin
      && !animal.ficheNaissance
    ) {
      mouvements.push({
        date: animal.dateArrivee,
        type: "Entrée",
        espece: animal.especeAnimale.nom,
        cible,
        origine: animal.nExploitationOrigine || animal.provenance || "",
        destination: "",
        motif: "",
      })
    }
    if (animal.dateSortie && animal.dateSortie >= debut && animal.dateSortie < fin) {
      const sortie = texteNormalise(
        [animal.statut, animal.motifSortie, animal.causeSortie].filter(Boolean).join(" "),
      )
      mouvements.push({
        date: animal.dateSortie,
        type: sortie.includes("mort") || sortie.includes("deces") ? "Mortalité" : "Sortie",
        espece: animal.especeAnimale.nom,
        cible,
        origine: "",
        destination: animal.nExploitationDestination || "",
        motif: animal.motifSortie || animal.causeSortie || "",
      })
    }
  }
  for (const lot of lots) {
    if (lot.dateArrivee && lot.dateArrivee >= debut && lot.dateArrivee < fin) {
      mouvements.push({
        date: lot.dateArrivee,
        type: "Entrée lot",
        espece: lot.especeAnimale.nom,
        cible: `${lot.nom || `Lot #${lot.id}`} ×${lot.quantiteInitiale}`,
        origine: lot.provenance || "",
        destination: "",
        motif: "",
      })
    }
    if (lot.dateReforme && lot.dateReforme >= debut && lot.dateReforme < fin) {
      mouvements.push({
        date: lot.dateReforme,
        type: "Sortie lot",
        espece: lot.especeAnimale.nom,
        cible: `${lot.nom || `Lot #${lot.id}`} ×${lot.quantiteActuelle}`,
        origine: "",
        destination: "",
        motif: "Réforme / fin de lot",
      })
    }
  }
  for (const abattage of abattages.filter((item) => item.lotId)) {
    mouvements.push({
      date: abattage.date,
      type: "Abattage",
      espece: abattage.lot?.especeAnimale.nom || "—",
      cible: `${abattage.lot?.nom || `Lot #${abattage.lotId}`} ×${abattage.quantite}`,
      origine: "",
      destination: abattage.lieu === "abattoir" ? "Abattoir" : abattage.lieu || "",
      motif: abattage.destination,
    })
  }
  mouvements.sort((a, b) => a.date.getTime() - b.date.getTime())

  const pieces: PieceArchiveRegistre[] = [
    ...lieuxPeriode
      .filter((lieu) => lieu.planMasseUrl)
      .map((lieu) => ({
        sourceType: "PLAN_MASSE",
        sourceId: lieu.id,
        type: "Plan de masse",
        date: lieu.updatedAt,
        libelle: lieu.nom,
        reference: lieu.planMasseUrl!,
        fichierUrl: lieu.planMasseUrl,
        nomFichier: null,
        empreinteSha256: null,
      })),
    ...soins
      .filter((soin) => soin.ordonnanceUrl)
      .map((soin) => ({
        sourceType: "ORDONNANCE_SOIN",
        sourceId: String(soin.id),
        type: "Ordonnance",
        date: soin.date,
        libelle: soin.produitVeterinaire?.nom || soin.produit || soin.type,
        reference: soin.ordonnanceUrl!,
        fichierUrl: soin.ordonnanceUrl,
        nomFichier: null,
        empreinteSha256: null,
      })),
    ...prophylaxies
      .filter((prophylaxie) => prophylaxie.documentUrl)
      .map((prophylaxie) => ({
        sourceType: "PROPHYLAXIE",
        sourceId: prophylaxie.id,
        type: "Prophylaxie / analyse",
        date: prophylaxie.dateRealisee || prophylaxie.datePrevue,
        libelle: prophylaxie.type,
        reference: prophylaxie.documentUrl!,
        fichierUrl: prophylaxie.documentUrl,
        nomFichier: null,
        empreinteSha256: null,
      })),
    ...pharmacie
      .filter((stock) => stock.ordonnanceUrl)
      .map((stock) => ({
        sourceType: "ORDONNANCE_PHARMACIE",
        sourceId: stock.id,
        type: "Ordonnance pharmacie",
        date: stock.createdAt,
        libelle: `${stock.produitId} · lot ${stock.numeroLot}`,
        reference: stock.ordonnanceUrl!,
        fichierUrl: stock.ordonnanceUrl,
        nomFichier: null,
        empreinteSha256: null,
      })),
    ...justificatifsAliments.map((justificatif) => ({
      sourceType: "JUSTIFICATIF_ALIMENT",
      sourceId: justificatif.id,
      type: LABELS_TYPE_JUSTIFICATIF_ALIMENT[
        justificatif.typeDocument as TypeJustificatifAliment
      ] ?? justificatif.typeDocument,
      date: justificatif.dateDocument,
      libelle: [
        justificatif.aliment?.nom,
        justificatif.fournisseur,
        justificatif.numeroLot ? `lot ${justificatif.numeroLot}` : null,
      ].filter(Boolean).join(" · ") || "Justificatif d’aliment",
      reference: [
        justificatif.reference,
        justificatif.fichierUrl,
        justificatif.empreinteSha256
          ? `SHA-256 ${justificatif.empreinteSha256}`
          : null,
      ].filter(Boolean).join(" · "),
      fichierUrl: justificatif.fichierUrl,
      nomFichier: justificatif.nomFichier,
      empreinteSha256: justificatif.empreinteSha256,
    })),
    ...justificatifsEquarrissage.map((justificatif) => ({
      sourceType: "JUSTIFICATIF_EQUARRISSAGE",
      sourceId: justificatif.id,
      type:
        LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE[
          justificatif.typeDocument as TypeJustificatifEquarrissage
        ] ?? justificatif.typeDocument,
      date: justificatif.dateEnlevement,
      libelle: [
        ...justificatif.animaux.map(({ animal }) =>
          animal.identifiant || animal.nom || `Animal #${animal.id}`
        ),
        justificatif.nombreAnimauxNonIdentifies > 0
          ? `${justificatif.nombreAnimauxNonIdentifies} × ${justificatif.typeAnimauxNonIdentifies || "animaux non identifiés"}`
          : null,
        justificatif.prestataire,
      ].filter(Boolean).join(" · ") || "Preuve d’équarrissage",
      reference: [
        justificatif.reference,
        justificatif.fichierUrl,
        justificatif.empreinteSha256
          ? `SHA-256 ${justificatif.empreinteSha256}`
          : null,
      ].filter(Boolean).join(" · "),
      fichierUrl: justificatif.fichierUrl,
      nomFichier: justificatif.nomFichier,
      empreinteSha256: justificatif.empreinteSha256,
    })),
  ]

  const traitementsIncomplets = soins.filter((soin) =>
    soin.fait && (!soin.dose || !soin.voie),
  ).length
  const ordonnancesManquantes = soins.filter((soin) =>
    soin.fait && soin.produitVeterinaire?.ordonnanceObligatoire && !soin.ordonnanceUrl,
  ).length
  const sortiesSansDestination = mouvements.filter((mouvement) =>
    mouvement.type.startsWith("Sortie") && !mouvement.destination,
  ).length
  const mortalitesIndividuelles = animaux.filter((animal) =>
    animal.statut === "mort"
    && animal.dateSortie
    && animal.dateSortie >= debut
    && animal.dateSortie < fin
  )
  const mortaliteIdsAvecBon = new Set(
    justificatifsEquarrissage.flatMap((justificatif) =>
      justificatif.animaux.map((lien) => lien.animalId)
    ),
  )
  const mortalitesSansBon = mortalitesIndividuelles.filter(
    (animal) => !mortaliteIdsAvecBon.has(animal.id),
  ).length

  const manques: string[] = []
  if (!exploitation) manques.push("Fiche synthétique de l’exploitation absente")
  if (!exploitation?.numeroEde) manques.push("Numéro EDE non renseigné")
  if (exploitation) {
    manques.push(...manquesCadreReglementaire({
      lieux: exploitation.lieuxDetentionElevage,
      intervenants: exploitation.intervenantsElevage,
      veterinaireSanitaireLegacy: exploitation.veterinaireSanitaire,
    }))
  }
  if (traitementsIncomplets) {
    manques.push(`${traitementsIncomplets} traitement(s) réalisé(s) sans dose ou voie d’administration complète`)
  }
  if (ordonnancesManquantes) {
    manques.push(`${ordonnancesManquantes} ordonnance(s) obligatoire(s) non référencée(s)`)
  }
  if (sortiesSansDestination) {
    manques.push(`${sortiesSansDestination} sortie(s) sans établissement ou exploitation de destination`)
  }
  if (declarations.resume.aCompleter) {
    manques.push(`${declarations.resume.aCompleter} déclaration(s) réglementaire(s) à compléter`)
  }
  if (declarations.resume.horsDelai) {
    manques.push(`${declarations.resume.horsDelai} déclaration(s) réglementaire(s) hors délai`)
  }
  if ((inventaireAnimaux.length || inventaireLots.length) && !justificatifsAliments.length) {
    manques.push(
      "Aucun justificatif d’aliment acheté référencé sur la période ; vérifier si cette rubrique est non applicable",
    )
  }
  if (mortalitesSansBon) {
    manques.push(
      `${mortalitesSansBon} mortalité(s) individuelle(s) sans bon d’enlèvement actif`,
    )
  }
  manques.push(
    "Journal append-only des créations, modifications et annulations non disponible rétroactivement",
    "Les pièces référencées sont listées mais ne sont pas incorporées physiquement à ce PDF",
  )

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 30,
    bufferPages: true,
    info: {
      Title: `Registre d'élevage complet ${year}`,
      Subject: "Dossier réglementaire d'élevage généré par Gleba",
      CreationDate: maintenant,
    },
  })
  const chunks: Buffer[] = []

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    const nouvellePage = (titre: string) => {
      if (doc.y > 40) doc.addPage()
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(titre)
      doc.moveDown(0.5)
    }
    const espace = (hauteur = 20) => {
      if (doc.y + hauteur > 540) doc.addPage()
    }
    const titreSection = (titre: string) => {
      // Réserver assez de place pour le titre et au moins une première ligne :
      // un titre isolé en pied de page rend le registre difficile à parcourir.
      espace(70)
      doc.moveDown(0.5)
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(titre)
      doc.moveDown(0.35)
    }
    const ligne = (texte: string, options?: { color?: string; indent?: number }) => {
      const indent = options?.indent || 0
      const largeur = 760 - indent
      doc
        .font("Helvetica")
        .fontSize(8)
      const hauteur = doc.heightOfString(texte, { width: largeur, lineBreak: true })
      espace(hauteur + 8)
      doc
        .fillColor(options?.color || "#1e293b")
        .text(texte, 30 + indent, doc.y, { width: largeur })
      doc.moveDown(0.25)
    }
    const vide = (texte: string) => ligne(texte, { color: "#64748b" })

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0f172a").text("Registre d’élevage complet")
    doc.font("Helvetica").fontSize(12).fillColor("#334155").text(`Période du 1er janvier au 31 décembre ${year}`)
    doc.moveDown(1)
    if (exploitation) {
      const identifiant = identifiantLegalAffichage(exploitation)
      ligne(`${exploitation.raisonSociale}${identifiant ? ` · ${identifiant.label} ${identifiant.valeur}` : ""}`)
      ligne(`${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}`)
      ligne(`N° EDE : ${exploitation.numeroEde || "non renseigné"}`)
    } else {
      ligne("Fiche exploitation non configurée", { color: "#b91c1c" })
    }
    ligne(`Généré le ${formatDate(maintenant)} à ${maintenant.toLocaleTimeString("fr-FR")}`)
    doc.moveDown(1)
    ligne(
      "Ce dossier regroupe les données saisies dans Gleba. Il ne remplace pas les notifications aux organismes officiels et signale explicitement les informations ou annexes absentes.",
      { color: "#475569" },
    )
    ligne(
      "Support : l’article 10 de l’arrêté du 5 juin 2000 prévoit un registre sur support papier. Pour les données tenues informatiquement qu’il vise, conserver une version papier mise à jour au moins chaque trimestre, lors des visites vétérinaires et à la demande des agents de contrôle.",
      { color: "#475569" },
    )
    ligne("Conservation cible : minimum cinq ans après l’année de la dernière information enregistrée, sous réserve des durées particulières applicables.", { color: "#475569" })

    nouvellePage("1. Fiche synthétique de l’exploitation")
    if (exploitation) {
      ligne(`Raison sociale : ${exploitation.raisonSociale}`)
      ligne(`Forme juridique : ${exploitation.formeJuridique}`)
      ligne(`Adresse : ${exploitation.adresseSiege}, ${exploitation.codePostal} ${exploitation.ville}, ${exploitation.pays}`)
      ligne(`N° EDE : ${exploitation.numeroEde || "non renseigné"}`)
      ligne(`Lieu de détention principal : ${lieuPrincipalAffichage || exploitation.lieuDetentionPrincipal || "non renseigné"}`)
      ligne(`Vétérinaire sanitaire : ${veterinaireSanitaireAffichage || exploitation.veterinaireSanitaire || "non renseigné"}`)
      ligne(`Contact : ${exploitation.emailContact}${exploitation.telContact ? ` · ${exploitation.telContact}` : ""}`)
    } else {
      vide("Aucune fiche exploitation.")
    }

    titreSection("1.1 Lieux et constructions de détention")
    for (const lieu of lieuxPeriode) {
      const type = LABELS_TYPE_LIEU[lieu.type as keyof typeof LABELS_TYPE_LIEU] ?? lieu.type
      const adresse = [lieu.adresse, lieu.codePostal, lieu.ville].filter(Boolean).join(", ")
      ligne(
        `${type} · ${lieu.nom}${lieu.parent ? ` · rattaché à ${lieu.parent.nom}` : ""}${lieu.numeroEde ? ` · EDE ${lieu.numeroEde}` : ""} · ${adresse || "adresse non renseignée"} · espèces ${lieu.especes.length ? lieu.especes.join(", ") : "toutes / non précisées"}${lieu.usages ? ` · usages ${lieu.usages}` : ""}${lieu.planMasseUrl ? " · plan de masse référencé en annexe" : ""}`,
      )
    }
    if (!lieuxPeriode.length) vide("Aucun lieu ou bâtiment structuré sur la période.")

    titreSection("1.2 Encadrement zootechnique, sanitaire et tenue du registre")
    for (const intervenant of intervenantsPeriode) {
      const role =
        LABELS_ROLE_INTERVENANT[intervenant.role as RoleIntervenantElevage]
        ?? intervenant.role
      const statut =
        LABELS_STATUT_INTERVENANT[intervenant.statut as StatutIntervenantElevage]
        ?? intervenant.statut
      const identite = [intervenant.nom, intervenant.organisme].filter(Boolean).join(" · ")
      const periode = [
        intervenant.dateDebut ? `du ${formatDate(intervenant.dateDebut)}` : null,
        intervenant.dateFin ? `au ${formatDate(intervenant.dateFin)}` : null,
      ].filter(Boolean).join(" ")
      ligne(
        `${role} · ${identite || statut} · statut ${statut}${intervenant.fonction ? ` · fonction ${intervenant.fonction}` : ""}${periode ? ` · ${periode}` : ""} · espèces ${intervenant.especes.length ? intervenant.especes.join(", ") : "toutes / non précisées"}${intervenant.typesProduction.length ? ` · productions ${intervenant.typesProduction.join(", ")}` : ""}${intervenant.adresse ? ` · adresse ${intervenant.adresse}` : ""}${intervenant.perimetreDelegation ? ` · périmètre ${intervenant.perimetreDelegation}` : ""}`,
      )
    }
    if (!intervenantsPeriode.length) vide("Aucun intervenant ou responsable structuré sur la période.")

    titreSection(`2. Inventaire du cheptel au ${formatDate(maintenant)}`)
    for (const animal of inventaireAnimaux) {
      ligne(
        `${animal.especeAnimale.nom} · ${animal.identifiant || `#${animal.id}`}${animal.nom ? ` (${animal.nom})` : ""} · ${animal.sexe || "sexe non renseigné"} · naissance ${formatDate(animal.dateNaissance)} · ${animal.raceAnimale?.nom || animal.race || "race non renseignée"} · lot ${animal.lot?.nom || "—"}`,
      )
    }
    if (!inventaireAnimaux.length) vide("Aucun animal individuel actif.")
    for (const lot of inventaireLots) {
      ligne(`${lot.especeAnimale.nom} · ${lot.nom || `Lot #${lot.id}`} · effectif collectif courant ${partCollective(lot)} (hors fiches individuelles listees ci-dessus) · arrivée ${formatDate(lot.dateArrivee)}`)
    }
    if (!inventaireLots.length) vide("Aucun lot actif.")

    nouvellePage("3. Mouvements, naissances et sorties")
    for (const mouvement of mouvements) {
      ligne(
        `${formatDate(mouvement.date)} · ${mouvement.type} · ${mouvement.espece} · ${mouvement.cible} · origine ${mouvement.origine || "—"} · destination ${mouvement.destination || "—"}${mouvement.motif ? ` · ${mouvement.motif}` : ""}`,
      )
    }
    if (!mouvements.length) vide("Aucun mouvement enregistré sur la période.")

    titreSection("3.1 Bons d’enlèvement et preuves d’équarrissage")
    for (const justificatif of justificatifsEquarrissage) {
      const type =
        LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE[
          justificatif.typeDocument as TypeJustificatifEquarrissage
        ] ?? justificatif.typeDocument
      const animauxIdentifies = justificatif.animaux.map(({ animal }) =>
        `${animal.especeAnimale.nom} ${animal.identifiant || animal.nom || `#${animal.id}`} · décès ${formatDate(animal.dateSortie)}${animal.causeSortie ? ` · ${animal.causeSortie}` : ""}`
      )
      if (justificatif.nombreAnimauxNonIdentifies > 0) {
        animauxIdentifies.push(
          `${justificatif.nombreAnimauxNonIdentifies} × ${justificatif.typeAnimauxNonIdentifies || "animaux non identifiés"}`,
        )
      }
      ligne(
        `${formatDate(justificatif.dateEnlevement)} · ${type} · ${animauxIdentifies.join(" ; ")} · prestataire ${justificatif.prestataire || "—"} · référence ${justificatif.reference || "—"} · fichier ${justificatif.nomFichier || "non téléversé"}${justificatif.empreinteSha256 ? ` · SHA-256 ${justificatif.empreinteSha256}` : ""}`,
      )
    }
    if (!justificatifsEquarrissage.length) {
      vide("Aucun bon d’enlèvement ou justificatif d’équarrissage référencé sur la période.")
    }

    nouvellePage("4. Soins, traitements et délais d’attente")
    for (const soin of soins) {
      const cible = soin.animal
        ? soin.animal.identifiant || soin.animal.nom || `Animal #${soin.animal.id}`
        : soin.lot?.nom || (soin.lot ? `Lot #${soin.lot.id}` : "Cible non renseignée")
      const produit = soin.produitVeterinaire?.nom || soin.produit || "produit non renseigné"
      const injections = soin.injections.length > 1
        ? ` · injections ${soin.injections.filter((injection) => injection.dateRealisee).length}/${soin.injections.length}`
        : ""
      ligne(
        `${formatDate(soin.date)} · ${soin.fait ? soin.type : `${soin.type} (prévu)`} · ${cible} · ${produit}${soin.produitVeterinaire?.amm ? ` (AMM ${soin.produitVeterinaire.amm})` : ""} · dose ${soin.dose || "—"} · voie ${soin.voie || "—"}${injections} · attente lait ${formatDate(soin.finAttenteLait)} · viande ${formatDate(soin.finAttenteViande)} · vétérinaire ${soin.veterinaire || "—"} · ordonnance ${soin.ordonnanceUrl ? "référencée" : "non référencée"}`,
      )
    }
    if (!soins.length) vide("Aucun soin enregistré sur la période.")

    titreSection("5. Prophylaxies, analyses et visites")
    for (const prophylaxie of prophylaxies) {
      ligne(
        `${formatDate(prophylaxie.datePrevue)} · ${prophylaxie.type} · ${prophylaxie.statut} · réalisé ${formatDate(prophylaxie.dateRealisee)} · organisme ${prophylaxie.organisme || "—"} · résultat ${prophylaxie.resultat || "—"} · document ${prophylaxie.documentUrl ? "référencé" : "non référencé"}`,
      )
    }
    if (!prophylaxies.length) vide("Aucune prophylaxie ou visite enregistrée.")

    nouvellePage("6. Alimentation et justificatifs")
    titreSection("6.1 Distributions enregistrées")
    for (const consommation of consommationsAliments) {
      const cible = consommation.animal
        ? consommation.animal.identifiant || consommation.animal.nom || `Animal #${consommation.animal.id}`
        : consommation.lot?.nom || (consommation.lot ? `Lot #${consommation.lot.id}` : "Cheptel non précisé")
      ligne(
        `${formatDate(consommation.date)} · ${consommation.aliment.nom} · ${consommation.quantite} kg · ${cible}${consommation.notes ? ` · ${consommation.notes}` : ""}`,
      )
    }
    if (!consommationsAliments.length) vide("Aucune distribution d’aliment enregistrée sur la période.")

    titreSection("6.2 Factures, bons, étiquettes et fiches techniques")
    for (const justificatif of justificatifsAliments) {
      const type =
        LABELS_TYPE_JUSTIFICATIF_ALIMENT[
          justificatif.typeDocument as TypeJustificatifAliment
        ] ?? justificatif.typeDocument
      ligne(
        `${formatDate(justificatif.dateDocument)} · ${type} · ${justificatif.aliment?.nom || "plusieurs aliments / non rattaché"} · fournisseur ${justificatif.fournisseur || "—"} · lot ${justificatif.numeroLot || "—"} · référence ${justificatif.reference || "—"} · fichier ${justificatif.nomFichier || "non téléversé"}${justificatif.empreinteSha256 ? ` · SHA-256 ${justificatif.empreinteSha256}` : ""}`,
      )
    }
    if (!justificatifsAliments.length) vide("Aucun justificatif d’aliment référencé sur la période.")

    nouvellePage("7. Pharmacie d’élevage")
    for (const stock of pharmacie) {
      ligne(
        `${stock.produit?.nom || stock.produitId}${stock.produit?.amm ? ` · ${stock.produit.amm}` : ""} · lot ${stock.numeroLot} · ${stock.quantite} ${stock.unite} · péremption ${formatDate(stock.datePeremption)} · fournisseur ${stock.fournisseur || "—"} · ordonnance ${stock.ordonnanceUrl ? "référencée" : "non référencée"}`,
      )
    }
    if (!pharmacie.length) vide("Aucun stock de médicament enregistré.")

    titreSection("8. Déclarations réglementaires préparées")
    for (const declaration of declarations.declarations) {
      ligne(
        `${formatDate(declaration.dateEvenement)} · ${declaration.type} · ${declaration.libelle} · ${declaration.organisme} · échéance ${formatDate(declaration.dateEcheance)} · statut ${declaration.statut}${declaration.referenceTransmission ? ` · preuve ${declaration.referenceTransmission}` : ""}${declaration.anomalies.length ? ` · anomalies : ${declaration.anomalies.join(", ")}` : ""}`,
      )
    }
    if (!declarations.declarations.length) vide("Aucune déclaration couverte sur la période.")

    nouvellePage("9. Annexes et pièces référencées")
    for (const piece of pieces) {
      ligne(`${formatDate(piece.date)} · ${piece.type} · ${piece.libelle} · ${piece.reference}`)
    }
    if (!pieces.length) vide("Aucune pièce jointe ou référence documentaire enregistrée.")

    nouvellePage("10. Contrôle de complétude et limites")
    if (!manques.length) {
      ligne("Aucun manque détecté dans le périmètre actuellement modélisé.", { color: "#166534" })
    } else {
      for (const manque of manques) ligne(`• ${manque}`, { color: "#92400e", indent: 8 })
    }
    doc.moveDown(1)
    ligne(
      "Le détenteur reste responsable de la vérification, de la transmission aux organismes compétents, de la conservation des originaux et de la présentation du registre lors d’un contrôle.",
      { color: "#475569" },
    )

    const pages = doc.bufferedPageRange()
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(pages.start + index)
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(
          `Gleba · registre ${year} · page ${index + 1}/${pages.count} · généré le ${formatDate(maintenant)}`,
          30,
          548,
          { width: 780, align: "center", lineBreak: false },
        )
    }

    doc.end()
  })
  const snapshotHash = empreinteDeclaration({
    version: 1,
    year,
    exploitation: exploitation
      ? {
          raisonSociale: exploitation.raisonSociale,
          numeroEde: exploitation.numeroEde,
          updatedAt: exploitation.updatedAt,
          lieuxDetention: exploitation.lieuxDetentionElevage.map((lieu) => ({
            id: lieu.id,
            updatedAt: lieu.updatedAt,
            archivedAt: lieu.archivedAt,
          })),
          intervenants: exploitation.intervenantsElevage.map((intervenant) => ({
            id: intervenant.id,
            role: intervenant.role,
            statut: intervenant.statut,
            updatedAt: intervenant.updatedAt,
            archivedAt: intervenant.archivedAt,
          })),
        }
      : null,
    animaux: animaux.map((animal) => ({
      id: animal.id,
      statut: animal.statut,
      dateArrivee: animal.dateArrivee,
      dateSortie: animal.dateSortie,
    })),
    lots: lots.map((lot) => ({
      id: lot.id,
      statut: lot.statut,
      quantiteActuelle: lot.quantiteActuelle,
      updatedAt: lot.updatedAt,
    })),
    mouvements,
    soins: soins.map((soin) => ({
      id: soin.id,
      createdAt: soin.createdAt,
      injections: soin.injections.map((injection) => ({
        numero: injection.numero,
        statut: injection.statut,
        dateRealisee: injection.dateRealisee,
      })),
    })),
    prophylaxies: prophylaxies.map((item) => ({ id: item.id, updatedAt: item.updatedAt })),
    pharmacie: pharmacie.map((item) => ({ id: item.id, updatedAt: item.updatedAt })),
    consommationsAliments: consommationsAliments.map((item) => ({
      id: item.id,
      date: item.date,
      quantite: item.quantite,
      alimentId: item.alimentId,
    })),
    justificatifsAliments: justificatifsAliments.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt,
      empreinteSha256: item.empreinteSha256,
    })),
    justificatifsEquarrissage: justificatifsEquarrissage.map((item) => ({
      id: item.id,
      updatedAt: item.updatedAt,
      empreinteSha256: item.empreinteSha256,
      animalIds: item.animaux.map((lien) => lien.animalId),
      nombreAnimauxNonIdentifies: item.nombreAnimauxNonIdentifies,
    })),
    declarations: declarations.declarations.map((item) => ({
      key: item.key,
      statut: item.statut,
      snapshotHash: item.snapshotHash,
    })),
    pieces,
    manques,
  })
  const actorUserId = acteurReglementaire(session.user)
  const metadataCommunes = {
    year,
    animaux: inventaireAnimaux.length,
    lots: inventaireLots.length,
    mouvements: mouvements.length,
    soins: soins.length,
    declarations: declarations.declarations.length,
    annexesReferencees: pieces.length,
    distributionsAliments: consommationsAliments.length,
    justificatifsAliments: justificatifsAliments.length,
    mortalites: mortalitesIndividuelles.length,
    justificatifsEquarrissage: justificatifsEquarrissage.length,
    mortalitesSansBon,
    lieuxDetention: lieuxPeriode.length,
    intervenants: intervenantsPeriode.length,
    manques: manques.length,
  }

  if (format === "archive") {
    const dossier = await construireArchiveRegistre({
      userId,
      annee: year,
      debut,
      fin,
      genereLe: maintenant,
      snapshotHash,
      pdf: buffer,
      pieces,
      manques,
    })
    const stockageNom = `${randomUUID()}.zip`
    const nomFichier =
      `dossier-reglementaire-elevage-${year}-${maintenant.toISOString().replace(/[:.]/g, "-")}.zip`
    const dossierStockage = path.join(process.cwd(), "storage", "registres", userId)
    const cheminStockage = path.join(dossierStockage, stockageNom)
    await mkdir(dossierStockage, { recursive: true })
    await writeFile(cheminStockage, dossier.archive, { flag: "wx" })

    let archive
    try {
      archive = await prisma.$transaction(async (tx) => {
        const archiveCreee = await tx.archiveRegistreElevage.create({
          data: {
            userId,
            annee: year,
            periodeDebut: debut,
            periodeFin: fin,
            genereLe: maintenant,
            actorUserId,
            snapshotHash,
            archiveSha256: dossier.archiveSha256,
            tailleOctets: dossier.archive.byteLength,
            nomFichier,
            stockageNom,
            annexesIncluses: dossier.annexesIncluses,
            annexesSignalees: dossier.annexesSignalees,
            manifeste: dossier.manifeste as unknown as Prisma.InputJsonValue,
          },
        })
        await journaliserEvenementReglementaire(tx, {
          userId,
          declarationKey: `registre-complet:${year}`,
          action: "REGISTRE_COMPLET_ARCHIVE",
          actorUserId,
          snapshotHash,
          metadata: {
            ...metadataCommunes,
            archiveId: archiveCreee.id,
            archiveSha256: dossier.archiveSha256,
            tailleOctets: dossier.archive.byteLength,
            annexesIncluses: dossier.annexesIncluses,
            annexesSignalees: dossier.annexesSignalees,
          },
        })
        return archiveCreee
      })
    } catch (erreurCreation) {
      await unlink(cheminStockage).catch(() => undefined)
      throw erreurCreation
    }

    return new NextResponse(new Uint8Array(dossier.archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${nomFichier}"`,
        "Cache-Control": "private, no-store",
        "X-Gleba-Archive-Id": archive.id,
        "X-Gleba-Archive-Sha256": dossier.archiveSha256,
      },
    })
  }

  await journaliserEvenementReglementaire(prisma, {
    userId,
    declarationKey: `registre-complet:${year}`,
    action: "REGISTRE_COMPLET_GENERE",
    actorUserId,
    snapshotHash,
    metadata: metadataCommunes,
  })

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="registre-elevage-complet-${year}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
