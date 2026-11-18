/**
 * Unités admises par les exports structurés, sans conversion des quantités.
 * Sources UN/CEFACT vérifiées le 18/11/2026 :
 * - Rec. 20 : H87 = piece, un article individuel (ici une tige).
 *   https://service.unece.org/trade/uncefact/vocabulary/rec20/
 * - Rec. 21 : BH = Bunch (botte), préfixé X pour une unité de mesure.
 *   https://vocabulary.uncefact.org/PackageTypeCodeList#BH
 * - Liste Rec. 20 + Rec. 21 et usage BT-130, publication mai 2026 :
 *   https://docs.peppol.eu/poacc/billing/3.0/codelist/UNECERec20/
 *   https://docs.peppol.eu/poacc/billing/3.0/syntax/ubl-invoice/cac-InvoiceLine/cbc-InvoicedQuantity/unitCode/
 * Les codes historiques sont conservés. Une botte reste une botte, sans
 * supposer son nombre de tiges. Le libellé agricole accompagne son code.
 */
const UNIT_CODES: ReadonlyArray<{
  unite: string
  code: string
  variantes: readonly string[]
  description?: string
}> = [
  { unite: 'unité', code: 'C62', variantes: ['unite', 'unites', 'unités'] },
  { unite: 'pièce', code: 'C62', variantes: ['piece', 'pieces', 'pièces'] },
  { unite: 'kg', code: 'KGM', variantes: [] },
  { unite: 'g', code: 'GRM', variantes: [] },
  { unite: 'litre', code: 'LTR', variantes: ['l', 'litres'] },
  { unite: 'heure', code: 'HUR', variantes: ['h', 'heures'] },
  { unite: 'lot', code: 'SET', variantes: ['lots'] },
  { unite: 'tige', code: 'H87', variantes: ['tiges'], description: 'Unité de vente : tige' },
  { unite: 'botte', code: 'XBH', variantes: ['bottes'], description: 'Unité de vente : botte' },
]

// Map exclut aussi les clés héritées d'Object (constructor, __proto__…).
const PAR_VARIANTE = new Map(UNIT_CODES.flatMap(unite =>
  [unite.unite, ...unite.variantes].map(variante => [variante, unite] as const),
))

/** Variantes explicites uniquement : pas de retrait automatique du « s ». */
export function normaliserUniteFacture(value?: string | null): string {
  const nettoyee = (value ?? '').normalize('NFC').trim().toLocaleLowerCase('fr-FR')
  return PAR_VARIANTE.get(nettoyee)?.unite ?? nettoyee
}

/** null signifie refus ; aucune unité inconnue ne devient une pièce. */
export function codeUnite(value?: string | null): string | null {
  return PAR_VARIANTE.get(normaliserUniteFacture(value))?.code ?? null
}

export function descriptionUniteFacture(value?: string | null): string | null {
  return PAR_VARIANTE.get(normaliserUniteFacture(value))?.description ?? null
}
