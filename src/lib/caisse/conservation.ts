/**
 * Stub public. La caisse de marché n'est pas distribuée : sur gleba.fr, ce
 * module refuse la suppression d'un compte ou de ses données tant que des
 * encaissements réels doivent être conservés (voir docs/private-stubs.md).
 * Sans elle, il n'y a rien à conserver ni à purger.
 */
import type { NextResponse } from 'next/server'

export const refusConservationCaisse: (userId: string, portee: 'compte' | 'donnees', db?: unknown) => Promise<NextResponse | null> =
  async () => null

export const purgerCaisseEntrainementTx: (tx: unknown, userId: string) => Promise<void> = async () => {}

/** Sans boutique reliée au stock ni caisse, aucun journal de stock n'existe : rien à purger. */
export const purgerJournauxStockTx: (tx: unknown, userId: string) => Promise<void> = async () => {}
