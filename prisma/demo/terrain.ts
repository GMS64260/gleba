/**
 * Terrain : parcelles géoréférencées, planches, objets du plan.
 *
 * Repère du plan (identique en 2D, en 3D et sur la vignette de l'accueil) :
 * mètres, x vers l'est, y vers le sud, origine au coin nord-ouest de la
 * ferme. Une planche ou un objet est posé par son coin haut-gauche, sa
 * `largeur` sur x, sa `longueur` sur y ; un arbre par le centre de son tronc.
 * Les polygones des parcelles reprennent le même repère converti en
 * longitude/latitude : la carte et le plan racontent la même ferme.
 *
 * Contraintes de l'API respectées (validations/planche.ts) : posX/posY dans
 * [−100 ; 100], largeur ≤ 10, longueur ≤ 100. Aucune rotation : les cadrages
 * du plan l'ignorent.
 */

import { IDENTITE, journal, prisma, Y, type Contexte } from "./contexte"

// ─── Géoréférencement ───────────────────────────────────────────────────────
const LAT0 = 46.9302
const LNG0 = -1.211
const M_LAT = 111_319.49
const M_LNG = M_LAT * Math.cos((LAT0 * Math.PI) / 180)
const ll = (x: number, y: number) => [LNG0 + x / M_LNG, LAT0 - y / M_LAT]

function geoRect([x0, y0, x1, y1]: readonly number[]) {
  const anneau = [[x0, y1], [x1, y1], [x1, y0], [x0, y0], [x0, y1]].map(([x, y]) => ll(x, y))
  const [lng, lat] = ll((x0 + x1) / 2, (y0 + y1) / 2)
  return {
    geometry: JSON.stringify({ type: "Polygon", coordinates: [anneau] }),
    centroidLat: lat,
    centroidLng: lng,
    surface: Math.round(((x1 - x0) * (y1 - y0)) / 10) / 1000,
  }
}

type Couche = "MARAICHAGE" | "VERGER" | "PATURAGE" | "ELEVAGE"

/** Parcelles : rectangle [x0, y0, x1, y1] en mètres dans le repère du plan. */
export const PARCELLES: Array<{ cle: string; nom: string; rect: readonly number[]; couches: Couche[]; usage: string; typeSol: string; couleur: string; notes: string }> = [
  { cle: "V", nom: "Verger", rect: [1.5, 1.5, 29.5, 30], couches: ["VERGER"], usage: "verger", typeSol: "limono-argileux", couleur: "#65a30d", notes: "Verger haute tige et demi-tige planté entre 2018 et 2022, enherbé, rucher en bordure est." },
  { cle: "A", nom: "Serre", rect: [31.5, 1.5, 45.5, 15.5], couches: ["MARAICHAGE"], usage: "culture", typeSol: "limono-sableux", couleur: "#10b981", notes: "Serre froide de 96 m², goutte-à-goutte. Plants et légumes d'été." },
  { cle: "C", nom: "Tunnel", rect: [31.5, 15.5, 45.5, 43.5], couches: ["MARAICHAGE"], usage: "culture", typeSol: "limono-sableux", couleur: "#22c55e", notes: "Tunnel de 8 × 25 m, quatre planches permanentes, aire de compostage au sud." },
  { cle: "B", nom: "Plein champ", rect: [45.5, 1.5, 85.5, 43.5], couches: ["MARAICHAGE"], usage: "culture", typeSol: "limono-argileux", couleur: "#16a34a", notes: "Seize planches permanentes de 40 m : onze en rotation (4 ans, 3 ans courges, potager), cinq pour les alliacées, choux d'hiver et pommes de terre. Engrais verts l'hiver." },
  { cle: "P", nom: "Pâture du Grand Pré", rect: [87, 1.5, 160, 48], couches: ["PATURAGE", "ELEVAGE"], usage: "prairie", typeSol: "limono-argileux", couleur: "#a3a300", notes: "Pâturage tournant des chèvres et des brebis en paddocks de 0,1 ha, chèvrerie et poulailler." },
  { cle: "F", nom: "Prairie de fauche", rect: [1.5, 58, 160, 115], couches: ["PATURAGE"], usage: "prairie", typeSol: "limoneux", couleur: "#84cc16", notes: "Prairie naturelle fauchée en juin (foin autoproduit), pâturée en regain à l'automne." },
]

/** Planches : [nom, posX, posY, largeur, longueur, parcelle, type, irrigation]. */
export const PLANCHES: Array<[string, number, number, number, number, string, string, string]> = [
  ["A1", 33.8, 3.5, 1.2, 10, "A", "Serre", "Goutte-à-goutte"],
  ["A2", 36.4, 3.5, 1.2, 10, "A", "Serre", "Goutte-à-goutte"],
  ["A3", 39.0, 3.5, 1.2, 10, "A", "Serre", "Goutte-à-goutte"],
  ["C1", 33.4, 18, 1.2, 23, "C", "Tunnel", "Goutte-à-goutte"],
  ["C2", 35.3, 18, 1.2, 23, "C", "Tunnel", "Goutte-à-goutte"],
  ["C3", 37.2, 18, 1.2, 23, "C", "Tunnel", "Goutte-à-goutte"],
  ["C4", 39.1, 18, 1.2, 23, "C", "Tunnel", "Goutte-à-goutte"],
  ...Array.from({ length: 16 }, (_, i): [string, number, number, number, number, string, string, string] => [
    `B${i + 1}`, Math.round((46.6 + i * 2.4) * 10) / 10, 3, 1.2, 40, "B", "Plein champ", i < 11 ? "Goutte-à-goutte" : "Aspersion",
  ]),
]

/**
 * Rotations du référentiel commun affectées aux planches de plein champ :
 * [rotation, étape de l'année en cours]. L'app calcule l'étape d'une année
 * par ((année − Planche.annee) mod n) + 1 : poser `annee` = Y − (étape − 1) à
 * chaque reseed garde la même planche à la même étape pour l'année en cours,
 * et le maraîchage y cultive l'itinéraire de l'étape (plan « prêt »).
 */
export const ROTATIONS_PLANCHES: Record<string, [string, number]> = {
  B1: ["Rotation-4ans-A", 1], B2: ["Rotation-4ans-A", 2], B3: ["Rotation-4ans-A", 3], B4: ["Rotation-4ans-A", 4],
  B5: ["Rotation-3ans-Courges", 1], B6: ["Rotation-3ans-Courges", 2], B7: ["Rotation-3ans-Courges", 3],
  B8: ["Potager", 1], B9: ["Potager", 2], B10: ["Potager", 3], B11: ["Potager", 4],
}

/** Objets du plan : [nom, type, posX, posY, largeur, longueur, parcelle, couleur]. */
const OBJETS: Array<[string | null, string, number, number, number, number, string | null, string | null]> = [
  [null, "haie", 0, 0, 86, 1.5, null, null],
  [null, "haie", 0, 1.5, 1.5, 55, null, null],
  [null, "allee", 29.5, 1.5, 2, 42.5, null, null],
  ["Chemin d'exploitation", "allee", 1.5, 44, 84, 2.5, null, null],
  [null, "serre", 33, 2.5, 8, 12, "A", null],
  ["Récupérateur 1 000 L", "eau", 42.2, 3, 1.2, 1.2, "A", null],
  [null, "tunnel", 33, 17, 8, 25, "C", null],
  ["Compost", "compost", 42.3, 37.5, 1.2, 1.2, "C", null],
  [null, "compost", 42.3, 39.2, 1.2, 1.2, "C", null],
  [null, "compost", 42.3, 40.9, 1.2, 1.2, "C", null],
  ["Mare", "eau", 8, 34, 9, 6, null, null],
  ["Hangar et chambre froide", "batiment", 33, 47.5, 16, 8, null, null],
  [null, "cloture", 86.5, 1.5, 0.1, 46.5, "P", null],
  ["Chèvrerie", "batiment", 90, 22, 8, 12, "P", null],
  ["Poulailler", "batiment", 90, 38, 3, 2.5, "P", "#a16207"],
  ["Rucher", "autre", 25.6, 19.5, 0.5, 0.5, "V", "#f59e0b"],
  ...[26.4, 27.2, 28.0].map((x): [string | null, string, number, number, number, number, string | null, string | null] => [null, "autre", x, 19.5, 0.5, 0.5, "V", "#f59e0b"]),
  ...[25.6, 26.4].map((x): [string | null, string, number, number, number, number, string | null, string | null] => [null, "autre", x, 20.5, 0.5, 0.5, "V", "#f59e0b"]),
]

/** Analyse de sol de référence par parcelle (reprise sur les planches). */
const SOLS: Record<string, { typeSol: string; argile: number; limon: number; sable: number; phSol: number; carboneOrg: number; retentionEau: string }> = {
  A: { typeSol: "limono-sableux", argile: 14, limon: 41, sable: 45, phSol: 6.8, carboneOrg: 2.9, retentionEau: "moyenne" },
  C: { typeSol: "limono-sableux", argile: 15, limon: 42, sable: 43, phSol: 6.7, carboneOrg: 2.6, retentionEau: "moyenne" },
  B: { typeSol: "limono-argileux", argile: 24, limon: 46, sable: 30, phSol: 6.4, carboneOrg: 2.1, retentionEau: "bonne" },
}

export async function seedTerrain(ctx: Contexte) {
  const { userId } = ctx
  for (const p of PARCELLES) {
    const g = geoRect(p.rect)
    const row = await prisma.parcelleGeo.create({
      data: {
        userId, nom: p.nom, ...g, couches: p.couches, usage: p.usage, typeSol: p.typeSol,
        couleur: p.couleur, notes: p.notes, commune: IDENTITE.ville, statutBio: "AB", certificateur: IDENTITE.certificateur,
        ...(p.cle === "P" ? { eauDisponible: true, etatCloture: "bon", disponibiliteFourragereKgMsHa: 1800 } : {}),
        ...(p.cle === "F" ? { eauDisponible: false, etatCloture: "bon", disponibiliteFourragereKgMsHa: 900 } : {}),
      },
    })
    ctx.parcelles[p.cle] = row.id
  }

  const rotationsExistantes = new Set((await prisma.rotation.findMany({ select: { id: true } })).map((r) => r.id))
  for (const [nom, posX, posY, largeur, longueur, parcelle, type, irrigation] of PLANCHES) {
    const sol = SOLS[parcelle]
    const rotation = ROTATIONS_PLANCHES[nom]
    const enRotation = rotation && rotationsExistantes.has(rotation[0])
    const row = await prisma.planche.create({
      data: {
        userId, nom, posX, posY, largeur, longueur, surface: Math.round(largeur * longueur * 10) / 10,
        rotation2D: 0, ilot: parcelle, type, irrigation, parcelleGeoId: ctx.parcelles[parcelle],
        rotationId: enRotation ? rotation[0] : null,
        annee: enRotation ? Y - (rotation[1] - 1) : null,
        typeSol: sol.typeSol, argile: sol.argile, limon: sol.limon, sable: sol.sable, phSol: sol.phSol,
        carboneOrg: sol.carboneOrg, retentionEau: sol.retentionEau,
        statutBio: "AB", certificateur: IDENTITE.certificateur, nCertificat: "FR-BIO-01-85-0412",
      },
    })
    ctx.planches[nom] = row.id
  }

  for (const [nom, type, posX, posY, largeur, longueur, parcelle, couleur] of OBJETS) {
    await prisma.objetJardin.create({
      data: { userId, nom, type, posX, posY, largeur, longueur, rotation2D: 0, parcelleGeoId: parcelle ? ctx.parcelles[parcelle] : null, couleur },
    })
  }
  journal(`Terrain : ${PARCELLES.length} parcelles, ${PLANCHES.length} planches, ${OBJETS.length} objets`)
}
