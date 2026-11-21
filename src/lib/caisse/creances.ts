/**
 * Stub public. La caisse de marché n'est pas distribuée : sur gleba.fr, ce
 * module calcule le montant restant à régler des tickets de caisse, avoirs
 * déduits (voir docs/private-stubs.md). Sans elle, aucun ticket n'existe.
 */
export const chargerMontantsNetsCaisse: (
  db: unknown,
  userId: string,
  lignes: readonly { sourceType?: string | null; sourceRef?: string | null; montant: number }[],
  borne?: Date,
) => Promise<Map<string, number>> = async () => new Map()
