import { describe, expect, it } from "vitest"
import { abandonnerLecture, creerBoite, etatChargement, lancerLecture, rangerReponse, type Reponse } from "./use-chargement"

/** Lecteur dont chaque demande se résout à la main, dans l'ordre voulu par le test. */
function lecteurManuel() {
  const demandes: Array<{ cle: string; signal: AbortSignal; resoudre: (v: string) => void; rejeter: (e: unknown) => void }> = []
  return {
    demandes,
    pour: (cle: string) => (signal: AbortSignal) =>
      new Promise<string>((resoudre, rejeter) => demandes.push({ cle, signal, resoudre, rejeter })),
  }
}

describe("lancerLecture : la dernière demande gagne", () => {
  it("ignore la réponse en retard d'un filtre quitté", async () => {
    const recues: Reponse<string>[] = []
    const lecteur = lecteurManuel()
    const boite = creerBoite<string>(lecteur.pour("2025"), (r) => recues.push(r))

    boite.cle = "2025"
    const premiere = lancerLecture(boite)
    boite.cle = "2026"
    boite.lecteur = lecteur.pour("2026")
    const seconde = lancerLecture(boite)

    // La réponse 2026 arrive d'abord, celle de 2025 ensuite.
    lecteur.demandes[1].resoudre("lignes 2026")
    lecteur.demandes[0].resoudre("lignes 2025")
    await Promise.all([premiere, seconde])

    expect(recues.at(-1)).toEqual({ cle: "2026", etat: "pret", donnees: "lignes 2026" })
    expect(recues.some((r) => r.etat === "pret" && r.cle === "2025")).toBe(false)
    expect(lecteur.demandes[0].signal.aborted).toBe(true)
  })

  it("gagne même si le lecteur ignore le signal d'annulation", async () => {
    const recues: Reponse<number>[] = []
    let resoudreLent: (v: number) => void = () => {}
    const boite = creerBoite<number>(() => new Promise((r) => { resoudreLent = r }), (r) => recues.push(r))
    boite.cle = "a"
    const lente = lancerLecture(boite)
    boite.cle = "b"
    boite.lecteur = async () => 2
    await lancerLecture(boite)
    resoudreLent(1)
    await lente

    expect(recues.filter((r) => r.etat === "pret")).toEqual([{ cle: "b", etat: "pret", donnees: 2 }])
  })

  it("un rechargement lit la clé et le lecteur courants, pas ceux d'une fermeture", async () => {
    const recues: Reponse<string>[] = []
    const boite = creerBoite<string>(async () => "exercice 2025", (r) => recues.push(r))
    const recharger = () => lancerLecture(boite) // capturé avant le changement de filtre
    boite.cle = "2025"
    await lancerLecture(boite)

    boite.cle = "2026"
    boite.lecteur = async () => "exercice 2026"
    await recharger()

    expect(recues.at(-1)).toEqual({ cle: "2026", etat: "pret", donnees: "exercice 2026" })
  })

  it("range l'erreur de la demande courante et tait celle d'une demande annulée", async () => {
    const recues: Reponse<string>[] = []
    const lecteur = lecteurManuel()
    const boite = creerBoite<string>(lecteur.pour("a"), (r) => recues.push(r))
    boite.cle = "a"
    const premiere = lancerLecture(boite)
    boite.cle = "b"
    const seconde = lancerLecture(boite)
    lecteur.demandes[0].rejeter(new Error("annulée"))
    lecteur.demandes[1].rejeter(new Error("panne"))
    await Promise.all([premiere, seconde])

    expect(recues.filter((r) => r.etat === "erreur")).toEqual([{ cle: "b", etat: "erreur", erreur: new Error("panne") }])
  })

  it("ne lit rien pour une clé nulle, et un lecteur qui lève tout de suite devient une erreur", async () => {
    const recues: Reponse<string>[] = []
    const boite = creerBoite<string>(() => { throw new Error("immédiat") }, (r) => recues.push(r))
    await lancerLecture(boite)
    expect(recues).toEqual([])

    boite.cle = "a"
    await lancerLecture(boite)
    expect(recues.at(-1)).toMatchObject({ cle: "a", etat: "erreur" })
  })

  it("après abandon (démontage), la réponse n'est plus appliquée", async () => {
    const recues: Reponse<string>[] = []
    const lecteur = lecteurManuel()
    const boite = creerBoite<string>(lecteur.pour("a"), (r) => recues.push(r))
    boite.cle = "a"
    const lecture = lancerLecture(boite)
    abandonnerLecture(boite)
    lecteur.demandes[0].resoudre("trop tard")
    await lecture

    expect(recues).toEqual([{ cle: "a", etat: "chargement", rafraichissement: false }])
  })
})

describe("rafraîchissement", () => {
  it("distingue le rechargement de la même clé d'un changement de filtre", async () => {
    const recues: Reponse<string>[] = []
    const boite = creerBoite<string>(async () => "lignes", (r) => recues.push(r))
    boite.cle = "2025"
    await lancerLecture(boite)
    await lancerLecture(boite)
    boite.cle = "2026"
    await lancerLecture(boite)

    expect(recues.filter((r) => r.etat === "chargement").map((r) => r.etat === "chargement" && r.rafraichissement)).toEqual([false, true, false])
  })
})

describe("état affiché", () => {
  const pret: Reponse<string> = { cle: "2025", etat: "pret", donnees: "lignes 2025" }

  it("ne montre jamais les données d'une autre clé", () => {
    expect(etatChargement(pret, "2025")).toEqual({ donnees: "lignes 2025", erreur: null, enChargement: false })
    expect(etatChargement(pret, "2026")).toEqual({ donnees: null, erreur: null, enChargement: true })
    expect(etatChargement(pret, null)).toEqual({ donnees: null, erreur: null, enChargement: true })
    expect(etatChargement(null, "2025").enChargement).toBe(true)
  })

  it("garde les données pendant un rechargement de la même clé, les masque au changement de clé", () => {
    expect(rangerReponse(pret, { cle: "2025", etat: "chargement", rafraichissement: true })).toBe(pret)
    expect(rangerReponse(pret, { cle: "2026", etat: "chargement", rafraichissement: false })).toEqual({ cle: "2026", etat: "chargement", rafraichissement: false })
    const erreur: Reponse<string> = { cle: "2025", etat: "erreur", erreur: new Error("panne") }
    expect(rangerReponse(pret, erreur)).toBe(erreur)
  })
})
