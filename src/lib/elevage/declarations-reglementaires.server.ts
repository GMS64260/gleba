import prisma from "@/lib/prisma"
import {
  calculerEcheanceDeclaration,
  calculerStatutDeclaration,
  empreinteDeclaration,
  joursAvantEcheance,
  lotNeSurExploitation,
  normaliserCategorieReglementaire,
  organismeDeclaration,
  prioriteStatut,
  typeDeclarationCouvert,
  type DeclarationReglementaire,
  type SuiviDeclaration,
  type TypeDeclarationReglementaire,
} from "@/lib/elevage/declarations-reglementaires"

const dansPeriode = (date: Date | null, debut: Date, fin: Date) =>
  Boolean(date && date >= debut && date < fin)

const memeJourUTC = (a: Date | null, b: Date | null) =>
  Boolean(
    a
      && b
      && a.getUTCFullYear() === b.getUTCFullYear()
      && a.getUTCMonth() === b.getUTCMonth()
      && a.getUTCDate() === b.getUTCDate(),
  )

const texteNormalise = (value: string | null | undefined) =>
  (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()

const listeIdentifiants = (...values: Array<string | null | undefined>) => [
  ...new Set(
    values
      .flatMap((value) => (value ?? "").split(/[;,\n]/))
      .map((value) => value.trim())
      .filter(Boolean),
  ),
]

export interface ResultatDeclarationsReglementaires {
  year: number
  generatedAt: string
  declarations: DeclarationReglementaire[]
  resume: {
    total: number
    aCompleter: number
    aDeclarer: number
    horsDelai: number
    transmises: number
    modifieesApresTransmission: number
  }
}

export async function chargerDeclarationsReglementaires(
  userId: string,
  options: { year: number; maintenant?: Date },
): Promise<ResultatDeclarationsReglementaires> {
  const { year, maintenant = new Date() } = options
  const debut = new Date(Date.UTC(year, 0, 1))
  const fin = new Date(Date.UTC(year + 1, 0, 1))

  const [exploitation, naissances, animaux, lots, abattagesLots, suivis] = await Promise.all([
    prisma.exploitation.findUnique({
      where: { userId },
      select: { raisonSociale: true, numeroEde: true },
    }),
    prisma.naissanceAnimale.findMany({
      where: { userId, date: { gte: debut, lt: fin } },
      select: {
        id: true,
        date: true,
        nombreVivants: true,
        nombreMales: true,
        nombreFemelles: true,
        identifiantsDefinitifs: true,
        mere: {
          select: {
            identifiant: true,
            nom: true,
            especeAnimale: {
              select: { nom: true, filiere: true, categorieReglementaire: true },
            },
          },
        },
        lot: {
          select: {
            id: true,
            nom: true,
            especeAnimale: {
              select: { nom: true, filiere: true, categorieReglementaire: true },
            },
          },
        },
        petits: { select: { boucleDefinitive: true } },
      },
    }),
    prisma.animal.findMany({
      where: {
        userId,
        OR: [
          { dateArrivee: { gte: debut, lt: fin } },
          { dateSortie: { gte: debut, lt: fin } },
        ],
      },
      select: {
        id: true,
        identifiant: true,
        nom: true,
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
        especeAnimale: {
          select: { nom: true, filiere: true, categorieReglementaire: true },
        },
      },
    }),
    prisma.lotAnimaux.findMany({
      where: {
        userId,
        OR: [
          { dateArrivee: { gte: debut, lt: fin } },
          { dateReforme: { gte: debut, lt: fin } },
        ],
      },
      select: {
        id: true,
        nom: true,
        dateArrivee: true,
        dateReforme: true,
        quantiteInitiale: true,
        quantiteActuelle: true,
        provenance: true,
        statut: true,
        especeAnimale: {
          select: { nom: true, filiere: true, categorieReglementaire: true },
        },
        naissances: { select: { date: true } },
      },
    }),
    prisma.abattage.findMany({
      where: {
        userId,
        annule: false,
        lotId: { not: null },
        date: { gte: debut, lt: fin },
      },
      select: {
        id: true,
        date: true,
        quantite: true,
        lieu: true,
        destination: true,
        lot: {
          select: {
            id: true,
            nom: true,
            especeAnimale: {
              select: { nom: true, filiere: true, categorieReglementaire: true },
            },
          },
        },
      },
    }),
    prisma.declarationReglementaireSuivi.findMany({ where: { userId } }),
  ])

  const suiviParCle = new Map<string, SuiviDeclaration>(
    suivis.map((suivi) => [suivi.declarationKey, suivi]),
  )
  const declarations: DeclarationReglementaire[] = []

  const ajouter = (args: {
    key: string
    type: TypeDeclarationReglementaire
    categorieBrute: string | null
    filiere: string
    dateEvenement: Date
    libelle: string
    espece: string
    cible: string
    sourceUrl: string
    identifiants?: string[]
    quantite?: number
    origine?: string | null
    destination?: string | null
    anomalies?: string[]
    donnees: Record<string, unknown>
  }) => {
    if (args.filiere !== "rente") return
    const categorie = normaliserCategorieReglementaire(args.categorieBrute)
    if (!categorie || !typeDeclarationCouvert(categorie, args.type)) return

    const anomalies = [...(args.anomalies ?? [])]
    if (!exploitation?.numeroEde) anomalies.unshift("Numéro EDE de l’exploitation manquant")

    const dateEcheance = calculerEcheanceDeclaration(args.dateEvenement)
    const snapshot: Record<string, unknown> = {
      version: 1,
      declarationKey: args.key,
      type: args.type,
      organisme: organismeDeclaration(categorie),
      numeroEde: exploitation?.numeroEde ?? null,
      exploitation: exploitation?.raisonSociale ?? null,
      dateEvenement: args.dateEvenement.toISOString(),
      dateEcheance: dateEcheance.toISOString(),
      categorie,
      espece: args.espece,
      cible: args.cible,
      identifiants: args.identifiants ?? [],
      quantite: args.quantite ?? 1,
      origine: args.origine ?? null,
      destination: args.destination ?? null,
      anomalies,
      donnees: args.donnees,
    }
    const snapshotHash = empreinteDeclaration(snapshot)
    const suivi = suiviParCle.get(args.key) ?? null
    const statut = calculerStatutDeclaration({ anomalies, dateEcheance, suivi, maintenant })
    const statutFinalise = suivi && ["TRANSMISE", "ACCEPTEE"].includes(suivi.statut)
    const modifieeApresTransmission = Boolean(
      statutFinalise && suivi.snapshotHash && suivi.snapshotHash !== snapshotHash,
    )

    declarations.push({
      key: args.key,
      type: args.type,
      categorie,
      organisme: organismeDeclaration(categorie),
      dateEvenement: args.dateEvenement.toISOString(),
      dateEcheance: dateEcheance.toISOString(),
      joursRestants: joursAvantEcheance(dateEcheance, maintenant),
      statut,
      libelle: args.libelle,
      espece: args.espece,
      cible: args.cible,
      sourceUrl: args.sourceUrl,
      numeroEde: exploitation?.numeroEde ?? null,
      identifiants: args.identifiants ?? [],
      quantite: args.quantite ?? 1,
      origine: args.origine ?? null,
      destination: args.destination ?? null,
      anomalies,
      transmisAt: suivi?.transmisAt?.toISOString() ?? null,
      canalTransmission: suivi?.canalTransmission ?? null,
      referenceTransmission: suivi?.referenceTransmission ?? null,
      notes: suivi?.notes ?? null,
      modifieeApresTransmission,
      snapshot,
      snapshotHash,
    })
  }

  for (const naissance of naissances) {
    if (naissance.nombreVivants <= 0) continue
    const espece = naissance.mere?.especeAnimale ?? naissance.lot?.especeAnimale
    if (!espece) continue
    const identifiants = listeIdentifiants(
      naissance.identifiantsDefinitifs,
      ...naissance.petits.map((petit) => petit.boucleDefinitive),
    )
    const anomalies: string[] = []
    if (identifiants.length < naissance.nombreVivants) {
      anomalies.push(
        `Identifiants définitifs incomplets (${identifiants.length}/${naissance.nombreVivants})`,
      )
    }
    if (!naissance.mere?.identifiant) anomalies.push("Identifiant officiel de la mère manquant")
    const sexesRenseignes =
      naissance.nombreMales !== null
      && naissance.nombreFemelles !== null
      && naissance.nombreMales + naissance.nombreFemelles === naissance.nombreVivants
    if (!sexesRenseignes) anomalies.push("Répartition mâles/femelles incomplète ou incohérente")

    ajouter({
      key: `naissance:${naissance.id}:NAISSANCE`,
      type: "NAISSANCE",
      categorieBrute: espece.categorieReglementaire,
      filiere: espece.filiere,
      dateEvenement: naissance.date,
      libelle: `Naissance de ${naissance.nombreVivants} ${espece.nom.toLowerCase()}(s)`,
      espece: espece.nom,
      cible: naissance.mere
        ? naissance.mere.nom || naissance.mere.identifiant || `Mère #${naissance.id}`
        : naissance.lot?.nom || `Lot #${naissance.lot?.id ?? naissance.id}`,
      sourceUrl: "/elevage?tab=reproduction",
      identifiants,
      quantite: naissance.nombreVivants,
      anomalies,
      donnees: {
        naissanceId: naissance.id,
        mereIdentifiant: naissance.mere?.identifiant ?? null,
        nombreMales: naissance.nombreMales,
        nombreFemelles: naissance.nombreFemelles,
      },
    })
  }

  for (const animal of animaux) {
    const espece = animal.especeAnimale
    const cible = animal.identifiant || animal.nom || `Animal #${animal.id}`
    const identifiants = animal.identifiant ? [animal.identifiant] : []
    const naissanceSurExploitation =
      Boolean(animal.ficheNaissance)
      || (
        memeJourUTC(animal.dateArrivee, animal.dateNaissance)
        && texteNormalise(animal.provenance).includes("naissance")
      )

    if (dansPeriode(animal.dateArrivee, debut, fin) && !naissanceSurExploitation) {
      const anomalies: string[] = []
      if (!animal.identifiant) anomalies.push("Identifiant officiel de l’animal manquant")
      if (!animal.nExploitationOrigine) anomalies.push("Numéro d’exploitation d’origine manquant")
      ajouter({
        key: `animal:${animal.id}:ENTREE`,
        type: "ENTREE",
        categorieBrute: espece.categorieReglementaire,
        filiere: espece.filiere,
        dateEvenement: animal.dateArrivee!,
        libelle: `Entrée de ${cible}`,
        espece: espece.nom,
        cible,
        sourceUrl: `/elevage?tab=animaux&edit=${animal.id}`,
        identifiants,
        origine: animal.nExploitationOrigine || animal.provenance,
        anomalies,
        donnees: { animalId: animal.id, provenance: animal.provenance },
      })
    }

    if (dansPeriode(animal.dateSortie, debut, fin)) {
      const texteSortie = texteNormalise(
        [animal.statut, animal.motifSortie, animal.causeSortie].filter(Boolean).join(" "),
      )
      const mortalite =
        texteSortie.includes("mort")
        || texteSortie.includes("deces")
        || texteSortie.includes("equarr")
      const type: TypeDeclarationReglementaire = mortalite ? "MORTALITE" : "SORTIE"
      const anomalies: string[] = []
      if (!animal.identifiant) anomalies.push("Identifiant officiel de l’animal manquant")
      if (!mortalite && !animal.nExploitationDestination) {
        anomalies.push("Numéro d’exploitation de destination manquant")
      }
      if (mortalite && !animal.motifSortie && !animal.causeSortie) {
        anomalies.push("Motif de mortalité ou d’équarrissage manquant")
      }
      ajouter({
        key: `animal:${animal.id}:${type}`,
        type,
        categorieBrute: espece.categorieReglementaire,
        filiere: espece.filiere,
        dateEvenement: animal.dateSortie!,
        libelle: `${mortalite ? "Mortalité" : "Sortie"} de ${cible}`,
        espece: espece.nom,
        cible,
        sourceUrl: `/elevage?tab=animaux&edit=${animal.id}`,
        identifiants,
        destination: animal.nExploitationDestination,
        anomalies,
        donnees: {
          animalId: animal.id,
          motifSortie: animal.motifSortie,
          causeSortie: animal.causeSortie,
        },
      })
    }
  }

  for (const lot of lots) {
    const espece = lot.especeAnimale
    const cible = lot.nom || `Lot #${lot.id}`
    const naissanceSurExploitation = lotNeSurExploitation({
      dateArrivee: lot.dateArrivee,
      provenance: lot.provenance,
      datesNaissances: lot.naissances.map((naissance) => naissance.date),
    })
    if (dansPeriode(lot.dateArrivee, debut, fin) && !naissanceSurExploitation) {
      const anomalies = lot.provenance ? [] : ["Provenance / exploitation d’origine manquante"]
      ajouter({
        key: `lot:${lot.id}:ENTREE`,
        type: "ENTREE",
        categorieBrute: espece.categorieReglementaire,
        filiere: espece.filiere,
        dateEvenement: lot.dateArrivee!,
        libelle: `Entrée du lot ${cible}`,
        espece: espece.nom,
        cible,
        sourceUrl: "/elevage?tab=animaux",
        quantite: lot.quantiteInitiale,
        origine: lot.provenance,
        anomalies,
        donnees: { lotId: lot.id, statut: lot.statut },
      })
    }
    if (dansPeriode(lot.dateReforme, debut, fin)) {
      ajouter({
        key: `lot:${lot.id}:SORTIE`,
        type: "SORTIE",
        categorieBrute: espece.categorieReglementaire,
        filiere: espece.filiere,
        dateEvenement: lot.dateReforme!,
        libelle: `Sortie / réforme du lot ${cible}`,
        espece: espece.nom,
        cible,
        sourceUrl: "/elevage?tab=animaux",
        quantite: lot.quantiteActuelle,
        anomalies: ["Exploitation ou établissement de destination manquant"],
        donnees: { lotId: lot.id, statut: lot.statut },
      })
    }
  }

  for (const abattage of abattagesLots) {
    if (!abattage.lot) continue
    ajouter({
      key: `abattage:${abattage.id}:SORTIE`,
      type: "SORTIE",
      categorieBrute: abattage.lot.especeAnimale.categorieReglementaire,
      filiere: abattage.lot.especeAnimale.filiere,
      dateEvenement: abattage.date,
      libelle: `Sortie de ${abattage.quantite} animal(aux) du lot ${abattage.lot.nom || `#${abattage.lot.id}`}`,
      espece: abattage.lot.especeAnimale.nom,
      cible: abattage.lot.nom || `Lot #${abattage.lot.id}`,
      sourceUrl: "/elevage?tab=production",
      quantite: abattage.quantite,
      destination: abattage.lieu === "abattoir" ? "Abattoir" : null,
      anomalies:
        abattage.lieu === "abattoir"
          ? ["Numéro de l’établissement destinataire à reporter dans l’export"]
          : ["Destination réglementaire du mouvement manquante"],
      donnees: {
        abattageId: abattage.id,
        lotId: abattage.lot.id,
        lieu: abattage.lieu,
        destinationUsage: abattage.destination,
      },
    })
  }

  declarations.sort((a, b) => {
    const statut = prioriteStatut(a.statut) - prioriteStatut(b.statut)
    if (statut !== 0) return statut
    return new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
  })

  return {
    year,
    generatedAt: maintenant.toISOString(),
    declarations,
    resume: {
      total: declarations.length,
      aCompleter: declarations.filter((d) => d.statut === "A_COMPLETER").length,
      aDeclarer: declarations.filter((d) => d.statut === "A_DECLARER").length,
      horsDelai: declarations.filter((d) => d.statut === "HORS_DELAI").length,
      transmises: declarations.filter((d) => ["TRANSMISE", "ACCEPTEE"].includes(d.statut)).length,
      modifieesApresTransmission: declarations.filter((d) => d.modifieeApresTransmission).length,
    },
  }
}
