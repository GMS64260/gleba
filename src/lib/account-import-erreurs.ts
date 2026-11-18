/** Une référence obligatoire indisponible annule toute la transaction d'import. */
export class ErreurReferenceObligatoireAbsente extends Error {
  constructor(
    public readonly modele: string,
    public readonly champ: string,
    public readonly nombre: number,
  ) {
    // Aucune clé ni distinction absent/privé : le refus ne décrit que le fichier.
    super(`Restauration annulée intégralement : ${nombre} ligne(s) ${modele} dépendent d'une référence obligatoire indisponible (${champ}). Aucune donnée n'a été enregistrée ni modifiée.`)
    this.name = "ErreurReferenceObligatoireAbsente"
  }
}
