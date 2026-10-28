/**
 * PATCH  /api/capteurs/[id] — nom, rattachement (une cible du compte, par id),
 *        profil de décodage (par id, liste fermée) et correspondances des clés
 *        reçues vers les grandeurs Gleba (ajout, « ignorer », ou retrait pour
 *        revenir à la règle automatique).
 * DELETE /api/capteurs/[id] — supprime le capteur et ses mesures. S'il émet
 *        encore, il revient « à rattacher » à sa prochaine trame.
 * Ouverts aux membres qui peuvent écrire (la lecture seule est arrêtée par
 * `requireAuthApi`).
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getUserId, requireAuthApi } from "@/lib/auth-utils"
import { GRANDEURS_IDS } from "@/lib/capteurs/grandeurs"
import { aProfil, CLES_MAX, LONGUEUR_CLE_MAX, lireCorrespondances, regleDe, type Correspondances } from "@/lib/capteurs/decodage"
import { cibleAppartient, colonnesRattachement, schemaCible } from "@/lib/capteurs/rattachement"

type Contexte = { params: Promise<{ id: string }> }

const cle = z.string().min(1).max(LONGUEUR_CLE_MAX)

const schema = z.object({
  nom: z.string().trim().max(80).nullable().optional(),
  cible: schemaCible.nullable().optional(),
  modele: z.string().refine(aProfil, "Profil de décodage inconnu").nullable().optional(),
  // Clé reçue → grandeur, ou null pour l'ignorer.
  correspondances: z.record(cle, z.enum(GRANDEURS_IDS as [string, ...string[]]).nullable()).optional(),
  // Clés rendues à la règle automatique (profil, dictionnaire).
  retirerCorrespondances: z.array(cle).max(CLES_MAX).optional(),
})

async function capteurDuCompte(request: Request, contexte: Contexte) {
  const { error, session } = await requireAuthApi(request)
  if (error) return { ok: false as const, refus: error }
  const userId = getUserId(session)
  const { id } = await contexte.params
  const capteur = await prisma.capteur.findFirst({
    where: { id, userId },
    select: { id: true },
  })
  if (!capteur) return { ok: false as const, refus: NextResponse.json({ error: "Capteur introuvable" }, { status: 404 }) }
  return { ok: true as const, userId, capteur }
}

export async function PATCH(request: Request, contexte: Contexte) {
  const g = await capteurDuCompte(request, contexte)
  if (!g.ok) return g.refus

  const lu = schema.safeParse(await request.json().catch(() => null))
  if (!lu.success) {
    return NextResponse.json({ error: lu.error.issues.map((i) => i.message).join(", ") }, { status: 400 })
  }
  const { nom, cible, modele, correspondances, retirerCorrespondances } = lu.data

  if (cible && !(await cibleAppartient(g.userId, cible))) {
    return NextResponse.json({ error: "Cible introuvable dans cette exploitation" }, { status: 404 })
  }

  return prisma.$transaction(async (tx) => {
    // La lecture utilisée pour la fusion doit suivre le verrou. Deux PATCH
    // concurrents voient ainsi chacun les choix validés par le précédent.
    await tx.$queryRaw`
      SELECT "id" FROM "capteurs"
      WHERE "id" = ${g.capteur.id} AND "user_id" = ${g.userId}
      FOR UPDATE
    `
    const actuel = await tx.capteur.findFirst({
      where: { id: g.capteur.id, userId: g.userId },
      select: {
        id: true, modele: true, correspondances: true, clesRecues: true, clesInconnues: true,
        connecteur: { select: { type: true } },
      },
    })
    if (!actuel) return NextResponse.json({ error: "Capteur introuvable" }, { status: 404 })

    const data: Prisma.CapteurUncheckedUpdateInput = {}
    if (nom !== undefined) data.nom = nom || null
    if (cible !== undefined) Object.assign(data, colonnesRattachement(cible))
    if (modele !== undefined) data.modele = modele
    if (modele !== undefined || correspondances !== undefined || retirerCorrespondances !== undefined) {
      // Fusion : une clé envoyée remplace la précédente, une clé retirée revient
      // à la règle automatique. Les inconnues sont recalculées sur toutes les
      // clés reçues, avec le profil et les correspondances qui en résultent.
      // Valeurs déjà validées par zod contre GRANDEURS_IDS.
      const fusion: Correspondances = { ...lireCorrespondances(actuel.correspondances), ...((correspondances ?? {}) as Correspondances) }
      for (const c of retirerCorrespondances ?? []) delete fusion[c]
      // Le JSON est relu à chaque trame : il ne grossit pas sans fin d'un PATCH à l'autre.
      if (Object.keys(fusion).length > 2 * CLES_MAX) {
        return NextResponse.json({ error: `${2 * CLES_MAX} correspondances au plus par capteur` }, { status: 400 })
      }
      const nomsGleba = actuel.connecteur.type === "generique"
      const profil = modele !== undefined ? modele : actuel.modele
      data.correspondances = fusion as Prisma.InputJsonValue
      data.clesInconnues = [...new Set([...actuel.clesRecues, ...actuel.clesInconnues])].filter(
        (c) => regleDe(c, profil, fusion, nomsGleba) === undefined,
      )
    }

    const capteur = await tx.capteur.update({
      where: { id: g.capteur.id },
      data,
      select: { id: true, nom: true, modele: true, correspondances: true, clesInconnues: true },
    })
    return NextResponse.json({ capteur })
  })
}

export async function DELETE(request: Request, contexte: Contexte) {
  const g = await capteurDuCompte(request, contexte)
  if (!g.ok) return g.refus
  await prisma.capteur.delete({ where: { id: g.capteur.id } })
  return NextResponse.json({ ok: true })
}
