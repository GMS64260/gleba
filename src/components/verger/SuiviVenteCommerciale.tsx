'use client'

import Link from 'next/link'
import { formatNombre } from '@/lib/format-utils'
import type { VenteCommercialeVerger } from '@/lib/verger/suivi-commercial-types'

const argent = (montant: number, devise: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(montant)

export function QuantiteCommerciale({ vente }: { vente: VenteCommercialeVerger }) {
  return <><span>{formatNombre(vente.quantiteNette, 3)} {vente.unite}</span>
    {vente.quantiteRetournee > 0 && <p className="text-xs text-muted-foreground">{formatNombre(vente.quantiteLivree, 3)} livrés · {formatNombre(vente.quantiteRetournee, 3)} retournés</p>}</>
}

export function MontantCommercial({ vente }: { vente: VenteCommercialeVerger }) {
  if (!vente.facture) return <><span>{argent(vente.montantLivre, vente.devise)}</span><p className="text-xs text-muted-foreground">{vente.quantiteNette > 0 ? 'Livré, à facturer' : 'Livraison retournée'} · hors CA</p></>
  return <><span>{vente.revenuTTC == null ? 'À vérifier' : argent(vente.revenuTTC, vente.devise)}</span>
    {vente.revenuTTC == null && <p className="text-xs text-amber-800">Avoir à ventiler · hors total identifié</p>}
    {vente.facture.statut === 'annulee' && <p className="text-xs text-muted-foreground">Facture annulée</p>}
    {vente.montantAvoirs > 0 && <p className="text-xs text-muted-foreground">Après {argent(vente.montantAvoirs, vente.devise)} d’avoirs</p>}</>
}

export function PiecesCommerciales({ vente }: { vente: VenteCommercialeVerger }) {
  return <div className="space-y-1 text-xs">
    {vente.documents.map(document => <Link key={document.id} className="block text-primary underline" href={`/comptabilite/factures?tab=livraisons&anneeDocuments=all&document=${document.id}`}>{document.numero}</Link>)}
    {vente.facture && <Link className="block text-primary underline" href={`/comptabilite/factures?id=${vente.facture.id}`}>{vente.facture.numero}</Link>}
  </div>
}

export function RevenusProductions({ direct, commercial, className }: { direct: number; commercial: VenteCommercialeVerger[]; className?: string }) {
  const montants = new Map<string, number>([['EUR', direct]])
  for (const vente of commercial) if (vente.revenuTTC != null) montants.set(vente.devise, (montants.get(vente.devise) ?? 0) + vente.revenuTTC)
  const aVerifier = commercial.filter(vente => vente.revenuTTC == null).length
  return <div className={className}>
    {[...montants].filter(([, montant]) => montants.size === 1 || montant !== 0).map(([devise, montant]) => <p key={devise}>{argent(montant, devise)} {aVerifier ? 'CA identifié' : 'CA'}</p>)}
    {aVerifier > 0 && <p className="text-xs text-amber-800">{aVerifier} vente(s) avec avoir à vérifier</p>}
  </div>
}
