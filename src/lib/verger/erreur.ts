export class ErreurVerger extends Error {
  constructor(message: string, public status = 400, public champ?: string) { super(message) }
}
