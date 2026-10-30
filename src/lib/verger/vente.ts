import { etatSortiesLotVerger, sortirReliquatVerger } from './sortie-stock'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { verrouillerStockCommercial } from '@/lib/stocks/verrou-commercial'
import { createVenteFromRecolteArbre, createVenteFromProductionBois, deleteAutoEntry } from '@/lib/auto-compta'
import { annulerFactureLiee, creerFacture } from '@/lib/facture-utils'
import { ajouterReglementTx } from '@/lib/comptabilite/reglements'
import { modeReglementSchema, modePaiementDepuisReglement } from '@/lib/validations/reglement'
import { nouveauReglementSchema } from '@/lib/validations/reglements'
import { suiviReglementActif, suiviReglementParCle } from '@/lib/comptabilite/suivi-reglement-source'
import { cleSourceReglement } from '@/lib/comptabilite/cle-reglement'
import { finJourLivraison } from '@/lib/commercial/dates-stock'
import { indisponibiliteLotVerger } from './disponibilite-lot'
import { quantiteBois } from '@/lib/commercial/stock-types'
import { invalidateKpi } from '@/lib/kpi/cache'
import { ErreurVerger } from './erreur'
import { prixFruitApi, dateRecolteApi } from './creation-recolte'
import { montantVenteFruit } from './montant-vente'
import { libellesVenteBois } from './production-bois'
import { avertissementsDarFruit } from './dar'
import { TAUX_TVA_BOIS_PAR_DEFAUT } from './tva-bois'

/** Lecture et décision sous le même verrou que les BL et les règlements. */
export async function modifierVenteVerger(type: 'fruit' | 'bois', userId: string, acteurId: string, id: number, saisie: Record<string, unknown>) {
  if (!saisie || typeof saisie !== 'object' || Array.isArray(saisie)) throw new ErreurVerger('Données invalides.')
  if (!Number.isInteger(id) || id <= 0) throw new ErreurVerger('ID invalide.')
  const sortiePhysique = (type === 'fruit' ? ['perte', 'consomme'] : ['utilise']).includes(String(saisie.statut))
  if (!sortiePhysique && ['quantite', 'quantiteVendue', 'arbreId', 'parcelleId', 'date'].some(c => saisie[c] !== undefined)) throw new ErreurVerger('Corrigez la récolte avant sa vente. Pour une vente partielle, préparez un bon de livraison.')
  const autorises = type === 'fruit' ? ['en_stock', 'vendu', 'consomme', 'perte'] : ['en_stock', 'vendu', 'utilise']
  if (saisie.statut !== undefined && !autorises.includes(String(saisie.statut))) throw new ErreurVerger('Statut invalide.', 400, 'statut')
  for (const champ of ['paye', 'creerFacture']) if (saisie[champ] !== undefined && typeof saisie[champ] !== 'boolean') throw new ErreurVerger('Valeur attendue : oui ou non.', 400, champ)
  const prixKgSaisi = prixFruitApi(saisie.prixKg, 'prixKg')
  const totalSaisi = prixFruitApi(type === 'fruit' ? saisie.prixTotal : saisie.prixVente, type === 'fruit' ? 'prixTotal' : 'prixVente')
  const mode = modeReglementSchema.safeParse(saisie.modeReglement)
  if (!mode.success || (saisie.paye === true && (!mode.data || mode.data === 'À crédit'))) throw new ErreurVerger('Choisissez le mode du règlement reçu.', 400, 'modeReglement')
  if (saisie.clientId != null && (!Number.isInteger(saisie.clientId) || Number(saisie.clientId) <= 0)) throw new ErreurVerger('Client invalide.', 400, 'clientId')
  const texte = (champ: string) => {
    const v = saisie[champ]
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    if (typeof v !== 'string') throw new ErreurVerger('Texte invalide.', 400, champ)
    return v.trim() || null
  }
  const resultat = await prisma.$transaction(async tx => {
    await verrouillerStockCommercial(tx, userId)
    const table = type === 'fruit' ? 'recoltes_arbres' : 'production_bois'
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(table)} WHERE id = ${id} AND user_id = ${userId} FOR UPDATE`)
    const fruit = type === 'fruit' ? await tx.recolteArbre.findUnique({ where: { id, userId }, include: { arbre: true } }) : null
    const bois = type === 'bois' ? await tx.productionBois.findUnique({ where: { id, userId }, include: { arbre: true } }) : null
    const courant = fruit ?? bois
    if (!courant) throw new ErreurVerger('Lot introuvable.', 404)
    if (sortiePhysique) return sortirReliquatVerger(tx, userId, type, courant, saisie)
    if (courant.stockDisponibleCommercial != null) {
      // Une vente directe porte le lot entier : un lot entamé se vend par BL.
      if ((await etatSortiesLotVerger(tx, userId, type, courant)).fige) throw new ErreurVerger('Ce lot est lié à un document commercial. Utilisez le BL ou sa facture pour son reliquat et ses retours.', 409)
      throw new ErreurVerger('Ce lot a des pertes ou usages internes enregistrés. Vendez son reliquat par un bon de livraison, ou annulez ces sorties depuis l’historique pour vendre le lot entier.', 409)
    }
    const statut = saisie.statut === undefined ? courant.statut : String(saisie.statut)
    if (saisie.statut === 'vendu' && courant.statut === 'vendu') throw new ErreurVerger('Ce lot est déjà vendu. Actualisez la liste avant une nouvelle action.', 409)
    const nouvelleVente = statut === 'vendu' && courant.statut !== 'vendu'
    const sourceType = fruit ? 'recolte_arbre' : 'production_bois'
    if (nouvelleVente && courant.statut !== 'en_stock') throw new ErreurVerger('Remettez ce lot en stock avant de le vendre.', 409)
    if (nouvelleVente && await suiviReglementParCle(tx, userId, cleSourceReglement('vente', sourceType, id))) throw new ErreurVerger('Ce lot possède déjà un historique de vente et de règlements. Préparez un nouveau BL pour revendre le stock retourné avec son propre suivi.', 409)
    if (courant.statut === 'vendu' && saisie.paye !== undefined) throw new ErreurVerger('Corrigez les versements depuis Règlements pour conserver leur historique.', 409)
    if (courant.factureId && saisie.creerFacture) throw new ErreurVerger('Ce lot est déjà facturé.', 409)
    if (courant.factureId && statut === 'vendu' && ['prixKg', 'prixTotal', 'prixVente', 'dateVente', 'clientId', 'clientNom'].some(c => saisie[c] !== undefined)) throw new ErreurVerger('Cette vente est facturée. Corrigez-la avec un avoir depuis Comptabilité > Factures.', 409)
    if (saisie.clientId) {
      const client = await tx.client.findFirst({ where: { id: Number(saisie.clientId), userId }, select: { id: true } })
      if (!client) throw new ErreurVerger('Client introuvable.', 400, 'clientId')
    }
    let factureId = courant.factureId
    if (factureId && courant.statut === 'vendu' && statut !== 'vendu') {
      const annulation = await annulerFactureLiee(tx, userId, factureId)
      if (!annulation.ok) throw new ErreurVerger(annulation.raison, 409)
      factureId = null
    }
    const dateVente = statut === 'vendu'
      ? saisie.dateVente !== undefined ? dateRecolteApi(saisie.dateVente, 'dateVente', new Date())! : nouvelleVente ? new Date() : courant.dateVente ?? new Date()
      : courant.dateVente
    if (statut === 'vendu' && dateVente! > finJourLivraison(new Date())) throw new ErreurVerger('Une vente réelle ne peut pas être datée dans le futur.', 400, 'dateVente')
    const indisponible = statut === 'vendu' ? indisponibiliteLotVerger(courant, dateVente!) : null
    if (indisponible === 'avant_production') throw new ErreurVerger('Ce lot n’existait pas à la date de vente. Corrigez la date ou attendez sa production.', 409, 'dateVente')
    if (indisponible === 'perime') throw new ErreurVerger('Ce lot est périmé à la date de vente. Vérifiez sa date ou enregistrez sa perte.', 409)
    const montant = fruit
      ? totalSaisi ?? (prixKgSaisi !== undefined ? fruit.quantite * (prixKgSaisi ?? 0) : montantVenteFruit(fruit))
      : totalSaisi ?? bois!.prixVente ?? 0
    const total = Math.round(montant * 100) / 100
    if (statut === 'vendu' && (!Number.isFinite(total) || total <= 0)) throw new ErreurVerger('Le montant de la vente doit être supérieur à zéro.', 400, 'prixTotal')
    const historique = courant.statut === 'vendu' ? await tx.venteManuelle.findFirst({
      where: { userId, auto: true, sourceType, sourceId: id }, select: { paye: true, modeReglement: true, montant: true },
    }) : null
    // Même garde que les dépenses : un dossier sans versement actif ne prouve
    // pas le paiement historique (revue du 2026-10-29).
    if (statut === 'vendu' && historique?.paye && Math.abs(historique.montant - total) > 0.005
      && !await suiviReglementActif(tx, userId, cleSourceReglement('vente', sourceType, id))) throw new ErreurVerger('Précisez les versements historiques dans Règlements avant de corriger le montant de cette vente déclarée payée.', 409)
    if (saisie.creerFacture && statut !== 'vendu') throw new ErreurVerger('Seule une vente peut être facturée.')
    const clientId = saisie.clientId === undefined ? courant.clientId : saisie.clientId === null ? null : Number(saisie.clientId)
    const clientNom = texte('clientNom') === undefined ? courant.clientNom : texte('clientNom')
    const q = fruit ? { quantite: fruit.quantite, unite: 'kg' } : quantiteBois(bois!)
    if (statut === 'vendu' && q.quantite <= 0) throw new ErreurVerger('Le lot ne contient aucune quantité vendable.')
    if (saisie.creerFacture) {
      const tauxTVA = fruit ? 5.5 : TAUX_TVA_BOIS_PAR_DEFAUT
      const totalHT = total / (1 + tauxTVA / 100)
      const textes = bois ? libellesVenteBois({ ...bois, arbreNom: bois.arbre?.nom }) : null
      const description = fruit ? `${fruit.arbre.nom}${fruit.arbre.espece ? ` - ${fruit.arbre.espece}` : ''}` : textes!.ligneFacture
      const f = await creerFacture(tx, { userId, type: 'facture', clientId, clientNom: clientNom ?? undefined, date: dateVente!,
        objet: fruit ? `Vente de ${description}` : textes!.objetFacture,
        totalHT, totalTVA: total - totalHT, totalTTC: total, statut: historique?.paye ? 'payee' : 'emise',
        modePaiement: historique ? modePaiementDepuisReglement(historique.modeReglement) : null,
        lignes: [{ description, quantite: q.quantite, unite: q.unite, prixUnitaire: totalHT / q.quantite, tauxTVA,
          montantHT: totalHT, montantTVA: total - totalHT, montantTTC: total }],
      })
      factureId = f.id
    }
    const commun = { statut, dateVente, clientId, clientNom, factureId, notes: texte('notes') }
    const updated = fruit
      ? await tx.recolteArbre.update({ where: { id, userId }, data: { ...commun,
        ...(statut === 'vendu' ? { prixTotal: total, prixKg: total / fruit.quantite } : { prixTotal: totalSaisi, prixKg: prixKgSaisi }),
        ...(saisie.datePeremption !== undefined ? { datePeremption: dateRecolteApi(saisie.datePeremption, 'datePeremption') } : {}),
      }, include: { arbre: { select: { id: true, nom: true, type: true, espece: true } } } })
      : await tx.productionBois.update({ where: { id, userId }, data: { ...commun, destination: statut === 'vendu' ? 'vente' : texte('destination'),
        prixVente: statut === 'vendu' ? total : totalSaisi }, include: { arbre: { select: { id: true, nom: true, type: true, espece: true } } } })
    let miroir: { id: number } | null = null
    if (updated.statut === 'vendu') {
      miroir = fruit
        ? await createVenteFromRecolteArbre(userId, { ...fruit, ...commun, quantite: fruit.quantite, prixTotal: total, prixKg: total / fruit.quantite }, tx)
        : await createVenteFromProductionBois(userId, { ...bois!, ...commun, prixVente: total }, tx)
    } else if (courant.statut === 'vendu') await deleteAutoEntry(sourceType, id, 'vente', userId, tx)
    if (nouvelleVente && saisie.paye === true) {
      const cible = factureId ? { type: 'Facture' as const, id: factureId } : { type: 'VenteManuelle' as const, id: miroir!.id }
      const paiement = nouveauReglementSchema.safeParse({ ...cible, montant: total, date: dateRecolteApi(saisie.datePaiement, 'datePaiement', dateVente!)!,
        modeReglement: mode.data!, cleIdempotence: `vente-verger:${type}:${id}:${randomUUID()}` })
      if (!paiement.success) throw new ErreurVerger('Règlement invalide. Vérifiez sa date et son mode.', 400, 'datePaiement')
      await ajouterReglementTx(tx, userId, acteurId, paiement.data)
    }
    const warnings = fruit ? await avertissementsDarFruit(tx, userId, fruit.arbreId, fruit.parcelleId, fruit.date) : []
    const facture = bois && factureId ? await tx.facture.findFirst({ where: { id: factureId, userId },
      select: { id: true, numero: true, type: true, clientNom: true, totalTTC: true, statut: true } }) : null
    return { ...updated, ...(bois ? { facture } : {}), ...(warnings.length ? { warnings } : {}) }
  })
  invalidateKpi(userId)
  return resultat
}
