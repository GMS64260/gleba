/**
 * Rendu serveur des tuiles de l'accueil v2 dans leurs trois états
 * (chargement, vide, données) : la preuve visuelle se fait au navigateur sur
 * le build Docker (jamais de `next build` sur l'hôte), ceci garantit au
 * moins qu'aucune tuile ne lève et que l'information est portée en texte.
 */

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { AccueilEnTete, libelleDate } from "./AccueilEnTete"
import { PlanVignette } from "./PlanVignette"
import { TuileAgent, alerteMeteoPrioritaire } from "./TuileAgent"
import { TuileAujourdhui } from "./TuileAujourdhui"
import { TuileElevage } from "./TuileElevage"
import { TuileCarte, TuileJournal, TuileRaccourcis, TuileStocks, TuileTresorerie, TuileVentes, TuileVerger } from "./TuilesCatalogue"
import { TuilePlan, TuilePlanVide } from "./TuilePlan"
import { TuileSemaine } from "./TuileSemaine"
import type { ElementAujourdhui, PlanVignetteDonnees } from "@/lib/accueil/types"

const element = (p: Partial<ElementAujourdhui> & Pick<ElementAujourdhui, "id" | "etat" | "titre">): ElementAujourdhui => ({
  source: "recolte",
  module: "maraichage",
  meta: [],
  action: { libelle: "Ouvrir", href: "/taches" },
  retardJours: 0,
  plancheIds: [],
  ...p,
})

const plan: PlanVignetteDonnees = {
  planches: [
    { id: "a", nom: "A1", posX: 0, posY: 0, largeur: 0.8, longueur: 10, rotation2D: 0, etat: "arroser" },
    { id: "b", nom: "B1", posX: 2, posY: 0, largeur: 0.8, longueur: 10, rotation2D: 0, etat: "recolter" },
    { id: "c", nom: "C1", posX: 4, posY: 0, largeur: 0.8, longueur: 10, rotation2D: 15, etat: "libre" },
  ],
  arbres: [{ id: 1, posX: 10, posY: 5, envergure: 3 }],
  objets: [{ id: 1, type: "serre", posX: -8, posY: 0, largeur: 4, longueur: 8, rotation2D: 0 }],
}

describe("AccueilEnTete", () => {
  it("date longue capitalisée et fenêtre de travail en texte", () => {
    expect(libelleDate("2026-10-08")).toBe("Jeudi 8 octobre")
    const html = renderToStaticMarkup(
      createElement(AccueilEnTete, {
        date: "2026-10-08",
        fenetre: { principal: "sec jusqu'à samedi", details: ["6 mm dimanche"] },
      }),
    )
    expect(html).toContain("Jeudi 8 octobre")
    expect(html).toContain("sec jusqu&#x27;à samedi")
    expect(html).toContain("6 mm dimanche")
    expect(html).toContain("+ Récolte")
  })
})

describe("TuileAujourdhui", () => {
  it("chargement, puis état vide honnête quand une source manque", () => {
    const chargement = renderToStaticMarkup(
      createElement(TuileAujourdhui, { elements: [], sourcesEnErreur: [], chargement: true, erreur: null }),
    )
    expect(chargement).toContain("lecture en cours")

    const vide = renderToStaticMarkup(
      createElement(TuileAujourdhui, { elements: [], sourcesEnErreur: ["irrigation"], chargement: false, erreur: null }),
    )
    expect(vide).toContain("Sources indisponibles : irrigation")
    expect(vide).not.toContain("Rien d&#x27;urgent aujourd")
  })

  it("rend les lignes avec leur état en texte et replie au-delà de huit", () => {
    const elements = Array.from({ length: 10 }, (_, i) =>
      element({ id: `e${i}`, etat: i === 0 ? "critique" : i === 1 ? "attention" : "info", titre: `Ligne ${i}`, retardJours: i === 1 ? 3 : 0 }),
    )
    const html = renderToStaticMarkup(
      createElement(TuileAujourdhui, { elements, sourcesEnErreur: [], chargement: false, erreur: null }),
    )
    expect(html).toContain("10 choses · classées par urgence")
    expect(html).toContain("Urgent")
    expect(html).toContain("En retard")
    expect(html).toContain("Ligne 7")
    expect(html).not.toContain("Ligne 8")
    expect(html).toContain("Voir les 2 autres")
  })

  it("une ligne qui porte sa mutation a un bouton, les autres un lien", () => {
    const html = renderToStaticMarkup(
      createElement(TuileAujourdhui, {
        elements: [
          element({
            id: "semis:1",
            etat: "attention",
            titre: "Semer phacélie B4",
            retardJours: 2,
            action: {
              libelle: "Fait",
              href: "/taches",
              mutation: { url: "/api/cultures/1", corps: { semisFait: true }, inverse: { semisFait: false }, titre: "Semis noté" },
            },
          }),
          element({ id: "recolte:2", etat: "info", titre: "Récolter radis B1", action: { libelle: "Récolte", href: "/maraichage/recoltes" } }),
        ],
        sourcesEnErreur: [],
        chargement: false,
        erreur: null,
      }),
    )
    expect(html).toMatch(/<button[^>]*>Fait<\/button>/)
    expect(html).toMatch(/<a[^>]*href="\/maraichage\/recoltes"[^>]*>Récolte<\/a>/)
  })
})

describe("TuilePlan et PlanVignette", () => {
  it("peint les états et les dit en texte", () => {
    const html = renderToStaticMarkup(createElement(TuilePlan, { plan, nomFerme: "Ferme du Bois Joli", chargement: false }))
    expect(html).toContain("Ferme du Bois Joli")
    expect(html).toContain("1 à arroser")
    expect(html).toContain("1 à récolter")
    expect(html).toContain("Ouvrir le plan")
    expect(html).toContain("var(--argile)")
    expect(html).toContain("rotate(15")
  })

  it("état vide et chargement sans lever", () => {
    expect(renderToStaticMarkup(createElement(TuilePlanVide, {}))).toContain("Dessiner la ferme")
    expect(renderToStaticMarkup(createElement(TuilePlan, { plan: null, nomFerme: null, chargement: true }))).toContain("chargement")
    expect(renderToStaticMarkup(createElement(PlanVignette, { plan: { planches: [], arbres: [], objets: [] } }))).toContain("<svg")
  })
})

describe("TuileSemaine", () => {
  it("sept jours, pluie et gel en texte, parcelle en sous-titre", () => {
    const previsions = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-10-${String(8 + i).padStart(2, "0")}`,
      tempMin: i === 5 ? -1 : 6,
      tempMax: 17,
      precipitation: i === 3 ? 6 : 0,
      sunshine: 7,
    }))
    const html = renderToStaticMarkup(
      createElement(TuileSemaine, {
        meteo: { parcelle: { id: "p", nom: "Serre" }, actuelle: null, previsions, alertes: [] },
        chargement: false,
        erreur: null,
      }),
    )
    expect(html).toContain("Serre")
    expect(html).toContain("6 mm")
    expect(html).toContain("gel")
    expect((html.match(/<li/g) ?? []).length).toBe(7)
  })

  it("sans parcelle : le dit et propose de placer la ferme", () => {
    const html = renderToStaticMarkup(createElement(TuileSemaine, { meteo: null, chargement: false, erreur: null }))
    expect(html).toContain("Aucune parcelle géolocalisée")
    expect(html).toContain("Placer la ferme")
  })
})

describe("TuileAgent", () => {
  it("alerte météo d'abord, danger avant attention", () => {
    const alertes = [
      { type: "vent_traitement", niveau: "attention" as const, date: "2026-10-09", message: "Vent fort", details: "" },
      { type: "gel", niveau: "danger" as const, date: "2026-10-13", message: "Gel probable mardi nuit", details: "-1 °C à la parcelle." },
    ]
    expect(alerteMeteoPrioritaire(alertes)?.type).toBe("gel")
    const html = renderToStaticMarkup(
      createElement(TuileAgent, { alerteMeteo: alertes[1], elementCritique: null, chargement: false }),
    )
    expect(html).toContain("Gel probable mardi nuit")
    expect(html).toContain("Ouvrir la météo")
    expect(html).toContain("Demander à Gleba")
  })

  it("sinon la ligne critique du jour, sinon une invitation", () => {
    const critique = renderToStaticMarkup(
      createElement(TuileAgent, {
        alerteMeteo: null,
        elementCritique: element({ id: "i", etat: "critique", titre: "Arroser C1, C2", meta: ["6 cultures"], action: { libelle: "Noter", href: "/x" } }),
        chargement: false,
      }),
    )
    expect(critique).toContain("Arroser C1, C2")
    expect(critique).toContain("Noter")
    const calme = renderToStaticMarkup(createElement(TuileAgent, { alerteMeteo: null, elementCritique: null, chargement: false }))
    expect(calme).toContain("Rien d&#x27;urgent signalé")
  })
})

describe("TuileElevage", () => {
  it("échéances avec état et lien, état vide sinon", () => {
    const html = renderToStaticMarkup(
      createElement(TuileElevage, {
        elevage: {
          animauxActifs: 48,
          counts: { total: 2, urgent: 1, dansListeDuJour: 0 },
          echeances: [
            { id: "soin-1", kind: "soin_retard", date: null, joursRestants: -2, titre: "Vermifuge — Noisette", detail: "en retard de 2 j", gravite: "urgent" },
            { id: "att-1", kind: "attente_lait", date: null, joursRestants: 6, titre: "Lait non commercialisable — Noisette", detail: "remise en vente le 15/10", gravite: "urgent" },
          ],
        },
        chargement: false,
      }),
    )
    expect(html).toContain("48 animaux · 1 urgent")
    expect(html).toContain('data-etat="critique"')
    expect(html).toContain('data-etat="info"')
    expect(html).toContain("/elevage?tab=alimentation&amp;sub=soins")
    const dejaDansLaListe = renderToStaticMarkup(
      createElement(TuileElevage, {
        elevage: { animauxActifs: 19, counts: { total: 2, urgent: 2, dansListeDuJour: 2 }, echeances: [] },
        chargement: false,
      }),
    )
    expect(dejaDansLaListe).toContain("2 dans la liste du jour")
    expect(dejaDansLaListe).toContain("Rien d&#x27;autre sous 7 jours")
    const vide = renderToStaticMarkup(createElement(TuileElevage, { elevage: null, chargement: false }))
    expect(vide).toContain("Aucune échéance sous 7 jours")
  })
})

describe("tuiles du catalogue", () => {
  it("Trésorerie : créances en lignes de registre, retard en verbe, total à encaisser", () => {
    const html = renderToStaticMarkup(
      createElement(TuileTresorerie, {
        chargement: false,
        tresorerie: {
          devise: "EUR", revenusYtd: 12000, depensesYtd: 8000, beneficeYtd: 4000, margePercentYtd: 33,
          creances: [
            { id: 1, numero: "F-2026-0002", client: "La Table du Bocage", montant: 1111.24, echeance: "2026-08-15T00:00:00.000Z", retardJours: 56 },
            { id: 2, numero: "F-2026-0009", client: "AMAP du Bourg", montant: 240, echeance: "2026-10-20T00:00:00.000Z", retardJours: 0 },
          ],
          totalCreances: 1351, nbDepensesNonPayees: 2, depensesNonPayees: 380,
        },
      }),
    )
    expect(html).toContain('data-etat="critique"')
    expect(html).toContain("À relancer")
    expect(html).toContain("À encaisser")
    expect(html).toContain("échue depuis 56 j")
    expect(html).toContain("2 dépenses à régler")
  })

  it("Verger : un lot par geste, « Fait » n'est pas promis ici, l'état vide parle", () => {
    const html = renderToStaticMarkup(
      createElement(TuileVerger, {
        chargement: false,
        verger: { lots: [{ cle: "taille|Taille en vert", libelle: "Taille en vert", type: "taille", nbArbres: 4, arbres: ["P1", "P2", "P3"], fenetre: "septembre-octobre", echeance: null, enRetard: false }], counts: { aFaire: 4, aVenir: 2 } },
      }),
    )
    expect(html).toContain("Taille en vert")
    expect(html).toContain("4 arbres")
    expect(html).toContain("fenêtre septembre-octobre")
    expect(html).toContain("4 à faire · 2 à venir")
    const vide = renderToStaticMarkup(createElement(TuileVerger, { chargement: false, verger: { lots: [], counts: { aFaire: 0, aVenir: 0 } } }))
    expect(vide).toContain("Rien à faire au verger")
  })

  it("Stocks, Ventes, Journal : états en verbe, aucune couleur seule", () => {
    const stocks = renderToStaticMarkup(
      createElement(TuileStocks, { chargement: false, stocks: { aliments: [{ id: "foin", nom: "Foin", stock: 0, stockMin: 200 }], peremptions: [{ id: "m1", titre: "Vermifuge X périme", detail: null, joursRestants: 3 }] } }),
    )
    expect(stocks).toContain("Épuisé")
    expect(stocks).toContain("Bientôt périmé")
    const ventes = renderToStaticMarkup(
      createElement(TuileVentes, { chargement: false, ventes: { devise: "EUR", totalMois: 420, nbMois: 3, dernieres: [{ id: 1, date: "2026-10-09T00:00:00.000Z", description: "Panier légumes", montant: 25, client: "Marie", paye: false }] } }),
    )
    expect(ventes).toContain("Panier légumes")
    expect(ventes).toContain("À encaisser")
    const journal = renderToStaticMarkup(
      createElement(TuileJournal, { chargement: false, journal: { entrees: [{ id: "intervention:1", date: "2026-10-09T00:00:00.000Z", titre: "desherbage", detail: "Planche B1", href: "/interventions" }] } }),
    )
    expect(journal).toContain("desherbage")
    expect(journal).toContain("Planche B1")
  })

  it("Raccourcis : seuls les modules actifs ont leur raccourci ; Carte dessine les parcelles", () => {
    const raccourcis = renderToStaticMarkup(createElement(TuileRaccourcis, { modules: ["maraichage"] }))
    expect(raccourcis).toContain("Noter une récolte")
    expect(raccourcis).not.toContain("Soin")
    expect(raccourcis).toContain("Demander à Gleba")
    const carte = renderToStaticMarkup(
      createElement(TuileCarte, {
        chargement: false,
        carte: { nbParcelles: 1, surfaceHa: 0.5, vignette: { largeur: 320, hauteur: 180, formes: [{ id: "a", nom: "Le Clos", anneaux: ["10,10 100,10 100,100"], couleur: null }] } },
      }),
    )
    expect(carte).toContain("<polygon")
    expect(carte).toContain("1 parcelle · 0,5 ha")
    expect(carte).toContain("Le Clos")
  })
})
