import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const round = (value: number) => Math.round(value * 100) / 100

type Atelier = {
  code: string
  libelle: string
  effectif: number
  couts: { achat: number; soins: number; alimentation: number; total: number }
  revenus: { ventes: number; abattages: number; paiesLait: number; total: number }
  production: { oeufs: number; litresLivres: number }
  marge: number
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const annee = Number.parseInt(searchParams.get('annee') || String(new Date().getFullYear()), 10)
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2200) {
      return NextResponse.json({ error: 'Année invalide' }, { status: 400 })
    }
    const userId = session.user.id
    const start = new Date(annee, 0, 1)
    const end = new Date(annee, 11, 31, 23, 59, 59, 999)
    const period = { gte: start, lte: end }

    const [lots, animals, soins, consommations, abattages, ventes, productionsOeufs, livraisons, paies] = await Promise.all([
      prisma.lotAnimaux.findMany({ where: { userId }, include: { especeAnimale: { select: { id: true, nom: true } } } }),
      prisma.animal.findMany({ where: { userId }, include: { especeAnimale: { select: { id: true, nom: true } } } }),
      prisma.soinAnimal.findMany({ where: { userId, fait: true, date: period }, select: { lotId: true, animalId: true, cout: true } }),
      prisma.consommationAliment.findMany({ where: { userId, date: period }, include: { aliment: { select: { prix: true } }, lot: { select: { especeAnimaleId: true } }, animal: { select: { especeAnimaleId: true } } } }),
      prisma.abattage.findMany({ where: { userId, annule: false, date: period }, select: { lotId: true, animalId: true, prixVente: true, poidsCarcasse: true, quantite: true } }),
      prisma.venteProduit.findMany({ where: { userId, annule: false, date: period }, select: { type: true, prixTotal: true, animalId: true } }),
      prisma.productionOeuf.findMany({ where: { userId, date: period }, select: { lotId: true, animalId: true, quantite: true } }),
      prisma.livraisonLait.findMany({ where: { userId, date: period }, select: { date: true, litres: true, laiterie: true } }),
      prisma.paieLait.findMany({ where: { userId, annee }, select: { mois: true, litres: true, montantHT: true, laiterie: true } }),
    ])

    const lotById = new Map(lots.map(l => [l.id, l]))
    const animalById = new Map(animals.map(a => [a.id, a]))
    const ateliers = new Map<string, Atelier>()
    const getAtelier = (code: string, libelle: string) => {
      let atelier = ateliers.get(code)
      if (!atelier) {
        atelier = { code, libelle, effectif: 0, couts: { achat: 0, soins: 0, alimentation: 0, total: 0 }, revenus: { ventes: 0, abattages: 0, paiesLait: 0, total: 0 }, production: { oeufs: 0, litresLivres: 0 }, marge: 0 }
        ateliers.set(code, atelier)
      }
      return atelier
    }
    const speciesFor = (lotId: number | null, animalId: number | null) => {
      const species = animalId != null ? animalById.get(animalId)?.especeAnimale : lotId != null ? lotById.get(lotId)?.especeAnimale : null
      return species ? getAtelier(species.id, species.nom) : getAtelier('non_affecte', 'Non affecté')
    }

    for (const lot of lots) {
      const a = getAtelier(lot.especeAnimale.id, lot.especeAnimale.nom)
      if (lot.statut === 'actif') a.effectif += lot.quantiteActuelle
      if (lot.dateArrivee && lot.dateArrivee >= start && lot.dateArrivee <= end) a.couts.achat += lot.prixAchatTotal || 0
    }
    for (const animal of animals) {
      const a = getAtelier(animal.especeAnimale.id, animal.especeAnimale.nom)
      if (animal.statut === 'actif') a.effectif += 1
      if (animal.dateArrivee && animal.dateArrivee >= start && animal.dateArrivee <= end) a.couts.achat += animal.prixAchat || 0
    }
    for (const soin of soins) speciesFor(soin.lotId, soin.animalId).couts.soins += soin.cout || 0
    for (const c of consommations) {
      const a = c.animal ? getAtelier(c.animal.especeAnimaleId, animalById.get(c.animalId!)?.especeAnimale.nom || c.animal.especeAnimaleId) : c.lot ? getAtelier(c.lot.especeAnimaleId, lotById.get(c.lotId!)?.especeAnimale.nom || c.lot.especeAnimaleId) : getAtelier('non_affecte', 'Non affecté')
      a.couts.alimentation += c.quantite * (c.aliment.prix || 0)
    }
    for (const abattage of abattages) speciesFor(abattage.lotId, abattage.animalId).revenus.abattages += abattage.prixVente || 0
    for (const vente of ventes) {
      const a = vente.animalId != null ? speciesFor(null, vente.animalId) : getAtelier(`vente_${vente.type}`, `Ventes ${vente.type.replaceAll('_', ' ')}`)
      a.revenus.ventes += vente.prixTotal
    }
    for (const production of productionsOeufs) speciesFor(production.lotId, production.animalId).production.oeufs += production.quantite

    const lait = getAtelier('lait_non_ventile', 'Lait — espèce non renseignée')
    lait.production.litresLivres = livraisons.reduce((sum, l) => sum + Number(l.litres), 0)
    lait.revenus.paiesLait = paies.reduce((sum, p) => sum + Number(p.montantHT), 0)

    const rapprochementLait = Array.from({ length: 12 }, (_, index) => {
      const mois = index + 1
      const litresLivres = livraisons.filter(l => l.date.getMonth() + 1 === mois).reduce((sum, l) => sum + Number(l.litres), 0)
      const paie = paies.find(p => p.mois === mois)
      const litresPayes = Number(paie?.litres || 0)
      const ecartLitres = litresPayes - litresLivres
      return {
        mois,
        litresLivres: round(litresLivres),
        litresPayes: round(litresPayes),
        ecartLitres: round(ecartLitres),
        montantHT: round(Number(paie?.montantHT || 0)),
        statut: !paie && litresLivres > 0 ? 'paie_manquante' : Math.abs(ecartLitres) > Math.max(1, litresLivres * 0.01) ? 'a_verifier' : 'ok',
      }
    })

    for (const a of ateliers.values()) {
      a.couts.total = round(a.couts.achat + a.couts.soins + a.couts.alimentation)
      a.revenus.total = round(a.revenus.ventes + a.revenus.abattages + a.revenus.paiesLait)
      a.couts.achat = round(a.couts.achat); a.couts.soins = round(a.couts.soins); a.couts.alimentation = round(a.couts.alimentation)
      a.revenus.ventes = round(a.revenus.ventes); a.revenus.abattages = round(a.revenus.abattages); a.revenus.paiesLait = round(a.revenus.paiesLait)
      a.production.oeufs = round(a.production.oeufs); a.production.litresLivres = round(a.production.litresLivres)
      a.marge = round(a.revenus.total - a.couts.total)
    }

    // Contrat historique : conserver `data` par lot pour les consommateurs existants.
    const data = lots.map(lot => {
      const lotSoins = soins.filter(s => s.lotId === lot.id)
      const lotConso = consommations.filter(c => c.lotId === lot.id)
      const lotAbattages = abattages.filter(a => a.lotId === lot.id)
      const coutAchat = lot.dateArrivee && lot.dateArrivee >= start && lot.dateArrivee <= end ? lot.prixAchatTotal || 0 : 0
      const coutSoins = lotSoins.reduce((sum, s) => sum + (s.cout || 0), 0)
      const coutAlimentation = lotConso.reduce((sum, c) => sum + c.quantite * (c.aliment.prix || 0), 0)
      const revenus = lotAbattages.reduce((sum, a) => sum + (a.prixVente || 0), 0)
      const total = coutAchat + coutSoins + coutAlimentation
      const totalOeufs = productionsOeufs.filter(p => p.lotId === lot.id).reduce((sum, p) => sum + p.quantite, 0)
      return { lotId: lot.id, lotNom: lot.nom || `Lot #${lot.id}`, espece: lot.especeAnimale.nom, quantiteActuelle: lot.quantiteActuelle, quantiteInitiale: lot.quantiteInitiale, statut: lot.statut, couts: { achat: round(coutAchat), soins: round(coutSoins), alimentation: round(coutAlimentation), total: round(total) }, revenus: { ventes: round(revenus) }, marge: round(revenus - total), metriques: { coutParAnimal: round(lot.quantiteActuelle ? total / lot.quantiteActuelle : 0), coutParOeuf: totalOeufs ? round(total / totalOeufs) : null, totalOeufs, totalConsoKg: round(lotConso.reduce((sum, c) => sum + c.quantite, 0)), poidsCarcasse: round(lotAbattages.reduce((sum, a) => sum + (a.poidsCarcasse || 0), 0)), nbAbattages: lotAbattages.reduce((sum, a) => sum + a.quantite, 0), nbSoins: lotSoins.length } }
    })
    const atelierList = [...ateliers.values()].filter(a => a.effectif || a.couts.total || a.revenus.total || a.production.oeufs || a.production.litresLivres)
    const totalCouts = atelierList.reduce((sum, a) => sum + a.couts.total, 0)
    const totalRevenus = atelierList.reduce((sum, a) => sum + a.revenus.total, 0)

    return NextResponse.json({
      data,
      ateliers: atelierList,
      rapprochementLait,
      stats: { totalCouts: round(totalCouts), totalRevenus: round(totalRevenus), margeGlobale: round(totalRevenus - totalCouts), nbLots: lots.length, nbAnimaux: animals.length },
      methode: {
        achats: "Comptés uniquement si la date d'arrivée est dans l'année sélectionnée.",
        affectation: "Lot/animal affecté directement ; saisies globales et ventes sans cible conservées dans un atelier explicite non ventilé.",
        lait: "Les paies et livraisons sont rapprochées au mois mais non attribuées à une espèce faute de lien dans la saisie.",
      },
    })
  } catch (cause) {
    console.error('GET /api/elevage/analyse-couts error:', cause)
    return NextResponse.json({ error: 'Erreur lors du calcul des coûts', details: 'Erreur interne du serveur' }, { status: 500 })
  }
}
