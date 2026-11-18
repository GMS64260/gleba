type IdentiteEcritureFec = Readonly<{ JournalCode: string; EcritureNum: string }>

/** Les numéros FEC redémarrent par journal ; même définition que le contrôle d'équilibre. */
export function cleEcritureFec(ligne: IdentiteEcritureFec): string {
  return `${ligne.JournalCode}-${ligne.EcritureNum}`
}

export function compterEcrituresFec(lignes: readonly IdentiteEcritureFec[]): number {
  return new Set(lignes.map(cleEcritureFec)).size
}
