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

import { contientLitteral } from '@/lib/recherche/like'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'
import { chargerAccesService } from '@/lib/abonnement/serveur'
import { operationPermise } from '@/lib/abonnement/requetes'
import { cheminOuvert } from '@/lib/exploitation/modules-chemins'
import { estVisibleReferentiel, visibiliteReferentiel, type EntreeReferentiel } from '@/lib/referentiel-communaute'
import { normalizeReferentielKey } from '@/lib/normalize'
import { formatSurface } from '@/components/parcelles/parcelle-constants'
import { formatQuantite } from '@/lib/recolte/quantites'
import { UNITES_QUANTITE, type UniteQuantite } from '@/lib/recolte/projection'

const TAKE = 8
const SELECT_NOM_VISIBLE = { nom: true, userId: true, partageCommunaute: true } as const

function nomVisible(entree: (EntreeReferentiel & { nom: string | null; espece?: EntreeReferentiel }) | null, userId: string) {
  if (!entree || !estVisibleReferentiel(entree, userId)) return null
  // Pour une variété, la visibilité cascade depuis sa propre espèce.
  if (entree.espece && !estVisibleReferentiel(entree.espece, userId)) return null
  return entree.nom
}

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
  // FB-SQGWSG : « %_ » est du texte saisi. Sans échappement, il devenait un
  // joker et remontait tous les arbres, parcelles, animaux, clients…
  const like = contientLitteral(q)
  const likeLitteral = contientLitteral(q)
  const cle = normalizeReferentielKey(q)
  // Une clé vide ne doit jamais devenir `contains: ''` (toutes les lignes).
  const noms = { OR: [{ nom: likeLitteral }, ...(cle ? [{ nomNormalise: contientLitteral(cle) }] : [])] }
  const visible = visibiliteReferentiel(userId)
  const especeRecherchee = { AND: [visible, noms] }
  const varieteVisible = { AND: [visible, { espece: visible }] }
  const varieteRecherchee = { AND: [varieteVisible, noms] }

  const [cultures, varietes, arbres, animaux, lots, clients, factures, documents, parcelles, soins, recoltes, produitsBout] = await Promise.all([
    prisma.culture.findMany({
      where: { userId, OR: [
        // Compatibilité des identifiants historiques, en complément des noms visibles.
        { varieteId: likeLitteral }, { especeId: likeLitteral },
        { espece: especeRecherchee }, { variete: varieteRecherchee },
      ] },
      take: TAKE,
      orderBy: { id: 'desc' },
      select: { id: true, especeId: true, varieteId: true, plancheId: true, annee: true, espece: { select: SELECT_NOM_VISIBLE }, variete: { select: { ...SELECT_NOM_VISIBLE, espece: { select: SELECT_NOM_VISIBLE } } } },
    }),
    // Variétés que le compte voit, comme GET /api/varietes (règle cascadée sur
    // l'espèce) : la recherche listait les variétés privées des autres comptes.
    prisma.variete.findMany({
      where: {
        AND: [
          { OR: [{ id: likeLitteral }, noms] },
          varieteVisible,
        ],
      },
      take: TAKE,
      orderBy: { id: 'asc' },
      select: { id: true, nom: true, nomNormalise: true, especeId: true },
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
    prisma.documentCommercial.findMany({
      where: { userId, OR: [{ numero: like }, { clientNom: like }, { objet: like }] },
      take: TAKE,
      orderBy: { date: 'desc' },
      select: { id: true, numero: true, clientNom: true, type: true, statut: true },
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
      where: { userId, OR: [
        // L'identifiant historique et les notes restent cherchés dans le texte brut.
        { especeId: likeLitteral }, { notes: likeLitteral }, { espece: especeRecherchee },
      ] },
      take: TAKE,
      orderBy: { date: 'desc' },
      select: { id: true, especeId: true, notes: true, quantite: true, unite: true, date: true, espece: { select: SELECT_NOM_VISIBLE } },
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
      label: `${nomVisible(c.espece, userId) ?? c.especeId ?? '?'}${c.varieteId ? ` — ${nomVisible(c.variete, userId) ?? c.varieteId}` : ''}`,
      sub: `Culture ${c.annee} · planche ${c.plancheId || '—'}`,
      type: 'Culture',
      href: `/maraichage/cultures/${c.id}`,
    })),
    ...varietes.map((v): SearchItem => ({
      id: `variete-${v.id}`,
      label: v.nom ?? v.id,
      sub: `Variété (${v.especeId || '?'})`,
      type: 'Variété',
      href: `/maraichage/cultures?variete=${encodeURIComponent(v.id)}`,
    })),
    ...arbres.map((a): SearchItem => ({
      id: `arbre-${a.id}`,
      label: a.nom || `Arbre #${a.id}`,
      sub: `${a.espece || ''}${a.variete ? ` — ${a.variete}` : ''}`.trim() || null,
      type: 'Arbre',
      href: `/verger/${a.id}`,
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
    ...documents.map((d): SearchItem => ({
      id: `document-${d.id}`,
      label: d.statut === 'brouillon' ? `Brouillon · ${d.clientNom}` : d.numero,
      sub: d.clientNom,
      type: d.type === 'devis' ? 'Devis' : 'Bon de livraison',
      href: `/comptabilite/factures?tab=${d.type === 'devis' ? 'devis' : 'livraisons'}&document=${encodeURIComponent(d.id)}`,
    })),
    ...parcelles.map((p): SearchItem => ({
      id: `parcelle-${p.id}`,
      label: p.nom || `Parcelle ${p.id}`,
      // FRONT-06 (recette du 2026-11-12) : `surface` est en hectares
      // (`surface_ha`) ; elle sortait suivie de « m² » sans conversion (2 500 m²
      // affichés « 0.25 m² »). Même format que l'écran Parcelles.
      sub: p.surface != null ? formatSurface(p.surface) : null,
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
      label: `${nomVisible(r.espece, userId) ?? r.especeId ?? ''} · ${formatQuantite(r.quantite, (UNITES_QUANTITE as readonly string[]).includes(r.unite ?? '') ? (r.unite as UniteQuantite) : 'kg')}`,
      sub: `${r.notes || ''} · ${new Date(r.date).toLocaleDateString('fr-FR')}`.trim(),
      type: 'Récolte',
      href: `/maraichage/recoltes`,
    })),
    ...produitsBout.map((p): SearchItem => ({
      id: `produit-bout-${p.id}`,
      label: p.nom,
      sub: `Boutique · ${p.prix.toFixed(2)} €`,
      type: 'Produit boutique',
      href: `/boutique`,
    })),
  ]

  const acces = await chargerAccesService(userId)
  // Un résultat dont l'écran est fermé (formule, ou module fermé au membre
  // connecté : même table que la garde des API) n'est pas proposé.
  const restriction = session.user.modulesExploitation
  return NextResponse.json({ items: items.filter(item => operationPermise(acces, item.href, 'GET') && cheminOuvert(restriction, item.href)) })
}
