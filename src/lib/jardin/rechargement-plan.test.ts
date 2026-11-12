import { describe, expect, it } from "vitest"
import { indexerEtatSauve } from "./sauvegarde-differentielle"
import {
  annonceSauvegarde,
  aSauvegarder,
  champsPersistes,
  confirmerSauvegarde,
  fusionnerRechargement,
} from "./rechargement-plan"

/**
 * PLAN-01 (revue Codex du 2026-11-12) : le plan se sauvegarde 1 s après le
 * dernier geste. Un rechargement (changement de parcelle, création,
 * suppression, renommage) remplaçait les tableaux ET la référence sauvegardée
 * sans rien garder des modifications en attente : déplacer A puis changer de
 * parcelle avant la sauvegarde effaçait le déplacement, et la sauvegarde
 * suivante annonçait « Plan sauvegardé » sans rien envoyer.
 */

type Planche = { id: string; nom: string; posX: number | null; posY: number | null; cultures?: string[] }
const { empreinte, reporter } = champsPersistes<Planche>(["posX", "posY"])

const planche = (id: string, posX: number | null = 0, extra: Partial<Planche> = {}): Planche =>
  ({ id, nom: id, posX, posY: 0, ...extra })

/** État du plan côté écran : entités affichées, référence sauvée, file hors vue. */
function chargerPremiereFois(serveur: Planche[]) {
  return fusionnerRechargement({
    rechargees: serveur,
    etatServeur: indexerEtatSauve(serveur, empreinte),
    locales: [],
    etatSauve: new Map(),
    horsVue: new Map(),
    empreinte,
    reporter,
  })
}

describe("fusionnerRechargement", () => {
  it("scénario de Codex : A déplacée puis changement de parcelle avant la sauvegarde", () => {
    const vueA = chargerPremiereFois([planche("A")])
    const locales = vueA.entites.map(p => (p.id === "A" ? { ...p, posX: 7 } : p))

    const serveurB = [planche("B")]
    const vueB = fusionnerRechargement({
      rechargees: serveurB,
      etatServeur: indexerEtatSauve(serveurB, empreinte),
      locales,
      etatSauve: vueA.etatSauve,
      horsVue: vueA.horsVue,
      empreinte,
      reporter,
    })

    expect(vueB.entites.map(p => p.id)).toEqual(["B"])
    // Le déplacement de A n'est pas perdu : il attend hors de la vue…
    expect(vueB.horsVue.get("A")?.posX).toBe(7)
    // … et la sauvegarde suivante l'envoie.
    const envoi = aSauvegarder(vueB.entites, vueB.etatSauve, vueB.horsVue, empreinte)
    expect(envoi.map(p => [p.id, p.posX])).toEqual([["A", 7]])
  })

  it("rechargement dans la même vue (création, renommage) : la position locale reste, l'affichage suit la base", () => {
    const vue = chargerPremiereFois([planche("A", 0, { cultures: [] })])
    const locales = vue.entites.map(p => ({ ...p, posX: 7 }))
    const serveur = [planche("A", 0, { nom: "A renommée", cultures: ["tomate"] }), planche("C", 3)]

    const apres = fusionnerRechargement({
      rechargees: serveur,
      etatServeur: indexerEtatSauve(serveur, empreinte),
      locales,
      etatSauve: vue.etatSauve,
      horsVue: vue.horsVue,
      empreinte,
      reporter,
    })

    const a = apres.entites.find(p => p.id === "A")!
    expect(a).toMatchObject({ posX: 7, nom: "A renommée", cultures: ["tomate"] })
    expect(apres.entites.find(p => p.id === "C")?.posX).toBe(3)
    expect(apres.horsVue.size).toBe(0)
    // A reste à écrire ; C, telle qu'en base, non.
    expect(aSauvegarder(apres.entites, apres.etatSauve, apres.horsVue, empreinte).map(p => p.id)).toEqual(["A"])
  })

  it("une entité non modifiée prend la version relue en base", () => {
    const vue = chargerPremiereFois([planche("A", 0)])
    const serveur = [planche("A", 4)]
    const apres = fusionnerRechargement({
      rechargees: serveur,
      etatServeur: indexerEtatSauve(serveur, empreinte),
      locales: vue.entites,
      etatSauve: vue.etatSauve,
      horsVue: vue.horsVue,
      empreinte,
      reporter,
    })
    expect(apres.entites[0].posX).toBe(4)
    expect(aSauvegarder(apres.entites, apres.etatSauve, apres.horsVue, empreinte)).toEqual([])
  })

  it("une entité supprimée ne part pas en file d'attente", () => {
    const vue = chargerPremiereFois([planche("A"), planche("B")])
    const locales = vue.entites.map(p => (p.id === "A" ? { ...p, posX: 7 } : p))
    const serveur = [planche("B")]
    const apres = fusionnerRechargement({
      rechargees: serveur,
      etatServeur: indexerEtatSauve(serveur, empreinte),
      locales,
      etatSauve: vue.etatSauve,
      horsVue: vue.horsVue,
      supprimees: ["A"],
      empreinte,
      reporter,
    })
    expect(apres.horsVue.size).toBe(0)
    expect(aSauvegarder(apres.entites, apres.etatSauve, apres.horsVue, empreinte)).toEqual([])
  })

  it("retour sur la parcelle de départ avant la sauvegarde : A réapparaît à sa position locale, toujours à écrire", () => {
    const horsVue = new Map([["A", planche("A", 7)]])
    const serveur = [planche("A", 0)]
    const apres = fusionnerRechargement({
      rechargees: serveur,
      etatServeur: indexerEtatSauve(serveur, empreinte),
      locales: [planche("B")],
      etatSauve: indexerEtatSauve([planche("B")], empreinte),
      horsVue,
      empreinte,
      reporter,
    })
    expect(apres.entites[0].posX).toBe(7)
    expect(apres.horsVue.size).toBe(0)
    expect(aSauvegarder(apres.entites, apres.etatSauve, apres.horsVue, empreinte).map(p => p.id)).toEqual(["A"])
  })

  it("une planche seulement posée par l'écran (sans position en base) n'entre pas en file", () => {
    const serveur = [planche("P", null)]
    const vue = chargerPremiereFois(serveur)
    // L'écran la pose en (4, 0) pour l'afficher ; l'utilisateur n'y touche pas.
    const posee = { ...vue.entites[0], posX: 4 }
    const placementsLocaux = new Map([["P", empreinte(posee)]])
    const ailleurs = fusionnerRechargement({
      rechargees: [],
      etatServeur: new Map(),
      locales: [posee],
      etatSauve: vue.etatSauve,
      horsVue: vue.horsVue,
      placementsLocaux,
      empreinte,
      reporter,
    })
    expect(ailleurs.horsVue.size).toBe(0)

    // Déplacée ensuite par l'utilisateur : c'est une modification, elle attend.
    const deplacee = fusionnerRechargement({
      rechargees: [],
      etatServeur: new Map(),
      locales: [{ ...posee, posX: 9 }],
      etatSauve: vue.etatSauve,
      horsVue: vue.horsVue,
      placementsLocaux,
      empreinte,
      reporter,
    })
    expect(deplacee.horsVue.get("P")?.posX).toBe(9)
  })

  it("ne modifie pas la référence ni la file reçues", () => {
    const etatSauve = new Map([["A", empreinte(planche("A"))]])
    const horsVue = new Map([["Z", planche("Z", 9)]])
    fusionnerRechargement({
      rechargees: [],
      etatServeur: new Map(),
      locales: [planche("A", 7)],
      etatSauve,
      horsVue,
      empreinte,
      reporter,
    })
    expect([...etatSauve.keys()]).toEqual(["A"])
    expect([...horsVue.keys()]).toEqual(["Z"])
  })
})

describe("confirmerSauvegarde", () => {
  it("avance la référence et vide la file des seules entités envoyées", () => {
    const envoyeeA = planche("A", 7)
    const etatSauve = new Map<string | number, string>()
    const horsVue = new Map([["A", envoyeeA], ["Z", planche("Z", 9)]])
    confirmerSauvegarde(etatSauve, horsVue, [envoyeeA], empreinte)
    expect(etatSauve.get("A")).toBe(empreinte(envoyeeA))
    expect([...horsVue.keys()]).toEqual(["Z"])
  })

  it("une version plus récente mise en file pendant l'envoi y reste", () => {
    const envoyee = planche("A", 7)
    const horsVue = new Map([["A", planche("A", 8)]])
    confirmerSauvegarde(new Map(), horsVue, [envoyee], empreinte)
    expect(horsVue.get("A")?.posX).toBe(8)
  })
})

describe("annonceSauvegarde", () => {
  it("rien d'envoyé : aucune annonce de succès", () => {
    expect(annonceSauvegarde({ envoyes: 0, differes: 0, reussi: true })).toBeNull()
  })

  it("envoi réussi : « Plan sauvegardé »", () => {
    expect(annonceSauvegarde({ envoyes: 2, differes: 0, reussi: true })).toEqual({
      title: "Plan sauvegardé",
      description: "Les positions ont été enregistrées",
    })
  })

  it("envoi réussi avec arbres en attente GPS : le dit", () => {
    expect(annonceSauvegarde({ envoyes: 1, differes: 2, reussi: true })?.description)
      .toBe("Positions enregistrées. 2 arbres en attente de confirmation GPS n'ont pas été déplacés.")
    expect(annonceSauvegarde({ envoyes: 1, differes: 1, reussi: true })?.description)
      .toBe("Positions enregistrées. 1 arbre en attente de confirmation GPS n'a pas été déplacé.")
  })

  it("échec : message d'erreur, jamais de succès", () => {
    expect(annonceSauvegarde({ envoyes: 3, differes: 0, reussi: false })).toEqual({
      variant: "destructive",
      title: "Erreur",
      description: "Certaines positions n'ont pas pu être enregistrées",
    })
  })
})

describe("champsPersistes", () => {
  it("l'empreinte reste celle des valeurs des champs, dans l'ordre (comme avant)", () => {
    expect(empreinte(planche("A", 7))).toBe(JSON.stringify([7, 0]))
  })

  it("le report ne copie que les champs persistés", () => {
    const r = reporter(planche("A", 0, { nom: "base" }), planche("A", 7, { nom: "local" }))
    expect(r).toMatchObject({ posX: 7, nom: "base" })
  })
})
