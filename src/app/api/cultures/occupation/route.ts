/**
 * Aperçu de l'occupation d'une planche avant de créer une culture.
 *
 * GET /api/cultures/occupation?plancheId=…&itpId=…&nbRangs=3&longueur=24
 *     &dateSemis=AAAA-MM-JJ&datePlantation=…&dateRecolte=…&finRecolte=…
 *   → VerdictOccupation (src/lib/planche-validation.ts)
 *
 * QA cmv2r1v63 (2026-10-10) — l'assistant de création calculait l'occupation de
 * son côté, avec d'autres règles que la création (POST /api/cultures) : son
 * verdict et ses suggestions pouvaient contredire le refus du serveur. Cet
 * aperçu lit les mêmes colonnes et appelle la même règle ; il n'écrit rien.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuthApi } from '@/lib/auth-utils'
import { evaluerOccupationPlanche } from '@/lib/planche-validation'
import { selectCulturesOccupation } from '@/lib/planches/occupation'
import { finDeCycle, finRecolteDepuisItp } from '@/lib/cultures/fenetre-recolte'
import { whereItpUtilisable } from '@/lib/itp-acces'
import { appliquerDecalageItp, decalageItpPourLecteur } from '@/lib/calendrier-climat'
import { zoneEffectiveUser } from '@/lib/terroir'
import { dateJourSeul } from '@/lib/jour-civil'

function lireDate(valeur: string | null): Date | null {
  if (!valeur) return null
  const date = new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

function lireNombre(valeur: string | null): number | null {
  if (valeur == null || valeur.trim() === '') return null
  const nombre = Number(valeur)
  return Number.isFinite(nombre) ? nombre : null
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const userId = session!.user.id

  const { searchParams } = new URL(request.url)
  const plancheId = searchParams.get('plancheId')
  if (!plancheId) {
    return NextResponse.json({ error: 'plancheId requis' }, { status: 400 })
  }

  try {
    // Planche lue par son identifiant, dans le compte (jamais par son nom).
    const planche = await prisma.planche.findFirst({
      where: { id: plancheId, userId },
      select: {
        largeur: true,
        longueur: true,
        cultures: { where: { terminee: null }, select: selectCulturesOccupation },
      },
    })
    if (!planche) {
      return NextResponse.json({ error: 'Planche introuvable' }, { status: 404 })
    }

    const itpId = searchParams.get('itpId')
    const itp = itpId
      ? await prisma.iTP.findFirst({
          where: { AND: [{ id: itpId }, whereItpUtilisable(userId)] },
          select: {
            userId: true,
            zoneClimat: true,
            semaineSemis: true,
            semainePlantation: true,
            semaineRecolte: true,
            semaineRecolteFin: true,
            dureeRecolte: true,
            espacementRangs: true,
          },
        })
      : null

    // Mêmes jours que ceux que la création enregistrera : chaque date ramenée
    // au jour seul, minuit UTC (`dateJourSeul`, ticket cmvnulry1).
    const dateSemis = dateJourSeul(lireDate(searchParams.get('dateSemis')))
    const datePlantation = dateJourSeul(lireDate(searchParams.get('datePlantation')))
    const dateRecolte = dateJourSeul(lireDate(searchParams.get('dateRecolte')))
    // Même dérivation que la création : sans fin de fenêtre fournie, elle se
    // déduit de l'itinéraire, dans le référentiel de semaines de l'exploitation.
    let finRecolte = dateJourSeul(lireDate(searchParams.get('finRecolte')))
    if (!finRecolte && itp) {
      const itpCalibre = appliquerDecalageItp(
        itp,
        decalageItpPourLecteur(itp, await zoneEffectiveUser(prisma, userId), userId)
      )
      finRecolte = dateJourSeul(finRecolteDepuisItp(dateRecolte, itpCalibre))
    }

    const verdict = evaluerOccupationPlanche({
      planche: { largeur: planche.largeur, longueur: planche.longueur },
      culturesEnPlace: planche.cultures,
      espacementRangs: itp?.espacementRangs ?? null,
      nbRangs: lireNombre(searchParams.get('nbRangs')),
      longueur: lireNombre(searchParams.get('longueur')),
      debut: dateSemis ?? datePlantation,
      fin: finDeCycle({ dateRecolte, finRecolte }),
    })
    return NextResponse.json(verdict)
  } catch (err) {
    console.error('GET /api/cultures/occupation error:', err)
    return NextResponse.json({ error: "Vérification de l'occupation impossible" }, { status: 500 })
  }
}
