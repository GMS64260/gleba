/**
 * Consultation LECTURE SEULE de la session d'un utilisateur (Admin).
 *
 * Feature demandée 2026-07-24 : une « porte » pour voir les données d'un
 * utilisateur sans rien pouvoir modifier. Choisi : visionneuse admin dédiée
 * (pages séparées) plutôt qu'une impersonation touchant l'auth → aucun risque
 * d'écriture par construction (server component gardé `requireAdmin`, requêtes
 * Prisma en lecture, aucun formulaire/mutation). Couvre toute l'app en vue
 * d'ensemble + un détail Élevage riche.
 */

import { requireAdmin } from "@/lib/auth-utils"
import prisma from "@/lib/prisma"
import { reconstituerEffectifsLots } from "@/lib/elevage/effectif"
import { chargerAttentesConsolidees } from "@/lib/elevage/attentes-query"
import { remiseVente } from "@/lib/elevage/attentes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Shield,
  ArrowLeft,
  Eye,
  Bird,
  Leaf,
  Trees,
  Euro,
  Egg,
  Milk,
  Baby,
  Stethoscope,
  Pencil,
} from "lucide-react"

interface PageProps {
  params: Promise<{ id: string }>
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)
const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR") : "—"

export default async function ConsultationUserPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  })
  if (!user) notFound()

  const userId = user.id
  const now = new Date()
  const debutAnnee = new Date(now.getFullYear(), 0, 1)
  const finAnnee = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [
    animauxActifs,
    animauxHorsLot,
    lotsActifs,
    oeufsAnnee,
    laitAnnee,
    naissancesAnnee,
    soinsAVenir,
    culturesCount,
    planchesCount,
    recoltesCount,
    recolteKgAnnee,
    arbresCount,
    caAnnee,
    attentes,
    animaux,
    soinsRecents,
  ] = await Promise.all([
    prisma.animal.count({ where: { userId, statut: "actif" } }),
    // QA caprin cms1v227a — fiches hors lot : celles rattachées à un lot sont
    // déjà dans l'effectif calculé des lots (pas de double comptage).
    prisma.animal.count({ where: { userId, statut: "actif", lotId: null } }),
    prisma.lotAnimaux.findMany({
      where: { userId, statut: "actif" },
      select: {
        id: true,
        nom: true,
        quantiteInitiale: true,
        quantiteActuelle: true,
        especeAnimale: { select: { nom: true } },
      },
    }),
    prisma.productionOeuf.aggregate({
      where: { userId, date: { gte: debutAnnee, lte: finAnnee } },
      _sum: { quantite: true },
    }),
    prisma.collecteLait.aggregate({
      where: { userId, date: { gte: debutAnnee, lte: finAnnee } },
      _sum: { quantiteLitres: true },
    }),
    prisma.naissanceAnimale.count({ where: { userId, date: { gte: debutAnnee, lte: finAnnee } } }),
    prisma.soinAnimal.count({ where: { userId, fait: false } }),
    prisma.culture.count({ where: { userId } }),
    prisma.planche.count({ where: { userId } }),
    prisma.recolte.count({ where: { userId } }),
    prisma.recolte.aggregate({
      where: { userId, date: { gte: debutAnnee, lte: finAnnee } },
      _sum: { quantite: true },
    }),
    prisma.arbre.count({ where: { userId } }),
    prisma.venteProduit.aggregate({
      where: { userId, annule: false, date: { gte: debutAnnee, lte: finAnnee } },
      _sum: { prixTotal: true },
    }),
    chargerAttentesConsolidees(userId, today),
    prisma.animal.findMany({
      where: { userId },
      orderBy: [{ statut: "asc" }, { identifiant: "asc" }],
      take: 200,
      select: {
        id: true,
        identifiant: true,
        nom: true,
        sexe: true,
        statut: true,
        especeAnimale: { select: { nom: true } },
        lot: { select: { nom: true } },
      },
    }),
    prisma.soinAnimal.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }],
      take: 15,
      select: {
        id: true,
        date: true,
        type: true,
        produit: true,
        fait: true,
        animal: { select: { nom: true, identifiant: true } },
        lot: { select: { nom: true } },
      },
    }),
  ])

  const effectifs = await reconstituerEffectifsLots(userId, lotsActifs)
  const animauxEnLots = Array.from(effectifs.values()).reduce((s, e) => s + e.effectifCalcule, 0)
  // QA caprin cms1v227a — effectif réel = lots (fiches rattachées incluses) + hors lot.
  const cheptelTotal = animauxHorsLot + animauxEnLots
  const laitLitres = Number(laitAnnee._sum.quantiteLitres ?? 0)
  const recolteKg = Number(recolteKgAnnee._sum.quantite ?? 0)
  const ca = Number(caAnnee._sum.prixTotal ?? 0)
  const annee = now.getFullYear()

  const modules = [
    {
      titre: "Élevage",
      icon: Bird,
      couleur: "text-emerald-600",
      kpis: [
        { label: "Cheptel total", value: `${cheptelTotal}` },
        { label: "Hors lot / en lots", value: `${animauxHorsLot} / ${animauxEnLots}` },
        { label: "Lots actifs", value: `${lotsActifs.length}` },
        { label: `Œufs ${annee}`, value: fmt(oeufsAnnee._sum.quantite ?? 0) },
        { label: `Lait ${annee}`, value: `${fmt(laitLitres)} L` },
        { label: `Naissances ${annee}`, value: `${naissancesAnnee}` },
        { label: "Soins à venir", value: `${soinsAVenir}` },
      ],
    },
    {
      titre: "Potager",
      icon: Leaf,
      couleur: "text-lime-600",
      kpis: [
        { label: "Cultures", value: `${culturesCount}` },
        { label: "Planches", value: `${planchesCount}` },
        { label: "Récoltes", value: `${recoltesCount}` },
        { label: `Récolté ${annee}`, value: `${fmt(recolteKg)} kg` },
      ],
    },
    {
      titre: "Verger",
      icon: Trees,
      couleur: "text-green-700",
      kpis: [{ label: "Arbres", value: `${arbresCount}` }],
    },
    {
      titre: "Comptabilité",
      icon: Euro,
      couleur: "text-amber-600",
      kpis: [{ label: `Ventes ${annee}`, value: `${fmt(ca)} €` }],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-bold text-amber-800">Consultation utilisateur</h1>
            </div>
          </div>
          <Link href={`/admin/users/${user.id}`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4 mr-1.5" /> Modifier la fiche
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Bandeau lecture seule */}
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 flex items-center gap-3">
          <Eye className="h-5 w-5 text-sky-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sky-900">
              {user.name || user.email}
              {!user.active && <Badge variant="secondary" className="ml-2">compte inactif</Badge>}
            </p>
            <p className="text-xs text-sky-700">
              {user.email} · rôle {user.role} · inscrit le {fmtDate(user.createdAt)} — vue{" "}
              <strong>lecture seule</strong> (aucune modification possible).
            </p>
          </div>
        </div>

        {/* Vue d'ensemble multi-modules */}
        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((m) => (
            <Card key={m.titre}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <m.icon className={`h-5 w-5 ${m.couleur}`} />
                  {m.titre}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {m.kpis.map((k) => (
                    <div key={k.label}>
                      <div className="text-lg font-bold">{k.value}</div>
                      <div className="text-xs text-muted-foreground">{k.label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Délais d'attente actifs (sanitaire) */}
        {attentes.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Milk className="h-5 w-5 text-amber-600" />
                Délais d&apos;attente en cours
                <Badge variant="secondary">{attentes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Animal / Lot</th>
                    <th className="p-2">Traitement</th>
                    <th className="p-2">🥛 Lait — remise</th>
                    <th className="p-2">🥩 Viande — remise</th>
                  </tr>
                </thead>
                <tbody>
                  {attentes.map((a) => (
                    <tr key={a.key} className="border-b border-amber-100">
                      <td className="p-2 font-medium">{a.cible.label}</td>
                      <td className="p-2 text-slate-600">{a.traitement}</td>
                      <td className="p-2">{a.finAttenteLait ? `le ${fmtDate(remiseVente(a.finAttenteLait))}` : "—"}</td>
                      <td className="p-2">{a.finAttenteViande ? `le ${fmtDate(remiseVente(a.finAttenteViande))}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Détail Élevage : lots */}
        {lotsActifs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Egg className="h-5 w-5 text-emerald-600" /> Lots actifs
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Lot</th>
                    <th className="p-2">Espèce</th>
                    <th className="p-2 text-right">Effectif</th>
                  </tr>
                </thead>
                <tbody>
                  {lotsActifs.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-2 font-medium">{l.nom || `Lot #${l.id}`}</td>
                      <td className="p-2 text-slate-600">{l.especeAnimale?.nom ?? "—"}</td>
                      <td className="p-2 text-right font-semibold">
                        {effectifs.get(l.id)?.effectifCalcule ?? l.quantiteActuelle}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Détail Élevage : animaux */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bird className="h-5 w-5 text-emerald-600" /> Animaux
              <Badge variant="secondary">{animaux.length}{animaux.length === 200 ? "+" : ""}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {animaux.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucun animal nominatif.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Boucle</th>
                    <th className="p-2">Nom</th>
                    <th className="p-2">Espèce</th>
                    <th className="p-2">Sexe</th>
                    <th className="p-2">Lot</th>
                    <th className="p-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {animaux.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="p-2 font-mono">{a.identifiant || "—"}</td>
                      <td className="p-2">{a.nom || "—"}</td>
                      <td className="p-2 text-slate-600">{a.especeAnimale?.nom ?? "—"}</td>
                      <td className="p-2">{a.sexe === "male" ? "♂" : a.sexe === "femelle" ? "♀" : "—"}</td>
                      <td className="p-2 text-slate-600">{a.lot?.nom ?? "—"}</td>
                      <td className="p-2">
                        <Badge variant={a.statut === "actif" ? "secondary" : "outline"}>{a.statut}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Détail Élevage : derniers soins */}
        {soinsRecents.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" /> Derniers soins
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Produit</th>
                    <th className="p-2">Cible</th>
                    <th className="p-2">État</th>
                  </tr>
                </thead>
                <tbody>
                  {soinsRecents.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-2 whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="p-2">{s.type}</td>
                      <td className="p-2 text-slate-600">{s.produit || "—"}</td>
                      <td className="p-2">{s.animal?.identifiant || s.animal?.nom || s.lot?.nom || "—"}</td>
                      <td className="p-2">
                        {s.fait ? <Badge variant="secondary">fait</Badge> : <Badge variant="outline">à faire</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Baby className="h-3.5 w-3.5" />
          Reproduction, alimentation, transformation et autres modules pourront être détaillés ici
          au besoin — la vue d&apos;ensemble ci-dessus couvre déjà tous les modules.
        </p>
      </main>
    </div>
  )
}
