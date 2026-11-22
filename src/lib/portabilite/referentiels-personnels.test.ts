/* eslint-disable no-restricted-syntax -- Identifiants techniques exacts des modèles Prisma. */
import { describe, expect, it, vi } from "vitest"
import {
  champProprietaire, recreerReferentielPersonnel, referentielsUtilises, remapperCompositionRation, type RelationReferentiel,
} from "./referentiels-personnels"

type Ligne = Record<string, unknown>

/** Table en mémoire : assez pour suivre ce que la recréation lit et écrit. */
function table(initiales: Ligne[] = []) {
  const lignes = [...initiales]
  const correspond = (ligne: Ligne, where: Ligne) => Object.entries(where).every(([champ, valeur]) => ligne[champ] === valeur)
  return {
    lignes,
    findFirst: vi.fn(async ({ where }: { where: Ligne }) => lignes.find((l) => correspond(l, where)) ?? null),
    count: vi.fn(async ({ where }: { where: Ligne }) => lignes.filter((l) => correspond(l, where)).length),
    create: vi.fn(async ({ data }: { data: Ligne }) => { lignes.push(data); return data }),
  }
}

const base = {
  pkField: "id", proprietaire: "userId" as const, utilisateurCible: "compte-cible",
  relations: [] as RelationReferentiel[], resoudre: () => undefined, estDuCompte: () => false,
}
const especeDuFichier = {
  id: "cmsourceespece", nom: "Tomate de la ferme", nomNormalise: "tomate de la ferme",
  userId: "compte-source", partageCommunaute: true, familleId: null,
}

describe("propriétaire d'un référentiel personnel", () => {
  it("lit userId pour le communautaire, ownerUserId pour les aliments, rien pour le reste", () => {
    expect(champProprietaire("Espece", true)).toBe("userId")
    expect(champProprietaire("Aliment", false)).toBe("ownerUserId")
    expect(champProprietaire("Famille", false)).toBeNull()
  })
})

describe("recréation d'un référentiel personnel à la restauration (FB-GJLDGZ)", () => {
  it("crée une copie privée du compte cible, sous un nouvel identifiant", async () => {
    // L'entrée privée du compte d'origine existe encore sur l'instance : elle n'est ni reprise ni touchée.
    const t = table([{ ...especeDuFichier }])
    const copie = await recreerReferentielPersonnel({ ...base, modele: "Espece", delegue: t, donnees: { ...especeDuFichier } })
    expect(copie).toMatchObject({ reprise: false, renomme: null })
    expect(copie!.id).not.toBe(especeDuFichier.id)
    expect(String(copie!.id)).toMatch(/^c[0-9a-z]{24}$/)
    expect(t.lignes).toHaveLength(2)
    expect(t.lignes[0]).toEqual(especeDuFichier)
    expect(t.lignes[1]).toMatchObject({ id: copie!.id, nom: "Tomate de la ferme", userId: "compte-cible", partageCommunaute: false })
  })

  it("reprend l'entrée du compte cible qui porte déjà ce nom, sans rien écrire", async () => {
    const t = table([{ id: "cmdejala", nomNormalise: "tomate de la ferme", userId: "compte-cible" }])
    const copie = await recreerReferentielPersonnel({ ...base, modele: "Espece", delegue: t, donnees: { ...especeDuFichier } })
    expect(copie).toEqual({ id: "cmdejala", reprise: true, renomme: null })
    expect(t.create).not.toHaveBeenCalled()
  })

  it("réécrit les références internes et cherche l'homonyme d'une variété dans son espèce", async () => {
    const t = table([{ id: "cmautre", nomNormalise: "noire de crimee", especeId: "cmautreespece", userId: "compte-cible" }])
    const copie = await recreerReferentielPersonnel({
      ...base, modele: "Variete", delegue: t,
      donnees: { id: "cmvariete", nom: "Noire de Crimée", nomNormalise: "noire de crimee", especeId: "cmsourceespece", fournisseurId: "f-inconnu", userId: "compte-source", partageCommunaute: false },
      relations: [
        { fkField: "especeId", targetModel: "Espece", nullable: false },
        { fkField: "fournisseurId", targetModel: "Fournisseur", nullable: true },
        { fkField: "userId", targetModel: "User", nullable: true },
      ],
      resoudre: (modele, ancien) => (modele === "Espece" && ancien === "cmsourceespece" ? "cmnouvelleespece" : undefined),
    })
    expect(copie!.reprise).toBe(false)
    expect(t.lignes[1]).toMatchObject({ especeId: "cmnouvelleespece", fournisseurId: null, userId: "compte-cible" })
  })

  it("n'écrit rien quand une référence obligatoire de l'entrée est indisponible", async () => {
    const t = table()
    const copie = await recreerReferentielPersonnel({
      ...base, modele: "Variete", delegue: t,
      donnees: { id: "cmvariete", nom: "Orpheline", nomNormalise: "orpheline", especeId: "cmabsente", userId: "compte-source" },
      relations: [{ fkField: "especeId", targetModel: "Espece", nullable: false }],
    })
    expect(copie).toBeNull()
    expect(t.create).not.toHaveBeenCalled()
  })

  it("renomme la copie quand le nom est déjà pris sur l'instance par un autre compte", async () => {
    const t = table([
      { id: "pg1", nom: "Franc maison", userId: "compte-source" },
      { id: "pg2", nom: "Franc maison (restauré)", userId: "un-autre" },
    ])
    const copie = await recreerReferentielPersonnel({
      ...base, modele: "PorteGreffe", delegue: t,
      donnees: { id: "pg1", nom: "Franc maison", userId: "compte-source", partageCommunaute: false },
    })
    expect(copie).toMatchObject({ reprise: false, renomme: "Franc maison (restauré 2)" })
    expect(t.lignes[2]).toMatchObject({ nom: "Franc maison (restauré 2)", userId: "compte-cible" })
  })

  it("ramène un itinéraire et un aliment à leur état personnel, quoi que dise le fichier", async () => {
    const itps = table()
    await recreerReferentielPersonnel({
      ...base, modele: "ITP", delegue: itps,
      donnees: { id: "cmitp", nom: "Mon itinéraire", nomNormalise: "mon itineraire", userId: "compte-source", partageCommunaute: true, statutValidation: "source_documentee", sourceRecordId: "officiel-42" },
    })
    expect(itps.lignes[0]).toMatchObject({ statutValidation: "personnel", sourceRecordId: null, partageCommunaute: false })
    const aliments = table()
    await recreerReferentielPersonnel({
      ...base, modele: "Aliment", delegue: aliments, proprietaire: "ownerUserId",
      donnees: { id: "foin_maison", nom: "Foin maison", ownerUserId: "compte-source", origine: "officiel" },
    })
    expect(aliments.lignes[0]).toMatchObject({ ownerUserId: "compte-cible", origine: "prive" })
    expect(aliments.lignes[0].id).not.toBe("foin_maison")
  })

  // Contre-relecture du 2026-11-22 : la variété « Non spécifiée » d'une espèce est
  // attribuée d'office aux cultures sans variété de TOUS les comptes.
  it("ne garde une variété « Non spécifiée » que sur une espèce du compte lui-même", async () => {
    const variete = { id: "cmv", nom: "Tomate — Non spécifiée", nomNormalise: "peu importe", especeId: "Tomate", isPlaceholder: true, userId: "compte-source" }
    const relations = [{ fkField: "especeId", targetModel: "Espece", nullable: false }]
    const surOfficielle = table()
    await recreerReferentielPersonnel({ ...base, modele: "Variete", delegue: surOfficielle, donnees: { ...variete }, relations, resoudre: () => "Tomate" })
    expect(surOfficielle.lignes[0]).toMatchObject({ especeId: "Tomate", isPlaceholder: false, userId: "compte-cible" })
    const surCopie = table()
    await recreerReferentielPersonnel({ ...base, modele: "Variete", delegue: surCopie, donnees: { ...variete }, relations, resoudre: () => "cmcopie", estDuCompte: (modele, id) => modele === "Espece" && id === "cmcopie" })
    expect(surCopie.lignes[0]).toMatchObject({ especeId: "cmcopie", isPlaceholder: true })
  })

  it("recalcule la clé de dédoublonnage depuis le nom, sans croire le fichier", async () => {
    const t = table([{ id: "cmdejala", nomNormalise: "tomate de la ferme", userId: "compte-cible" }])
    const copie = await recreerReferentielPersonnel({ ...base, modele: "Espece", delegue: t, donnees: { ...especeDuFichier, nomNormalise: "cle forgee" } })
    expect(copie).toMatchObject({ id: "cmdejala", reprise: true })
    // Entrée ancienne du compte, sans clé : reprise par son nom exact.
    const ancienne = table([{ id: "cmancienne", nom: "Tomate de la ferme", nomNormalise: null, userId: "compte-cible" }])
    expect(await recreerReferentielPersonnel({ ...base, modele: "Espece", delegue: ancienne, donnees: { ...especeDuFichier } })).toMatchObject({ id: "cmancienne", reprise: true })
    const sansNom = table()
    expect(await recreerReferentielPersonnel({ ...base, modele: "Variete", delegue: sansNom, donnees: { id: "cmv", nom: null, especeId: null, userId: "compte-source" } })).toBeNull()
    expect(sansNom.create).not.toHaveBeenCalled()
  })

  it("reprend l'itinéraire du compte qui occupe déjà la même période sur l'espèce", async () => {
    const periode = { especeId: "Tomate", semaineSemis: 10, semainePlantation: 18, semaineRecolte: 28, typePlanche: null, sourceRecordId: null }
    const t = table([{ id: "cmitpdeja", nom: "Autre nom", nomNormalise: "autre nom", userId: "compte-cible", ...periode }])
    const copie = await recreerReferentielPersonnel({
      ...base, modele: "ITP", delegue: t,
      donnees: { id: "cmitp", nom: "Tomate de saison", userId: "tiers", partageCommunaute: true, ...periode, typePlanche: undefined },
      relations: [{ fkField: "especeId", targetModel: "Espece", nullable: true }], resoudre: () => "Tomate",
    })
    expect(copie).toMatchObject({ id: "cmitpdeja", reprise: true, reprisePeriode: true })
    expect(t.create).not.toHaveBeenCalled()
  })
})

describe("tri des référentiels utiles au compte", () => {
  const modeles = [
    { name: "Espece", referentiel: true, pkField: "id", relations: [{ fkField: "familleId", targetModel: "Famille", nullable: true }] },
    { name: "Variete", referentiel: true, pkField: "id", relations: [{ fkField: "especeId", targetModel: "Espece", nullable: false }] },
    { name: "Aliment", referentiel: true, pkField: "id", relations: [] },
    { name: "Famille", referentiel: true, pkField: "id", relations: [] },
    { name: "Culture", referentiel: false, pkField: "id", relations: [{ fkField: "varieteId", targetModel: "Variete", nullable: true }, { fkField: "plancheId", targetModel: "Planche", nullable: true }] },
    { name: "PlanRation", referentiel: false, pkField: "id", relations: [] },
  ]

  it("retient ce que les données utilisent, puis ce dont ces entrées dépendent, et rien d'autre", () => {
    const utiles = referentielsUtilises(modeles, {
      Espece: [{ id: "e1", familleId: "f1" }, { id: "e-catalogue", familleId: "f2" }],
      Variete: [{ id: "v1", especeId: "e1" }, { id: "v-catalogue", especeId: "e-catalogue" }],
      Culture: [{ id: 1, varieteId: "v1", plancheId: "p1" }, { id: 2, varieteId: null }],
      PlanRation: [{ id: "r1", composition: [{ alimentId: "a1", quantiteKg: 2 }, null] }],
    })
    expect(Object.fromEntries([...utiles].map(([modele, ids]) => [modele, [...ids]]))).toEqual({
      Variete: ["v1"], Aliment: ["a1"], Espece: ["e1"], Famille: ["f1"],
    })
  })
})

describe("composition d'une ration", () => {
  it("fait suivre les aliments recréés et compte ceux qui restent indisponibles", () => {
    const resultat = remapperCompositionRation(
      [{ alimentId: "ancien", quantiteKg: 2 }, { alimentId: "perdu", quantiteKg: 1 }, "texte"],
      (id) => (id === "ancien" ? "nouveau" : undefined),
    )
    expect(resultat).toEqual({ composition: [{ alimentId: "nouveau", quantiteKg: 2 }, { alimentId: "perdu", quantiteKg: 1 }, "texte"], nonResolus: 1 })
    expect(remapperCompositionRation(null, () => "x")).toEqual({ composition: null, nonResolus: 0 })
  })
})
