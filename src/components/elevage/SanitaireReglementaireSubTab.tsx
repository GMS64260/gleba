"use client"

import * as React from "react"
import { AlertTriangle, Archive, Check, Download, ExternalLink, FileSpreadsheet, FileText, History, Loader2, Pencil, Plus, RotateCcw, Send, Trash2, Upload } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { useFiliereSelection, capacitesSelection } from "@/lib/elevage/filiere-context"
import {
  LABELS_TYPE_JUSTIFICATIF_ALIMENT,
  TYPES_JUSTIFICATIF_ALIMENT,
  type TypeJustificatifAliment,
} from "@/lib/elevage/justificatifs-aliments"
import {
  LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE,
  TYPES_JUSTIFICATIF_EQUARRISSAGE,
  type TypeJustificatifEquarrissage,
} from "@/lib/elevage/justificatifs-equarrissage"
import { confirmDialog } from "@/lib/global-dialog"
import { SyntheseSanitaireCheptel } from "@/components/elevage/SyntheseSanitaireCheptel"

type Produit = { id: string; nom: string; amm: string | null; especesCibles?: string[] }

// Codes d'espèces (referentiel produits) par filière d'atelier, pour ne
// proposer que des produits pertinents dans la pharmacie (2026-07-25).
const CODES_PHARMACIE: Record<string, string[]> = {
  compagnie: ["chien", "chat"],
  equin: ["équin"],
  nac: ["lapin"],
}
type Stock = { id: string; produitId: string; numeroLot: string; quantite: number; unite: string; datePeremption: string | null; ordonnanceUrl: string | null; produit: Produit | null }
type Prophylaxie = { id: string; type: string; datePrevue: string; dateRealisee: string | null; statut: string; organisme: string | null; resultat: string | null }
type AlimentJustificatifOption = { id: string; nom: string }
type JustificatifAliment = {
  id: string
  typeDocument: TypeJustificatifAliment
  dateDocument: string
  alimentId: string | null
  aliment: AlimentJustificatifOption | null
  reference: string | null
  fournisseur: string | null
  numeroLot: string | null
  fichierUrl: string | null
  nomFichier: string | null
  tailleOctets: number | null
  empreinteSha256: string | null
  notes: string | null
  archivedAt: string | null
}
type MortaliteOption = {
  id: number
  nom: string | null
  identifiant: string | null
  causeSortie: string | null
  dateSortie: string
  especeAnimale: { id: string; nom: string }
  lot: { id: number; nom: string | null } | null
}
type JustificatifEquarrissage = {
  id: string
  typeDocument: TypeJustificatifEquarrissage
  dateEnlevement: string
  nombreAnimauxNonIdentifies: number
  typeAnimauxNonIdentifies: string | null
  reference: string | null
  prestataire: string | null
  fichierUrl: string | null
  nomFichier: string | null
  tailleOctets: number | null
  empreinteSha256: string | null
  notes: string | null
  archivedAt: string | null
  animaux: Array<{
    animalId: number
    animal: {
      id: number
      identifiant: string | null
      nom: string | null
      dateSortie: string | null
      causeSortie: string | null
      especeAnimale: { nom: string }
    }
  }>
}
type Declaration = {
  key: string
  type: "NAISSANCE" | "ENTREE" | "SORTIE" | "MORTALITE"
  categorie: "BOVIN" | "OVIN" | "CAPRIN"
  organisme: string
  dateEvenement: string
  dateEcheance: string
  joursRestants: number
  statut: "A_COMPLETER" | "A_DECLARER" | "HORS_DELAI" | "TRANSMISE" | "ACCEPTEE" | "REJETEE" | "ANNULEE"
  libelle: string
  espece: string
  cible: string
  sourceUrl: string
  anomalies: string[]
  transmisAt: string | null
  canalTransmission: string | null
  referenceTransmission: string | null
  modifieeApresTransmission: boolean
}
type DeclarationResume = {
  total: number
  aCompleter: number
  aDeclarer: number
  horsDelai: number
  transmises: number
  modifieesApresTransmission: number
}
type PreparationCirculation = {
  numeroDocumentEde: string
  typeExploitationEde: string
  categorieAnimaux: string
  indicatifsMarquage: string
  tiersNom: string
  tiersNumeroEde: string
  tiersSiren: string
  tiersAdresse: string
  numeroAgrementSanitaire: string
  transporteurNom: string
  numeroTransporteur: string
  immatriculationVehicule: string
  motifMouvement: string
  contactDepart: string
  contactArrivee: string
  notes: string
}
type EvenementReglementaire = {
  id: string
  action: string
  actorUserId: string
  actorLabel: string
  statutAvant: string | null
  statutApres: string | null
  snapshotHash: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}
type ArchiveRegistre = {
  id: string
  annee: number
  periodeDebut: string
  periodeFin: string
  genereLe: string
  snapshotHash: string
  archiveSha256: string
  tailleOctets: number
  nomFichier: string
  annexesIncluses: number
  annexesSignalees: number
  createdAt: string
}

const dateISO = (date = new Date()) => date.toISOString().slice(0, 10)
const anneeCourante = new Date().getFullYear()
const justificatifAlimentVide = {
  id: null as string | null,
  typeDocument: "FACTURE" as TypeJustificatifAliment,
  dateDocument: dateISO(),
  alimentId: "",
  reference: "",
  fournisseur: "",
  numeroLot: "",
  fichierUrl: "",
  nomFichier: "",
  notes: "",
}
const justificatifEquarrissageVide = {
  id: null as string | null,
  typeDocument: "BON_ENLEVEMENT" as TypeJustificatifEquarrissage,
  dateEnlevement: dateISO(),
  animalIds: [] as number[],
  nombreAnimauxNonIdentifies: "",
  typeAnimauxNonIdentifies: "",
  reference: "",
  prestataire: "",
  fichierUrl: "",
  nomFichier: "",
  notes: "",
}
const preparationCirculationVide: PreparationCirculation = {
  numeroDocumentEde: "",
  typeExploitationEde: "",
  categorieAnimaux: "",
  indicatifsMarquage: "",
  tiersNom: "",
  tiersNumeroEde: "",
  tiersSiren: "",
  tiersAdresse: "",
  numeroAgrementSanitaire: "",
  transporteurNom: "",
  numeroTransporteur: "",
  immatriculationVehicule: "",
  motifMouvement: "",
  contactDepart: "",
  contactArrivee: "",
  notes: "",
}
const statutDeclarationLabel: Record<Declaration["statut"], string> = {
  A_COMPLETER: "À compléter",
  A_DECLARER: "À déclarer",
  HORS_DELAI: "Hors délai",
  TRANSMISE: "Transmise",
  ACCEPTEE: "Acceptée",
  REJETEE: "Rejetée",
  ANNULEE: "Annulée",
}
const actionReglementaireLabel: Record<string, string> = {
  STATUT_MODIFIE: "Statut modifié",
  EXPORT_CSV_GENERE: "Export CSV généré",
  DOCUMENT_CIRCULATION_PREPARE: "Préparation de circulation enregistrée",
  DOCUMENT_CIRCULATION_GENERE: "Fiche de circulation générée",
  INVENTAIRE_CHEPTEL_GENERE: "Inventaire généré",
  REGISTRE_COMPLET_GENERE: "Registre complet généré",
  REGISTRE_SANITAIRE_GENERE: "Registre sanitaire généré",
  REGISTRE_MOUVEMENTS_GENERE: "Registre des mouvements généré",
  CADRE_LIEU_CREE: "Lieu de détention ajouté",
  CADRE_LIEU_MODIFIE: "Lieu de détention modifié",
  CADRE_LIEU_ARCHIVE: "Lieu de détention archivé",
  CADRE_LIEU_REACTIVE: "Lieu de détention réactivé",
  CADRE_INTERVENANT_CREE: "Intervenant ajouté",
  CADRE_INTERVENANT_MODIFIE: "Intervenant modifié",
  CADRE_INTERVENANT_ARCHIVE: "Intervenant archivé",
  CADRE_INTERVENANT_REACTIVE: "Intervenant réactivé",
  JUSTIFICATIF_ALIMENT_CREE: "Justificatif d’aliment ajouté",
  JUSTIFICATIF_ALIMENT_MODIFIE: "Justificatif d’aliment modifié",
  JUSTIFICATIF_ALIMENT_ARCHIVE: "Justificatif d’aliment archivé",
  JUSTIFICATIF_ALIMENT_REACTIVE: "Justificatif d’aliment réactivé",
  JUSTIFICATIF_EQUARRISSAGE_CREE: "Bon d’équarrissage ajouté",
  JUSTIFICATIF_EQUARRISSAGE_MODIFIE: "Bon d’équarrissage modifié",
  JUSTIFICATIF_EQUARRISSAGE_ARCHIVE: "Bon d’équarrissage archivé",
  JUSTIFICATIF_EQUARRISSAGE_REACTIVE: "Bon d’équarrissage réactivé",
  REGISTRE_COMPLET_ARCHIVE: "Dossier réglementaire archivé",
  REGISTRE_COMPLET_ARCHIVE_TELECHARGE: "Archive réglementaire téléchargée",
}

export function SanitaireReglementaireSubTab() {
  const { toast } = useToast()
  const filiereSel = useFiliereSelection()
  const caps = capacitesSelection(filiereSel)
  // Registres BDNI / prophylaxies réglementaires = rente. Pour compagnie/équin/
  // NAC on garde la pharmacie (produits filtrés) et des rappels sanitaires
  // génériques (vaccination, vermifuge, visite véto).
  const codesFiliere =
    filiereSel === "toutes" || filiereSel === "rente" ? null : CODES_PHARMACIE[filiereSel] ?? []
  const [stocks, setStocks] = React.useState<Stock[]>([])
  const [prophylaxies, setProphylaxies] = React.useState<Prophylaxie[]>([])
  const [produits, setProduits] = React.useState<Produit[]>([])
  const [aliments, setAliments] = React.useState<AlimentJustificatifOption[]>([])
  const [justificatifsAliments, setJustificatifsAliments] = React.useState<JustificatifAliment[]>([])
  const [mortalites, setMortalites] = React.useState<MortaliteOption[]>([])
  const [justificatifsEquarrissage, setJustificatifsEquarrissage] =
    React.useState<JustificatifEquarrissage[]>([])
  const [stockOpen, setStockOpen] = React.useState(false)
  const [proOpen, setProOpen] = React.useState(false)
  const [justificatifOpen, setJustificatifOpen] = React.useState(false)
  const [justificatifLoading, setJustificatifLoading] = React.useState(false)
  const [justificatifForm, setJustificatifForm] = React.useState(justificatifAlimentVide)
  const [justificatifFile, setJustificatifFile] = React.useState<File | null>(null)
  const [equarrissageOpen, setEquarrissageOpen] = React.useState(false)
  const [equarrissageLoading, setEquarrissageLoading] = React.useState(false)
  const [equarrissageForm, setEquarrissageForm] =
    React.useState(justificatifEquarrissageVide)
  const [equarrissageFile, setEquarrissageFile] = React.useState<File | null>(null)
  const [declarations, setDeclarations] = React.useState<Declaration[]>([])
  const [declarationResume, setDeclarationResume] = React.useState<DeclarationResume | null>(null)
  const [declarationsLoading, setDeclarationsLoading] = React.useState(true)
  const [transmissionOpen, setTransmissionOpen] = React.useState(false)
  const [declarationSelectionnee, setDeclarationSelectionnee] = React.useState<Declaration | null>(null)
  const [inventaireDate, setInventaireDate] = React.useState(dateISO())
  const [circulationOpen, setCirculationOpen] = React.useState(false)
  const [circulationLoading, setCirculationLoading] = React.useState(false)
  const [circulationForm, setCirculationForm] = React.useState<PreparationCirculation>(preparationCirculationVide)
  const [circulationAnomalies, setCirculationAnomalies] = React.useState<string[]>([])
  const [historiqueOpen, setHistoriqueOpen] = React.useState(false)
  const [historiqueLoading, setHistoriqueLoading] = React.useState(false)
  const [historique, setHistorique] = React.useState<EvenementReglementaire[]>([])
  const [historiqueTitre, setHistoriqueTitre] = React.useState("")
  const [archivesRegistre, setArchivesRegistre] = React.useState<ArchiveRegistre[]>([])
  const [archivageLoading, setArchivageLoading] = React.useState(false)
  const [transmissionForm, setTransmissionForm] = React.useState({
    transmisAt: dateISO(),
    canalTransmission: "Portail EDE",
    referenceTransmission: "",
    notes: "",
  })
  const [stockForm, setStockForm] = React.useState({ produitId: "", numeroLot: "", quantite: "", unite: "mL", datePeremption: "", ordonnanceUrl: "", fournisseur: "", notes: "" })
  const [proForm, setProForm] = React.useState({ type: "", datePrevue: dateISO(), organisme: "", notes: "" })
  const [numeroEde, setNumeroEde] = React.useState("")
  const [numeroEdeSaving, setNumeroEdeSaving] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/exploitation")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setNumeroEde(payload?.data?.numeroEde ?? ""))
      .catch(() => {})
  }, [])

  async function enregistrerNumeroEde() {
    if (!numeroEde.trim()) {
      toast({ variant: "destructive", title: "Numéro EDE requis" })
      return
    }
    setNumeroEdeSaving(true)
    try {
      const response = await fetch("/api/exploitation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeroEde }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Impossible d’enregistrer le numéro EDE")
      setNumeroEde(payload.data.numeroEde)
      toast({ title: "Numéro EDE enregistré", description: "Les déclarations ont été recalculées." })
      await reload()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Numéro EDE non enregistré",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setNumeroEdeSaving(false)
    }
  }

  const reload = React.useCallback(async () => {
    setDeclarationsLoading(true)
    try {
      const [
        s,
        p,
        produitsRes,
        declarationsRes,
        alimentsRes,
        justificatifsRes,
        mortalitesRes,
        equarrissageRes,
        archivesRes,
      ] = await Promise.all([
        fetch('/api/elevage/stock-medicaments'),
        fetch('/api/elevage/prophylaxies'),
        fetch('/api/elevage/produits-veterinaires'),
        fetch(`/api/elevage/declarations-reglementaires?year=${anneeCourante}`),
        fetch('/api/elevage/aliments'),
        fetch(`/api/elevage/justificatifs-aliments?year=${anneeCourante}`),
        fetch(`/api/elevage/mortalites?annee=${anneeCourante}`),
        fetch(`/api/elevage/justificatifs-equarrissage?year=${anneeCourante}`),
        fetch(`/api/elevage/registres-archives?year=${anneeCourante}`),
      ])
      if (s.ok) setStocks((await s.json()).data)
      if (p.ok) setProphylaxies((await p.json()).data)
      if (produitsRes.ok) setProduits((await produitsRes.json()).data)
      if (alimentsRes.ok) {
        setAliments((await alimentsRes.json()).data.map((aliment: AlimentJustificatifOption) => ({
          id: aliment.id,
          nom: aliment.nom,
        })))
      }
      if (justificatifsRes.ok) {
        setJustificatifsAliments((await justificatifsRes.json()).data)
      }
      if (mortalitesRes.ok) {
        setMortalites((await mortalitesRes.json()).data)
      }
      if (equarrissageRes.ok) {
        setJustificatifsEquarrissage((await equarrissageRes.json()).data)
      }
      if (archivesRes.ok) {
        setArchivesRegistre((await archivesRes.json()).data)
      }
      if (declarationsRes.ok) {
        const payload = await declarationsRes.json()
        setDeclarations(payload.declarations)
        setDeclarationResume(payload.resume)
      }
    } finally {
      setDeclarationsLoading(false)
    }
  }, [])
  React.useEffect(() => { void reload() }, [reload])

  async function archiverRegistreComplet() {
    setArchivageLoading(true)
    try {
      const response = await fetch(
        `/api/elevage/registre-elevage-complet?year=${anneeCourante}&format=archive`,
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Impossible de constituer l’archive")
      }
      const blob = await response.blob()
      const disposition = response.headers.get("content-disposition") || ""
      const nomFichier =
        /filename="([^"]+)"/.exec(disposition)?.[1]
        || `dossier-reglementaire-elevage-${anneeCourante}.zip`
      const url = URL.createObjectURL(blob)
      const lien = document.createElement("a")
      lien.href = url
      lien.download = nomFichier
      document.body.appendChild(lien)
      lien.click()
      lien.remove()
      URL.revokeObjectURL(url)

      const archivesResponse = await fetch(
        `/api/elevage/registres-archives?year=${anneeCourante}`,
      )
      if (archivesResponse.ok) {
        setArchivesRegistre((await archivesResponse.json()).data)
      }
      toast({
        title: "Dossier réglementaire archivé",
        description:
          "Le ZIP contient le registre, son manifeste d’intégrité et les pièces privées disponibles.",
      })
    } catch (erreur) {
      toast({
        variant: "destructive",
        title: "Archive non créée",
        description: erreur instanceof Error ? erreur.message : "Erreur inattendue",
      })
    } finally {
      setArchivageLoading(false)
    }
  }

  async function saveStock(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/elevage/stock-medicaments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stockForm, quantite: Number(stockForm.quantite), datePeremption: stockForm.datePeremption || null, ordonnanceUrl: stockForm.ordonnanceUrl || null }),
    })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Stock non enregistré', description: (await res.json()).error })
    setStockOpen(false); await reload()
    toast({ title: 'Stock de médicament enregistré' })
  }

  async function savePro(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/elevage/prophylaxies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(proForm),
    })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Échéance non enregistrée', description: (await res.json()).error })
    setProOpen(false); await reload()
    toast({ title: 'Prophylaxie ajoutée à l’agenda' })
  }

  function ouvrirJustificatif(justificatif?: JustificatifAliment) {
    setJustificatifForm(justificatif ? {
      id: justificatif.id,
      typeDocument: justificatif.typeDocument,
      dateDocument: justificatif.dateDocument.slice(0, 10),
      alimentId: justificatif.alimentId ?? "",
      reference: justificatif.reference ?? "",
      fournisseur: justificatif.fournisseur ?? "",
      numeroLot: justificatif.numeroLot ?? "",
      fichierUrl: justificatif.fichierUrl ?? "",
      nomFichier: justificatif.nomFichier ?? "",
      notes: justificatif.notes ?? "",
    } : { ...justificatifAlimentVide, dateDocument: dateISO() })
    setJustificatifFile(null)
    setJustificatifOpen(true)
  }

  async function saveJustificatifAliment(e: React.FormEvent) {
    e.preventDefault()
    setJustificatifLoading(true)
    try {
      let fichierUrl = justificatifForm.fichierUrl
      let nomFichier = justificatifForm.nomFichier
      if (justificatifFile) {
        const uploadBody = new FormData()
        uploadBody.append("file", justificatifFile)
        const uploadResponse = await fetch("/api/upload/justificatif", {
          method: "POST",
          body: uploadBody,
        })
        const uploadPayload = await uploadResponse.json()
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload.error || "Téléversement impossible")
        }
        fichierUrl = uploadPayload.url
        nomFichier = uploadPayload.filename
      }

      const response = await fetch("/api/elevage/justificatifs-aliments", {
        method: justificatifForm.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: justificatifForm.id ?? undefined,
          data: {
            typeDocument: justificatifForm.typeDocument,
            dateDocument: justificatifForm.dateDocument,
            alimentId: justificatifForm.alimentId || null,
            reference: justificatifForm.reference || null,
            fournisseur: justificatifForm.fournisseur || null,
            numeroLot: justificatifForm.numeroLot || null,
            fichierUrl: fichierUrl || null,
            nomFichier: nomFichier || null,
            notes: justificatifForm.notes || null,
          },
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Enregistrement impossible")
      }
      setJustificatifOpen(false)
      await reload()
      toast({
        title: justificatifForm.id
          ? "Justificatif d’aliment mis à jour"
          : "Justificatif d’aliment ajouté au registre",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Justificatif non enregistré",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setJustificatifLoading(false)
    }
  }

  async function changerArchivageJustificatif(
    justificatif: JustificatifAliment,
    archived: boolean,
  ) {
    if (archived && !(await confirmDialog(
      "Archiver ce justificatif ? Le fichier et l’historique seront conservés.",
      { title: "Archiver le justificatif", confirmLabel: "Archiver" },
    ))) return

    const response = await fetch("/api/elevage/justificatifs-aliments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: justificatif.id, archived }),
    })
    const payload = await response.json()
    if (!response.ok) {
      return toast({
        variant: "destructive",
        title: archived ? "Archivage impossible" : "Réactivation impossible",
        description: payload.error,
      })
    }
    await reload()
    toast({ title: archived ? "Justificatif archivé" : "Justificatif réactivé" })
  }

  function ouvrirEquarrissage(justificatif?: JustificatifEquarrissage) {
    setEquarrissageForm(justificatif ? {
      id: justificatif.id,
      typeDocument: justificatif.typeDocument,
      dateEnlevement: justificatif.dateEnlevement.slice(0, 10),
      animalIds: justificatif.animaux.map((lien) => lien.animalId),
      nombreAnimauxNonIdentifies: justificatif.nombreAnimauxNonIdentifies
        ? String(justificatif.nombreAnimauxNonIdentifies)
        : "",
      typeAnimauxNonIdentifies: justificatif.typeAnimauxNonIdentifies ?? "",
      reference: justificatif.reference ?? "",
      prestataire: justificatif.prestataire ?? "",
      fichierUrl: justificatif.fichierUrl ?? "",
      nomFichier: justificatif.nomFichier ?? "",
      notes: justificatif.notes ?? "",
    } : { ...justificatifEquarrissageVide, dateEnlevement: dateISO(), animalIds: [] })
    setEquarrissageFile(null)
    setEquarrissageOpen(true)
  }

  function basculerMortalite(animalId: number, checked: boolean) {
    setEquarrissageForm((form) => ({
      ...form,
      animalIds: checked
        ? [...form.animalIds, animalId]
        : form.animalIds.filter((id) => id !== animalId),
    }))
  }

  async function saveJustificatifEquarrissage(e: React.FormEvent) {
    e.preventDefault()
    setEquarrissageLoading(true)
    try {
      let fichierUrl = equarrissageForm.fichierUrl
      let nomFichier = equarrissageForm.nomFichier
      if (equarrissageFile) {
        const uploadBody = new FormData()
        uploadBody.append("file", equarrissageFile)
        const uploadResponse = await fetch("/api/upload/justificatif", {
          method: "POST",
          body: uploadBody,
        })
        const uploadPayload = await uploadResponse.json()
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload.error || "Téléversement impossible")
        }
        fichierUrl = uploadPayload.url
        nomFichier = uploadPayload.filename
      }

      const response = await fetch("/api/elevage/justificatifs-equarrissage", {
        method: equarrissageForm.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: equarrissageForm.id ?? undefined,
          data: {
            typeDocument: equarrissageForm.typeDocument,
            dateEnlevement: equarrissageForm.dateEnlevement,
            animalIds: equarrissageForm.animalIds,
            nombreAnimauxNonIdentifies:
              Number(equarrissageForm.nombreAnimauxNonIdentifies) || 0,
            typeAnimauxNonIdentifies:
              equarrissageForm.typeAnimauxNonIdentifies || null,
            reference: equarrissageForm.reference || null,
            prestataire: equarrissageForm.prestataire || null,
            fichierUrl: fichierUrl || null,
            nomFichier: nomFichier || null,
            notes: equarrissageForm.notes || null,
          },
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Enregistrement impossible")
      }
      setEquarrissageOpen(false)
      await reload()
      toast({
        title: equarrissageForm.id
          ? "Bon d’équarrissage mis à jour"
          : "Bon d’équarrissage ajouté au registre",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Bon non enregistré",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setEquarrissageLoading(false)
    }
  }

  async function changerArchivageEquarrissage(
    justificatif: JustificatifEquarrissage,
    archived: boolean,
  ) {
    if (archived && !(await confirmDialog(
      "Archiver ce bon ? Le fichier, les rattachements et l’historique seront conservés.",
      { title: "Archiver le bon d’équarrissage", confirmLabel: "Archiver" },
    ))) return

    const response = await fetch("/api/elevage/justificatifs-equarrissage", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: justificatif.id, archived }),
    })
    const payload = await response.json()
    if (!response.ok) {
      return toast({
        variant: "destructive",
        title: archived ? "Archivage impossible" : "Réactivation impossible",
        description: payload.error,
      })
    }
    await reload()
    toast({ title: archived ? "Bon archivé" : "Bon réactivé" })
  }

  async function realisee(p: Prophylaxie) {
    const res = await fetch('/api/elevage/prophylaxies', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, datePrevue: p.datePrevue, dateRealisee: new Date(), statut: 'realisee' }),
    })
    if (res.ok) await reload()
  }

  async function supprimerStock(id: string) {
    const res = await fetch(`/api/elevage/stock-medicaments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) await reload()
  }

  function ouvrirTransmission(declaration: Declaration) {
    setDeclarationSelectionnee(declaration)
    setTransmissionForm({
      transmisAt: dateISO(),
      canalTransmission: "Portail EDE",
      referenceTransmission: "",
      notes: "",
    })
    setTransmissionOpen(true)
  }

  async function enregistrerTransmission(e: React.FormEvent) {
    e.preventDefault()
    if (!declarationSelectionnee) return
    const res = await fetch('/api/elevage/declarations-reglementaires', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: declarationSelectionnee.key,
        year: anneeCourante,
        statut: 'TRANSMISE',
        ...transmissionForm,
      }),
    })
    if (!res.ok) {
      const payload = await res.json()
      return toast({
        variant: 'destructive',
        title: 'Transmission non enregistrée',
        description: payload.error || 'Vérifiez les informations obligatoires.',
      })
    }
    setTransmissionOpen(false)
    await reload()
    toast({ title: 'Transmission réglementaire tracée' })
  }

  async function remettreADeclarer(declaration: Declaration) {
    const res = await fetch('/api/elevage/declarations-reglementaires', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: declaration.key,
        year: anneeCourante,
        statut: 'A_DECLARER',
      }),
    })
    if (!res.ok) {
      return toast({
        variant: 'destructive',
        title: 'Statut non modifié',
        description: (await res.json()).error,
      })
    }
    await reload()
  }

  async function ouvrirCirculation(declaration: Declaration) {
    setCirculationLoading(true)
    setDeclarationSelectionnee(declaration)
    try {
      const query = new URLSearchParams({
        year: String(anneeCourante),
        key: declaration.key,
      })
      const res = await fetch(
        `/api/elevage/declarations-reglementaires/document-circulation?${query}`,
      )
      const payload = await res.json()
      if (!res.ok) {
        return toast({
          variant: "destructive",
          title: "Préparation indisponible",
          description: payload.error,
        })
      }
      setCirculationForm(Object.fromEntries(
        Object.keys(preparationCirculationVide).map((key) => [
          key,
          payload.preparation[key] ?? "",
        ]),
      ) as unknown as PreparationCirculation)
      setCirculationAnomalies(payload.anomalies)
      setCirculationOpen(true)
    } finally {
      setCirculationLoading(false)
    }
  }

  async function enregistrerCirculation(e: React.FormEvent) {
    e.preventDefault()
    if (!declarationSelectionnee) return
    setCirculationLoading(true)
    try {
      const res = await fetch(
        "/api/elevage/declarations-reglementaires/document-circulation",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: declarationSelectionnee.key,
            year: anneeCourante,
            ...circulationForm,
          }),
        },
      )
      const payload = await res.json()
      if (!res.ok) {
        return toast({
          variant: "destructive",
          title: "Préparation non enregistrée",
          description: payload.error,
        })
      }
      setCirculationAnomalies(payload.anomalies)
      toast({
        title: payload.pret ? "Préparation complète" : "Préparation enregistrée avec des manques",
        description: payload.pret
          ? "Le PDF peut être reporté sur le modèle officiel de l’EDE."
          : "Les éléments restant à renseigner sont affichés dans le formulaire.",
      })
    } finally {
      setCirculationLoading(false)
    }
  }

  async function chargerHistorique(cle: string, titre: string) {
    setHistoriqueTitre(titre)
    setHistoriqueLoading(true)
    setHistoriqueOpen(true)
    try {
      const res = await fetch(
        `/api/elevage/declarations-reglementaires/historique?key=${encodeURIComponent(cle)}`,
      )
      const payload = await res.json()
      if (!res.ok) {
        setHistorique([])
        return toast({
          variant: "destructive",
          title: "Historique indisponible",
          description: payload.error,
        })
      }
      setHistorique(payload.data)
    } finally {
      setHistoriqueLoading(false)
    }
  }

  async function ouvrirHistorique(declaration: Declaration) {
    setDeclarationSelectionnee(declaration)
    await chargerHistorique(declaration.key, declaration.libelle)
  }

  const lienPdfCirculation = declarationSelectionnee
    ? `/api/elevage/declarations-reglementaires/document-circulation?${new URLSearchParams({
        year: String(anneeCourante),
        key: declarationSelectionnee.key,
        format: "pdf",
      })}`
    : "#"

  const produitsFiltres = codesFiliere
    ? produits.filter((p) => (p.especesCibles ?? []).some((c) => codesFiliere.includes(c)))
    : produits
  const mortaliteIdsCouvertes = new Set(
    justificatifsEquarrissage
      .filter((justificatif) => !justificatif.archivedAt)
      .flatMap((justificatif) => justificatif.animaux.map((lien) => lien.animalId)),
  )
  const mortalitesSansBon = mortalites.filter(
    (mortalite) => !mortaliteIdsCouvertes.has(mortalite.id),
  )

  return <div className="space-y-4">
    {/* Registres BDNI / inventaire du cheptel : documents de rente. */}
    {caps.productionRente && (
      <div className="flex flex-wrap items-end gap-2">
        <Button asChild><a href={`/api/elevage/registre-elevage-complet?year=${new Date().getFullYear()}`}><Download className="h-4 w-4 mr-2" />Registre complet PDF</a></Button>
        <Button
          variant="secondary"
          onClick={() => void archiverRegistreComplet()}
          disabled={archivageLoading}
        >
          {archivageLoading
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Archive className="h-4 w-4 mr-2" />}
          {archivageLoading ? "Archivage…" : "Archiver le dossier ZIP"}
        </Button>
        <Button asChild variant="outline">
          <a href="/parametres/exploitation/cadre-reglementaire">Cadre de l’exploitation</a>
        </Button>
        <div className="min-w-40 space-y-1">
          <Label htmlFor="inventaire-date" className="text-xs text-muted-foreground">Inventaire au</Label>
          <Input
            id="inventaire-date"
            type="date"
            max={dateISO()}
            value={inventaireDate}
            onChange={(event) => setInventaireDate(event.target.value)}
          />
        </div>
        <Button asChild variant="outline">
          <a href={`/api/elevage/inventaire-cheptel?date=${inventaireDate}&format=pdf`}>
            <Download className="h-4 w-4 mr-2" />Inventaire PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/elevage/inventaire-cheptel?date=${inventaireDate}&format=csv`}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />Inventaire CSV
          </a>
        </Button>
        <Button asChild variant="outline"><a href={`/api/elevage/registre-sanitaire?year=${new Date().getFullYear()}`}><Download className="h-4 w-4 mr-2" />Registre sanitaire PDF</a></Button>
        <Button asChild variant="outline"><a href={`/api/elevage/registre-elevage?year=${new Date().getFullYear()}`}><Download className="h-4 w-4 mr-2" />Registre d’élevage PDF</a></Button>
      </div>
    )}

    {caps.productionRente && (
      <SyntheseSanitaireCheptel />
    )}

    {caps.productionRente && (
      <Card>
        <CardHeader>
          <CardTitle>Archives du registre {anneeCourante}</CardTitle>
          <CardDescription>
            Copies immuables conservées dans l’espace privé avec empreinte SHA-256,
            manifeste et annexes disponibles au moment de la génération.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {archivesRegistre.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Aucune archive figée pour {anneeCourante}. Le PDF seul n’incorpore pas
              les justificatifs : utilisez « Archiver le dossier ZIP » pour créer
              une copie durable.
            </div>
          )}
          {archivesRegistre.map((archive) => (
            <div
              key={archive.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="font-medium">
                  Générée le {new Date(archive.genereLe).toLocaleString("fr-FR")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {archive.annexesIncluses} annexe(s) incorporée(s)
                  {archive.annexesSignalees > 0
                    ? ` · ${archive.annexesSignalees} pièce(s) à vérifier`
                    : " · intégrité documentaire sans anomalie"}
                  {" · "}
                  {(archive.tailleOctets / 1024 / 1024).toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })} Mo
                </div>
                <div className="break-all font-mono text-xs text-muted-foreground">
                  SHA-256 {archive.archiveSha256}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={`/api/elevage/registres-archives/${archive.id}`}>
                  <Download className="mr-1 h-4 w-4" />Télécharger
                </a>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    )}

    {caps.productionRente && (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Déclarations réglementaires</CardTitle>
            <CardDescription>
              Préparation assistée des notifications bovines et des mouvements ovins/caprins.
              Gleba ne transmet pas encore directement aux bases officielles.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`/api/elevage/declarations-reglementaires/export?year=${anneeCourante}`}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />Export CSV
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => void reload()} disabled={declarationsLoading}>
              <RotateCcw className={`mr-1 h-4 w-4 ${declarationsLoading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {declarationResume && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">À compléter</div><div className="text-xl font-semibold">{declarationResume.aCompleter}</div></div>
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">À déclarer</div><div className="text-xl font-semibold">{declarationResume.aDeclarer}</div></div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3"><div className="text-red-700">Hors délai</div><div className="text-xl font-semibold text-red-800">{declarationResume.horsDelai}</div></div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3"><div className="text-green-700">Exportées</div><div className="text-xl font-semibold text-green-800">{declarationResume.transmises}</div></div>
            </div>
          )}

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="mb-2">
              <div className="font-medium text-blue-950">Numéro d’exploitation / EDE</div>
              <div className="text-xs text-blue-800">
                Corrigez ce prérequis ici : les événements sont recalculés sans quitter le registre.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={numeroEde}
                onChange={(event) => setNumeroEde(event.target.value)}
                placeholder="N° attribué par l’EDE"
                maxLength={40}
                className="bg-white sm:max-w-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => void enregistrerNumeroEde()}
                disabled={numeroEdeSaving || !numeroEde.trim()}
              >
                {numeroEdeSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                Enregistrer
              </Button>
            </div>
          </div>

          {declarationsLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Analyse des événements d’élevage…
            </div>
          )}
          {!declarationsLoading && declarations.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Aucune naissance, entrée, sortie ou mortalité couverte sur {anneeCourante}.
            </div>
          )}
          {!declarationsLoading && declarations.map((declaration) => {
            const finalisee = ["TRANSMISE", "ACCEPTEE"].includes(declaration.statut)
            const circulation =
              ["OVIN", "CAPRIN"].includes(declaration.categorie)
              && ["ENTREE", "SORTIE"].includes(declaration.type)
            const badgeVariant =
              declaration.statut === "HORS_DELAI" || declaration.statut === "REJETEE"
                ? "destructive"
                : finalisee ? "default" : "secondary"
            return (
              <div key={declaration.key} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{declaration.libelle}</span>
                      <Badge variant={badgeVariant}>{statutDeclarationLabel[declaration.statut]}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Événement le {new Date(declaration.dateEvenement).toLocaleDateString('fr-FR')}
                      {' · '}échéance le {new Date(declaration.dateEcheance).toLocaleDateString('fr-FR')}
                      {' · '}{declaration.organisme}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {circulation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void ouvrirCirculation(declaration)}
                        disabled={circulationLoading}
                      >
                        <FileText className="mr-1 h-4 w-4" />Préparer circulation
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void ouvrirHistorique(declaration)}
                    >
                      <History className="mr-1 h-4 w-4" />Historique
                    </Button>
                    {declaration.anomalies.length > 0 && (
                      <Button asChild size="sm" variant="outline">
                        <a href={declaration.sourceUrl}>Corriger la source</a>
                      </Button>
                    )}
                    {!finalisee && declaration.statut !== "ANNULEE" && declaration.anomalies.length === 0 && (
                      <Button size="sm" onClick={() => ouvrirTransmission(declaration)}>
                        <Send className="mr-1 h-4 w-4" />Marquer exportée
                      </Button>
                    )}
                    {(finalisee || declaration.statut === "REJETEE") && (
                      <Button size="sm" variant="outline" onClick={() => void remettreADeclarer(declaration)}>
                        <RotateCcw className="mr-1 h-4 w-4" />Remettre à faire
                      </Button>
                    )}
                  </div>
                </div>

                {declaration.anomalies.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Informations à compléter</div>
                    <ul className="list-disc space-y-1 pl-5">
                      {declaration.anomalies.map((anomalie) => <li key={anomalie}>{anomalie}</li>)}
                    </ul>
                  </div>
                )}
                {declaration.modifieeApresTransmission && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    Les données source ont changé après la transmission. Vérifiez si une rectification officielle est nécessaire.
                  </div>
                )}
                {declaration.transmisAt && (
                  <div className="text-sm text-muted-foreground">
                    Transmise le {new Date(declaration.transmisAt).toLocaleDateString('fr-FR')}
                    {declaration.canalTransmission ? ` via ${declaration.canalTransmission}` : ''}
                    {declaration.referenceTransmission ? ` · preuve ${declaration.referenceTransmission}` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    )}

    <Dialog open={transmissionOpen} onOpenChange={setTransmissionOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tracer la transmission</DialogTitle>
          <DialogDescription>
            Enregistrez la preuve obtenue après l’envoi officiel. Cette action ne transmet aucune donnée à l’EDE.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enregistrerTransmission} className="space-y-3">
          <div><Label>Déclaration</Label><Input value={declarationSelectionnee?.libelle || ''} disabled /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date d’envoi</Label><Input required type="date" value={transmissionForm.transmisAt} onChange={e => setTransmissionForm(f => ({ ...f, transmisAt: e.target.value }))} /></div>
            <div><Label>Canal</Label><Select value={transmissionForm.canalTransmission} onValueChange={v => setTransmissionForm(f => ({ ...f, canalTransmission: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Portail EDE">Portail EDE</SelectItem><SelectItem value="Courriel">Courriel</SelectItem><SelectItem value="Courrier">Courrier</SelectItem><SelectItem value="Autre">Autre</SelectItem></SelectContent></Select></div>
          </div>
          <div><Label>Référence ou preuve</Label><Input required value={transmissionForm.referenceTransmission} onChange={e => setTransmissionForm(f => ({ ...f, referenceTransmission: e.target.value }))} placeholder="Accusé, bordereau, nom du fichier…" /></div>
          <div><Label>Notes</Label><Textarea value={transmissionForm.notes} onChange={e => setTransmissionForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <Button type="submit">Enregistrer la transmission</Button>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={circulationOpen} onOpenChange={setCirculationOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Préparer le document de circulation</DialogTitle>
          <DialogDescription>
            Cette fiche rassemble les données à reporter sur le modèle officiel fourni par l’EDE.
            Elle ne remplace ni ce modèle, ni sa signature, ni la notification du mouvement.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enregistrerCirculation} className="space-y-4">
          <div>
            <Label>Mouvement</Label>
            <Input value={declarationSelectionnee?.libelle || ""} disabled />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>N° du document EDE</Label>
              <Input
                value={circulationForm.numeroDocumentEde}
                onChange={(event) => setCirculationForm((form) => ({ ...form, numeroDocumentEde: event.target.value }))}
                placeholder="Si préimprimé ou attribué"
              />
            </div>
            <div>
              <Label>Type d’exploitation EDE</Label>
              <Input
                value={circulationForm.typeExploitationEde}
                onChange={(event) => setCirculationForm((form) => ({ ...form, typeExploitationEde: event.target.value }))}
                placeholder="Exploitation d’élevage…"
              />
            </div>
            <div>
              <Label>Catégorie des animaux</Label>
              <Select
                value={circulationForm.categorieAnimaux}
                onValueChange={(value) => setCirculationForm((form) => ({ ...form, categorieAnimaux: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NON_DEROGATAIRES">Non dérogataires</SelectItem>
                  <SelectItem value="BOUCHERIE_DEROGATAIRES">Boucherie dérogataires</SelectItem>
                  <SelectItem value="MIXTE">Mouvement mixte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Identifiants ou indicatifs de marquage complémentaires</Label>
            <Input
              value={circulationForm.indicatifsMarquage}
              onChange={(event) => setCirculationForm((form) => ({ ...form, indicatifsMarquage: event.target.value }))}
              placeholder="Séparer les valeurs par une virgule"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nom du détenteur tiers</Label>
              <Input
                value={circulationForm.tiersNom}
                onChange={(event) => setCirculationForm((form) => ({ ...form, tiersNom: event.target.value }))}
              />
            </div>
            <div>
              <Label>N° EDE du tiers</Label>
              <Input
                value={circulationForm.tiersNumeroEde}
                onChange={(event) => setCirculationForm((form) => ({ ...form, tiersNumeroEde: event.target.value }))}
              />
            </div>
            <div>
              <Label>SIREN du tiers</Label>
              <Input
                inputMode="numeric"
                value={circulationForm.tiersSiren}
                onChange={(event) => setCirculationForm((form) => ({ ...form, tiersSiren: event.target.value }))}
              />
            </div>
            <div>
              <Label>Agrément sanitaire de destination</Label>
              <Input
                value={circulationForm.numeroAgrementSanitaire}
                onChange={(event) => setCirculationForm((form) => ({ ...form, numeroAgrementSanitaire: event.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Adresse du tiers</Label>
            <Input
              value={circulationForm.tiersAdresse}
              onChange={(event) => setCirculationForm((form) => ({ ...form, tiersAdresse: event.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Transporteur</Label>
              <Input
                value={circulationForm.transporteurNom}
                onChange={(event) => setCirculationForm((form) => ({ ...form, transporteurNom: event.target.value }))}
              />
            </div>
            <div>
              <Label>N° transporteur</Label>
              <Input
                value={circulationForm.numeroTransporteur}
                onChange={(event) => setCirculationForm((form) => ({ ...form, numeroTransporteur: event.target.value }))}
              />
            </div>
            <div>
              <Label>Immatriculation du véhicule</Label>
              <Input
                value={circulationForm.immatriculationVehicule}
                onChange={(event) => setCirculationForm((form) => ({ ...form, immatriculationVehicule: event.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Contact au départ</Label>
              <Input
                value={circulationForm.contactDepart}
                onChange={(event) => setCirculationForm((form) => ({ ...form, contactDepart: event.target.value }))}
              />
            </div>
            <div>
              <Label>Contact à l’arrivée</Label>
              <Input
                value={circulationForm.contactArrivee}
                onChange={(event) => setCirculationForm((form) => ({ ...form, contactArrivee: event.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Motif du mouvement</Label>
            <Input
              value={circulationForm.motifMouvement}
              onChange={(event) => setCirculationForm((form) => ({ ...form, motifMouvement: event.target.value }))}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={circulationForm.notes}
              onChange={(event) => setCirculationForm((form) => ({ ...form, notes: event.target.value }))}
            />
          </div>
          {circulationAnomalies.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />Éléments restant à compléter
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {circulationAnomalies.map((anomalie) => <li key={anomalie}>{anomalie}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={circulationLoading}>
              {circulationLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Enregistrer la préparation
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={lienPdfCirculation}>
                <Download className="mr-1 h-4 w-4" />Télécharger la fiche PDF
              </a>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={historiqueOpen} onOpenChange={setHistoriqueOpen}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique réglementaire</DialogTitle>
          <DialogDescription>
            {historiqueTitre || declarationSelectionnee?.libelle || "Élément réglementaire"} · journal append-only des actions enregistrées.
          </DialogDescription>
        </DialogHeader>
        {historiqueLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Chargement…
          </div>
        )}
        {!historiqueLoading && historique.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            Aucune action persistée pour cette déclaration.
          </div>
        )}
        {!historiqueLoading && historique.map((evenement) => (
          <div key={evenement.id} className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {actionReglementaireLabel[evenement.action] || evenement.action}
              </span>
              <span className="text-muted-foreground">
                {new Date(evenement.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            {(evenement.statutAvant || evenement.statutApres) && (
              <div className="mt-1 text-muted-foreground">
                {evenement.statutAvant || "—"} → {evenement.statutApres || "—"}
              </div>
            )}
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              Auteur {evenement.actorLabel}
              {evenement.snapshotHash ? ` · empreinte ${evenement.snapshotHash.slice(0, 12)}…` : ""}
            </div>
          </div>
        ))}
      </DialogContent>
    </Dialog>

    {caps.productionRente && (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Mortalités et équarrissage</CardTitle>
            <CardDescription>
              Bons d’enlèvement rattachés aux animaux morts ou à un effectif collectif non identifié.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => ouvrirEquarrissage()}>
            <Plus className="mr-1 h-4 w-4" />Bon d’enlèvement
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {mortalitesSansBon.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {mortalitesSansBon.length} mortalité(s) individuelle(s) sans bon actif en {anneeCourante}
              </div>
              <p className="mt-1">
                Ajoutez le bon reçu ou sa référence de classement pour compléter le registre.
              </p>
            </div>
          )}
          {justificatifsEquarrissage.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Aucun bon d’enlèvement référencé pour {anneeCourante}.
            </div>
          )}
          {justificatifsEquarrissage.map((justificatif) => {
            const cibles = justificatif.animaux.map(({ animal }) =>
              animal.identifiant || animal.nom || `Animal #${animal.id}`
            )
            if (justificatif.nombreAnimauxNonIdentifies > 0) {
              cibles.push(
                `${justificatif.nombreAnimauxNonIdentifies} × ${justificatif.typeAnimauxNonIdentifies || "animaux non identifiés"}`,
              )
            }
            return (
              <div
                key={justificatif.id}
                className={`rounded-xl border p-4 ${justificatif.archivedAt ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE[justificatif.typeDocument]}
                      </span>
                      <Badge variant="secondary">
                        {new Date(justificatif.dateEnlevement).toLocaleDateString("fr-FR")}
                      </Badge>
                      {justificatif.archivedAt && <Badge variant="outline">Archivé</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cibles.join(" · ") || "Aucune mortalité rattachée"}
                      {justificatif.prestataire ? ` · ${justificatif.prestataire}` : ""}
                    </p>
                    {justificatif.reference && (
                      <p className="text-sm">Référence : {justificatif.reference}</p>
                    )}
                    {justificatif.empreinteSha256 && (
                      <p className="font-mono text-xs text-muted-foreground">
                        SHA-256 {justificatif.empreinteSha256.slice(0, 16)}…
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {justificatif.fichierUrl && (
                      <Button asChild size="sm" variant="outline">
                        <a href={justificatif.fichierUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-4 w-4" />
                          {justificatif.nomFichier || "Ouvrir"}
                        </a>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => ouvrirEquarrissage(justificatif)}
                      aria-label="Modifier le bon d’équarrissage"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void chargerHistorique(
                        `justificatif-equarrissage:${justificatif.id}`,
                        `${LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE[justificatif.typeDocument]} ${justificatif.reference || ""}`.trim(),
                      )}
                      aria-label="Historique du bon d’équarrissage"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => void changerArchivageEquarrissage(
                        justificatif,
                        !justificatif.archivedAt,
                      )}
                      aria-label={justificatif.archivedAt ? "Réactiver le bon" : "Archiver le bon"}
                    >
                      {justificatif.archivedAt
                        ? <RotateCcw className="h-4 w-4" />
                        : <Archive className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    )}

    <Dialog open={equarrissageOpen} onOpenChange={setEquarrissageOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {equarrissageForm.id ? "Modifier le bon d’équarrissage" : "Ajouter un bon d’enlèvement"}
          </DialogTitle>
          <DialogDescription>
            Un même bon peut couvrir plusieurs animaux. Le fichier reste privé et son empreinte est recalculée depuis la copie serveur.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveJustificatifEquarrissage} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type de preuve</Label>
              <Select
                value={equarrissageForm.typeDocument}
                onValueChange={(value) => setEquarrissageForm((form) => ({
                  ...form,
                  typeDocument: value as TypeJustificatifEquarrissage,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_JUSTIFICATIF_EQUARRISSAGE.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LABELS_TYPE_JUSTIFICATIF_EQUARRISSAGE[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="equarrissage-date">Date d’enlèvement *</Label>
              <Input
                id="equarrissage-date"
                required
                type="date"
                value={equarrissageForm.dateEnlevement}
                onChange={(event) => setEquarrissageForm((form) => ({
                  ...form,
                  dateEnlevement: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equarrissage-reference">Référence / classement</Label>
              <Input
                id="equarrissage-reference"
                required={!equarrissageForm.fichierUrl && !equarrissageFile}
                value={equarrissageForm.reference}
                onChange={(event) => setEquarrissageForm((form) => ({
                  ...form,
                  reference: event.target.value,
                }))}
                placeholder="N° du bon ou classeur papier"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equarrissage-prestataire">Prestataire</Label>
              <Input
                id="equarrissage-prestataire"
                value={equarrissageForm.prestataire}
                onChange={(event) => setEquarrissageForm((form) => ({
                  ...form,
                  prestataire: event.target.value,
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mortalités individuelles de {anneeCourante}</Label>
            <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">
              {mortalites.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucune mortalité individuelle enregistrée cette année.
                </p>
              )}
              {mortalites.map((mortalite) => {
                const id = `equarrissage-animal-${mortalite.id}`
                return (
                  <label key={mortalite.id} htmlFor={id} className="flex items-start gap-3 text-sm">
                    <Checkbox
                      id={id}
                      checked={equarrissageForm.animalIds.includes(mortalite.id)}
                      onCheckedChange={(checked) =>
                        basculerMortalite(mortalite.id, checked === true)
                      }
                    />
                    <span>
                      <span className="font-medium">
                        {mortalite.identifiant || mortalite.nom || `Animal #${mortalite.id}`}
                      </span>
                      {" · "}{mortalite.especeAnimale.nom}
                      {" · "}{new Date(mortalite.dateSortie).toLocaleDateString("fr-FR")}
                      {mortalite.causeSortie ? ` · ${mortalite.causeSortie}` : ""}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="equarrissage-nombre">Animaux non identifiés</Label>
              <Input
                id="equarrissage-nombre"
                type="number"
                min="0"
                step="1"
                value={equarrissageForm.nombreAnimauxNonIdentifies}
                onChange={(event) => setEquarrissageForm((form) => ({
                  ...form,
                  nombreAnimauxNonIdentifies: event.target.value,
                }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="equarrissage-type-animaux">Type, espèce ou lot</Label>
              <Input
                id="equarrissage-type-animaux"
                required={Number(equarrissageForm.nombreAnimauxNonIdentifies) > 0}
                value={equarrissageForm.typeAnimauxNonIdentifies}
                onChange={(event) => setEquarrissageForm((form) => ({
                  ...form,
                  typeAnimauxNonIdentifies: event.target.value,
                }))}
                placeholder="Ex. 15 volailles · lot L-2026-03"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equarrissage-file">Bon PDF ou image</Label>
            <Input
              id="equarrissage-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setEquarrissageFile(event.target.files?.[0] ?? null)}
            />
            {(equarrissageFile || equarrissageForm.fichierUrl) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <span>{equarrissageFile?.name || equarrissageForm.nomFichier}</span>
                {equarrissageForm.fichierUrl && !equarrissageFile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEquarrissageForm((form) => ({
                      ...form,
                      fichierUrl: "",
                      nomFichier: "",
                    }))}
                  >
                    Dissocier du registre
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              PDF, JPEG ou PNG · 10 Mo maximum. L’original papier reste à conserver selon les obligations applicables.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="equarrissage-notes">Notes</Label>
            <Textarea
              id="equarrissage-notes"
              value={equarrissageForm.notes}
              onChange={(event) => setEquarrissageForm((form) => ({
                ...form,
                notes: event.target.value,
              }))}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEquarrissageOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={equarrissageLoading}>
              {equarrissageLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Enregistrer dans le registre
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    {caps.productionRente && (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Justificatifs d’alimentation</CardTitle>
            <CardDescription>
              Factures, bons, étiquettes et fiches techniques référencés dans le registre de {anneeCourante}.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => ouvrirJustificatif()}>
            <Plus className="mr-1 h-4 w-4" />Justificatif
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {justificatifsAliments.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
              Aucun justificatif d’aliment référencé pour {anneeCourante}.
            </div>
          )}
          {justificatifsAliments.map((justificatif) => (
            <div
              key={justificatif.id}
              className={`rounded-xl border p-4 ${justificatif.archivedAt ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {LABELS_TYPE_JUSTIFICATIF_ALIMENT[justificatif.typeDocument]}
                    </span>
                    <Badge variant="secondary">
                      {new Date(justificatif.dateDocument).toLocaleDateString("fr-FR")}
                    </Badge>
                    {justificatif.archivedAt && <Badge variant="outline">Archivé</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {justificatif.aliment?.nom || "Aliment non rattaché"}
                    {justificatif.numeroLot ? ` · lot ${justificatif.numeroLot}` : ""}
                    {justificatif.fournisseur ? ` · ${justificatif.fournisseur}` : ""}
                  </p>
                  {justificatif.reference && (
                    <p className="text-sm">Référence : {justificatif.reference}</p>
                  )}
                  {justificatif.empreinteSha256 && (
                    <p className="font-mono text-xs text-muted-foreground">
                      SHA-256 {justificatif.empreinteSha256.slice(0, 16)}…
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {justificatif.fichierUrl && (
                    <Button asChild size="sm" variant="outline">
                      <a href={justificatif.fichierUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        {justificatif.nomFichier || "Ouvrir"}
                      </a>
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => ouvrirJustificatif(justificatif)}
                    aria-label="Modifier le justificatif"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void chargerHistorique(
                      `justificatif-aliment:${justificatif.id}`,
                      `${LABELS_TYPE_JUSTIFICATIF_ALIMENT[justificatif.typeDocument]} ${justificatif.reference || justificatif.nomFichier || ""}`.trim(),
                    )}
                    aria-label="Historique du justificatif"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void changerArchivageJustificatif(
                      justificatif,
                      !justificatif.archivedAt,
                    )}
                    aria-label={justificatif.archivedAt ? "Réactiver le justificatif" : "Archiver le justificatif"}
                  >
                    {justificatif.archivedAt
                      ? <RotateCcw className="h-4 w-4" />
                      : <Archive className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )}

    <Dialog open={justificatifOpen} onOpenChange={setJustificatifOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {justificatifForm.id ? "Modifier le justificatif d’aliment" : "Ajouter un justificatif d’aliment"}
          </DialogTitle>
          <DialogDescription>
            Le fichier reste privé. Gleba en calcule l’empreinte SHA-256 et conserve les modifications dans le journal réglementaire.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveJustificatifAliment} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type de document</Label>
              <Select
                value={justificatifForm.typeDocument}
                onValueChange={(value) => setJustificatifForm((form) => ({
                  ...form,
                  typeDocument: value as TypeJustificatifAliment,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_JUSTIFICATIF_ALIMENT.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LABELS_TYPE_JUSTIFICATIF_ALIMENT[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificatif-date">Date du document *</Label>
              <Input
                id="justificatif-date"
                required
                type="date"
                value={justificatifForm.dateDocument}
                onChange={(event) => setJustificatifForm((form) => ({
                  ...form,
                  dateDocument: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Aliment</Label>
              <Select
                value={justificatifForm.alimentId || "__none"}
                onValueChange={(value) => setJustificatifForm((form) => ({
                  ...form,
                  alimentId: value === "__none" ? "" : value,
                }))}
              >
                <SelectTrigger><SelectValue placeholder="Non rattaché" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Non rattaché / plusieurs aliments</SelectItem>
                  {aliments.map((aliment) => (
                    <SelectItem key={aliment.id} value={aliment.id}>{aliment.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificatif-lot">N° de lot de l’aliment</Label>
              <Input
                id="justificatif-lot"
                value={justificatifForm.numeroLot}
                onChange={(event) => setJustificatifForm((form) => ({
                  ...form,
                  numeroLot: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificatif-fournisseur">Fournisseur</Label>
              <Input
                id="justificatif-fournisseur"
                value={justificatifForm.fournisseur}
                onChange={(event) => setJustificatifForm((form) => ({
                  ...form,
                  fournisseur: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="justificatif-reference">Référence / classement</Label>
              <Input
                id="justificatif-reference"
                required={!justificatifForm.fichierUrl && !justificatifFile}
                value={justificatifForm.reference}
                onChange={(event) => setJustificatifForm((form) => ({
                  ...form,
                  reference: event.target.value,
                }))}
                placeholder="N° facture ou classeur papier"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="justificatif-file">Fichier PDF ou image</Label>
            <Input
              id="justificatif-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setJustificatifFile(event.target.files?.[0] ?? null)}
            />
            {(justificatifFile || justificatifForm.fichierUrl) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <span>{justificatifFile?.name || justificatifForm.nomFichier}</span>
                {justificatifForm.fichierUrl && !justificatifFile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setJustificatifForm((form) => ({
                      ...form,
                      fichierUrl: "",
                      nomFichier: "",
                    }))}
                  >
                    Dissocier du registre
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Formats acceptés : PDF, JPEG, PNG · 10 Mo maximum. Une copie papier reste à conserver selon les obligations applicables.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="justificatif-notes">Notes</Label>
            <Textarea
              id="justificatif-notes"
              value={justificatifForm.notes}
              onChange={(event) => setJustificatifForm((form) => ({
                ...form,
                notes: event.target.value,
              }))}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setJustificatifOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={justificatifLoading}>
              {justificatifLoading
                ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                : <Upload className="mr-1 h-4 w-4" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle>Pharmacie d’élevage</CardTitle><CardDescription>Lots, quantités, péremptions et lien vers l’ordonnance.</CardDescription></div>
        <Dialog open={stockOpen} onOpenChange={setStockOpen}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Stock</Button></DialogTrigger><DialogContent>
          <DialogHeader><DialogTitle>Enregistrer un lot de médicament</DialogTitle><DialogDescription>Les produits proviennent du référentiel vétérinaire Gleba.</DialogDescription></DialogHeader>
          <form onSubmit={saveStock} className="space-y-3">
            <div><Label>Produit</Label><Select value={stockForm.produitId} onValueChange={(v) => setStockForm(f => ({ ...f, produitId: v }))}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{produitsFiltres.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}{p.amm ? ` · ${p.amm}` : ''}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>N° lot</Label><Input required value={stockForm.numeroLot} onChange={e => setStockForm(f => ({ ...f, numeroLot: e.target.value }))} /></div><div><Label>Péremption</Label><Input type="date" value={stockForm.datePeremption} onChange={e => setStockForm(f => ({ ...f, datePeremption: e.target.value }))} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Quantité</Label><Input required type="number" min="0" step="any" value={stockForm.quantite} onChange={e => setStockForm(f => ({ ...f, quantite: e.target.value }))} /></div><div><Label>Unité</Label><Input required value={stockForm.unite} onChange={e => setStockForm(f => ({ ...f, unite: e.target.value }))} /></div></div>
            <div><Label>URL ordonnance</Label><Input type="url" value={stockForm.ordonnanceUrl} onChange={e => setStockForm(f => ({ ...f, ordonnanceUrl: e.target.value }))} /></div>
            <Button type="submit" disabled={!stockForm.produitId}>Enregistrer</Button>
          </form>
        </DialogContent></Dialog>
      </CardHeader>
      <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Produit</TableHead><TableHead>Lot</TableHead><TableHead>Stock</TableHead><TableHead>Péremption</TableHead><TableHead>Ordonnance</TableHead><TableHead /></TableRow></TableHeader><TableBody>
        {stocks.map(s => { const expire = s.datePeremption && new Date(s.datePeremption) < new Date(); return <TableRow key={s.id}><TableCell>{s.produit?.nom || s.produitId}</TableCell><TableCell>{s.numeroLot}</TableCell><TableCell>{s.quantite} {s.unite}</TableCell><TableCell className={expire ? 'text-red-700 font-medium' : ''}>{s.datePeremption ? new Date(s.datePeremption).toLocaleDateString('fr-FR') : '—'} {expire && <AlertTriangle className="inline h-4 w-4" />}</TableCell><TableCell>{s.ordonnanceUrl ? <a className="underline" href={s.ordonnanceUrl} target="_blank" rel="noreferrer">Ouvrir</a> : '—'}</TableCell><TableCell><Button size="icon" variant="ghost" onClick={() => supprimerStock(s.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow> })}
        {!stocks.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Pharmacie non inventoriée</TableCell></TableRow>}
      </TableBody></Table></div></CardContent>
    </Card>

    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>{caps.productionRente ? "Prophylaxies et contrôles" : "Rappels sanitaires & contrôles"}</CardTitle><CardDescription>{caps.productionRente ? "Échéances réglementaires, visites et dépistages." : "Rappels de vaccination, vermifuge et visites vétérinaires."}</CardDescription></div>
      <Dialog open={proOpen} onOpenChange={setProOpen}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Échéance</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Planifier une prophylaxie</DialogTitle></DialogHeader><form onSubmit={savePro} className="space-y-3"><div><Label>Type</Label><Input required value={proForm.type} onChange={e => setProForm(f => ({ ...f, type: e.target.value }))} placeholder={caps.productionRente ? "Brucellose, visite sanitaire…" : "Vaccination, vermifuge, visite véto…"} /></div><div><Label>Date prévue</Label><Input required type="date" value={proForm.datePrevue} onChange={e => setProForm(f => ({ ...f, datePrevue: e.target.value }))} /></div><div><Label>Organisme / vétérinaire</Label><Input value={proForm.organisme} onChange={e => setProForm(f => ({ ...f, organisme: e.target.value }))} /></div><div><Label>Notes</Label><Textarea value={proForm.notes} onChange={e => setProForm(f => ({ ...f, notes: e.target.value }))} /></div><Button type="submit">Planifier</Button></form></DialogContent></Dialog>
    </CardHeader><CardContent className="space-y-2">{prophylaxies.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><div className="font-medium">{p.type}</div><div className="text-sm text-muted-foreground">{new Date(p.datePrevue).toLocaleDateString('fr-FR')} · {p.organisme || 'organisme à préciser'}</div></div><div className="flex items-center gap-2"><Badge variant={p.statut === 'realisee' ? 'default' : 'secondary'}>{p.statut === 'realisee' ? 'Réalisée' : 'À faire'}</Badge>{p.statut !== 'realisee' && <Button size="sm" variant="outline" onClick={() => realisee(p)}><Check className="h-4 w-4 mr-1" />Réalisée</Button>}</div></div>)}{!prophylaxies.length && <p className="text-center text-muted-foreground py-8">Aucune prophylaxie planifiée</p>}</CardContent></Card>
  </div>
}
