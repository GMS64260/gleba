import { z } from 'zod'
import { dateIsoFacture } from '@/lib/facture-regles'
import { factureSansTaxe } from '@/lib/territoires'

export const TYPES_DOCUMENT = ['devis', 'livraison'] as const
export const LABELS_STATUT: Record<string, string> = {
  brouillon: 'Brouillon', emis: 'Émis', accepte: 'Accepté', refuse: 'Refusé', livre: 'Livré', annule: 'Annulé',
}
export const dateCivileSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue : AAAA-MM-JJ').refine((s) => {
  const d = new Date(`${s}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= '2000-01-01' && s <= '2200-12-31'
}, 'Date invalide')
export const dateCivile = (s: string) => new Date(`${s}T12:00:00Z`)
export const arrondir = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const ligneSchema = z.object({
  description: z.string().trim().min(1, 'Description requise').max(500),
  quantite: z.number().positive().max(1_000_000),
  unite: z.string().trim().min(1).max(20),
  prixUnitaire: z.number().min(0).max(1_000_000),
  tauxTVA: z.union([z.literal(0), z.literal(2.1), z.literal(5.5), z.literal(10), z.literal(20)]),
}).strict()

export const contenuDocumentSchema = z.object({
  type: z.enum(TYPES_DOCUMENT),
  clientId: z.number().int().positive(),
  date: dateCivileSchema,
  dateValidite: dateCivileSchema.nullable(),
  dateLivraison: dateCivileSchema.nullable(),
  objet: z.string().trim().min(1, 'Objet requis').max(500),
  notes: z.string().trim().max(5000).default(''),
  adresseLivraison: z.string().trim().max(500).default(''),
  categorieOperation: z.enum(['biens', 'services', 'mixte']).default('biens'),
  lignes: z.array(ligneSchema).min(1).max(100),
}).strict().superRefine((d, ctx) => {
  if (d.type === 'devis' && (!d.dateValidite || d.dateValidite < d.date)) {
    ctx.addIssue({ code: 'custom', path: ['dateValidite'], message: 'La validité doit couvrir la date du devis' })
  }
  if (d.type === 'livraison' && d.categorieOperation !== 'biens') {
    ctx.addIssue({ code: 'custom', path: ['categorieOperation'], message: 'Un bon de livraison concerne des biens' })
  }
})
export const creationDocumentSchema = z.object({ cle: z.string().uuid(), contenu: contenuDocumentSchema }).strict()
export const actionDocumentSchema = z.object({
  action: z.enum(['emettre', 'accepter', 'refuser', 'livrer', 'annuler']),
  dateLivraison: dateCivileSchema.optional(),
}).strict()
export const facturationDocumentsSchema = z.object({
  ids: z.array(z.string().min(1).max(80)).min(1).max(20).refine((ids) => new Set(ids).size === ids.length, 'Sélection répétée'),
  dateEcheance: dateCivileSchema,
}).strict()

export type ContenuDocument = z.infer<typeof contenuDocumentSchema>

/** Les montants reçus du navigateur ne sont jamais une source de vérité. PU saisi HT. */
export function calculerDocument(lignes: ContenuDocument['lignes'], sansTaxe = false) {
  const calculees = lignes.map((l, ordre) => {
    const tauxTVA = sansTaxe ? 0 : l.tauxTVA
    const montantHT = arrondir(l.quantite * l.prixUnitaire)
    const montantTVA = arrondir(montantHT * tauxTVA / 100)
    return { ...l, ordre, tauxTVA, montantHT, montantTVA, montantTTC: arrondir(montantHT + montantTVA) }
  })
  return {
    lignes: calculees,
    totalHT: arrondir(calculees.reduce((s, l) => s + l.montantHT, 0)),
    totalTVA: arrondir(calculees.reduce((s, l) => s + l.montantTVA, 0)),
    totalTTC: arrondir(calculees.reduce((s, l) => s + l.montantTTC, 0)),
  }
}

export class ErreurCommerciale extends Error {
  constructor(message: string, public status = 409) { super(message) }
}

export function transitionDocument(d: { type: string; statut: string; dateValidite: Date | null; factureId: number | null; bonLivraison?: { id: string } | null }, action: string, maintenant = new Date()) {
  if (d.factureId || d.bonLivraison) throw new ErreurCommerciale('Ce document a déjà été converti. Consultez le document lié.')
  const suivantes: Record<string, Record<string, string>> = d.type === 'devis' ? {
    brouillon: { emettre: 'emis' },
    emis: { accepter: 'accepte', refuser: 'refuse', annuler: 'annule' },
    accepte: { annuler: 'annule' },
  } : { brouillon: { emettre: 'emis' }, emis: { livrer: 'livre', annuler: 'annule' }, livre: { annuler: 'annule' } }
  const cible = suivantes[d.statut]?.[action]
  if (!cible) throw new ErreurCommerciale('Cette action ne correspond plus à l’état du document. Actualisez la liste.')
  if (d.type === 'devis' && ['emettre', 'accepter'].includes(action) && (!d.dateValidite || dateIsoFacture(d.dateValidite) < dateIsoFacture(maintenant))) {
    throw new ErreurCommerciale('Ce devis est expiré. Dupliquez-le pour proposer une nouvelle offre.')
  }
  return cible
}

export interface SourceFacturable {
  type: string; statut: string; clientId: number | null; clientNom: string; clientAdresse: string | null
  clientSiret: string | null; clientSiren: string | null; clientTvaIntra: string | null; clientExonere: boolean
  dateLivraison: Date | null; categorieOperation: string; factureId: number | null
  bonLivraison?: { id: string } | null
}

export function verifierSourcesFacturables(docs: SourceFacturable[]) {
  const premier = docs[0]
  if (!premier) throw new ErreurCommerciale('Sélectionnez un document', 400)
  if (docs.some((d) => d.factureId)) throw new ErreurCommerciale('Un document de cette sélection est déjà facturé')
  if (docs.some((d) => !d.clientId || d.clientId !== premier.clientId)) throw new ErreurCommerciale('Choisissez des bons du même client, avec une fiche client encore disponible')
  const identite = (d: SourceFacturable) => JSON.stringify([d.clientNom, d.clientAdresse, d.clientSiret, d.clientSiren, d.clientTvaIntra, d.clientExonere])
  if (docs.some((d) => identite(d) !== identite(premier))) throw new ErreurCommerciale('Les coordonnées ou le régime du client diffèrent entre ces documents. Facturez-les séparément.')
  if (premier.type === 'devis') {
    if (docs.length !== 1 || premier.statut !== 'accepte' || premier.bonLivraison) throw new ErreurCommerciale('Seul un devis accepté, sans bon de livraison, peut être facturé directement')
  } else {
    if (docs.some((d) => d.type !== 'livraison' || d.statut !== 'livre' || !d.dateLivraison)) throw new ErreurCommerciale('Seuls les bons marqués livrés peuvent être facturés')
    if (docs.length > 1) {
      if (docs.some((d) => d.categorieOperation !== 'biens')) throw new ErreurCommerciale('Le regroupement concerne les livraisons de biens')
      const mois = dateIsoFacture(premier.dateLivraison!).slice(0, 7)
      if (docs.some((d) => dateIsoFacture(d.dateLivraison!).slice(0, 7) !== mois)) throw new ErreurCommerciale('Regroupez uniquement des livraisons du même mois civil')
    }
  }
}

export { factureSansTaxe }
