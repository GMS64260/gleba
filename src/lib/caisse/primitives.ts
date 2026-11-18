// Module feuille de la caisse : aucune dépendance interne, importable par modele.ts et fiscalite.ts
// sans cycle d'imports (modele.ts importe fiscalite.ts, qui n'importe plus modele.ts qu'en type).
export class ErreurCaisse extends Error {
  constructor(
    message: string,
    readonly status = 409,
    readonly code = "CAISSE_CONFLIT",
  ) {
    super(message);
  }
}
function exiger(test: unknown, message: string): asserts test {
  if (!test) throw new ErreurCaisse(message);
}
export function repartir(total: number, poids: number[]): number[] {
  const somme = poids.reduce((a, b) => a + b, 0);
  exiger(total <= somme, "La remise dépasse le montant du panier.");
  if (!somme) return poids.map(() => 0);
  const parts = poids.map((p) => Number(BigInt(total) * BigInt(p) / BigInt(somme)));
  const ordre = poids
    .map((p, i) => ({ i, reste: (BigInt(total) * BigInt(p)) % BigInt(somme) }))
    .sort((a, b) =>
      a.reste === b.reste ? a.i - b.i : a.reste > b.reste ? -1 : 1,
    );
  for (let r = total - parts.reduce((a, b) => a + b, 0), i = 0; r > 0; r--, i++)
    parts[ordre[i].i]++;
  return parts;
}
