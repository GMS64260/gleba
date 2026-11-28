"use client"

/**
 * Page Gestion des Clients
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Users, RefreshCw, Plus, Search, Edit, Trash2, Building2, User, Users2, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { TITRE_FICHE_MODIFIEE, avecVersionLigne, conflitDansDialogue } from "@/hooks/use-version-fiche"
import { fetchWithRetry } from "@/lib/fetch-retry"
import { confirmDialog } from "@/lib/global-dialog"

interface Client {
  /** Version de fiche, renvoyée à la modification. */
  version?: number
  id: number
  nom: string
  type: string
  email: string | null
  telephone: string | null
  adresse: string | null
  ville: string | null
  codePostal: string | null
  siret: string | null
  siren: string | null
  tvaIntra: string | null
  conditionsPaiement: number | null
  exonererTVA: boolean
  notes: string | null
  actif: boolean
  /** Ventes rattachées à la fiche (écritures et factures), calculé par l'API. */
  nbVentes?: number
}

const TYPE_LABELS: Record<string, string> = {
  particulier: "Particulier",
  professionnel: "Professionnel",
  association: "Association",
  amap: "AMAP",
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  particulier: <User className="h-4 w-4" />,
  professionnel: <Building2 className="h-4 w-4" />,
  association: <Users2 className="h-4 w-4" />,
  amap: <ShoppingBag className="h-4 w-4" />,
}

/** Compteurs renvoyés par GET /api/comptabilite/clients. */
interface ClientsStats {
  total: number
  actifs: number
  inactifs: number
  parType: Record<string, number>
}

export default function ClientsPage() {
  const { toast } = useToast()
  const formId = React.useId()
  const [isLoading, setIsLoading] = React.useState(true)
  const [clients, setClients] = React.useState<Client[]>([])
  const [stats, setStats] = React.useState<ClientsStats | null>(null)
  const [search, setSearch] = React.useState("")
  const [showInactifs, setShowInactifs] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [editingClient, setEditingClient] = React.useState<Client | null>(null)
  // QA cmsw91q0z (2026-08-16) — un refus serveur (doublon 409, SIRET invalide…)
  // n'était restitué que par un toast de 5 s hors de la modale : perçu comme
  // « aucun message ». L'erreur est désormais aussi affichée dans la modale.
  const [formError, setFormError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    nom: "",
    type: "particulier",
    email: "",
    telephone: "",
    adresse: "",
    ville: "",
    codePostal: "",
    siret: "",
    siren: "",
    tvaIntra: "",
    conditionsPaiement: "0",
    exonererTVA: false,
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (!showInactifs) params.set('actif', 'true')

      // DEV1 T2 — Retry exponentiel sur cold start (503/504) : 3 tentatives,
      // backoff 200ms → 400ms → 800ms (jitter ±25 %).
      const response = await fetchWithRetry(`/api/comptabilite/clients?${params}`, {
        onRetry: (attempt, _err, status) => {
          // Silent retry — pas de toast pour ne pas alarmer si juste 1 cold start.
          // Log console pour observabilité dev.
          console.info(`[clients] retry ${attempt}/3 (status=${status ?? "network"})`)
        },
      })
      if (response.ok) {
        const result = await response.json()
        setClients(result.data)
        setStats(result.stats)
      } else {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: `Chargement clients impossible (HTTP ${response.status}). Réessayez dans quelques secondes.`,
        })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur réseau",
        description: error instanceof Error ? error.message : "Impossible de charger les clients",
      })
    } finally {
      setIsLoading(false)
    }
  }, [search, showInactifs, toast])

  React.useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setFormData({
      nom: "",
      type: "particulier",
      email: "",
      telephone: "",
      adresse: "",
      ville: "",
      codePostal: "",
      siret: "",
      siren: "",
      tvaIntra: "",
      conditionsPaiement: "0",
      exonererTVA: false,
      notes: "",
    })
    setEditingClient(null)
    setFormError(null)
  }

  const openEdit = (client: Client) => {
    setEditingClient(client)
    setFormError(null)
    setFormData({
      nom: client.nom,
      type: client.type,
      email: client.email || "",
      telephone: client.telephone || "",
      adresse: client.adresse || "",
      ville: client.ville || "",
      codePostal: client.codePostal || "",
      siret: client.siret || "",
      siren: client.siren || "",
      tvaIntra: client.tvaIntra || "",
      conditionsPaiement: String(client.conditionsPaiement || 0),
      exonererTVA: client.exonererTVA,
      notes: client.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setFormError(null)

    try {
      // DEV2 #4 — Empty strings → null pour permettre la validation Zod
      // (Luhn refuse empty mais le transform "" passe ; on nettoie ici).
      const body = {
        ...formData,
        siret: formData.siret || null,
        siren: formData.siren || null,
        tvaIntra: formData.tvaIntra || null,
        conditionsPaiement: parseInt(formData.conditionsPaiement),
        ...(editingClient && { id: editingClient.id }),
      }

      const response = await fetch('/api/comptabilite/clients', {
        method: editingClient ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(avecVersionLigne(body, editingClient)),
      })
      // Client modifié ailleurs : la saisie reste ouverte, un second envoi l'impose.
      const conflit = await conflitDansDialogue(response, editingClient)
      if (conflit) {
        setEditingClient(conflit.ligne)
        toast({ variant: "destructive", title: TITRE_FICHE_MODIFIEE, description: conflit.message })
        return
      }

      if (response.ok) {
        toast({ title: editingClient ? "Client modifié" : "Client créé" })
        setDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const err = await response.json().catch(() => ({}))
        const msg = err?.details?.fieldErrors
          ? Object.entries(err.details.fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
              .join(' · ')
          : err?.error || "Impossible d'enregistrer"
        setFormError(msg)
        toast({
          variant: "destructive",
          title: err?.code === 'CLIENT_DOUBLON' ? "Doublon détecté" : "Erreur de validation",
          description: msg,
        })
      }
    } catch {
      setFormError("Impossible d'enregistrer (erreur réseau)")
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (client: Client) => {
    if (!(await confirmDialog(`Désactiver le client "${client.nom}" ?`))) return

    try {
      const response = await fetch(`/api/comptabilite/clients?id=${client.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({ title: "Client désactivé" })
        fetchData()
      } else {
        const p = await response.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Impossible de désactiver ce client" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Clients</h1>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${formId}-nom`}>Nom *</Label>
                      <Input
                        id={`${formId}-nom`}
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        placeholder="Nom du client"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-type`}>Type</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                        <SelectTrigger id={`${formId}-type`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="professionnel">Professionnel</SelectItem>
                          <SelectItem value="association">Association</SelectItem>
                          <SelectItem value="amap">AMAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${formId}-email`}>Email</Label>
                      <Input
                        id={`${formId}-email`}
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@exemple.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-telephone`}>Téléphone</Label>
                      <Input
                        id={`${formId}-telephone`}
                        value={formData.telephone}
                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`${formId}-adresse`}>Adresse</Label>
                    <Input
                      id={`${formId}-adresse`}
                      value={formData.adresse}
                      onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                      placeholder="Adresse"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${formId}-codePostal`}>Code postal</Label>
                      <Input
                        id={`${formId}-codePostal`}
                        value={formData.codePostal}
                        onChange={(e) => setFormData({ ...formData, codePostal: e.target.value })}
                        placeholder="75000"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`${formId}-ville`}>Ville</Label>
                      <Input
                        id={`${formId}-ville`}
                        value={formData.ville}
                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                        placeholder="Paris"
                      />
                    </div>
                  </div>

                  {/* DEV2 #4 — SIRET/SIREN/TVA conditionnels selon le type
                      Professionnel, Association et AMAP ont un SIRET ; particulier non */}
                  {(formData.type === 'professionnel' || formData.type === 'association' || formData.type === 'amap') && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label htmlFor={`${formId}-siret`}>SIRET</Label>
                        <Input
                          id={`${formId}-siret`}
                          value={formData.siret}
                          onChange={(e) => {
                            const v = e.target.value
                            const cleaned = v.replace(/\s+/g, "")
                            // Auto-déduit SIREN (9 premiers chiffres) tant que SIREN n'a pas été édité manuellement
                            const derivedSiren = cleaned.length >= 9 ? cleaned.substring(0, 9) : formData.siren
                            setFormData({ ...formData, siret: v, siren: derivedSiren })
                          }}
                          placeholder="123 456 789 00012"
                          maxLength={20}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`${formId}-siren`}>SIREN{formData.type === 'professionnel' ? ' *' : ''}</Label>
                        <Input
                          id={`${formId}-siren`}
                          aria-required={formData.type === 'professionnel'}
                          aria-describedby={formData.type === 'professionnel' ? `${formId}-siren-aide` : undefined}
                          value={formData.siren}
                          onChange={(e) => setFormData({ ...formData, siren: e.target.value })}
                          placeholder="123 456 789"
                          maxLength={11}
                        />
                        {formData.type === 'professionnel' && (
                          <p id={`${formId}-siren-aide`} className="text-xs text-muted-foreground mt-1">
                            Requis : identifiant de l&apos;acheteur sur une facture électronique.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`${formId}-tvaIntra`}>N° TVA intracom.</Label>
                        <Input
                          id={`${formId}-tvaIntra`}
                          value={formData.tvaIntra}
                          onChange={(e) => setFormData({ ...formData, tvaIntra: e.target.value.toUpperCase() })}
                          placeholder="FR12 345678901"
                          maxLength={20}
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor={`${formId}-conditionsPaiement`}>Conditions de paiement (jours)</Label>
                      <Select value={formData.conditionsPaiement} onValueChange={(v) => setFormData({ ...formData, conditionsPaiement: v })}>
                        <SelectTrigger id={`${formId}-conditionsPaiement`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Comptant</SelectItem>
                          <SelectItem value="7">7 jours</SelectItem>
                          <SelectItem value="15">15 jours</SelectItem>
                          <SelectItem value="30">30 jours</SelectItem>
                          <SelectItem value="45">45 jours</SelectItem>
                          <SelectItem value="60">60 jours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id={`${formId}-exonererTVA`}
                        checked={formData.exonererTVA}
                        onChange={(e) => setFormData({ ...formData, exonererTVA: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor={`${formId}-exonererTVA`} className="cursor-pointer">Client exonéré de TVA</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`${formId}-notes`}>Notes</Label>
                    <Textarea
                      id={`${formId}-notes`}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Notes internes..."
                      rows={2}
                    />
                  </div>

                  {formError && (
                    <div
                      role="alert"
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                    >
                      {formError}
                    </div>
                  )}

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Annuler</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : editingClient ? "Modifier" : "Créer"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" aria-label="Actualiser les clients" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto min-w-0 px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 md:gap-4 max-md:[&>*>*]:px-3 max-md:[&>*>*:first-child]:pt-3 max-md:[&>*>*:last-child]:pb-3 max-md:[&_.text-2xl]:text-xl md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {showInactifs ? "Clients (actifs + inactifs)" : "Clients actifs"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
                {showInactifs && stats.inactifs > 0 && (
                  <p className="text-xs text-muted-foreground">
                    dont {stats.inactifs} inactif{stats.inactifs > 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Particuliers</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.particulier || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Professionnels</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.professionnel || 0}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">AMAP</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{stats.parType?.amap || 0}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Filtres */}
        <Card className="mb-6 min-w-0">
          <CardContent className="min-w-0 pt-4">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="min-w-0 flex-1 sm:basis-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactifs}
                  onChange={(e) => setShowInactifs(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Afficher inactifs</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card className="min-w-0">
          <CardContent className="min-w-0 p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Ventes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className={!client.actif ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{client.nom}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {TYPE_ICONS[client.type]}
                          <span className="text-sm">{TYPE_LABELS[client.type]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {client.email && <div>{client.email}</div>}
                          {client.telephone && <div className="text-muted-foreground">{client.telephone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>{client.ville || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {client.conditionsPaiement === 0 ? 'Comptant' : `${client.conditionsPaiement}j`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {client.nbVentes ?? 0} vente{(client.nbVentes ?? 0) > 1 ? "s" : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(client)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {client.actif && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(client)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Aucun client
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
