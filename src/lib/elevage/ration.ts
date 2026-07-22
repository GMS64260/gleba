/**
 * Calcul de ration caprine (PROMPT 25) — fonctions pures, système INRA.
 *
 * Besoins journaliers en UFL (énergie) et PDI (protéines) d'une chèvre selon
 * son poids, son niveau de production laitière (corrigé du taux butyreux) et
 * son stade de gestation ; bilan d'une ration composée d'aliments.
 *
 * Repères INRA (caprin laitier) — valeurs de conduite, à ajuster au troupeau :
 *  - entretien : 0,033 UFL et 2,5 g PDI par kg de poids métabolique (PV^0,75) ;
 *  - lait : 0,44 UFL + 48 g PDI par litre à 35 g/L de TB, corrigé du TB ;
 *  - gestation : surcoût des 2 derniers mois.
 *
 * Règle PDI : l'apport PDI d'une ration = min(ΣPDIN, ΣPDIE).
 */

export type StadeGestation = 'aucune' | 'gestation_moyenne' | 'gestation_finale'
export type ProfilEspeceRation = 'caprin' | 'ovin' | 'bovin' | 'porcin' | 'volaille' | 'lapin'

export type BesoinsInput = {
  poidsVif: number // kg
  litresLait: number // L/jour
  tauxButyreux?: number // g/L (défaut 35)
  stadeGestation?: StadeGestation
}

export type Besoins = {
  ufl: number
  pdi: number // g
  detail: { entretien: { ufl: number; pdi: number }; lait: { ufl: number; pdi: number }; gestation: { ufl: number; pdi: number } }
}

const SURCOUT_GESTATION: Record<StadeGestation, { ufl: number; pdi: number }> = {
  aucune: { ufl: 0, pdi: 0 },
  gestation_moyenne: { ufl: 0.2, pdi: 25 }, // ~4e mois
  gestation_finale: { ufl: 0.4, pdi: 55 }, // dernier mois
}

const r2 = (v: number) => Math.round(v * 100) / 100
const r0 = (v: number) => Math.round(v)

export function besoinsChevre(x: BesoinsInput): Besoins {
  const pv75 = Math.pow(Math.max(0, x.poidsVif), 0.75)
  const tb = x.tauxButyreux ?? 35
  const stade = x.stadeGestation ?? 'aucune'

  const entretien = { ufl: 0.033 * pv75, pdi: 2.5 * pv75 }
  // Coût énergétique du litre corrigé du TB (+0,0053 UFL / g TB au-dessus de 35)
  const uflParL = 0.44 + 0.0053 * (tb - 35)
  const lait = { ufl: uflParL * x.litresLait, pdi: 48 * x.litresLait }
  const gestation = SURCOUT_GESTATION[stade]

  return {
    ufl: r2(entretien.ufl + lait.ufl + gestation.ufl),
    pdi: r0(entretien.pdi + lait.pdi + gestation.pdi),
    detail: {
      entretien: { ufl: r2(entretien.ufl), pdi: r0(entretien.pdi) },
      lait: { ufl: r2(lait.ufl), pdi: r0(lait.pdi) },
      gestation: { ufl: r2(gestation.ufl), pdi: r0(gestation.pdi) },
    },
  }
}

const COEFF_RUMINANTS: Record<'caprin' | 'ovin' | 'bovin', { entretienUfl: number; entretienPdi: number; laitUfl: number; laitPdi: number; tbRef: number }> = {
  caprin: { entretienUfl: 0.033, entretienPdi: 2.5, laitUfl: 0.44, laitPdi: 48, tbRef: 35 },
  ovin: { entretienUfl: 0.032, entretienPdi: 2.6, laitUfl: 0.43, laitPdi: 50, tbRef: 60 },
  bovin: { entretienUfl: 0.041, entretienPdi: 3.25, laitUfl: 0.44, laitPdi: 48, tbRef: 40 },
}

export function besoinsRuminant(profil: 'caprin' | 'ovin' | 'bovin', x: BesoinsInput): Besoins {
  if (profil === 'caprin') return besoinsChevre(x)
  const c = COEFF_RUMINANTS[profil]
  const pv75 = Math.pow(Math.max(0, x.poidsVif), 0.75)
  const tb = x.tauxButyreux ?? c.tbRef
  const stade = x.stadeGestation ?? 'aucune'
  const entretien = { ufl: c.entretienUfl * pv75, pdi: c.entretienPdi * pv75 }
  const lait = { ufl: (c.laitUfl + 0.0053 * (tb - c.tbRef)) * x.litresLait, pdi: c.laitPdi * x.litresLait }
  const facteur = profil === 'bovin' ? 2.5 : 1
  const gestation = { ufl: SURCOUT_GESTATION[stade].ufl * facteur, pdi: SURCOUT_GESTATION[stade].pdi * facteur }
  return { ufl: r2(entretien.ufl + lait.ufl + gestation.ufl), pdi: r0(entretien.pdi + lait.pdi + gestation.pdi), detail: { entretien: { ufl: r2(entretien.ufl), pdi: r0(entretien.pdi) }, lait: { ufl: r2(lait.ufl), pdi: r0(lait.pdi) }, gestation: { ufl: r2(gestation.ufl), pdi: r0(gestation.pdi) } } }
}

export type BesoinsMonogastrique = { ingestionKg: number; energieKcal: number; proteinesG: number }
const MONOGASTRIQUES: Record<'porcin' | 'volaille' | 'lapin', { ingestionPct: number; energieKcalKg: number; proteinesPct: number }> = {
  porcin: { ingestionPct: 0.04, energieKcalKg: 3200, proteinesPct: 0.16 },
  volaille: { ingestionPct: 0.05, energieKcalKg: 2800, proteinesPct: 0.17 },
  lapin: { ingestionPct: 0.035, energieKcalKg: 2500, proteinesPct: 0.15 },
}
export function besoinsMonogastrique(profil: 'porcin' | 'volaille' | 'lapin', poidsVif: number): BesoinsMonogastrique {
  const c = MONOGASTRIQUES[profil]
  const ingestionKg = Math.max(0, poidsVif) * c.ingestionPct
  return { ingestionKg: r2(ingestionKg), energieKcal: r0(ingestionKg * c.energieKcalKg), proteinesG: r0(ingestionKg * c.proteinesPct * 1000) }
}

export type LigneRation = {
  ufl?: number | null
  pdin?: number | null
  pdie?: number | null
  uel?: number | null
  prix?: number | null // €/kg
  energie?: number | null // kcal/kg
  proteines?: number | null // %
  quantiteKg: number
}

export function bilanRationMonogastrique(lignes: LigneRation[], besoins: BesoinsMonogastrique) {
  const total = lignes.reduce((a, l) => ({
    kg: a.kg + l.quantiteKg,
    energie: a.energie + (l.energie || 0) * l.quantiteKg,
    proteines: a.proteines + ((l.proteines || 0) / 100) * l.quantiteKg * 1000,
    cout: a.cout + (l.prix || 0) * l.quantiteKg,
  }), { kg: 0, energie: 0, proteines: 0, cout: 0 })
  return { ingestionKg: r2(total.kg), energieKcal: r0(total.energie), proteinesG: r0(total.proteines), cout: r2(total.cout), couvertureEnergie: besoins.energieKcal ? r0(total.energie / besoins.energieKcal * 100) : null, couvertureProteines: besoins.proteinesG ? r0(total.proteines / besoins.proteinesG * 100) : null }
}

export type BilanRation = {
  ufl: number
  pdin: number
  pdie: number
  pdi: number // = min(pdin, pdie)
  uel: number
  cout: number
  couvertureUFL: number | null // %
  couverturePDI: number | null // %
  equilibrePDIN_PDIE: 'PDIN' | 'PDIE' | 'équilibré' // facteur limitant
}

export function bilanRation(lignes: LigneRation[], besoins: Besoins): BilanRation {
  let ufl = 0, pdin = 0, pdie = 0, uel = 0, cout = 0
  for (const l of lignes) {
    const q = l.quantiteKg || 0
    ufl += (l.ufl || 0) * q
    pdin += (l.pdin || 0) * q
    pdie += (l.pdie || 0) * q
    uel += (l.uel || 0) * q
    cout += (l.prix || 0) * q
  }
  const pdi = Math.min(pdin, pdie)
  const ecart = pdin - pdie
  const equilibre = Math.abs(ecart) < 5 ? 'équilibré' : ecart < 0 ? 'PDIN' : 'PDIE'
  return {
    ufl: r2(ufl),
    pdin: r0(pdin),
    pdie: r0(pdie),
    pdi: r0(pdi),
    uel: r2(uel),
    cout: r2(cout),
    couvertureUFL: besoins.ufl > 0 ? Math.round((ufl / besoins.ufl) * 100) : null,
    couverturePDI: besoins.pdi > 0 ? Math.round((pdi / besoins.pdi) * 100) : null,
    equilibrePDIN_PDIE: equilibre,
  }
}
