export type TypeCibleReglement = 'Facture' | 'VenteProduit' | 'VenteManuelle' | 'DepenseManuelle'
export interface IdentiteMiroir {
  id: number
  auto: boolean
  sourceType: string | null
  sourceId: number | null
  sourceRef: string | null
}
export const cleFacture = (id: number) => 'facture:' + id
export const cleSourceReglement = (
  nature: 'vente' | 'depense',
  type: string,
  id: number | string,
  parRef = false,
) => JSON.stringify([nature, type, parRef ? 'ref' : 'id', String(id)])
export function cleMiroirReglement(nature: 'vente' | 'depense', m: IdentiteMiroir): string {
  if (m.auto && m.sourceType && (m.sourceId != null || m.sourceRef != null))
    return cleSourceReglement(nature, m.sourceType, m.sourceId ?? m.sourceRef!, m.sourceId == null)
  return nature + ':manuel:' + m.id
}

/** Une vente native se règle par son ID, même si la liste expose aussi son miroir. */
export function cibleReglementLigne(ligne: {
  source: string
  sourceId: number
  facture?: { id: number } | null
  ecriture?: { id: number } | null
  comptable?: boolean
  reglementsDisponibles?: boolean
}, nature: 'vente' | 'depense'): { type: TypeCibleReglement; id: number } | null {
  if (ligne.comptable === false || ligne.reglementsDisponibles === false) return null
  if (ligne.facture) return { type: 'Facture', id: ligne.facture.id }
  if (ligne.source === 'VenteProduit') return { type: 'VenteProduit', id: ligne.sourceId }
  if (ligne.source === 'Facture') return { type: 'Facture', id: ligne.sourceId }
  if (ligne.source === 'VenteManuelle' || ligne.source === 'DepenseManuelle') {
    return { type: ligne.source, id: ligne.sourceId }
  }
  return ligne.ecriture ? { type: nature === 'vente' ? 'VenteManuelle' : 'DepenseManuelle', id: ligne.ecriture.id } : null
}
