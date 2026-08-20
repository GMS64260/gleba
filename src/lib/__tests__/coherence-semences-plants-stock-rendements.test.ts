/**
 * Vérification du lot « semences, plants, stock, rendements » (2026-08-19).
 *
 * Cinq défauts de la même chaîne se soutenaient mutuellement : les corriger un
 * par un aurait produit un état intermédiaire aussi faux que le départ. Ce
 * fichier tient les invariants du lot entier, sur les cas réellement relevés au
 * registre de cohérence ITP (C03, C04, C21, C22, C24, C25, C27).
 *
 * Les scénarios reprennent les chiffres du registre, pas des valeurs inventées :
 * Poireau 52 + 60 plants en S29/S32, Oignon 100 plants sur 4,5 m², Kiwi
 * 25 kg/arbre sur 30 m², Tournesol 2,5 t/ha sur 18 m², Épinard récolté le
 * 25/05/2026, Épinard rattaché à un ITP dosé à 30 g/m².
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getISOWeek } from 'date-fns'

vi.mock('@/lib/prisma', () => ({
  default: {
    planche: { findMany: vi.fn() },
    espece: { findMany: vi.fn() },
    variete: { findMany: vi.fn() },
    userStockVariete: { findMany: vi.fn() },
    // Surcharges de rendement par ferme (2026-08-20) : vides par défaut, donc
    // le catalogue fait foi et les attentes historiques ne bougent pas.
    userStockEspece: { findMany: vi.fn().mockResolvedValue([]) },
    culture: { findMany: vi.fn() },
    iTP: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/terroir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/terroir')>()
  return { ...actual, zoneEffectiveUser: vi.fn().mockResolvedValue(null) }
})

import prisma from '@/lib/prisma'
import { getBesoinsSemences, getBesoinsPlants, getRecoltesPrevuesDetail } from '../planification'
import {
  libelleUniteQuantite,
  projectionRecolte,
  projectionRecolteKg,
  rendementKgParM2,
  rendementParM2,
  uniteQuantiteRecolte,
} from '../recolte/projection'
import { moisDepuisSemaine } from '../cultures/dates-itp'

const mocked = prisma as unknown as {
  planche: { findMany: ReturnType<typeof vi.fn> }
  espece: { findMany: ReturnType<typeof vi.fn> }
  variete: { findMany: ReturnType<typeof vi.fn> }
  userStockVariete: { findMany: ReturnType<typeof vi.fn> }
  culture: { findMany: ReturnType<typeof vi.fn> }
  iTP: { findMany: ReturnType<typeof vi.fn> }
}

type OptionsCulture = {
  longueur?: number | null
  quantite?: number | null
  nbRangs?: number | null
  espacement?: number | null
  varieteId?: string | null
  datePlantation?: Date | null
  itp?: { id: string; doseSemis?: number | null; nbGrainesPlant?: number | null } | null
}

function culture(
  id: number,
  especeId: string,
  planche: { nom: string; longueur: number; largeur: number },
  opts: OptionsCulture = {},
) {
  return {
    id,
    plancheId: planche.nom,
    planche: {
      nom: planche.nom,
      longueur: planche.longueur,
      largeur: planche.largeur,
      surface: planche.longueur * planche.largeur,
      ilot: null,
      rotationId: null,
    },
    itpId: opts.itp?.id ?? null,
    itp: opts.itp ? { ...opts.itp, semaineSemis: null, semainePlantation: null, semaineRecolte: null, dureeCulture: null, nbRangs: null, espacement: null } : null,
    especeId,
    espece: { id: especeId, couleur: null, rendement: null },
    varieteId: opts.varieteId ?? null,
    variete: null,
    annee: 2026,
    dateSemis: null,
    datePlantation: opts.datePlantation ?? null,
    dateRecolte: null,
    nbRangs: opts.nbRangs ?? null,
    espacement: opts.espacement ?? null,
    longueur: opts.longueur ?? null,
    quantite: opts.quantite ?? null,
  }
}

const ESPECE = {
  poireau: { id: 'poireau', couleur: null, modeSemis: 'plant_repique', doseSemis: null, uniteDose: null, tauxGermination: 80, margeSecuritePct: 0, densite: null, famille: null },
  oignon: { id: 'oignon', couleur: null, modeSemis: 'bulbe_caieu', doseSemis: null, uniteDose: 'caieux_m2', tauxGermination: null, margeSecuritePct: 0, densite: null, famille: null },
  epinard: { id: 'epinard', couleur: null, modeSemis: 'graine_directe', doseSemis: null, uniteDose: null, tauxGermination: 80, margeSecuritePct: 0, densite: null, famille: null },
  carotte: { id: 'carotte', couleur: null, modeSemis: 'graine_directe', doseSemis: 2, uniteDose: 'g_m2', tauxGermination: 80, margeSecuritePct: 0, densite: null, famille: null },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.planche.findMany.mockResolvedValue([])
  mocked.variete.findMany.mockResolvedValue([])
  mocked.userStockVariete.findMany.mockResolvedValue([])
  mocked.iTP.findMany.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// C03 + C04 — une seule mesure « surface + plants » pour les deux écrans
// ---------------------------------------------------------------------------

describe('C03/C04 — Semences et Plants mesurent la même culture pareillement', () => {
  it("la quantité enregistrée sur la fiche fait foi des DEUX côtés (elle était ignorée par Semences)", async () => {
    // Tomate : la fiche enregistre 1 000 plants. Plants nécessaires les
    // reprenait, Semences repartait d'un calcul géométrique et en trouvait 100.
    const cultures = [
      culture(1, 'tomate', { nom: 'B1', longueur: 20, largeur: 1.2 }, {
        quantite: 1000,
        datePlantation: new Date(2026, 4, 15),
      }),
    ]
    const especes = [{ ...ESPECE.poireau, id: 'tomate' }]
    mocked.culture.findMany.mockResolvedValue(cultures)
    mocked.espece.findMany.mockResolvedValue(especes)

    const semences = await getBesoinsSemences('u1', 2026)
    mocked.culture.findMany.mockResolvedValue(cultures)
    mocked.espece.findMany.mockResolvedValue(especes)
    const plants = await getBesoinsPlants('u1', 2026)

    expect(semences[0].nbPlants).toBe(1000)
    expect(plants[0].nbPlants).toBe(1000)
    expect(semences[0].nbPlants).toBe(plants[0].nbPlants)
  })

  it("le prorata 1/N ne touche PAS le nombre de plants d'une planche partagée", async () => {
    // Poireau 198 + Basilic 100 sur la même planche : 198 poireaux plantés
    // demandent 198 plants, pas 198/2. C'était « 66 plants » à trois cultures.
    const cultures = [
      culture(1, 'poireau', { nom: 'B1', longueur: 15, largeur: 1.2 }, { quantite: 198, datePlantation: new Date(2026, 6, 19) }),
      culture(2, 'basilic', { nom: 'B1', longueur: 15, largeur: 1.2 }, { quantite: 100, datePlantation: new Date(2026, 6, 19) }),
    ]
    const especes = [ESPECE.poireau, { ...ESPECE.poireau, id: 'basilic' }]
    mocked.culture.findMany.mockResolvedValue(cultures)
    mocked.espece.findMany.mockResolvedValue(especes)

    const semences = await getBesoinsSemences('u1', 2026)
    expect(semences.find(b => b.especeId === 'poireau')?.nbPlants).toBe(198)
    expect(semences.find(b => b.especeId === 'basilic')?.nbPlants).toBe(100)
  })

  it("le prorata ne touche pas non plus la surface d'une culture qui porte sa propre longueur", async () => {
    // Carotte : la fiche dit 5 m × 0,9 m sur une planche partagée à 3. Le
    // besoin était calculé sur 1,5 m² au lieu de 4,5 m² — un tiers des graines.
    const cultures = [
      culture(1, 'carotte', { nom: 'B1', longueur: 15, largeur: 0.9 }, { longueur: 5 }),
      culture(2, 'epinard', { nom: 'B1', longueur: 15, largeur: 0.9 }, { longueur: 5 }),
      culture(3, 'oignon', { nom: 'B1', longueur: 15, largeur: 0.9 }, { longueur: 5 }),
    ]
    mocked.culture.findMany.mockResolvedValue(cultures)
    mocked.espece.findMany.mockResolvedValue([ESPECE.carotte, ESPECE.epinard, ESPECE.oignon])

    const besoins = await getBesoinsSemences('u1', 2026)
    expect(besoins.find(b => b.especeId === 'carotte')?.surfaceTotale).toBe(4.5)
    // 4,5 m² × 2 g/m², marge 0 → 9 g, et non 3 g.
    expect(besoins.find(b => b.especeId === 'carotte')?.grainesNecessaires).toBe(9)
  })

  it("la surface d'une culture SANS longueur propre reste au prorata de sa planche (BUG-21 préservé)", async () => {
    mocked.culture.findMany.mockResolvedValue([
      culture(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 3 }),
      culture(2, 'epinard', { nom: 'B1', longueur: 10, largeur: 3 }),
    ])
    mocked.espece.findMany.mockResolvedValue([ESPECE.carotte, ESPECE.epinard])

    const besoins = await getBesoinsSemences('u1', 2026)
    expect(besoins.find(b => b.especeId === 'carotte')?.surfaceTotale).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// C22 — une seule dose de semis
// ---------------------------------------------------------------------------

describe('C22 — la dose de l\'itinéraire rattaché prime sur celle de l\'espèce', () => {
  it("l'écran Semences lit la dose de l'ITP quand l'espèce n'en porte aucune", async () => {
    // Épinard sans dose au référentiel espèce, rattaché à « Épinard-été »
    // dont la fiche affiche 30 g/m². L'écran annonçait « dose manquante ».
    mocked.culture.findMany.mockResolvedValue([
      culture(353, 'epinard', { nom: 'B1', longueur: 10, largeur: 1.2 }, {
        itp: { id: 'itp-epinard-ete', doseSemis: 30 },
      }),
    ])
    mocked.espece.findMany.mockResolvedValue([ESPECE.epinard])
    mocked.iTP.findMany.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.doseSemis ? [{ id: 'itp-epinard-ete', doseSemis: 30, nbGrainesPlant: null }] : [],
    )

    const [epinard] = await getBesoinsSemences('u1', 2026)
    expect(epinard.doseSemis).toBe(30)
    expect(epinard.statut).not.toBe('DONNEE_MANQUANTE')
    // 12 m² × 30 g/m², marge 0.
    expect(epinard.grainesNecessaires).toBe(360)
  })

  it("une espèce comptée dans une AUTRE unité garde la sienne (des g/m² ne remplacent pas des caïeux/m²)", async () => {
    mocked.culture.findMany.mockResolvedValue([
      culture(1, 'oignon', { nom: 'B1', longueur: 10, largeur: 1.2 }, {
        quantite: 100,
        itp: { id: 'itp-oignon', doseSemis: 30 },
      }),
    ])
    mocked.espece.findMany.mockResolvedValue([{ ...ESPECE.oignon, doseSemis: 12 }])
    mocked.iTP.findMany.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args?.select?.doseSemis ? [{ id: 'itp-oignon', doseSemis: 30, nbGrainesPlant: null }] : [],
    )

    const [oignon] = await getBesoinsSemences('u1', 2026)
    expect(oignon.uniteDose).toBe('caieux_m2')
    expect(oignon.doseSemis).toBe(12)
    // 1 caïeu = 1 plant : la fiche dit 100, pas 37 (le prorata d'antan).
    expect(oignon.besoinCaieux).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// C27 — une succession n'est pas une seule semaine
// ---------------------------------------------------------------------------

describe('C27 — Plants nécessaires distingue les semaines de plantation', () => {
  const successionPoireau = () => [
    culture(939, 'poireau', { nom: 'B1', longueur: 15, largeur: 1.2 }, {
      quantite: 52, datePlantation: new Date(2026, 6, 19), varieteId: 'carentan',
    }),
    culture(947, 'poireau', { nom: 'B2', longueur: 15, largeur: 1.2 }, {
      quantite: 60, datePlantation: new Date(2026, 7, 9), varieteId: 'carentan',
    }),
  ]

  it('produit une ligne par semaine au lieu d\'attribuer tout à la première', async () => {
    mocked.culture.findMany.mockResolvedValue(successionPoireau())
    mocked.espece.findMany.mockResolvedValue([ESPECE.poireau])

    const besoins = await getBesoinsPlants('u1', 2026)
    expect(besoins).toHaveLength(2)
    const semaines = besoins.map(b => b.semainePlantation).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(semaines[0]).not.toBe(semaines[1])
    expect(besoins.reduce((s, b) => s + b.nbPlants, 0)).toBe(112)
  })

  it("le stock de la variété est alloué chronologiquement, jamais compté deux fois", async () => {
    mocked.culture.findMany.mockResolvedValue(successionPoireau())
    mocked.espece.findMany.mockResolvedValue([ESPECE.poireau])
    mocked.userStockVariete.findMany.mockResolvedValue([
      { varieteId: 'carentan', stockGraines: 0, stockPlants: 100, dateStock: new Date() },
    ])

    const besoins = await getBesoinsPlants('u1', 2026)
    const parSemaine = [...besoins].sort(
      (a, b) => (a.semainePlantation ?? 0) - (b.semainePlantation ?? 0),
    )
    // 112 plants + 10 % de marge = 58 puis 66. Les 100 plants en stock
    // couvrent la première plantation et une partie de la seconde.
    expect(parSemaine[0].stockActuel + parSemaine[1].stockActuel).toBe(100)
    // Total à commander conservé : 124 − 100 = 24, et non « OK » partout.
    expect(besoins.reduce((s, b) => s + b.aCommander, 0)).toBe(24)
  })
})

// ---------------------------------------------------------------------------
// C21 — un rendement porte une unité
// ---------------------------------------------------------------------------

describe('C21 — le rendement est converti avant d\'être multiplié par une surface', () => {
  it('kg/m² : comportement historique conservé', () => {
    expect(projectionRecolteKg(30, 5, 'kg_m2')).toBe(150)
    expect(projectionRecolteKg(30, 5, null)).toBe(150)
    expect(projectionRecolteKg(30, 5, undefined)).toBe(150)
  })

  it('t/ha : le tournesol donne 4,5 kg sur 18 m², pas 45 (facteur 10)', () => {
    expect(projectionRecolteKg(18, 2.5, 'biomasse_t_ha')).toBeCloseTo(4.5, 6)
    expect(rendementKgParM2(2.5, 'biomasse_t_ha')).toBeCloseTo(0.25, 6)
  })

  it("kg/arbre : le kiwi n'est pas projeté au m² (750 kg annoncés sur 30 m²)", () => {
    expect(rendementKgParM2(25, 'kg_arbre')).toBeNull()
    expect(projectionRecolteKg(30, 25, 'kg_arbre')).toBe(0)
  })

  it('une unité inconnue retombe sur le défaut du schéma plutôt que de perdre la ligne', () => {
    expect(projectionRecolteKg(10, 3, 'unite_inventee')).toBe(30)
  })
})

// ---------------------------------------------------------------------------
// Unités en pièces (demande du 2026-08-20 : fleurs coupées, bottes, unité)
// ---------------------------------------------------------------------------

describe('rendement en tiges, pièces ou bottes', () => {
  it('n\'entre JAMAIS dans un total de kilos', () => {
    // Le défaut à éviter : 1 300 tiges de dahlia comptées comme 1 300 kg.
    for (const unite of ['tiges_m2', 'pieces_m2', 'bottes_m2'] as const) {
      expect(rendementKgParM2(40, unite)).toBeNull()
      expect(projectionRecolteKg(9, 40, unite)).toBe(0)
    }
  })

  it('rend sa quantité dans SON unité', () => {
    expect(projectionRecolte(9, 40, 'tiges_m2')).toEqual({ quantite: 360, unite: 'tige' })
    expect(projectionRecolte(4, 16, 'pieces_m2')).toEqual({ quantite: 64, unite: 'piece' })
    expect(projectionRecolte(10, 12, 'bottes_m2')).toEqual({ quantite: 120, unite: 'botte' })
    expect(rendementParM2(40, 'tiges_m2')).toBe(40)
  })

  it('les unités pondérales restent des kilos, converties comme avant', () => {
    expect(projectionRecolte(30, 5, 'kg_m2')).toEqual({ quantite: 150, unite: 'kg' })
    expect(projectionRecolte(18, 2.5, 'biomasse_t_ha').unite).toBe('kg')
    expect(projectionRecolte(18, 2.5, 'biomasse_t_ha').quantite).toBeCloseTo(4.5, 6)
    // kg/arbre n'est pas surfacique : zéro, pas un chiffre inventé.
    expect(projectionRecolte(30, 25, 'kg_arbre')).toEqual({ quantite: 0, unite: 'kg' })
  })

  it('une unité absente ou hors canon compte des kilos, comme le défaut du schéma', () => {
    expect(uniteQuantiteRecolte(null)).toBe('kg')
    expect(uniteQuantiteRecolte('unite_inventee')).toBe('kg')
    expect(uniteQuantiteRecolte('tiges_m2')).toBe('tige')
  })

  it('le libellé s\'accorde au nombre', () => {
    expect(libelleUniteQuantite('tige', 1)).toBe('tige')
    expect(libelleUniteQuantite('tige', 360)).toBe('tiges')
    expect(libelleUniteQuantite('piece', 1)).toBe('pièce')
    expect(libelleUniteQuantite('botte', 12)).toBe('bottes')
    expect(libelleUniteQuantite('kg', 1)).toBe('kg')
  })
})

// ---------------------------------------------------------------------------
// C24 — un seul découpage mensuel
// ---------------------------------------------------------------------------

describe('C24 — Planification et tableau de bord rangent la récolte dans le même mois', () => {
  // Les 5 divergences nommément relevées au registre (30 sur 159 cultures).
  const cas: [string, Date][] = [
    ['353 Épinard', new Date(2026, 4, 25)],
    ['349 Chou brocoli', new Date(2026, 5, 22)],
    ['216 Tomate', new Date(2026, 5, 28)],
    ['886 Pomme de terre', new Date(2026, 8, 21)],
    ['831 Mâche', new Date(2026, 10, 30)],
  ]

  it.each(cas)('%s : la date stockée range la récolte dans son vrai mois', async (_nom, date) => {
    mocked.culture.findMany.mockResolvedValue([
      { ...culture(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 1 }), dateRecolte: date },
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', rendement: 5, uniteRendement: 'kg_m2', couleur: null },
    ])

    const detail = await getRecoltesPrevuesDetail('u1', 2026, 'mois')
    const moisPorteur = detail.periodes.filter(p => p.totalKg > 0).map(p => p.periodeNum)
    expect(moisPorteur).toEqual([date.getMonth() + 1])
  })

  it("une semaine ISO À CHEVAL ne déplace plus la récolte d'un mois", async () => {
    // Le 2 juillet 2026 appartient à une semaine ISO dont le LUNDI tombe le
    // 29 juin. Caler le mois sur la semaine plaçait cette récolte en juin sur
    // Planification quand le tableau de bord la lit en juillet depuis la même
    // date : c'est le résidu qu'un premier correctif avait laissé (30
    // divergences ramenées à 27 seulement, mesuré en production).
    const dateRecolte = new Date(2026, 6, 2)
    expect(moisDepuisSemaine(2026, getISOWeek(dateRecolte))).toBe(6) // le piège
    mocked.culture.findMany.mockResolvedValue([
      { ...culture(1, 'carotte', { nom: 'B1', longueur: 10, largeur: 1 }), dateRecolte },
    ])
    mocked.espece.findMany.mockResolvedValue([
      { id: 'carotte', rendement: 5, uniteRendement: 'kg_m2', couleur: null },
    ])

    const detail = await getRecoltesPrevuesDetail('u1', 2026, 'mois')
    const moisPorteur = detail.periodes.filter(p => p.totalKg > 0).map(p => p.periodeNum)
    expect(moisPorteur).toEqual([7]) // juillet, comme le tableau de bord
  })

  it("l'approximation à 4,33 semaines dérivait d'un mois entier en fin d'année", () => {
    // Ancienne formule : ceil(48 / 4.33) = 12 (décembre) pour une semaine
    // qui tombe en novembre. `moisDepuisSemaine` reste la référence pour les
    // cultures SANS date (suggestions de rotation).
    expect(Math.ceil(48 / 4.33)).toBe(12)
    expect(moisDepuisSemaine(2026, 48)).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// C25 — un seul comptable du stock de semences
// ---------------------------------------------------------------------------

describe('C25 — aucun chemin de création ne débite le stock de semences', () => {
  const chemins = [
    'app/api/cultures/route.ts',
    'lib/planification.ts',
  ]

  it.each(chemins)('%s n\'écrit pas userStockVariete', (relatif) => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src', relatif), 'utf8')
    // Une écriture passerait par un upsert/update sur le stock par variété.
    expect(source).not.toMatch(/userStockVariete\.(upsert|update|create)/)
  })

  it("la suppression d'une culture n'a rien à restituer", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/api/cultures/[id]/route.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/userStockVariete\.(upsert|update|create)/)
  })
})

// ---------------------------------------------------------------------------
// Câblage — les consommateurs passent bien par les SSOT
//
// Les blocs C21 et C24 ci-dessus valident les modules `recolte/projection` et
// `moisDepuisSemaine`. Ils passeraient tout aussi bien si personne ne les
// appelait : ces gardes-ci tiennent le câblage, c'est-à-dire l'absence des
// formules locales qu'ils remplacent.
// ---------------------------------------------------------------------------

describe('câblage des SSOT de projection et de découpage mensuel', () => {
  const lire = (relatif: string) =>
    fs.readFileSync(path.join(process.cwd(), 'src', relatif), 'utf8')

  const projeteurs = [
    'lib/planification.ts',
    'lib/kpi/recoltes-annee.ts',
    'app/api/dashboard/route.ts',
  ]

  it.each(projeteurs)('%s projette via recolte/projection', (relatif) => {
    expect(lire(relatif)).toMatch(/from ['"]@?\/?\.?\.?\/?(lib\/)?recolte\/projection['"]/)
  })

  it.each(projeteurs)('%s ne multiplie plus une surface par un rendement nu', (relatif) => {
    const source = lire(relatif)
    // `surface * rendement` dans un sens ou dans l'autre, quel que soit le
    // nom de la variable qui porte le rendement.
    expect(source).not.toMatch(/\bsurface\w*\s*\*\s*\w*[rR]endement\b/)
    expect(source).not.toMatch(/\b\w*[rR]endement\s*\*\s*surface\w*/)
  })

  it("plus aucun découpage mensuel par approximation de 4,33 semaines", () => {
    for (const relatif of ['lib/planification.ts', 'lib/kpi/recoltes-annee.ts']) {
      expect(lire(relatif)).not.toMatch(/\/\s*4\.3\d/)
    }
  })

  it("l'assistant n'annonce plus tout rendement en kg/m²", () => {
    // `/src/lib/chat/` est exclu du dépôt (.gitignore) : sur un arbre propre
    // le fichier est absent, et son absence n'est pas un échec.
    const chemin = path.join(process.cwd(), 'src/lib/chat/tool-executor.ts')
    if (!fs.existsSync(chemin)) return
    const source = fs.readFileSync(chemin, 'utf8')
    expect(source).not.toMatch(/rendementKgM2:/)
    expect(source).toMatch(/uniteRendement/)
  })
})
