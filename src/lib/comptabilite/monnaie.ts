/** Les sommes de règlements sont calculées en centimes entiers. */
export class ErreurReglement extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
    this.name = 'ErreurReglement'
  }
}

export function entierCentimes(valeur: number | bigint): number {
  const n = Number(valeur)
  if (!Number.isSafeInteger(n))
    throw new ErreurReglement('Montant hors des limites de précision.', 400)
  return n
}

export function enCentimes(valeur: number): number {
  if (!Number.isFinite(valeur)) throw new ErreurReglement('Montant invalide.', 400)
  return entierCentimes(Math.round((valeur + Math.sign(valeur) * Number.EPSILON) * 100))
}

export function lireMontant(valeur: unknown): number {
  if (typeof valeur !== 'string' && typeof valeur !== 'number')
    throw new ErreurReglement('Montant requis.', 400)
  const texte = String(valeur)
    .trim()
    .replace(/[\u00a0\u202f ]/g, '')
    .replace(',', '.')
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(texte))
    throw new ErreurReglement('Saisissez un montant avec deux décimales au maximum.', 400)
  const negatif = texte.startsWith('-')
  const [unites, decimales = ''] = texte.replace('-', '').split('.')
  const cents = BigInt(unites) * BigInt(100) + BigInt(decimales.padEnd(2, '0'))
  return entierCentimes(negatif ? -cents : cents)
}

export function soldeReglement(
  total: number,
  regle: number,
  historiquePaye = false,
  detaille = true,
) {
  const montantRegle = detaille ? regle : historiquePaye ? total : 0
  return {
    detaille,
    montantTotal: total / 100,
    montantRegle: montantRegle / 100,
    resteAPayer: Math.max(0, total - montantRegle) / 100,
    tropPercu: Math.max(0, montantRegle - total) / 100,
    statut: montantRegle <= 0 ? 'non_regle' : montantRegle < total ? 'partiel' : 'regle',
  }
}
