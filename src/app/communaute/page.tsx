"use client"

/**
 * Portail de l’encyclopédie et des échanges de Gleba.
 * Les propositions d’évolution et leur feuille de route restent accessibles ;
 * le référentiel canonique fournit les fiches, le forum porte les échanges.
 */

import * as React from "react"
import { LienCommunaute as Link, naviguerCommunaute } from "@/components/communaute/LienCommunaute"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppHeader } from "@/components/shell/AppHeader"
import { ConteneurPage, PageEntete } from "@/components/shell/PageEntete"
import type { AccesSalon } from "@/components/communaute/SalonDiscussion"
import { CatalogueCommunaute } from "@/components/communaute/CatalogueCommunaute"
import { ForumCommunaute } from "@/components/communaute/ForumCommunaute"
import { ContributionsSuivi } from "@/components/encyclopedie/ContributionsSuivi"
import { lireOngletCommunaute, urlOngletCommunaute, type OngletCommunaute } from "@/lib/communaute/navigation"
import { urlConnexion } from "@/lib/auth-retour"
import { useIsDemoAccount } from "@/hooks/use-is-demo"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import {
  BookOpen,
  Edit,
  Camera,
  ChevronUp,
  Plus,
  Loader2,
  Trash2,
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  LayoutGrid,
  Lightbulb,
  Route,
  MessageSquare,
} from "lucide-react"

interface Evolution {
  id: string
  titre: string
  description: string
  categorie: string
  statut: string
  adminNote: string | null
  createdAt: string
  votes: number
  hasVoted: boolean
  author: { id: string; name: string; isMe: boolean }
}

const CATEGORIES: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  MARAICHAGE: { label: "Maraîchage", icon: Sprout, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  VERGER: { label: "Verger & Forêt", icon: TreeDeciduous, className: "bg-lime-50 text-lime-700 border-lime-200" },
  ELEVAGE: { label: "Élevage", icon: Bird, className: "bg-amber-50 text-amber-700 border-amber-200" },
  COMPTABILITE: { label: "Comptabilité", icon: Wallet, className: "bg-blue-50 text-blue-700 border-blue-200" },
  GENERAL: { label: "Général", icon: LayoutGrid, className: "bg-slate-50 text-slate-700 border-slate-200" },
}

const STATUTS: Record<string, { label: string; className: string }> = {
  PROPOSEE: { label: "Proposée", className: "bg-slate-100 text-slate-600" },
  PLANIFIEE: { label: "Planifiée", className: "bg-blue-100 text-blue-700" },
  EN_COURS: { label: "En cours", className: "bg-amber-100 text-amber-700" },
  LIVREE: { label: "Livrée", className: "bg-green-100 text-green-700" },
  REFUSEE: { label: "Refusée", className: "bg-red-100 text-red-700" },
}

const ROADMAP_STATUTS = ["PLANIFIEE", "EN_COURS", "LIVREE"] as const
const ALL_STATUTS = ["PROPOSEE", "PLANIFIEE", "EN_COURS", "LIVREE", "REFUSEE"] as const

const INTRODUCTIONS: Record<OngletCommunaute, { titre: string; description: string }> = {
  encyclopedie: { titre: "Le savoir se cultive ensemble", description: "Explorez les cultures, leurs variétés et leurs itinéraires. Enrichissez une fiche avec des sources, des photos et des observations replacées dans leur terroir." },
  contribuer: { titre: "Faire progresser les connaissances", description: "Une correction, une référence ou une photo peut faire avancer une fiche. Retrouvez vos propositions et les retours de relecture." },
  salon: { titre: "Le forum de la communauté", description: "Posez une question, partagez une pratique et retrouvez les échanges par sujet. Les connaissances durables peuvent ensuite enrichir les fiches de l’encyclopédie." },
  propositions: { titre: "Faire évoluer Gleba", description: "Proposez vos idées d’évolution du logiciel et votez pour celles des autres. Retrouvez ici les besoins et les réponses de l’équipe." },
  roadmap: { titre: "La feuille de route de Gleba", description: "Suivez les évolutions retenues, les travaux en cours et les fonctionnalités livrées." },
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function CommunautePage() {
  return <React.Suspense fallback={<Loader />}><ContenuCommunaute /></React.Suspense>
}

function ContenuCommunaute() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const recherche = searchParams.toString()
  const onglet = lireOngletCommunaute(searchParams.get("tab"))
  const retour = `/communaute${recherche ? `?${recherche}` : ""}`
  const changerOnglet = (value: string) => naviguerCommunaute(urlOngletCommunaute(lireOngletCommunaute(value), recherche), "replace")
  const { toast } = useToast()
  const isAuthenticated = status === "authenticated"
  const isAdmin = session?.user?.role === "ADMIN"
  const isDemo = useIsDemoAccount()
  const accesSalon: AccesSalon =
    status === "loading" ? "chargement" : !isAuthenticated ? "anonyme" : isDemo ? "demo" : "membre"

  const [items, setItems] = React.useState<Evolution[]>([])
  const [loading, setLoading] = React.useState(true)
  const [categorieFiltre, setCategorieFiltre] = React.useState("ALL")
  const [tri, setTri] = React.useState<"votes" | "recent">("votes")
  const [erreurEvolutions, setErreurEvolutions] = React.useState<string | null>(null)
  const estSuiviProduit = onglet === "propositions" || onglet === "roadmap"

  const fetchItems = React.useCallback(async () => {
    setLoading(true)
    setErreurEvolutions(null)
    try {
      // Vue anonyme : endpoint public en lecture seule
      const endpoint = isAuthenticated ? "/api/evolutions" : "/api/public/evolutions"
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.evolutions)
    } catch {
      setErreurEvolutions("Les propositions n’ont pas pu être chargées. Réessayez dans un instant.")
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  React.useEffect(() => {
    if (status === "loading" || !estSuiviProduit) return
    fetchItems()
  }, [status, fetchItems, estSuiviProduit])

  // Vote optimiste — réservé aux utilisateurs connectés
  const handleVote = async (id: string) => {
    if (!isAuthenticated) {
      router.push(urlConnexion(retour))
      return
    }
    setItems((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, hasVoted: !e.hasVoted, votes: e.votes + (e.hasVoted ? -1 : 1) }
          : e
      )
    )
    try {
      const res = await fetch(`/api/evolutions/${id}/vote`, { method: "POST" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems((prev) =>
        prev.map((e) => (e.id === id ? { ...e, hasVoted: data.hasVoted, votes: data.votes } : e))
      )
    } catch {
      // rollback
      fetchItems()
      toast({ title: "Erreur", description: "Le vote n'a pas pu être enregistré.", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Supprimer cette demande d'évolution ?"))) return
    try {
      const res = await fetch(`/api/evolutions/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.filter((e) => e.id !== id))
      toast({ title: "Supprimée", description: "La demande a été supprimée.", duration: 3000 })
    } catch {
      toast({ title: "Erreur", description: "Suppression impossible.", variant: "destructive" })
    }
  }

  const handleStatut = async (id: string, statut: string) => {
    try {
      const res = await fetch(`/api/evolutions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      })
      if (!res.ok) throw new Error()
      setItems((prev) => prev.map((e) => (e.id === id ? { ...e, statut } : e)))
      toast({ title: "Statut mis à jour", duration: 2500 })
    } catch {
      toast({ title: "Erreur", description: "Mise à jour impossible.", variant: "destructive" })
    }
  }

  // Filtre catégorie
  const filtered = React.useMemo(() => {
    if (categorieFiltre === "ALL") return items
    return items.filter((e) => e.categorie === categorieFiltre)
  }, [items, categorieFiltre])

  // Propositions ouvertes au vote (PROPOSEE), triées
  const propositions = React.useMemo(() => {
    const list = filtered.filter((e) => e.statut === "PROPOSEE")
    return [...list].sort((a, b) =>
      tri === "recent"
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : b.votes - a.votes || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [filtered, tri])

  // Roadmap : groupée par statut
  const roadmap = React.useMemo(() => {
    return ROADMAP_STATUTS.map((statut) => ({
      statut,
      items: filtered
        .filter((e) => e.statut === statut)
        .sort((a, b) => b.votes - a.votes),
    }))
  }, [filtered])

  const refusees = React.useMemo(() => filtered.filter((e) => e.statut === "REFUSEE"), [filtered])

  return (
    <div className="min-h-screen bg-papier text-encre">
      {/* Header */}
      {isAuthenticated ? <AppHeader /> : <header className="sticky top-0 z-40 border-b border-lin bg-craie/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-3 lg:px-6 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/gleba-logo.png"
              alt="Gleba"
              width={150}
              height={100}
              className="h-10 w-auto rounded-lg"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
              <>
                <Link href={urlConnexion(retour)}>
                  <Button variant="ghost" size="sm">
                    Connexion
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-foret hover:bg-foret/90">
                    Inscription
                  </Button>
                </Link>
              </>
          </div>
        </div>
      </header>}

      <PageEntete id="communaute" />
      <ConteneurPage className="space-y-6 py-6">
        <section className="border-b border-lin pb-6" aria-labelledby="titre-communaute">
          <h2 id="titre-communaute" className="font-display text-xl font-medium leading-tight sm:text-2xl">{INTRODUCTIONS[onglet].titre}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ardoise sm:text-base">{INTRODUCTIONS[onglet].description}</p>
          {estSuiviProduit && <div className="mt-5">
            {isAuthenticated ? <NewEvolutionDialog onCreated={fetchItems} /> : <Button asChild className="min-h-11"><Link href={urlConnexion(retour)}>Se connecter pour proposer et voter</Link></Button>}
          </div>}
        </section>

        {estSuiviProduit && <div className="flex flex-wrap items-center gap-3">
          <Select value={categorieFiltre} onValueChange={setCategorieFiltre}>
            <SelectTrigger className="min-h-11 w-[220px]" aria-label="Catégorie des évolutions"><SelectValue placeholder="Toutes les catégories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les catégories</SelectItem>
              {Object.entries(CATEGORIES).map(([key, c]) => <SelectItem key={key} value={key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>}

        <Tabs value={onglet} onValueChange={changerOnglet} persist={false} className="w-full">
          <TabsList className="mb-6 h-auto max-w-full flex-wrap justify-start gap-1 bg-lin/40 p-1">
            <TabsTrigger value="encyclopedie" className="min-h-11 gap-2"><BookOpen className="h-4 w-4" aria-hidden />Encyclopédie</TabsTrigger>
            <TabsTrigger value="contribuer" className="min-h-11 gap-2"><Edit className="h-4 w-4" aria-hidden />Contribuer</TabsTrigger>
            <TabsTrigger value="salon" className="min-h-11 gap-2"><MessageSquare className="h-4 w-4" aria-hidden />Forum</TabsTrigger>
            <TabsTrigger value="propositions" className="min-h-11 gap-2"><Lightbulb className="h-4 w-4" aria-hidden />Faire évoluer Gleba</TabsTrigger>
            <TabsTrigger value="roadmap" className="min-h-11 gap-2"><Route className="h-4 w-4" aria-hidden />Feuille de route</TabsTrigger>
          </TabsList>

          <TabsContent value="encyclopedie"><CatalogueCommunaute /></TabsContent>
          <TabsContent value="contribuer" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Link href="/communaute?tab=encyclopedie" className="rounded-xl border border-lin bg-craie p-5 hover:border-sauge"><BookOpen className="h-5 w-5 text-sauge" aria-hidden /><h2 className="mt-3 font-display text-xl">Améliorer une fiche</h2><p className="mt-2 text-sm leading-6 text-ardoise">Choisissez une culture, apportez une source ou précisez un passage. Chaque proposition est relue avant publication.</p></Link>
              <Link href="/communaute?tab=encyclopedie&sansPhoto=1" className="rounded-xl border border-lin bg-craie p-5 hover:border-sauge"><Camera className="h-5 w-5 text-sauge" aria-hidden /><h2 className="mt-3 font-display text-xl">Illustrer une plante</h2><p className="mt-2 text-sm leading-6 text-ardoise">Retrouvez les fiches sans photo validée et proposez une image, avec son crédit et sa licence.</p></Link>
            </div>
            <ContributionsSuivi />
            {isAdmin && <Button asChild variant="outline" className="min-h-11"><Link href="/admin/referentiel/contributions">Relire les contributions</Link></Button>}
          </TabsContent>

          {/* Propositions */}
          <TabsContent value="propositions" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trier par :</span>
              <Button
                variant={tri === "votes" ? "default" : "outline"}
                size="sm"
                onClick={() => setTri("votes")}
                className={tri === "votes" ? "bg-foret hover:bg-foret/90" : ""}
              >
                Plus votées
              </Button>
              <Button
                variant={tri === "recent" ? "default" : "outline"}
                size="sm"
                onClick={() => setTri("recent")}
                className={tri === "recent" ? "bg-foret hover:bg-foret/90" : ""}
              >
                Plus récentes
              </Button>
            </div>

            {erreurEvolutions ? <div role="alert" className="rounded-xl border border-lin bg-craie p-6"><p>{erreurEvolutions}</p><Button variant="outline" className="mt-3 min-h-11" onClick={fetchItems}>Réessayer</Button></div> : loading ? (
              <Loader />
            ) : propositions.length === 0 ? (
              <EmptyState message="Aucune proposition pour le moment. Soyez le premier à proposer une évolution !" />
            ) : (
              <div className="space-y-3">
                {propositions.map((e) => (
                  <EvolutionCard
                    key={e.id}
                    evo={e}
                    isAdmin={isAdmin}
                    onVote={handleVote}
                    onDelete={handleDelete}
                    onStatut={handleStatut}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Roadmap */}
          <TabsContent value="roadmap" className="space-y-6">
            {erreurEvolutions ? <div role="alert" className="rounded-xl border border-lin bg-craie p-6"><p>{erreurEvolutions}</p><Button variant="outline" className="mt-3 min-h-11" onClick={fetchItems}>Réessayer</Button></div> : loading ? (
              <Loader />
            ) : roadmap.every((g) => g.items.length === 0) ? (
              <EmptyState message="La roadmap se remplira au fur et à mesure que les propositions seront retenues." />
            ) : (
              roadmap.map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.statut}>
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                      <span className={`px-2.5 py-1 rounded-md text-sm ${STATUTS[group.statut].className}`}>
                        {STATUTS[group.statut].label}
                      </span>
                      <span className="text-sm text-muted-foreground">({group.items.length})</span>
                    </h3>
                    <div className="space-y-3">
                      {group.items.map((e) => (
                        <EvolutionCard
                          key={e.id}
                          evo={e}
                          isAdmin={isAdmin}
                          onVote={handleVote}
                          onDelete={handleDelete}
                          onStatut={handleStatut}
                        />
                      ))}
                    </div>
                  </div>
                )
              )
            )}

            {isAdmin && refusees.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <span className={`px-2.5 py-1 rounded-md text-sm ${STATUTS.REFUSEE.className}`}>
                    {STATUTS.REFUSEE.label}
                  </span>
                  <span className="text-sm text-muted-foreground">({refusees.length})</span>
                </h3>
                <div className="space-y-3">
                  {refusees.map((e) => (
                    <EvolutionCard
                      key={e.id}
                      evo={e}
                      isAdmin={isAdmin}
                      onVote={handleVote}
                      onDelete={handleDelete}
                      onStatut={handleStatut}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Aucune lecture du forum ni de l’ancien salon tant que cet onglet est fermé. */}
          <TabsContent value="salon" className="space-y-6">
            <ForumCommunaute acces={accesSalon} />
          </TabsContent>
        </Tabs>
      </ConteneurPage>
    </div>
  )
}

function EvolutionCard({
  evo,
  isAdmin,
  onVote,
  onDelete,
  onStatut,
}: {
  evo: Evolution
  isAdmin: boolean
  onVote: (id: string) => void
  onDelete: (id: string) => void
  onStatut: (id: string, statut: string) => void
}) {
  const cat = CATEGORIES[evo.categorie] ?? CATEGORIES.GENERAL
  const CatIcon = cat.icon
  const statut = STATUTS[evo.statut]

  return (
    <Card>
      <CardContent className="flex gap-4 py-4">
        {/* Bouton vote */}
        <button
          type="button"
          onClick={() => onVote(evo.id)}
          className={`flex h-fit min-w-[3.5rem] flex-col items-center rounded-lg border px-3 py-2 transition-colors ${
            evo.hasVoted
              ? "border-sauge bg-sauge-doux text-foret"
              : "border-slate-200 text-slate-600 hover:border-sauge hover:bg-sauge-doux"
          }`}
          aria-pressed={evo.hasVoted}
        >
          <ChevronUp className={`h-5 w-5 ${evo.hasVoted ? "text-sauge" : ""}`} />
          <span className="text-lg font-bold leading-none">{evo.votes}</span>
          <span className="text-[10px] uppercase tracking-wide">vote{evo.votes > 1 ? "s" : ""}</span>
        </button>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{evo.titre}</h4>
            <Badge variant="outline" className={`gap-1 ${cat.className}`}>
              <CatIcon className="h-3 w-3" />
              {cat.label}
            </Badge>
            {evo.statut !== "PROPOSEE" && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statut.className}`}>
                {statut.label}
              </span>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{evo.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Proposé par {evo.author.isMe ? "vous" : evo.author.name} &middot; {fmtDate(evo.createdAt)}
          </p>
          {evo.adminNote && (
            <p className="mt-2 rounded-md bg-sauge-doux px-3 py-2 text-xs text-foret">
              <span className="font-semibold">Note de l&apos;équipe :</span> {evo.adminNote}
            </p>
          )}

          {/* Contrôles */}
          {(isAdmin || evo.author.isMe) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isAdmin && (
                <Select value={evo.statut} onValueChange={(v) => onStatut(evo.id, v)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUTS.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {STATUTS[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(isAdmin || evo.author.isMe) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onDelete(evo.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Supprimer
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function NewEvolutionDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [titre, setTitre] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [categorie, setCategorie] = React.useState("GENERAL")
  const [submitting, setSubmitting] = React.useState(false)

  const reset = () => {
    setTitre("")
    setDescription("")
    setCategorie("GENERAL")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch("/api/evolutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titre, description, categorie }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Erreur", description: data.error || "Envoi impossible.", variant: "destructive" })
        return
      }
      toast({ title: "Merci !", description: "Votre demande a été publiée.", duration: 3000 })
      reset()
      setOpen(false)
      onCreated()
    } catch {
      toast({ title: "Erreur", description: "Envoi impossible.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="bg-foret hover:bg-foret/90">
        <Plus className="mr-2 h-4 w-4" />
        Proposer une évolution
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Proposer une évolution</DialogTitle>
          <DialogDescription>
            Décrivez l&apos;amélioration ou la fonctionnalité que vous aimeriez voir dans Gleba.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="evolution-titre" className="text-sm font-medium">Titre</label>
            <Input
              id="evolution-titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex : Export PDF du plan de jardin"
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Catégorie</label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIES).map(([key, c]) => (
                  <SelectItem key={key} value={key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="evolution-description" className="text-sm font-medium">Description</label>
            <Textarea
              id="evolution-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez le besoin, le contexte et le bénéfice attendu…"
              rows={5}
              maxLength={2000}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting} className="bg-foret hover:bg-foret/90">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">{message}</CardContent>
    </Card>
  )
}
