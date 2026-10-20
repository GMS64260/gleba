/**
 * Base de référentiel simulée en mémoire pour les tests d'isolation entre
 * comptes (revue du 2026-10-20).
 *
 * Le délégué applique RÉELLEMENT le `where` que la route lui passe (formes
 * utilisées par les lectures de référentiel : AND, OR, NOT, égalité, null,
 * in, not, contains, has, filtre de relation) ainsi que les `where` des
 * relations incluses. Un test prouve donc ce que la route laisse sortir, au
 * lieu de rendre une ligne choisie d'avance.
 */

import { vi } from 'vitest'

export type Ligne = Record<string, unknown>

const OPERATEURS = new Set([
  'in',
  'notIn',
  'not',
  'equals',
  'contains',
  'startsWith',
  'mode',
  'has',
  'gt',
  'gte',
  'lt',
  'lte',
])

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

function appliquerOperateurs(valeur: unknown, ops: Record<string, unknown>): boolean {
  return Object.entries(ops).every(([op, attendu]) => {
    switch (op) {
      case 'mode':
        return true
      case 'in':
        return (attendu as unknown[]).includes(valeur)
      case 'notIn':
        return !(attendu as unknown[]).includes(valeur)
      case 'equals':
        return valeur === attendu
      case 'not':
        if (attendu === null) return valeur != null
        return estObjet(attendu) ? !appliquerOperateurs(valeur, attendu) : valeur !== attendu
      case 'contains':
      case 'startsWith': {
        if (typeof valeur !== 'string') return false
        const insensible = ops.mode === 'insensitive'
        const v = insensible ? valeur.toLowerCase() : valeur
        const a = insensible ? String(attendu).toLowerCase() : String(attendu)
        return op === 'contains' ? v.includes(a) : v.startsWith(a)
      }
      case 'has':
        return Array.isArray(valeur) && valeur.includes(attendu)
      case 'gt':
        return (valeur as number) > (attendu as number)
      case 'gte':
        return (valeur as number) >= (attendu as number)
      case 'lt':
        return (valeur as number) < (attendu as number)
      case 'lte':
        return (valeur as number) <= (attendu as number)
      default:
        throw new Error(`Opérateur non simulé : ${op}`)
    }
  })
}

/** Vrai si la ligne satisfait le `where` Prisma. */
export function correspond(ligne: Ligne, where: unknown): boolean {
  if (where == null) return true
  if (!estObjet(where)) throw new Error('where invalide')
  return Object.entries(where).every(([cle, cond]) => {
    if (cond === undefined) return true
    if (cle === 'AND') {
      return (Array.isArray(cond) ? cond : [cond]).every((c) => correspond(ligne, c))
    }
    if (cle === 'OR') return (cond as unknown[]).some((c) => correspond(ligne, c))
    if (cle === 'NOT') {
      return !(Array.isArray(cond) ? cond : [cond]).some((c) => correspond(ligne, c))
    }
    const valeur = ligne[cle]
    if (!estObjet(cond)) return valeur === cond
    if (Object.keys(cond).some((k) => OPERATEURS.has(k))) return appliquerOperateurs(valeur, cond)
    // Filtre de relation to-one : la ligne liée doit correspondre.
    if (estObjet(valeur)) return correspond(valeur, cond)
    if (valeur == null) return false
    throw new Error(`Filtre non simulé sur « ${cle} »`)
  })
}

type Projection = Record<string, unknown> | undefined

/** Applique `include` / `select` : `where` des relations listes, champs choisis. */
function projeter(ligne: Ligne, include: Projection, select: Projection): Ligne {
  const relation = (valeur: unknown, spec: unknown): unknown => {
    if (!estObjet(spec)) return valeur
    if (Array.isArray(valeur)) {
      const gardees = valeur.filter((v) => correspond(v as Ligne, spec.where))
      return gardees.map((v) => projeter(v as Ligne, spec.include as Projection, spec.select as Projection))
    }
    if (estObjet(valeur)) return projeter(valeur, spec.include as Projection, spec.select as Projection)
    return valeur
  }
  if (select) {
    const sortie: Ligne = {}
    for (const [cle, spec] of Object.entries(select)) {
      if (!spec || !(cle in ligne)) continue
      sortie[cle] = cle === '_count' ? ligne[cle] : relation(ligne[cle], spec)
    }
    return sortie
  }
  // Comme Prisma : les colonnes, plus les seules relations incluses.
  const estRelation = (v: unknown) =>
    estObjet(v) || (Array.isArray(v) && v.some((e) => estObjet(e)))
  const sortie: Ligne = Object.fromEntries(
    Object.entries(ligne).filter(([, v]) => !estRelation(v)),
  )
  for (const [cle, spec] of Object.entries(include ?? {})) {
    if (!spec || !(cle in ligne)) continue
    sortie[cle] = cle === '_count' ? ligne[cle] : relation(ligne[cle], spec)
  }
  return sortie
}

type Args = { where?: unknown; include?: Projection; select?: Projection } | undefined

/** Délégué Prisma (findMany, findFirst, findUnique, count, update, delete) sur des lignes en mémoire. */
export function delegueMemoire(lignes: Ligne[]) {
  const lire = (args: Args) =>
    lignes
      .filter((l) => correspond(l, args?.where))
      .map((l) => projeter(l, args?.include, args?.select))
  return {
    findMany: vi.fn(async (args?: Args) => lire(args)),
    findFirst: vi.fn(async (args?: Args) => lire(args)[0] ?? null),
    findUnique: vi.fn(async (args?: Args) => lire(args)[0] ?? null),
    count: vi.fn(async (args?: Args) => lignes.filter((l) => correspond(l, args?.where)).length),
    update: vi.fn(async (args: { where: { id: string }; data: Ligne }) => {
      const ligne = lignes.find((l) => l.id === args.where.id)
      if (!ligne) throw new Error('ligne absente')
      return { ...ligne, ...args.data }
    }),
    delete: vi.fn(async (args: { where: { id: string } }) => ({ id: args.where.id })),
  }
}

/**
 * Jeu type d'un référentiel vu par le compte « moi » : catalogue Gleba, entrée
 * du compte, entrée partagée par « autre », entrée privée de « autre ».
 */
export const MOI = 'compte-moi'
export const AUTRE = 'compte-autre'

export function jeuReferentiel<T extends Ligne>(base: (id: string, nom: string) => T) {
  return {
    gleba: { ...base('gleba-1', 'Entrée Gleba'), userId: null, partageCommunaute: false },
    moi: { ...base('cm-moi', 'Entrée du compte'), userId: MOI, partageCommunaute: false },
    partagee: { ...base('cm-partagee', 'Entrée partagée'), userId: AUTRE, partageCommunaute: true },
    privee: { ...base('cm-privee', 'Entrée privée secrète'), userId: AUTRE, partageCommunaute: false },
  }
}

/** Session NextAuth minimale de `requireAuthApi`. */
export const sessionDe = (id: string, role: 'USER' | 'ADMIN' = 'USER') => ({
  error: null,
  session: { user: { id, role } },
})
