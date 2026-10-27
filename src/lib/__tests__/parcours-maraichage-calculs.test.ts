import { describe, expect, it } from 'vitest'
import { calculerBesoin, besoinGrainesSansMarge, totalGrainesACommander } from '@/lib/semences/calcul'
import { nbPlantsCulture, quantiteCultureACreer, quantiteCultureApresModification } from '@/lib/cultures/quantite-plants'
import { surfaceCultureM2 } from '@/lib/culture-surface'
import { projectionRecolte, projectionRecolteKg } from '@/lib/recolte/projection'
import { ajouterQuantite, arrondirQuantites, fusionnerQuantites, partKg } from '@/lib/recolte/quantites'
import { arrondiQuantiteStock, computeStocksTotaux } from '@/lib/stocks/agregation'
import { calculerDocument } from '@/lib/commercial/regles'
import { ventilerRevenus } from '@/lib/comptabilite/ventilation-revenus'
import { shiftToPrevYear } from '@/lib/kpi/types'
import { dateIsoFacture } from '@/lib/facture-regles'

// Oracles numeriques calcules a la main; aucune valeur lue sur un compte reel.
describe('graine -> plants : quantites, marge et achat', () => {
  it.each([
    [16, 3, 30, 159], [2.3, 2, 10, 46], [0.3, 1, 10, 3],
    [0.09, 1, 10, 0], [1, 4, 25, 16],
  ])('%s m, %s rangs, %s cm -> %s plants', (longueur,rangs,espacement,attendu) => {
    expect(nbPlantsCulture(longueur,rangs,espacement)).toBe(attendu)
  })
  it.each([null, undefined, 0, -1, NaN, Infinity])('parametre inexploitable %s : aucun nombre invente', invalide => {
    expect(nbPlantsCulture(invalide, 2, 10)).toBeNull()
  })
  it('quantite manuelle conservee, quantite automatique recalculee, zero non stocke', () => {
    expect(quantiteCultureACreer({ longueur: 16, nbRangs: 3, espacement: 30, quantite: 180 })).toBe(180)
    expect(quantiteCultureACreer({ longueur: 16, nbRangs: 3, espacement: 30 })).toBe(159)
    expect(quantiteCultureACreer({ longueur: 0.09, nbRangs: 1, espacement: 10 })).toBeNull()
    expect(quantiteCultureApresModification({ longueur: 16, nbRangs: 3, espacement: 30, quantite: 159 }, { longueur: 10 })).toBe(99)
    expect(quantiteCultureApresModification({ longueur: 16, nbRangs: 3, espacement: 30, quantite: 180 }, { longueur: 10 })).toBeUndefined()
  })
  it('semis direct : 4 m2 a 2 g/m2 +25%, stock 3 g -> besoin 10 g, achat 7 g', () => {
    expect(calculerBesoin({ mode:'graine_directe', surfaceM2:4, nbPlants:0, doseGParM2:2, uniteDose:'g_m2', margeSecuritePct:25, stockGrammes:3 })).toMatchObject({ besoinGrammes:10, manqueGrammes:7, besoinCaieux:0, statut:'LOW' })
  })
  it('pepinere : 100 plants, 2 graines/plant, 100 graines/g +10% -> 2,2 g', () => {
    expect(calculerBesoin({ mode:'plant_repique', surfaceM2:0, nbPlants:100, doseGParM2:2, uniteDose:'graines_plant', grainesParGramme:100, margeSecuritePct:10, stockGrammes:0 })).toMatchObject({ besoinGrammes:2.2, manqueGrammes:2.2, statut:'MISSING' })
  })
  it('pepinere sans poids connu : graines gardees en unites', () => {
    expect(calculerBesoin({ mode:'plant_repique', surfaceM2:0, nbPlants:100, doseGParM2:2, uniteDose:'graines_plant', grainesParGramme:null, margeSecuritePct:10, stockUnites:20 })).toMatchObject({ besoinGrammes:0, besoinCaieux:220, manqueCaieux:200, statut:'LOW' })
  })
  it('caieux : plants de la fiche prioritaires, marge arrondie au plant entier', () => {
    expect(calculerBesoin({ mode:'bulbe_caieu', surfaceM2:30, nbPlants:159, doseGParM2:50, uniteDose:'caieux_m2', margeSecuritePct:10, stockUnites:100 })).toMatchObject({ besoinCaieux:175, manqueCaieux:75, statut:'LOW' })
  })
  it('boutures sans marge, stock suffisant et stock depassant le besoin', () => {
    expect(calculerBesoin({ mode:'bouture', surfaceM2:0, nbPlants:25, margeSecuritePct:40, stockUnites:30 })).toMatchObject({ besoinCaieux:25, manqueCaieux:0, statut:'OK' })
  })
  it('aucun calcul possible : distingue donnees de reference, dimensions et hors plan', () => {
    const base = { mode:'graine_directe' as const, surfaceM2:10, nbPlants:0, margeSecuritePct:0 }
    expect(calculerBesoin(base).statut).toBe('DONNEE_MANQUANTE')
    expect(calculerBesoin({ ...base, surfaceM2:0, doseGParM2:2, nbPlants:10 }).statut).toBe('SURFACE_MANQUANTE')
    expect(calculerBesoin({ ...base, surfaceM2:0 }).statut).toBe('IGNORE')
  })
  it('affichage sans marge et achats : le surplus de A ne couvre pas une variete B', () => {
    const besoins = [{ grainesNecessaires:12, margeSecuritePct:20, stockActuel:20 },{ grainesNecessaires:24, margeSecuritePct:20, stockActuel:5 }]
    expect(besoinGrainesSansMarge(besoins[0])).toBe(10)
    expect(totalGrainesACommander(besoins,true)).toBe(19)
    expect(totalGrainesACommander(besoins,false)).toBe(15)
  })
})

describe('champ -> recolte : surfaces et toutes les unites', () => {
  it('surface de culture de 10 m dans une planche de 15 m de large 1,2 m =12 m2', () => {
    expect(surfaceCultureM2({ longueur:10, planche:{ surface:18, largeur:1.2, longueur:15 } })).toBe(12)
    expect(surfaceCultureM2({ planche:{ surface:null, largeur:1.2, longueur:15 } })).toBe(18)
  })
  it.each([
    ['kg_m2', 3, 30, 90, 'kg'], ['biomasse_t_ha',2.5,30,7.5,'kg'],
    ['tiges_m2',20,10,200,'tige'], ['pieces_m2',15,10,150,'piece'],
    ['bottes_m2',5,10,50,'botte'], ['kg_arbre',25,30,0,'kg'],
  ])('rendement %s : %s x surface %s = %s %s', (unite,rdt,surface,quantite,uniteLot) => {
    expect(projectionRecolte(surface as number,rdt as number,unite as string)).toEqual({ quantite, unite:uniteLot })
    if (uniteLot!=='kg') expect(projectionRecolteKg(surface as number,rdt as number,unite as string)).toBe(0)
  })
  it.each([0,-1,NaN,Infinity])('surface invalide %s : projection nulle dans la bonne unite', surface => {
    expect(projectionRecolte(surface,20,'tiges_m2')).toEqual({ quantite:0, unite:'tige' })
  })
  it('cumuls : 12 kg + 120 tiges + 8 kg ne deviennent jamais 140 kg', () => {
    const cumul = {}; ajouterQuantite(cumul,'kg',12); ajouterQuantite(cumul,'tige',120); ajouterQuantite(cumul,'kg',8)
    expect(arrondirQuantites(cumul)).toEqual({ kg:20, tige:120 })
    expect(partKg(cumul)).toBe(20)
    expect(fusionnerQuantites(cumul,{ botte:3 })).toEqual({ kg:20,tige:120,botte:3 })
  })
  it('stock : pas de bavure flottante, precision au gramme', () => {
    expect(arrondiQuantiteStock(4.8+4.8+0.5+0.7)).toBe(10.8)
    expect(arrondiQuantiteStock(1.23456)).toBe(1.235)
  })
})

describe('vente -> compta : montants, modules, avoirs et dates', () => {
  it('prix HT et TVA mixtes : 20 HT a 5,5% + 10 HT a 20% -> 33,10 TTC', () => {
    const r=calculerDocument([{description:'Carotte',quantite:4,unite:'kg',prixUnitaire:5,tauxTVA:5.5},{description:'Prestation',quantite:1,unite:'unite',prixUnitaire:10,tauxTVA:20}])
    expect(r).toMatchObject({ totalHT:30,totalTVA:3.1,totalTTC:33.1 })
    expect(r.lignes[0]).toMatchObject({ montantHT:20,montantTVA:1.1,montantTTC:21.1 })
  })
  it('facture exoneree : TVA nulle et TTC=HT sur toutes les lignes', () => {
    const r=calculerDocument([{description:'Carotte',quantite:4,unite:'kg',prixUnitaire:5,tauxTVA:5.5}],true)
    expect(r).toMatchObject({ totalHT:20,totalTVA:0,totalTTC:20 })
    expect(r.lignes[0].tauxTVA).toBe(0)
  })
  it('ventilation : 32 de ventes +30 facture -5 avoir +10 sans source =67', () => {
    const r=ventilerRevenus([{montant:20,module:'potager'},{montant:12,module:null,categorie:'legumes'}],[{type:'facture',totalTTC:30,moduleSource:'potager'},{type:'avoir',totalTTC:5,moduleSource:'potager'},{type:'facture',totalTTC:10,moduleSource:null}])
    expect(r.total).toBe(67)
    expect(r.parModule.potager).toBe(57)
    expect(r.parModule.autre).toBe(10)
    expect(Object.values(r.parModule).reduce((s,x)=>s+x,0)).toBe(67)
    expect(Object.values(r.composition).reduce((s,x)=>s+x,0)).toBe(67)
  })
  it('comparaison N-1 et jour de facture autour de minuit Paris', () => {
    expect(dateIsoFacture(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(dateIsoFacture(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31')
    expect(shiftToPrevYear(new Date(2024,1,29)).getDate()).toBe(28)
  })
  it('valorisation stocks : les non valorises restent absents du montant, les modules inconnus restent visibles', () => {
    const base={categorie:'recoltes',nom:'temoin',stock:1,unite:'kg',stockMin:null,alerteBas:false}
    const r=computeStocksTotaux([{...base,id:'a',module:'potager',valeur:12.1},{...base,id:'b',module:'potager',valeur:null},{...base,id:'c',module:'inconnu',valeur:3.2}])
    expect(r.valeurTotale).toBe(15.3)
    expect(r.valeurParModule).toMatchObject({ potager:12.1,autre:3.2 })
    expect(r.itemsParModule).toMatchObject({ potager:2,autre:1 })
  })
})
