import type { DeclarationReglementaire } from "@/lib/elevage/declarations-reglementaires"

export interface PreparationDocumentCirculation {
  numeroDocumentEde: string | null
  typeExploitationEde: string | null
  categorieAnimaux: string | null
  indicatifsMarquage: string | null
  tiersNom: string | null
  tiersNumeroEde: string | null
  tiersSiren: string | null
  tiersAdresse: string | null
  numeroAgrementSanitaire: string | null
  transporteurNom: string | null
  numeroTransporteur: string | null
  immatriculationVehicule: string | null
  motifMouvement: string | null
  contactDepart: string | null
  contactArrivee: string | null
  notes: string | null
}

export const PREPARATION_CIRCULATION_VIDE: PreparationDocumentCirculation = {
  numeroDocumentEde: null,
  typeExploitationEde: null,
  categorieAnimaux: null,
  indicatifsMarquage: null,
  tiersNom: null,
  tiersNumeroEde: null,
  tiersSiren: null,
  tiersAdresse: null,
  numeroAgrementSanitaire: null,
  transporteurNom: null,
  numeroTransporteur: null,
  immatriculationVehicule: null,
  motifMouvement: null,
  contactDepart: null,
  contactArrivee: null,
  notes: null,
}

const present = (value: string | null | undefined) => Boolean(value?.trim())

export function declarationCompatibleDocumentCirculation(
  declaration: Pick<DeclarationReglementaire, "categorie" | "type">,
): boolean {
  return (
    ["OVIN", "CAPRIN"].includes(declaration.categorie)
    && ["ENTREE", "SORTIE"].includes(declaration.type)
  )
}

export function anomaliesDocumentCirculation(
  declaration: Pick<
    DeclarationReglementaire,
    "type" | "numeroEde" | "identifiants" | "quantite" | "origine" | "destination" | "anomalies"
  >,
  preparation: PreparationDocumentCirculation,
): string[] {
  const anomalies = [...declaration.anomalies]

  if (!present(declaration.numeroEde)) {
    anomalies.push("Numéro EDE de l’exploitation manquant")
  }
  if (declaration.quantite <= 0) {
    anomalies.push("Nombre d’animaux invalide")
  }
  if (
    declaration.identifiants.length === 0
    && !present(preparation.indicatifsMarquage)
  ) {
    anomalies.push("Identifiants individuels ou indicatifs de marquage manquants")
  }
  if (!present(preparation.typeExploitationEde)) {
    anomalies.push("Type d’exploitation EDE manquant")
  }
  if (!present(preparation.categorieAnimaux)) {
    anomalies.push("Catégorie dérogataire/non dérogataire des animaux manquante")
  }

  const tiersConnu =
    present(preparation.tiersNumeroEde)
    || present(preparation.tiersSiren)
    || present(preparation.numeroAgrementSanitaire)
    || (declaration.type === "ENTREE"
      ? present(declaration.origine)
      : present(declaration.destination))
  if (!tiersConnu) {
    anomalies.push(
      declaration.type === "ENTREE"
        ? "EDE/SIREN de provenance manquant"
        : "EDE/SIREN ou agrément sanitaire de destination manquant",
    )
  }
  if (!present(preparation.numeroTransporteur)) {
    anomalies.push("Numéro du transporteur manquant")
  }
  if (!present(preparation.immatriculationVehicule)) {
    anomalies.push("Immatriculation du véhicule manquante")
  }

  return [...new Set(anomalies)]
}

export function construireSnapshotDocumentCirculation(
  declaration: DeclarationReglementaire,
  preparation: PreparationDocumentCirculation,
) {
  return {
    version: 1,
    declarationKey: declaration.key,
    declarationSnapshotHash: declaration.snapshotHash,
    type: declaration.type,
    categorie: declaration.categorie,
    dateEvenement: declaration.dateEvenement,
    numeroEde: declaration.numeroEde,
    espece: declaration.espece,
    quantite: declaration.quantite,
    identifiants: declaration.identifiants,
    origine: declaration.origine,
    destination: declaration.destination,
    preparation,
    anomalies: anomaliesDocumentCirculation(declaration, preparation),
  }
}
