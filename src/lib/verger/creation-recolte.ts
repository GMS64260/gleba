import prisma from '@/lib/prisma'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { normaliserDateApi } from '@/lib/validations/date-api'
import { snapshotStatutBio, STATUTS_BIO } from '@/lib/statut-bio'
import { prochainNumeroLotVerger } from './numero-lot'
import { alerteSaisonRecolteArbre, chargerPeriodesRecolteVarietes } from './saison-recolte-arbre'
import { avertissementsDarFruit } from './dar'
import { ErreurVerger } from './erreur'

export function dateRecolteApi(valeur: unknown, champ: string, defaut?: Date): Date | null {
  const r = normaliserDateApi(valeur)
  if (!r.ok) throw new ErreurVerger('Date invalide.', 400, champ)
  return r.value ?? defaut ?? null
}

export function prixFruitApi(valeur: unknown, champ: string): number | null | undefined {
  if (valeur === undefined || valeur === null) return valeur
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < 0) throw new ErreurVerger('Le prix doit être un nombre positif ou nul.', 400, champ)
  return valeur
}

/** Point d'entrée commun au formulaire et aux outils de l'assistant. */
export async function creerRecolteFruit(userId: string, saisie: Record<string, unknown>) {
  if (!saisie || typeof saisie !== 'object' || Array.isArray(saisie)) throw new ErreurVerger('Données invalides.')
  const arbreId = Number(saisie.arbreId)
  if (!Number.isInteger(arbreId) || arbreId <= 0) throw new ErreurVerger("L'arbre est requis.", 400, 'arbreId')
  if (typeof saisie.quantite !== 'number' || !Number.isFinite(saisie.quantite) || saisie.quantite <= 0) throw new ErreurVerger('La quantité doit être supérieure à zéro.', 400, 'quantite')
  const quantite = saisie.quantite
  const prixKg = prixFruitApi(saisie.prixKg, 'prixKg')
  const date = dateRecolteApi(saisie.date, 'date', new Date())!
  const datePeremption = dateRecolteApi(saisie.datePeremption, 'datePeremption')
  const texte = (champ: string) => {
    const v = saisie[champ]
    if (v == null || v === '') return null
    if (typeof v !== 'string') throw new ErreurVerger('Texte invalide.', 400, champ)
    return v.trim() || null
  }
  const bioSaisi = texte('statutBioSnapshot')
  if (bioSaisi && !(STATUTS_BIO as readonly string[]).includes(bioSaisi)) throw new ErreurVerger('Statut bio invalide.', 400, 'statutBioSnapshot')
  return prisma.$transaction(async tx => {
    await verrouillerStockCommercial(tx, userId)
    const arbre = await tx.arbre.findFirst({ where: { id: arbreId, userId }, include: {
      parcelleGeo: { select: { id: true, nom: true, statutBio: true, dateDebutConversion: true } },
    } })
    if (!arbre) throw new ErreurVerger('Arbre non trouvé.', 404, 'arbreId')
    const parcelleId = texte('parcelleId') ?? arbre.parcelleGeo?.id ?? null
    const parcelle = parcelleId ? await tx.parcelleGeo.findFirst({ where: { id: parcelleId, userId },
      select: { id: true, nom: true, statutBio: true, dateDebutConversion: true } }) : null
    if (parcelleId && !parcelle) throw new ErreurVerger('Parcelle non trouvée.', 400, 'parcelleId')
    const zone = arbre.zoneId ? await tx.zoneVerger.findFirst({ where: { id: arbre.zoneId, userId }, select: { statutBio: true, dateDebutConversion: true } }) : null
    const sourceBio = parcelleId && parcelleId !== arbre.parcelleGeoId ? parcelle : zone ?? parcelle
    const statutBioSnapshot = bioSaisi ?? (sourceBio ? snapshotStatutBio(sourceBio.statutBio, sourceBio.dateDebutConversion, date) : null)
    const avertissements: string[] = []
    if (!parcelleId) avertissements.push("Cet arbre n'est rattaché à aucune parcelle : le lot porte NA. Choisissez sa parcelle d'origine pour compléter la traçabilité.")
    const doublon = await tx.recolteArbre.findFirst({ where: { userId, arbreId, quantite, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } }, select: { id: true } })
    if (doublon) avertissements.push('Une récolte identique a été enregistrée récemment. Pour une correction, modifiez la première récolte.')
    const periodes = await chargerPeriodesRecolteVarietes(tx, userId, [arbre])
    const saison = alerteSaisonRecolteArbre({ espece: arbre.espece, variete: periodes.get(arbre), date })
    const warnings = [...(saison ? [saison.message] : []), ...await avertissementsDarFruit(tx, userId, arbreId, parcelleId, date)]
    const numLot = texte('numLot') ?? await prochainNumeroLotVerger(tx, userId, { date, parcelleNom: parcelle?.nom ?? null, espece: arbre.espece })
    const recolte = await tx.recolteArbre.create({ data: { userId, arbreId, quantite, date, prixKg, datePeremption,
      qualite: texte('qualite'), notes: texte('notes'), statut: 'en_stock', parcelleId, numLot, statutBioSnapshot,
      categorieCommerciale: texte('categorieCommerciale'), destinationCommerce: texte('destinationCommerce'), conditionnement: texte('conditionnement'),
    }, include: { arbre: { select: { id: true, nom: true, type: true } }, parcelle: { select: { id: true, nom: true } } } })
    return { ...recolte, ...(warnings.length ? { warnings } : {}), ...(avertissements.length ? { avertissements } : {}) }
  })
}
