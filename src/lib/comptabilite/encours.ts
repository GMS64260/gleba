import prisma from '@/lib/prisma'
import { construireImpayees } from './impayees'
import {
  enrichirFacturesReglements,
  enrichirMiroirsReglements,
  enrichirVentesElevageReglements,
} from './projection-reglements'
/** Même périmètre pour les créances et leurs trois représentations comptables. */
export async function chargerEncoursCompta(userId: string, debut: Date | null, fin: Date) {
  const date = { ...(debut ? { gte: debut } : {}), lte: fin }
  const [factures, ventes, manuelles, depenses] = await Promise.all([
    prisma.facture.findMany({ where: { userId, date, statut: { in: ['emise', 'payee'] } } }),
    prisma.venteProduit.findMany({ where: { userId, date, annule: false, factureId: null } }),
    prisma.venteManuelle.findMany({ where: { userId, date } }),
    prisma.depenseManuelle.findMany({ where: { userId, date, comptable: true } }),
  ])
  // Les avoirs d'un autre exercice peuvent aussi corriger une facture de la
  // période : l'identité d'origine fait foi, pas la date du miroir.
  const avoirsManquants = factures.filter((f) => f.type !== 'avoir').length
    ? await prisma.facture.findMany({
        where: {
          userId,
          type: 'avoir',
          statut: { in: ['emise', 'payee'] },
          date: { lte: fin },
          factureOrigineId: { in: factures.filter((f) => f.type !== 'avoir').map((f) => f.id) },
          id: { notIn: factures.map((f) => f.id) },
        },
      })
    : []
  const [fs, vs, ms, ds] = await Promise.all([
    enrichirFacturesReglements(userId, [...factures, ...avoirsManquants], fin),
    enrichirVentesElevageReglements(userId, ventes, fin),
    enrichirMiroirsReglements(userId, 'vente', manuelles, fin),
    enrichirMiroirsReglements(userId, 'depense', depenses, fin),
  ])
  const credits = new Map<number, number>()
  for (const f of fs)
    if (f.type === 'avoir' && f.factureOrigineId)
      credits.set(f.factureOrigineId, (credits.get(f.factureOrigineId) ?? 0) + f.totalTTC)
  const facturesProjetees = fs.map((f) => {
    const statut =
      f.type !== 'avoir' && f.montantRegle != null
        ? Math.round((f.totalTTC - (credits.get(f.id) ?? 0) - f.montantRegle) * 100) > 0
          ? 'emise'
          : 'payee'
        : f.statut === 'payee' && f.datePaiement && f.datePaiement > fin
          ? 'emise'
          : f.statut
    return { ...f, statut, date: f.date.toISOString() }
  })
  const creances = construireImpayees({
    factures: facturesProjetees,
    ventes: vs
      .filter((v) => (v.montantRegle != null ? (v.resteAPayer ?? 0) > 0 : !v.paye))
      .map((v) => ({ ...v, date: v.date.toISOString() })),
    ventesManuelles: ms
      .filter((m) => (m.montantRegle != null ? (m.resteAPayer ?? 0) > 0 : !m.paye))
      .map((m) => ({ ...m, date: m.date.toISOString(), client: m.clientNom })),
  })
  const dettes = ds
    .filter((d) => (d.montantRegle != null ? (d.resteAPayer ?? 0) > 0 : !d.paye))
    .map((d) => ({ id: d.id, montant: d.resteAPayer ?? d.montant }))
    .filter((d) => d.montant > 0)
  return {
    creances,
    dettes: {
      total: Math.round(dettes.reduce((n, d) => n + d.montant, 0) * 100) / 100,
      nombre: dettes.length,
    },
  }
}
