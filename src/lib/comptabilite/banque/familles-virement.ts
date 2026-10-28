/** Ces flux déplacent la trésorerie et ne règlent pas une pièce commerciale. */
export const FAMILLES_VIREMENT: readonly string[] = [
  'payout',
  'payout_cancel',
  'payout_failure',
  'transfer',
  'transfer_cancel',
]
export function estFamilleVirement(famille: string): boolean {
  return FAMILLES_VIREMENT.includes(famille)
}
