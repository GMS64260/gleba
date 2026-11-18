/**
 * Harnais du test du lanceur de reprise BL-01 (chargé par `node -r`).
 *
 * Seul le client Prisma du script est enveloppé ; toutes les autres requêtes,
 * transactions et validations sont réelles (base jetable `gleba_tests`).
 * - BL01_PERIMETRE : identifiants d'exploitation (séparés par des virgules)
 *   auxquels la reprise est restreinte, pour ne pas toucher les données des
 *   autres suites qui partagent la base jetable ;
 * - BL01_PANNE_LECTURE : exploitation dont la lecture préalable échoue
 *   (panne P2024 simulée, comme une saturation du pool de connexions) ;
 * - BL01_PANNE_GENERALE : la recherche des exploitations échoue ;
 * - BL01_PANNE_ECRITURE_DES : rang (à partir de 1) du renommage du rapport à
 *   partir duquel tous les renommages échouent (EIO simulé, disque en panne).
 */
// Chargé par `node -r` avant tout module : seul require() est disponible ici.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('node:module')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs')

const panneEcriture = Number(process.env.BL01_PANNE_ECRITURE_DES ?? 0)
if (panneEcriture > 0) {
  const renommer = fs.renameSync
  let rang = 0
  fs.renameSync = function (...args) {
    if (++rang >= panneEcriture) throw Object.assign(new Error('EIO : panne d’écriture simulée'), { code: 'EIO' })
    return renommer.apply(this, args)
  }
  Module.syncBuiltinESMExports()
}

const charger = Module._load
Module._load = function (nom) {
  const reel = charger.apply(this, arguments)
  if (nom !== '@prisma/client') return reel
  const perimetre = (process.env.BL01_PERIMETRE ?? '').split(',').filter(Boolean)
  return {
    ...reel,
    PrismaClient: class extends reel.PrismaClient {
      constructor(...args) {
        super(...args)
        return this.$extends({ query: { recolte: {
          async groupBy({ args, query }) {
            if (process.env.BL01_PANNE_GENERALE) throw Object.assign(new Error('P2024 : panne simulée de la recherche des exploitations'), { code: 'P2024' })
            return query(perimetre.length ? { ...args, where: { AND: [args.where ?? {}, { userId: { in: perimetre } }] } } : args)
          },
          async findMany({ args, query }) {
            if (process.env.BL01_PANNE_LECTURE && args.where?.userId === process.env.BL01_PANNE_LECTURE) {
              throw Object.assign(new Error('P2024 : panne de lecture simulée'), { code: 'P2024' })
            }
            return query(args)
          },
        } } })
      }
    },
  }
}
