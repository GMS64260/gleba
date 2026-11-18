import prisma from '@/lib/prisma'
import type { Devise } from '@/lib/territoires'
import { construireImpayees } from './impayees'
import { monnaieVente } from './devise-vente'
import { projeterDevisesImpayees } from './ventilation-impayees'
import { chargerMonnaiesDepenses } from './devise-ecritures'
import {
  enrichirFacturesReglements,
  enrichirMiroirsReglements,
  enrichirVentesElevageReglements,
} from './projection-reglements'
/**
 * Même périmètre pour les créances et leurs trois représentations comptables.
 * Avec `deviseCourante`, chaque vente manuelle porte sa devise figée
 * (`monnaie`) pour la ventilation par devise ; sans, elle n'en porte pas.
 */
export async function chargerEncoursCompta(userId: string, debut: Date | null, fin: Date, deviseCourante?: Devise | null) {
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
      .map((m) => ({
        ...m, date: m.date.toISOString(), client: m.clientNom,
        ...(deviseCourante !== undefined ? { monnaie: monnaieVente(m, deviseCourante) } : {}),
      })),
  })
  const dettesRestantes = ds
    .filter((d) => (d.montantRegle != null ? (d.resteAPayer ?? 0) > 0 : !d.paye))
    .filter((d) => (d.resteAPayer ?? d.montant) > 0)
  // Devise d'une dette : celle de son dossier de règlement (figée), sinon la
  // devise courante (lot devise-totaux-api, tour 2).
  const monnaiesDettes = deviseCourante !== undefined
    ? await chargerMonnaiesDepenses(userId, dettesRestantes, deviseCourante)
    : null
  const dettes = dettesRestantes.map((d) => ({
    id: d.id,
    montant: d.resteAPayer ?? d.montant,
    ...(monnaiesDettes ? { monnaie: monnaiesDettes.get(d.id) ?? null } : {}),
  }))
  return {
    creances: {
      ...creances,
      items: projeterDevisesImpayees(creances.items, {
        factures: facturesProjetees,
        ventesManuelles: ms.map((m) => ({ id: m.id, ...(deviseCourante !== undefined ? { monnaie: monnaieVente(m, deviseCourante) } : {}) })),
      }),
    },
    dettes: {
      total: Math.round(dettes.reduce((n, d) => n + d.montant, 0) * 100) / 100,
      nombre: dettes.length,
      /** Dettes une à une ; `monnaie` seulement quand `deviseCourante` est fournie. */
      items: dettes as Array<{ id: number; montant: number; monnaie?: Devise | null }>,
    },
  }
}
