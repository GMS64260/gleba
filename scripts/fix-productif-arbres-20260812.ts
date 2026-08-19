/**
 * Correction en base du statut « Productif » posé à l'aveugle.
 *
 * Friction du 2026-08-12 : `productif` est `@default(true)` en base et seule la
 * route `POST /api/arbres` en dérivait la valeur — encore retombait-elle sur
 * `true` dès que l'espèce était hors barème. Les arbres écrits par les autres
 * chemins (données d'exemple de l'inscription, outil `create_arbre` de
 * l'assistant, import du jeu de démonstration) ont donc hérité de `true` sans
 * que personne ne l'ait jamais choisi.
 *
 * Ce script n'inverse QUE `true → false`, et seulement là où le statut ne peut
 * pas être la décision d'un utilisateur :
 *
 *   - type `fruitier` ou `petit_fruit` — les deux seuls types où `productif` a
 *     un sens métier (KPI « fruitiers productifs », cf. /api/arbres/stats) ;
 *   - date de plantation renseignée — sans elle aucun âge n'est calculable et
 *     on ne présume rien ;
 *   - `productifParDefaut()` (la fonction utilisée par l'application) répond
 *     `false` — barème d'entrée en production de l'espèce, ou plancher d'un an ;
 *   - ET la ligne n'a jamais été modifiée depuis sa création.
 *
 * Le dernier critère est le garde-fou, et il est solide : AUCUN formulaire de
 * création n'envoie `productif` (ni le plan du jardin, ni l'onglet Arbres du
 * verger, ni l'outil de l'assistant). Le statut ne se choisit que sur la fiche
 * de l'arbre, donc par un PUT postérieur. Une ligne dont `updatedAt` est resté
 * égal à `createdAt` n'a jamais été touchée par personne : son `true` ne peut
 * être qu'un défaut hérité.
 *
 * À l'inverse, toute ligne modifiée depuis est laissée en l'état, même si la
 * modification portait sur autre chose (déplacement dans le plan 2D, relevé
 * GPS, rattachement de parcelle). La fiche verger affiche depuis longtemps un
 * avertissement « statut Productif prématuré » sur exactement ces arbres : un
 * utilisateur qui l'a lu et a maintenu son choix ne doit pas être écrasé.
 *
 * Usage :
 *   npx tsx scripts/fix-productif-arbres-20260812.ts            (simulation)
 *   npx tsx scripts/fix-productif-arbres-20260812.ts --apply    (écriture)
 */

import { PrismaClient } from "@prisma/client"
import { productifParDefaut } from "../src/lib/tree-care-calendar"

const prisma = new PrismaClient()
const APPLY = process.argv.includes("--apply")

/** Les deux arbres posés par `createSampleDataForUser` à chaque inscription. */
const SIGNATURES_EXEMPLE = [
  { nom: "Pommier Golden", espece: "Pommier", variete: "Golden Delicious" },
  { nom: "Cerisier Burlat", espece: "Cerisier", variete: "Burlat" },
]

/** Marge pour l'écart create/update d'une même transaction Prisma. */
const TOLERANCE_MS = 1000

type ArbreCandidat = {
  id: number
  userId: string
  nom: string
  type: string
  espece: string | null
  variete: string | null
  datePlantation: Date | null
  createdAt: Date
  updatedAt: Date
}

/** La ligne n'a jamais été modifiée : son `productif` est un défaut hérité. */
function jamaisModifie(arbre: ArbreCandidat): boolean {
  return arbre.updatedAt.getTime() - arbre.createdAt.getTime() <= TOLERANCE_MS
}

function origine(arbre: ArbreCandidat): string {
  const exemple = SIGNATURES_EXEMPLE.some(
    (s) => s.nom === arbre.nom && s.espece === arbre.espece && s.variete === arbre.variete,
  )
  return exemple ? "données d'exemple de l'inscription" : "jamais modifié depuis la création"
}

async function main() {
  const arbres = await prisma.arbre.findMany({
    where: {
      productif: true,
      type: { in: ["fruitier", "petit_fruit"] },
      datePlantation: { not: null },
      dateSuppression: null,
    },
    select: {
      id: true, userId: true, nom: true, type: true, espece: true,
      variete: true, datePlantation: true, createdAt: true, updatedAt: true,
    },
    orderBy: { id: "asc" },
  })

  const aCorriger: Array<{ arbre: ArbreCandidat; motif: string }> = []
  const ecartesCarChoixPossible: ArbreCandidat[] = []

  for (const arbre of arbres) {
    if (productifParDefaut(arbre.espece, arbre.datePlantation)) continue
    if (jamaisModifie(arbre)) aCorriger.push({ arbre, motif: origine(arbre) })
    else ecartesCarChoixPossible.push(arbre)
  }

  const emails = new Map<string, string>()
  for (const u of await prisma.user.findMany({ select: { id: true, email: true } })) {
    emails.set(u.id, u.email)
  }

  console.log(`Arbres fruitiers/petits fruits marqués productifs, avec date : ${arbres.length}`)
  console.log(`Dont trop jeunes selon productifParDefaut() : ${aCorriger.length + ecartesCarChoixPossible.length}`)
  console.log(`\n== À corriger (${aCorriger.length}) ==`)
  for (const { arbre, motif } of aCorriger) {
    const age = arbre.datePlantation
      ? ((Date.now() - arbre.datePlantation.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
      : "?"
    console.log(
      `  #${arbre.id} ${emails.get(arbre.userId) ?? arbre.userId} — ${arbre.nom} ` +
      `(${arbre.espece || "sans espèce"}, planté il y a ${age} an(s)) → ${motif}`,
    )
  }

  console.log(`\n== Laissés en l'état (${ecartesCarChoixPossible.length}) : le statut a pu être choisi ==`)
  for (const arbre of ecartesCarChoixPossible) {
    const age = arbre.datePlantation
      ? ((Date.now() - arbre.datePlantation.getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
      : "?"
    console.log(
      `  #${arbre.id} ${emails.get(arbre.userId) ?? arbre.userId} — ${arbre.nom} ` +
      `(${arbre.espece || "sans espèce"}, planté il y a ${age} an(s))`,
    )
  }

  if (!APPLY) {
    console.log("\nSimulation : aucune écriture. Relancer avec --apply pour corriger.")
    return
  }

  if (aCorriger.length === 0) {
    console.log("\nRien à corriger.")
    return
  }

  const res = await prisma.arbre.updateMany({
    where: { id: { in: aCorriger.map(({ arbre }) => arbre.id) } },
    data: { productif: false },
  })
  console.log(`\n${res.count} arbre(s) repassés à « Productif : Non ».`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
