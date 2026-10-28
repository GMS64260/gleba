/** Refus métier : une transaction le propage pour annuler toutes ses écritures. */
export class ErreurElevage extends Error {
  constructor(message: string, readonly status = 409, readonly code?: string, readonly details?: unknown) {
    super(message)
    this.name = 'ErreurElevage'
  }
}
