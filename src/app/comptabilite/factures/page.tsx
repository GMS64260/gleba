"use client"

/**
 * Page Factures
 * Onglets: Impayées, Générer facture, Avoirs
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, FileText, RefreshCw, Check, Plus, AlertCircle, Download, Printer, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface Impayee {
  id: number
  source: string
  date: string
  type: string
  description: string
  montant: number
  client: string | null
}

interface LigneFacture {
  id: string
  description: string
  quantite: number
  unite: string
  prixUnitaire: number // HT
  tauxTVA: number      // 0 | 2.1 | 5.5 | 10 | 20
  montantHT: number
  montantTVA: number
  montantTTC: number
}

// Taux TVA présélectionné par catégorie (PROMPT 14C §10)
const TAUX_TVA_PAR_CATEGORIE: Record<string, number> = {
  legumes: 5.5,
  fruits: 5.5,
  oeufs: 5.5,
  produits_transformes: 5.5,
  animaux_vivants: 10,
  aliments_animaux: 10,
  bois: 20,
  service: 20,
  main_oeuvre: 0,
}

interface FactureEmise {
  id: number
  numero: string
  type: string
  date: string
  dateEcheance: string | null
  clientNom: string
  objet: string | null
  totalHT: number
  totalTTC: number
  statut: string
}

export default function FacturesPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("impayees")
  const [isLoading, setIsLoading] = React.useState(true)
  const [impayees, setImpayees] = React.useState<Impayee[]>([])
  const [total, setTotal] = React.useState(0)
  const [facturesEmises, setFacturesEmises] = React.useState<FactureEmise[]>([])

  // État formulaire facture
  const [factureData, setFactureData] = React.useState({
    numero: `F-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
    date: new Date().toISOString().split('T')[0],
    echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    client: "",
    adresse: "",
    email: "",
    objet: "",
    notes: "",
  })
  const [lignes, setLignes] = React.useState<LigneFacture[]>([
    { id: "1", description: "", quantite: 1, unite: "unité", prixUnitaire: 0, tauxTVA: 5.5, montantHT: 0, montantTVA: 0, montantTTC: 0 }
  ])
  const [savingFacture, setSavingFacture] = React.useState(false)
  const [exploitationOk, setExploitationOk] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    fetch('/api/exploitation')
      .then((r) => r.json())
      .then(({ data }) => setExploitationOk(!!data))
      .catch(() => setExploitationOk(false))
  }, [])

  // DEV1 #7 — État formulaire avoir refondu : sélecteur facture origine,
  // recopie auto client + montant, persistance via /api/comptabilite/factures
  // (numéro AV-AAAA-XXXX généré séquentiellement côté serveur via
  // SequenceFacture FOR UPDATE).
  const [avoirData, setAvoirData] = React.useState({
    factureOrigineId: "",
    date: new Date().toISOString().split("T")[0],
    motif: "",
    montant: "",
    tauxTVA: "5.5",
  })
  const [savingAvoir, setSavingAvoir] = React.useState(false)

  const fetchImpayees = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [ventesRes, manuellesRes] = await Promise.all([
        fetch('/api/elevage/ventes?paye=false'),
        fetch('/api/comptabilite/ventes-manuelles?paye=false'),
      ])

      const items: Impayee[] = []

      if (ventesRes.ok) {
        const ventesData = await ventesRes.json()
        const ventes = ventesData.data || []
        ventes.forEach((v: any) => {
          items.push({
            id: v.id,
            source: 'VenteProduit',
            date: v.date,
            type: v.type,
            description: v.description || `Vente ${v.type}`,
            montant: v.prixTotal,
            client: v.client,
          })
        })
      }

      if (manuellesRes.ok) {
        const manuellesData = await manuellesRes.json()
        const manuelles = manuellesData.data || []
        manuelles.forEach((m: any) => {
          items.push({
            id: m.id,
            source: 'VenteManuelle',
            date: m.date,
            type: m.categorie,
            description: m.description,
            montant: m.montant,
            client: m.client,
          })
        })
      }

      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setImpayees(items)
      setTotal(items.reduce((sum, i) => sum + i.montant, 0))
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les données" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const fetchFacturesEmises = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/comptabilite/factures?year=${new Date().getFullYear()}`)
      if (res.ok) {
        const data = await res.json()
        setFacturesEmises(Array.isArray(data) ? data : (data.data || data.factures || []))
      }
    } catch {
      // silent
    }
  }, [])

  React.useEffect(() => {
    fetchImpayees()
    fetchFacturesEmises()
  }, [fetchImpayees, fetchFacturesEmises])

  const downloadFacturePDF = (factureId: number, numero: string) => {
    const link = document.createElement("a")
    link.href = `/api/comptabilite/factures/${factureId}/pdf`
    link.download = `${numero}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatEuro = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const daysSince = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  }

  const markAsPaid = async (item: Impayee) => {
    try {
      const endpoint = item.source === 'VenteProduit'
        ? '/api/elevage/ventes'
        : '/api/comptabilite/ventes-manuelles'

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, paye: true }),
      })

      if (!response.ok) throw new Error('Erreur')

      toast({ title: "Marqué comme payé", description: formatEuro(item.montant) })
      fetchImpayees()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de mettre à jour" })
    }
  }

  const addLigne = () => {
    setLignes([
      ...lignes,
      { id: String(Date.now()), description: "", quantite: 1, unite: "unité", prixUnitaire: 0, tauxTVA: 5.5, montantHT: 0, montantTVA: 0, montantTTC: 0 }
    ])
  }

  const recalcLigne = (l: LigneFacture): LigneFacture => {
    const ht = Math.round(l.quantite * l.prixUnitaire * 100) / 100
    const tva = Math.round(ht * (l.tauxTVA / 100) * 100) / 100
    const ttc = Math.round((ht + tva) * 100) / 100
    return { ...l, montantHT: ht, montantTVA: tva, montantTTC: ttc }
  }

  const updateLigne = (id: string, field: keyof LigneFacture, value: any) => {
    setLignes(lignes.map(l => {
      if (l.id !== id) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantite' || field === 'prixUnitaire' || field === 'tauxTVA') {
        return recalcLigne(updated)
      }
      return updated
    }))
  }

  const removeLigne = (id: string) => {
    if (lignes.length > 1) {
      setLignes(lignes.filter(l => l.id !== id))
    }
  }

  const totalHT = lignes.reduce((s, l) => s + l.montantHT, 0)
  const totalTVA = lignes.reduce((s, l) => s + l.montantTVA, 0)
  const totalFacture = lignes.reduce((s, l) => s + l.montantTTC, 0)
  // Ventilation par taux pour affichage
  const totauxParTaux: Record<number, { ht: number; tva: number }> = {}
  for (const l of lignes) {
    if (!totauxParTaux[l.tauxTVA]) totauxParTaux[l.tauxTVA] = { ht: 0, tva: 0 }
    totauxParTaux[l.tauxTVA].ht += l.montantHT
    totauxParTaux[l.tauxTVA].tva += l.montantTVA
  }

  const enregistrerFacture = async () => {
    if (savingFacture) return
    setSavingFacture(true)
    try {
      const res = await fetch('/api/comptabilite/factures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'facture',
          clientNom: factureData.client,
          clientAdresse: factureData.adresse || null,
          date: factureData.date,
          dateEcheance: factureData.echeance,
          objet: factureData.objet,
          totalHT,
          totalTVA,
          totalTTC: totalFacture,
          statut: 'emise',
          notes: factureData.notes,
          lignes: lignes.map(l => ({
            description: l.description,
            quantite: l.quantite,
            unite: l.unite,
            prixUnitaire: l.prixUnitaire,
            tauxTVA: l.tauxTVA,
            montantHT: l.montantHT,
            montantTVA: l.montantTVA,
            montantTTC: l.montantTTC,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Erreur', description: json.error || 'Échec de la création' })
        return
      }
      toast({ title: 'Facture enregistrée', description: `Numéro ${json.data.numero}` })
      // Réinitialise le formulaire
      setLignes([{ id: '1', description: '', quantite: 1, unite: 'unité', prixUnitaire: 0, tauxTVA: 5.5, montantHT: 0, montantTVA: 0, montantTTC: 0 }])
      setFactureData({
        ...factureData,
        client: '', adresse: '', email: '', objet: '', notes: '',
      })
      // Recharge la liste & ouvre le PDF
      fetchFacturesEmises()
      window.open(`/api/comptabilite/factures/${json.data.id}/pdf`, '_blank')
      setActiveTab('emises')
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur réseau', description: String(err) })
    } finally {
      setSavingFacture(false)
    }
  }

  // DEV1 #7 — Création d'un avoir persistant (Art. 289 CGI).
  // L'avoir devient une Facture type='avoir' avec factureOrigineId pointant
  // vers la facture mère. Numéro AV-AAAA-XXXX généré côté serveur.
  // Le PDF est ensuite ouvert via la route /api/comptabilite/factures/[id]/pdf.
  const createAvoir = async () => {
    if (!avoirData.factureOrigineId) {
      toast({ variant: "destructive", title: "Facture d'origine requise" })
      return
    }
    if (!avoirData.motif || !avoirData.montant) {
      toast({ variant: "destructive", title: "Motif et montant requis" })
      return
    }
    const origine = facturesEmises.find(
      (f: { id: number | string }) => String(f.id) === avoirData.factureOrigineId
    ) as Record<string, unknown> | undefined
    if (!origine) {
      toast({ variant: "destructive", title: "Facture d'origine introuvable" })
      return
    }

    setSavingAvoir(true)
    try {
      const montantTTC = parseFloat(avoirData.montant)
      const tauxTVA = parseFloat(avoirData.tauxTVA)
      const montantHT = Math.round((montantTTC / (1 + tauxTVA / 100)) * 100) / 100
      const montantTVA = Math.round((montantTTC - montantHT) * 100) / 100

      const res = await fetch("/api/comptabilite/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "avoir",
          factureOrigineId: parseInt(avoirData.factureOrigineId, 10),
          date: avoirData.date,
          // Le numéro est généré par le serveur via SequenceFacture FOR UPDATE
          // (séquence AVOIR distincte de FACTURE, cf commit 36b8af5).
          clientId: origine.clientId ?? null,
          clientNom: origine.clientNom ?? "Client",
          clientAdresse: origine.clientAdresse ?? null,
          objet: `Avoir sur facture ${origine.numero} — ${avoirData.motif}`,
          notes: avoirData.motif,
          totalHT: montantHT,
          totalTVA: montantTVA,
          totalTTC: montantTTC,
          totauxParTauxTva: { [String(tauxTVA)]: { ht: montantHT, tva: montantTVA, ttc: montantTTC } },
          lignes: [
            {
              description: avoirData.motif,
              quantite: 1,
              unite: "lot",
              prixUnitaire: montantHT,
              tauxTVA,
              montantHT,
              montantTVA,
              montantTTC,
            },
          ],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec de la création")
      }
      const json = await res.json()
      const created = json.data ?? json
      toast({
        title: "Avoir créé",
        description: `${created.numero} — ${montantTTC.toFixed(2)} €`,
      })
      // Reset form
      setAvoirData({
        factureOrigineId: "",
        date: new Date().toISOString().split("T")[0],
        motif: "",
        montant: "",
        tauxTVA: "5.5",
      })
      fetchFacturesEmises()
      // Ouvre le PDF généré côté serveur (mentions légales + snapshot émetteur).
      window.open(`/api/comptabilite/factures/${created.id}/pdf`, "_blank")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Inconnue",
      })
    } finally {
      setSavingAvoir(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b border-b-2 border-b-blue-500 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/comptabilite"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Comptabilité</Button></Link>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">Factures</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchImpayees}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="impayees" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Impayées
              {impayees.length > 0 && (
                <Badge className="ml-1 bg-amber-500">{impayees.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="emises" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Factures émises
              {facturesEmises.length > 0 && (
                <Badge className="ml-1 bg-blue-500">{facturesEmises.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="generer" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle facture
            </TabsTrigger>
            <TabsTrigger value="avoir" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Avoir
            </TabsTrigger>
          </TabsList>

          {/* Onglet Impayées */}
          <TabsContent value="impayees">
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <Card className={impayees.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Factures en attente</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${impayees.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {impayees.length}
                  </p>
                </CardContent>
              </Card>
              <Card className={total > 0 ? "border-amber-200 bg-amber-50" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Montant total dû</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${total > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {formatEuro(total)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Factures en attente de paiement</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : impayees.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-lg font-medium text-green-600">Toutes les factures sont payées !</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ancienneté</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {impayees.map((item) => {
                        const days = daysSince(item.date)
                        return (
                          <TableRow key={`${item.source}-${item.id}`} className={days > 30 ? "bg-red-50" : days > 14 ? "bg-orange-50" : ""}>
                            <TableCell>{new Date(item.date).toLocaleDateString('fr-FR')}</TableCell>
                            <TableCell>
                              <Badge className={
                                days > 30 ? "bg-red-100 text-red-800" :
                                days > 14 ? "bg-orange-100 text-orange-800" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {days} jours
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                            <TableCell>{item.client || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-amber-600">{formatEuro(item.montant)}</TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => markAsPaid(item)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Payé
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Factures émises */}
          <TabsContent value="emises">
            <Card>
              <CardHeader>
                <CardTitle>Factures émises {new Date().getFullYear()}</CardTitle>
                <CardDescription>
                  Téléchargez vos factures au format PDF
                </CardDescription>
              </CardHeader>
              <CardContent>
                {facturesEmises.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune facture émise cette annee.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N°</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Objet</TableHead>
                        <TableHead className="text-right">Total TTC</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facturesEmises.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.numero}</TableCell>
                          <TableCell>{new Date(f.date).toLocaleDateString("fr-FR")}</TableCell>
                          <TableCell className="capitalize">{f.type}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{f.clientNom}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground">
                            {f.objet || "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatEuro(f.totalTTC)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                f.statut === "payee"
                                  ? "bg-green-100 text-green-800"
                                  : f.statut === "annulee"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-blue-100 text-blue-800"
                              }
                            >
                              {/* BUG #15 : libellé FR accentué pour l'affichage,
                                  le statut canonique reste « payee » côté data. */}
                              {f.statut === "payee"
                                ? "Payée"
                                : f.statut === "annulee"
                                  ? "Annulée"
                                  : f.statut === "emise"
                                    ? "Émise"
                                    : f.statut === "envoyee"
                                      ? "Envoyée"
                                      : f.statut === "partielle"
                                        ? "Partielle"
                                        : f.statut === "brouillon"
                                          ? "Brouillon"
                                          : f.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFacturePDF(f.id, f.numero)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Générer facture */}
          <TabsContent value="generer">
            <Card>
              <CardHeader>
                <CardTitle>Nouvelle facture</CardTitle>
                <CardDescription>Créez une facture à imprimer ou envoyer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <Label>N° Facture</Label>
                    <Input
                      value={factureData.numero}
                      onChange={(e) => setFactureData({ ...factureData, numero: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={factureData.date}
                      onChange={(e) => setFactureData({ ...factureData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Échéance</Label>
                    <Input
                      type="date"
                      value={factureData.echeance}
                      onChange={(e) => setFactureData({ ...factureData, echeance: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Client *</Label>
                    <Input
                      value={factureData.client}
                      onChange={(e) => setFactureData({ ...factureData, client: e.target.value })}
                      placeholder="Nom du client"
                      required
                    />
                  </div>
                  <div>
                    <Label>Adresse</Label>
                    <Input
                      value={factureData.adresse}
                      onChange={(e) => setFactureData({ ...factureData, adresse: e.target.value })}
                      placeholder="Adresse complète"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={factureData.email}
                      onChange={(e) => setFactureData({ ...factureData, email: e.target.value })}
                      placeholder="email@exemple.com"
                    />
                  </div>
                </div>

                <div>
                  <Label>Objet</Label>
                  <Input
                    value={factureData.objet}
                    onChange={(e) => setFactureData({ ...factureData, objet: e.target.value })}
                    placeholder="Ex: Vente légumes semaine 45"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Lignes de facturation</Label>
                    <Button variant="outline" size="sm" onClick={addLigne}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter ligne
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Désignation</TableHead>
                        <TableHead>Qté</TableHead>
                        <TableHead>Unité</TableHead>
                        <TableHead>PU HT</TableHead>
                        <TableHead>TVA</TableHead>
                        <TableHead>Total HT</TableHead>
                        <TableHead>Total TTC</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lignes.map((ligne) => (
                        <TableRow key={ligne.id}>
                          <TableCell>
                            <Input
                              value={ligne.description}
                              onChange={(e) => updateLigne(ligne.id, 'description', e.target.value)}
                              placeholder="Description"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.001"
                              value={ligne.quantite}
                              onChange={(e) => updateLigne(ligne.id, 'quantite', parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-9 rounded-md border border-slate-300 px-2 bg-white"
                              value={ligne.unite}
                              onChange={(e) => updateLigne(ligne.id, 'unite', e.target.value)}
                            >
                              <option value="unité">unité</option>
                              <option value="kg">kg</option>
                              <option value="pièce">pièce</option>
                              <option value="L">L</option>
                              <option value="heure">heure</option>
                              <option value="forfait">forfait</option>
                              <option value="m³">m³</option>
                            </select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={ligne.prixUnitaire}
                              onChange={(e) => updateLigne(ligne.id, 'prixUnitaire', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="h-9 rounded-md border border-slate-300 px-2 bg-white"
                              value={ligne.tauxTVA}
                              onChange={(e) => updateLigne(ligne.id, 'tauxTVA', parseFloat(e.target.value))}
                            >
                              <option value="0">0%</option>
                              <option value="2.1">2.1%</option>
                              <option value="5.5">5.5%</option>
                              <option value="10">10%</option>
                              <option value="20">20%</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-sm">{formatEuro(ligne.montantHT)}</TableCell>
                          <TableCell className="font-bold text-sm">{formatEuro(ligne.montantTTC)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeLigne(ligne.id)} disabled={lignes.length === 1}>
                              ×
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mt-4">
                    <div className="text-sm space-y-1">
                      <p className="font-semibold text-slate-700 mb-2">Récapitulatif TVA</p>
                      {Object.entries(totauxParTaux).sort((a,b) => Number(a[0]) - Number(b[0])).map(([taux, t]) => (
                        <div key={taux} className="flex justify-between text-slate-600 max-w-xs">
                          <span>Base {taux}%</span>
                          <span>{formatEuro(t.ht)} → TVA {formatEuro(t.tva)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm text-slate-600">Total HT : <span className="font-semibold">{formatEuro(totalHT)}</span></p>
                      <p className="text-sm text-slate-600">Total TVA : <span className="font-semibold">{formatEuro(totalTVA)}</span></p>
                      <p className="text-2xl font-bold text-teal-700">Net à payer TTC : {formatEuro(totalFacture)}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Notes / Conditions</Label>
                  <Textarea
                    value={factureData.notes}
                    onChange={(e) => setFactureData({ ...factureData, notes: e.target.value })}
                    placeholder="Conditions de paiement, mentions complémentaires..."
                    rows={3}
                  />
                </div>

                {exploitationOk === false && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-sm">
                    ⚠ Identité légale non configurée. Les mentions obligatoires
                    (SIRET, raison sociale, TVA) seront absentes du PDF. {" "}
                    <Link href="/parametres/exploitation" className="underline font-medium">
                      Configurer maintenant →
                    </Link>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={enregistrerFacture} disabled={!factureData.client || totalFacture === 0 || savingFacture}>
                    <FileText className="h-4 w-4 mr-2" />
                    {savingFacture ? 'Enregistrement…' : 'Enregistrer et générer le PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Avoir */}
          <TabsContent value="avoir">
            <Card>
              <CardHeader>
                <CardTitle>Nouvel avoir</CardTitle>
                <CardDescription>Créez un avoir (note de crédit) pour un remboursement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* DEV1 #7 — Sélecteur facture d'origine + recopie client */}
                <div>
                  <Label>Facture d'origine *</Label>
                  <Select
                    value={avoirData.factureOrigineId}
                    onValueChange={(v) => setAvoirData({ ...avoirData, factureOrigineId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une facture émise…" />
                    </SelectTrigger>
                    <SelectContent>
                      {facturesEmises
                        .filter((f: { type?: string }) => f.type !== "avoir")
                        .map((f: { id: number; numero: string; clientNom?: string; totalTTC?: number; date?: string }) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.numero} · {f.clientNom || "—"} · {(f.totalTTC ?? 0).toFixed(2)} €
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {avoirData.factureOrigineId && (() => {
                    const origine = facturesEmises.find(
                      (f: { id: number | string }) => String(f.id) === avoirData.factureOrigineId
                    ) as Record<string, unknown> | undefined
                    if (!origine) return null
                    return (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Client recopié : <span className="font-medium">{String(origine.clientNom ?? "—")}</span> ·
                        Montant origine TTC : <span className="font-medium">{Number(origine.totalTTC ?? 0).toFixed(2)} €</span>
                      </p>
                    )
                  })()}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={avoirData.date}
                      onChange={(e) => setAvoirData({ ...avoirData, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Montant TTC (€) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={avoirData.montant}
                      onChange={(e) => setAvoirData({ ...avoirData, montant: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label>Taux TVA (%)</Label>
                    <Select
                      value={avoirData.tauxTVA}
                      onValueChange={(v) => setAvoirData({ ...avoirData, tauxTVA: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["0", "2.1", "5.5", "10", "20"].map((t) => (
                          <SelectItem key={t} value={t}>{t} %</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Motif de l'avoir *</Label>
                  <Textarea
                    value={avoirData.motif}
                    onChange={(e) => setAvoirData({ ...avoirData, motif: e.target.value })}
                    placeholder="Ex: Marchandise retournée, erreur de facturation…"
                    required
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Le numéro AV-{new Date().getFullYear()}-XXXX est généré automatiquement par le serveur
                  (séquence comptable continue). La facture d'origine ne pourra plus être supprimée
                  tant que cet avoir existe (Art. 289 CGI).
                </p>

                <Button
                  onClick={createAvoir}
                  disabled={savingAvoir || !avoirData.factureOrigineId || !avoirData.motif || !avoirData.montant}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {savingAvoir ? "Création…" : "Créer l'avoir"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
