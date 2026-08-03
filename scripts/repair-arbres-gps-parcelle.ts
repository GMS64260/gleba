/**
 * Réparation des données d'arbres : coordonnées GPS aberrantes, rattachements de
 * parcelle manquants et libellés non normalisés.
 *
 * Trois défauts constatés en production le 2026-08-03, tous corrigés dans le
 * code mais laissant des données à reprendre :
 *
 *  1. Coordonnées hors bornes antérieures au garde-fou du 2026-07-28 (`4f058c4`).
 *     Une longitude saisie « -0.563888 » a été stockée « -563888 » (point décimal
 *     perdu). Conséquences : la fiche devient insauvegardable, tout PUT renvoyant
 *     la valeur fautive, et le sélecteur carte s'ouvre à des centaines de
 *     kilomètres. On tente une récupération corroborée par les parcelles du
 *     compte ; à défaut, on vide le couple pour que l'arbre reparte dans la file
 *     du relevé GPS en série plutôt que de porter une position inventée.
 *
 *  2. Rattachement parcelle jamais inféré depuis la fiche arbre : l'inférence
 *     était gardée sur l'absence du champ `parcelleGeoId`, or la fiche renvoie
 *     l'objet complet. Des arbres géolocalisés à l'intérieur d'une parcelle
 *     cartographiée restaient « sans parcelle ».
 *
 *  3. Libellés libres non normalisés : deux arbres portaient l'espèce
 *     « Cerisier » avec une espace finale, ce qui créait une seconde espèce dans
 *     tous les regroupements et une ligne fantôme dans le diagramme d'entretien.
 *     La normalisation est désormais faite à l'écriture (`normaliserLibelle`).
 *
 * Usage :
 *   npx tsx scripts/repair-arbres-gps-parcelle.ts [--apply] [--user <id>]
 *
 * Sans `--apply`, le script n'écrit rien et détaille ce qu'il ferait.
 * Idempotent : relançable sans effet supplémentaire.
 */

import prisma from "../src/lib/prisma"
import {
  latitudeValide,
  longitudeValide,
  recupererCoordonneeDecalee,
} from "../src/lib/geolocation"
import {
  distancePointParcelleMetres,
  trouverParcelleGpsProche,
} from "../src/lib/parcelle-gps-utils"
import { normaliserLibelle } from "../src/lib/libelle-libre"

interface ParcelleRef {
  id: string
  nom: string
  geometry: string
  centroidLat: number | null
  centroidLng: number | null
}

/** Référence géographique du compte : centroïdes de parcelles, sinon arbres sains. */
function referenceDuCompte(
  parcelles: ParcelleRef[],
  arbresSains: Array<{ gpsLat: number; gpsLng: number }>
): { lat: number; lng: number } | null {
  const centroides = parcelles.filter(
    (p) => p.centroidLat != null && p.centroidLng != null
  )
  if (centroides.length > 0) {
    return {
      lat: centroides.reduce((s, p) => s + p.centroidLat!, 0) / centroides.length,
      lng: centroides.reduce((s, p) => s + p.centroidLng!, 0) / centroides.length,
    }
  }
  if (arbresSains.length > 0) {
    return {
      lat: arbresSains.reduce((s, a) => s + a.gpsLat, 0) / arbresSains.length,
      lng: arbresSains.reduce((s, a) => s + a.gpsLng, 0) / arbresSains.length,
    }
  }
  return null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const userIndex = process.argv.indexOf("--user")
  const userFiltre = userIndex !== -1 ? process.argv[userIndex + 1] : undefined

  const comptes = await prisma.user.findMany({
    where: userFiltre ? { id: userFiltre } : {},
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
  })

  const stats = {
    coordonneesRecuperees: 0,
    coordonneesVidees: 0,
    rattachements: 0,
    arbresHorsParcelle: 0,
    libellesNormalises: 0,
  }

  // Libellés libres : normalisation sur tous les arbres, indépendamment du GPS.
  const aNormaliser = await prisma.arbre.findMany({
    where: userFiltre ? { userId: userFiltre } : {},
    select: { id: true, nom: true, espece: true, variete: true, portGreffe: true, fournisseur: true },
    orderBy: { id: "asc" },
  })
  for (const arbre of aNormaliser) {
    const champs = { espece: arbre.espece, variete: arbre.variete, portGreffe: arbre.portGreffe, fournisseur: arbre.fournisseur }
    const corrections: Record<string, string | null> = {}
    for (const [cle, valeur] of Object.entries(champs)) {
      if (valeur == null) continue
      const normalise = normaliserLibelle(valeur)
      if (normalise !== valeur) corrections[cle] = normalise ?? null
    }
    if (Object.keys(corrections).length === 0) continue
    const detail = Object.entries(corrections)
      .map(([cle, v]) => `${cle} « ${champs[cle as keyof typeof champs]} » → « ${v ?? ""} »`)
      .join(", ")
    console.log(`  ␣ ${arbre.nom} : ${detail}`)
    stats.libellesNormalises++
    if (apply) {
      await prisma.arbre.update({ where: { id: arbre.id }, data: corrections })
    }
  }

  for (const compte of comptes) {
    const [arbres, parcelles] = await Promise.all([
      prisma.arbre.findMany({
        where: { userId: compte.id, gpsLat: { not: null }, gpsLng: { not: null } },
        select: {
          id: true,
          nom: true,
          gpsLat: true,
          gpsLng: true,
          parcelleGeoId: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.parcelleGeo.findMany({
        where: { userId: compte.id },
        select: {
          id: true,
          nom: true,
          geometry: true,
          centroidLat: true,
          centroidLng: true,
        },
      }),
    ])

    if (arbres.length === 0) continue

    const sains = arbres.filter(
      (a) => latitudeValide(a.gpsLat!) && longitudeValide(a.gpsLng!)
    ) as Array<{ id: number; nom: string; gpsLat: number; gpsLng: number; parcelleGeoId: string | null }>
    const aberrants = arbres.filter(
      (a) => !latitudeValide(a.gpsLat!) || !longitudeValide(a.gpsLng!)
    )

    const reference = referenceDuCompte(parcelles, sains)
    const entete = () => console.log(`\n=== ${compte.email} (${compte.id})`)
    let enteteEcrite = false
    const trace = (message: string) => {
      if (!enteteEcrite) {
        entete()
        enteteEcrite = true
      }
      console.log(message)
    }

    // 1. Coordonnées aberrantes
    for (const arbre of aberrants) {
      const lat = arbre.gpsLat!
      const lng = arbre.gpsLng!
      const latRecuperee = latitudeValide(lat)
        ? lat
        : reference
          ? recupererCoordonneeDecalee({ valeur: lat, reference: reference.lat, max: 90 })
          : null
      const lngRecuperee = longitudeValide(lng)
        ? lng
        : reference
          ? recupererCoordonneeDecalee({ valeur: lng, reference: reference.lng, max: 180 })
          : null

      if (latRecuperee != null && lngRecuperee != null) {
        trace(
          `  ✎ ${arbre.nom} : (${lat}, ${lng}) → (${latRecuperee}, ${lngRecuperee}) — point décimal restitué, corroboré par les parcelles du compte`
        )
        stats.coordonneesRecuperees++
        if (apply) {
          await prisma.arbre.update({
            where: { id: arbre.id },
            data: { gpsLat: latRecuperee, gpsLng: lngRecuperee },
          })
        }
        sains.push({
          id: arbre.id,
          nom: arbre.nom,
          gpsLat: latRecuperee,
          gpsLng: lngRecuperee,
          parcelleGeoId: arbre.parcelleGeoId,
        })
      } else {
        trace(
          `  ✗ ${arbre.nom} : (${lat}, ${lng}) irrécupérable — coordonnées vidées, l'arbre repart dans le relevé GPS en série`
        )
        stats.coordonneesVidees++
        if (apply) {
          await prisma.arbre.update({
            where: { id: arbre.id },
            data: { gpsLat: null, gpsLng: null },
          })
        }
      }
    }

    // 2. Rattachement des arbres géolocalisés sans parcelle
    if (parcelles.length === 0) continue
    for (const arbre of sains) {
      if (arbre.parcelleGeoId) continue
      const parcelle = trouverParcelleGpsProche(parcelles, arbre.gpsLat, arbre.gpsLng)
      if (!parcelle) {
        stats.arbresHorsParcelle++
        continue
      }
      const distance = distancePointParcelleMetres({
        lat: arbre.gpsLat,
        lng: arbre.gpsLng,
        geometryGeoJson: parcelle.geometry,
      })
      trace(
        `  → ${arbre.nom} rattaché à « ${parcelle.nom} » (${distance === 0 ? "à l'intérieur" : `${Math.round(distance ?? 0)} m`})`
      )
      stats.rattachements++
      if (apply) {
        await prisma.arbre.update({
          where: { id: arbre.id },
          data: { parcelleGeoId: parcelle.id },
        })
      }
    }
  }

  console.log("")
  console.log(`Libellés normalisés         : ${stats.libellesNormalises}`)
  console.log(`Coordonnées restituées      : ${stats.coordonneesRecuperees}`)
  console.log(`Coordonnées vidées          : ${stats.coordonneesVidees}`)
  console.log(`Arbres rattachés            : ${stats.rattachements}`)
  console.log(`Géolocalisés hors parcelle  : ${stats.arbresHorsParcelle} (aucune parcelle à moins de 25 m)`)
  console.log("")
  console.log(
    apply
      ? "✓ Écritures appliquées."
      : "Simulation seule — relancer avec --apply pour écrire."
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
