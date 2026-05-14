/**
 * Recherche globale Cmd+K (PROMPT 20c §4).
 *
 * GET /api/search?q=carot
 *
 * Sources : Cultures, Variétés (catalogue partagé), Arbres, Animaux,
 * Lots, Clients, Factures, Produits boutique, Parcelles, Soins, Récoltes.
 *
 * Format réponse : { items: SearchItem[] } où SearchItem = {
 *   id, label, sub, type, href
 * }
 *
 * Limite : 8 résultats par catégorie, max 60 au total. La pagination
 * n'est pas exposée — l'utilisateur affine sa requête s'il veut plus.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const TAKE = 8

export interface SearchItem {
  id: string
  label: string
  sub?: string | null
  type: string
  href: string
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  if (q.length < 2) return NextResponse.json({ items: [] })

  const userId = session.user.id
  const like = { contains: q, mode: 'insensitive' as const }

  const [cultures, varietes, arbres, animaux, lots, clients, factures, parcelles, soins, recoltes, produitsBout] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, OR: [{ varieteId: like }, { especeId: like }] },
      take: TAKE,
      orderBy: { id: 'desc' },
      select: { id: true, especeId: true, varieteId: true, plancheId: true, annee: true },
    }),
    prisma.variete.findMany({
      where: { OR: [{ id: like }, { nomNormalise: like }] },
      take: TAKE,
      orderBy: { id: 'asc' },
      select: { id: true, nomNormalise: true, especeId: true },
    }),
    prisma.arbre.findMany({
      where: { userId, OR: [{ nom: like }, { espece: like }, { variete: like }] },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, espece: true, variete: true },
    }),
    prisma.animal.findMany({
      where: { userId, OR: [{ nom: like }, { identifiant: like }, { race: like }] },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, identifiant: true, race: true, especeAnimale: { select: { nom: true } } },
    }),
    prisma.lotAnimaux.findMany({
      where: { userId, nom: like },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, especeAnimale: { select: { nom: true } } },
    }),
    prisma.client.findMany({
      where: { userId, OR: [{ nom: like }, { email: like }, { siret: like }] },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, email: true, ville: true },
    }),
    prisma.facture.findMany({
      where: { userId, OR: [{ numero: like }, { clientNom: like }, { objet: like }] },
      take: TAKE,
      orderBy: { date: 'desc' },
      select: { id: true, numero: true, clientNom: true, totalTTC: true, statut: true },
    }),
    prisma.parcelleGeo.findMany({
      where: { userId, nom: like },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, surface: true },
    }),
    prisma.soinAnimal.findMany({
      where: { userId, OR: [{ type: like }, { produit: like }, { description: like }] },
      take: TAKE,
      orderBy: { date: 'desc' },
      select: { id: true, type: true, produit: true, date: true, animal: { select: { nom: true } }, lot: { select: { nom: true } } },
    }),
    prisma.recolte.findMany({
      where: { userId, OR: [{ especeId: like }, { notes: like }] },
      take: TAKE,
      orderBy: { date: 'desc' },
      select: { id: true, especeId: true, notes: true, quantite: true, date: true },
    }),
    prisma.produitBoutique.findMany({
      where: { userId, nom: like },
      take: TAKE,
      orderBy: { nom: 'asc' },
      select: { id: true, nom: true, prix: true },
    }),
  ])

  const items: SearchItem[] = [
    ...cultures.map((c): SearchItem => ({
      id: `culture-${c.id}`,
      label: `${c.especeId || '?'}${c.varieteId ? ` — ${c.varieteId}` : ''}`,
      sub: `Culture ${c.annee} · planche ${c.plancheId || '—'}`,
      type: 'Culture',
      href: `/cultures/${c.id}`,
    })),
    ...varietes.map((v): SearchItem => ({
      id: `variete-${v.id}`,
      label: v.id,
      sub: `Variété (${v.especeId || '?'})`,
      type: 'Variété',
      href: `/cultures?variete=${encodeURIComponent(v.id)}`,
    })),
    ...arbres.map((a): SearchItem => ({
      id: `arbre-${a.id}`,
      label: a.nom || `Arbre #${a.id}`,
      sub: `${a.espece || ''}${a.variete ? ` — ${a.variete}` : ''}`.trim() || null,
      type: 'Arbre',
      href: `/arbres/${a.id}`,
    })),
    ...animaux.map((an): SearchItem => ({
      id: `animal-${an.id}`,
      label: an.nom || an.identifiant || `Animal #${an.id}`,
      sub: `${an.especeAnimale?.nom || ''}${an.race ? ` · ${an.race}` : ''}`.trim() || null,
      type: 'Animal',
      href: `/elevage/animaux/${an.id}`,
    })),
    ...lots.map((l): SearchItem => ({
      id: `lot-${l.id}`,
      label: l.nom || `Lot #${l.id}`,
      sub: l.especeAnimale?.nom || null,
      type: 'Lot',
      href: `/elevage?tab=animaux`,
    })),
    ...clients.map((c): SearchItem => ({
      id: `client-${c.id}`,
      label: c.nom,
      sub: c.email || c.ville || null,
      type: 'Client',
      href: `/comptabilite/clients`,
    })),
    ...factures.map((f): SearchItem => ({
      id: `facture-${f.id}`,
      label: f.numero,
      sub: `${f.clientNom || ''} · ${f.totalTTC.toFixed(2)} €${f.statut ? ` · ${f.statut}` : ''}`,
      type: 'Facture',
      href: `/comptabilite/factures`,
    })),
    ...parcelles.map((p): SearchItem => ({
      id: `parcelle-${p.id}`,
      label: p.nom || `Parcelle ${p.id}`,
      sub: p.surface ? `${p.surface} m²` : null,
      type: 'Parcelle',
      href: `/parcelles`,
    })),
    ...soins.map((s): SearchItem => ({
      id: `soin-${s.id}`,
      label: `${s.type}${s.produit ? ` — ${s.produit}` : ''}`,
      sub: `${s.animal?.nom || s.lot?.nom || ''} · ${new Date(s.date).toLocaleDateString('fr-FR')}`,
      type: 'Soin',
      href: `/elevage?tab=alimentation`,
    })),
    ...recoltes.map((r): SearchItem => ({
      id: `recolte-${r.id}`,
      label: `${r.especeId || ''} · ${r.quantite} kg`,
      sub: `${r.notes || ''} · ${new Date(r.date).toLocaleDateString('fr-FR')}`.trim(),
      type: 'Récolte',
      href: `/recoltes`,
    })),
    ...produitsBout.map((p): SearchItem => ({
      id: `produit-bout-${p.id}`,
      label: p.nom,
      sub: `Boutique · ${p.prix.toFixed(2)} €`,
      type: 'Produit boutique',
      href: `/boutique`,
    })),
  ]

  return NextResponse.json({ items })
}
