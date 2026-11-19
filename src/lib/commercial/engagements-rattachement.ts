import type { Prisma } from '@prisma/client'
import * as catalogueStock from './catalogue-stock'
import { motifBlocageRattachementDocuments } from './engagements-documents'

type GardeRattachement = (db: Prisma.TransactionClient, userId: string, produitId: number) => Promise<string | null>

/**
 * Les deux catalogues exposent chargerCatalogueStock. La variante privée ajoute
 * sa garde, sans imposer ses modèles au client Prisma public. Le passage par ce
 * contrat structurel évite un import nommé absent de la variante publique.
 */
export function adapterGardeRattachement(catalogue: {
  chargerCatalogueStock: typeof catalogueStock.chargerCatalogueStock
  motifBlocageRattachementSupplementaire?: GardeRattachement
}): GardeRattachement {
  const supplement = 'motifBlocageRattachementSupplementaire' in catalogue
    ? catalogue.motifBlocageRattachementSupplementaire : undefined
  return async (db, userId, produitId) => {
    const complement = await supplement?.(db, userId, produitId)
    return complement ?? motifBlocageRattachementDocuments(db, userId, produitId)
  }
}

/** À appeler sous le verrou commercial, comme les préparations et les sorties. */
export const motifBlocageRattachement = adapterGardeRattachement(catalogueStock)
