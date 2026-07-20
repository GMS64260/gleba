"use client"

/**
 * Community Voice — Demandes d'évolution & votes
 * Chaque utilisateur authentifié peut proposer une évolution et voter pour
 * celles des autres. Les mieux notées sont promues dans la roadmap par l'admin.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { UserMenu } from "@/components/auth/UserMenu"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import {
  Megaphone,
  ChevronUp,
  Plus,
  Loader2,
  Trash2,
  Settings,
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  LayoutGrid,
  Lightbulb,
  Route,
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

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function CommunautePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const isAuthenticated = status === "authenticated"
  const isAdmin = session?.user?.role === "ADMIN"

  const [items, setItems] = React.useState<Evolution[]>([])
  const [loading, setLoading] = React.useState(true)
  const [categorieFiltre, setCategorieFiltre] = React.useState("ALL")
  const [tri, setTri] = React.useState<"votes" | "recent">("votes")

  const fetchItems = React.useCallback(async () => {
    setLoading(true)
    try {
      // Vue anonyme : endpoint public en lecture seule
      const endpoint = isAuthenticated ? "/api/evolutions" : "/api/public/evolutions"
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setItems(data.evolutions)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  React.useEffect(() => {
    if (status === "loading") return
    fetchItems()
  }, [status, fetchItems])

  // Vote optimiste — réservé aux utilisateurs connectés
  const handleVote = async (id: string) => {
    if (!isAuthenticated) {
      router.push("/login?callbackUrl=/communaute")
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
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      {/* Header */}
      <header className="border-b border-b-2 border-b-violet-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2 max-w-[1400px]">
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
            {isAuthenticated && session?.user ? (
              <>
                <Link href="/parametres">
                  <Button variant="ghost" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
                <UserMenu user={session.user} />
              </>
            ) : (
              <>
                <Link href="/login?callbackUrl=/communaute">
                  <Button variant="ghost" size="sm">
                    Connexion
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                    Inscription
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-[1400px] space-y-6">
        {/* Intro */}
        <Card className="border-violet-200 bg-violet-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-800">
              <Megaphone className="h-6 w-6 text-violet-600" />
              Community Voice
            </CardTitle>
            <CardDescription className="text-violet-700/80">
              Proposez vos idées d&apos;évolution et votez pour celles des autres.
              Les demandes les mieux notées rejoignent la roadmap de Gleba.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isAuthenticated ? (
              <NewEvolutionDialog onCreated={fetchItems} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/login?callbackUrl=/communaute">
                  <Button className="bg-violet-600 hover:bg-violet-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Connectez-vous pour proposer & voter
                  </Button>
                </Link>
                <span className="text-sm text-violet-700/70">
                  Consultation libre · participation réservée aux membres.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={categorieFiltre} onValueChange={setCategorieFiltre}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les catégories</SelectItem>
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <SelectItem key={key} value={key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="propositions" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="propositions" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Propositions ({propositions.length})
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="gap-2">
              <Route className="h-4 w-4" />
              Roadmap ({roadmap.reduce((n, g) => n + g.items.length, 0)})
            </TabsTrigger>
          </TabsList>

          {/* Propositions */}
          <TabsContent value="propositions" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trier par :</span>
              <Button
                variant={tri === "votes" ? "default" : "outline"}
                size="sm"
                onClick={() => setTri("votes")}
                className={tri === "votes" ? "bg-violet-600 hover:bg-violet-700" : ""}
              >
                Plus votées
              </Button>
              <Button
                variant={tri === "recent" ? "default" : "outline"}
                size="sm"
                onClick={() => setTri("recent")}
                className={tri === "recent" ? "bg-violet-600 hover:bg-violet-700" : ""}
              >
                Plus récentes
              </Button>
            </div>

            {loading ? (
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
            {loading ? (
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
        </Tabs>
      </main>
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
              ? "border-violet-400 bg-violet-50 text-violet-700"
              : "border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-violet-50/50"
          }`}
          aria-pressed={evo.hasVoted}
        >
          <ChevronUp className={`h-5 w-5 ${evo.hasVoted ? "text-violet-600" : ""}`} />
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
            <p className="mt-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-800">
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
      <Button onClick={() => setOpen(true)} className="bg-violet-600 hover:bg-violet-700">
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
            <label className="text-sm font-medium">Titre</label>
            <Input
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
            <label className="text-sm font-medium">Description</label>
            <Textarea
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
            <Button type="submit" disabled={submitting} className="bg-violet-600 hover:bg-violet-700">
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
