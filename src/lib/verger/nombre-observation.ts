type ChampNombreObservation = "nbVivants" | "nbMorts" | "nbManquants" | "tauxReprise" | "hauteurMoyenneCm"

export class NombreObservationInvalide extends Error {
  constructor(public readonly champ: ChampNombreObservation, message: string) {
    super(message)
  }
}

/** Une absence reste facultative ; seule une valeur numérique finie est une saisie. */
export function lireNombreObservation(valeur: unknown, champ: ChampNombreObservation): number | null {
  if (valeur === undefined || valeur === null || (typeof valeur === "string" && valeur.trim() === "")) return null

  const nombre = typeof valeur === "number" || typeof valeur === "string" ? Number(valeur) : NaN
  if (!Number.isFinite(nombre)) {
    throw new NombreObservationInvalide(champ, "Saisissez un nombre fini pour ce champ")
  }
  if (champ === "nbVivants" || champ === "nbMorts" || champ === "nbManquants") {
    // Les effectifs sont stockés en Int PostgreSQL, sans troncature des décimales.
    if (!Number.isInteger(nombre) || nombre < 0 || nombre > 2147483647) {
      throw new NombreObservationInvalide(champ, "Saisissez un nombre entier de plants entre 0 et 2 147 483 647")
    }
  }
  if (champ === "tauxReprise" && (nombre < 0 || nombre > 100)) {
    throw new NombreObservationInvalide(champ, "Le taux de reprise doit être compris entre 0 et 100 %")
  }
  return nombre
}
