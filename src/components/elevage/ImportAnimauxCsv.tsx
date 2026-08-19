"use client"

import * as React from "react"
import { AlertTriangle, Download, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  ANIMAUX_CSV_COLUMNS, apparierIdentifiantMasque, cleCanonique, csvRowToAnimal,
  csvRowToAnimalUpdate, indexerIdentifiantsMasques, parseAnimauxCsv, problemesLigne,
  resoudreEspece, suggererEspece,
  type AnimalCsvRow, type EspeceOption,
} from "@/lib/elevage/import-animaux"
import { ORIENTATIONS_PRODUCTION, type OrientationProduction } from "@/lib/validations/elevage-animal"

type AnimalExistant = { id: number; identifiant: string | null }

const LIBELLES_ORIENTATION: Record<OrientationProduction, string> = {
  lait: "Lait", viande: "Viande", laine: "Laine", mixte: "Mixte",
}

export function ImportAnimauxCsv({ especes, animauxExistants, onImported }: {
  especes: EspeceOption[]
  animauxExistants: AnimalExistant[]
  onImported: () => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [rows, setRows] = React.useState<AnimalCsvRow[]>([])
  const [entetesIgnores, setEntetesIgnores] = React.useState<string[]>([])
  const [fileName, setFileName] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [modeMaj, setModeMaj] = React.useState(false)
  // Le parent ne transmet que les animaux du filtre de statut affiché : un animal
  // vendu ou abattu en était absent, donc invisible à la détection de doublon.
  // L'appariement doit voir TOUT le cheptel, on le recharge sans filtre.
  const [cheptelComplet, setCheptelComplet] = React.useState<AnimalExistant[] | null>(null)
  React.useEffect(() => {
    if (!open) return
    let annule = false
    ;(async () => {
      try {
        const res = await fetch('/api/elevage/animaux')
        if (!res.ok) return
        const json = await res.json()
        if (!annule) {
          setCheptelComplet((json.data as AnimalExistant[]).map((a) => ({ id: a.id, identifiant: a.identifiant })))
        }
      } catch {
        // On retombe sur la liste du parent : dégradé, jamais bloquant.
      }
    })()
    return () => { annule = true }
  }, [open])
  const cheptel = cheptelComplet ?? animauxExistants
  const [orientationParDefaut, setOrientationParDefaut] = React.useState<OrientationProduction | "">("")

  const idParIdentifiant = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const a of cheptel) if (a.identifiant) map.set(cleCanonique(a.identifiant), a.id)
    return map
  }, [cheptel])

  const masques = React.useMemo(() => indexerIdentifiantsMasques(cheptel), [cheptel])

  const seen = new Set<string>()
  const analyses = rows.map((row, index) => {
    const issues: string[] = []
    const espece = resoudreEspece(especes, row.espece)
    if (!espece) {
      const suggestion = suggererEspece(especes, row.espece)
      issues.push(
        `espèce inconnue « ${row.espece || "(vide)"} »${suggestion ? ` — vouliez-vous dire « ${suggestion.nom} » (${suggestion.id}) ?` : ""}`
      )
    }
    const identifiant = cleCanonique(row.identifiant)
    const idExact = identifiant ? idParIdentifiant.get(identifiant) : undefined
    // Rattachement d'un identifiant complet à un animal encore masqué
    // (`XXXXXX61010`) : sans lui, la ligne repartait en création et dupliquait
    // l'animal que l'éleveur venait précisément compléter.
    const masqueApparie = idExact === undefined && row.identifiant
      ? apparierIdentifiantMasque(row.identifiant, masques)
      : null
    const idExistant = idExact ?? masqueApparie?.id
    if (identifiant && seen.has(identifiant)) issues.push(`identifiant « ${row.identifiant} » en double dans le fichier`)
    if (identifiant) seen.add(identifiant)
    if (idExistant !== undefined && !modeMaj) {
      issues.push(
        masqueApparie
          ? `identifiant « ${row.identifiant} » correspond à l'animal « ${masqueApparie.identifiant} », dont l'identifiant est incomplet (cochez « mettre à jour » pour le compléter au lieu de créer un doublon)`
          : `identifiant « ${row.identifiant} » déjà présent dans le cheptel (cochez « mettre à jour » pour compléter l'animal existant)`
      )
    }
    issues.push(...problemesLigne(row))
    return {
      index: index + 2, row, espece, issues,
      maj: modeMaj && idExistant !== undefined,
      idExistant,
      completeMasque: modeMaj && masqueApparie !== null,
      masqueApparie,
    }
  })
  const invalides = analyses.filter((a) => a.issues.length > 0)
  const nCreations = analyses.filter((a) => !a.issues.length && !a.maj).length
  const nMaj = analyses.filter((a) => !a.issues.length && a.maj).length
  const nMasquesCompletes = analyses.filter((a) => !a.issues.length && a.completeMasque).length
  // Animaux encore incomplets qu'aucune ligne ne vient compléter : le dire, sinon
  // l'éleveur croit son troupeau à jour alors qu'il lui manque des identifiants.
  const apparies = new Set(
    analyses.map((a) => a.masqueApparie?.id).filter((id): id is number => id !== undefined)
  )
  const masquesNonApparies = rows.length ? masques.filter((m) => !apparies.has(m.id)) : []

  const readFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed = parseAnimauxCsv(await file.text())
      setRows(parsed.rows)
      setEntetesIgnores(parsed.entetesIgnores)
      setFileName(file.name)
    } catch (error) {
      setRows([])
      setEntetesIgnores([])
      toast({ variant: "destructive", title: "CSV invalide", description: error instanceof Error ? error.message : "Lecture impossible" })
    }
  }

  const downloadTemplate = () => {
    // Une ligne par colonne canonique : espece;identifiant;type_identifiant;nom;
    // race;sexe;date_naissance;date_arrivee;provenance;orientation;prix_achat;poids_kg;notes
    const exemples = [
      ["brebis", "FR64123412345", "IPG ovin", "", "Mérinos", "femelle", "2022", "16/01/2026", "GAEC du Causse", "laine", "180", "60", ""],
      ["chevre_alpine", "FR123456789012", "IPG caprin", "Neige", "Alpine", "femelle", "2023-02-15", "2023-05-20", "Ferme voisine", "lait", "350", "55", ""],
    ]
    const contenu = [ANIMAUX_CSV_COLUMNS.join(";"), ...exemples.map((l) => l.join(";"))]
    const blob = new Blob([`${contenu.join("\n")}\n`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "modele-import-animaux.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    if (!rows.length || invalides.length) return
    setLoading(true)
    const errors: string[] = []
    let crees = 0
    let misAJour = 0
    for (const a of analyses) {
      const response = a.maj && a.idExistant !== undefined
        ? await fetch("/api/elevage/animaux", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(csvRowToAnimalUpdate(a.row, a.idExistant, { completerIdentifiant: a.completeMasque })),
          })
        : await fetch("/api/elevage/animaux", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(csvRowToAnimal(a.row, a.espece!.id, { orientationParDefaut: orientationParDefaut || null })),
          })
      if (response.ok) { if (a.maj) misAJour++; else crees++ }
      else {
        const payload = await response.json().catch(() => ({}))
        errors.push(`ligne ${a.index}: ${payload.error || "erreur inconnue"}`)
      }
    }
    setLoading(false)
    if (crees || misAJour) onImported()
    const bilan = [crees ? `${crees} créé(s)` : null, misAJour ? `${misAJour} mis à jour` : null].filter(Boolean).join(", ") || "0 animal importé"
    toast({
      variant: errors.length ? "destructive" : "default",
      title: bilan,
      description: errors.length ? `${errors.length} rejet(s) — ${errors.slice(0, 3).join(" ; ")}` : "Import terminé sans erreur.",
    })
    if (!errors.length) { setOpen(false); setRows([]); setEntetesIgnores([]); setFileName("") }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" />Importer CSV</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer un troupeau</DialogTitle>
          <DialogDescription>
            Une ligne par animal. L’espèce peut être son identifiant Gleba ou son nom. Dates au format AAAA-MM-JJ, JJ/MM/AAAA ou année seule. Chaque ligne est validée par les mêmes règles que la saisie manuelle.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />Télécharger le modèle</Button>
          <Input type="file" accept=".csv,text/csv,.txt" onChange={(e) => readFile(e.target.files?.[0])} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={modeMaj} onCheckedChange={(v) => setModeMaj(v === true)} />
              Mettre à jour les animaux existants (par identifiant)
            </label>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Orientation par défaut</Label>
              <Select value={orientationParDefaut || "__none__"} onValueChange={(v) => setOrientationParDefaut(v === "__none__" ? "" : (v as OrientationProduction))}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Non renseignée</SelectItem>
                  {ORIENTATIONS_PRODUCTION.map((o) => <SelectItem key={o} value={o}>{LIBELLES_ORIENTATION[o]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {rows.length > 0 && <div className="rounded-md border p-3 text-sm space-y-2">
            <p><strong>{fileName}</strong> — {rows.length} ligne(s) : {nCreations} à créer{modeMaj ? `, ${nMaj} à mettre à jour` : ""}{modeMaj && nMasquesCompletes > 0 ? ` (dont ${nMasquesCompletes} identifiant(s) incomplet(s) complété(s))` : ""}{invalides.length ? `, ${invalides.length} à corriger` : ""}</p>
            {/* Le cas qui a produit 66 doublons potentiels : des animaux à
                identifiant tronqué et un fichier complet. On l'annonce, et on
                dit quoi faire, au lieu de laisser lire « 66 à créer ». */}
            {!modeMaj && masques.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {masques.length} animal(aux) de votre cheptel ont un identifiant incomplet.
                  Cochez « mettre à jour » pour les compléter par correspondance sur les derniers
                  chiffres, sinon ce fichier les recréera en double.
                </span>
              </p>
            )}
            {modeMaj && masquesNonApparies.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {masquesNonApparies.length} animal(aux) à identifiant incomplet ne correspondent à
                  aucune ligne de ce fichier et resteront en attente :{" "}
                  {masquesNonApparies.slice(0, 8).map((m) => m.identifiant).join(", ")}
                  {masquesNonApparies.length > 8 ? "…" : ""}
                </span>
              </p>
            )}
            {entetesIgnores.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Colonnes non reconnues, elles ne seront pas importées : {entetesIgnores.map((h) => `« ${h} »`).join(", ")}. Colonnes acceptées : {ANIMAUX_CSV_COLUMNS.join(", ")}.</span>
              </p>
            )}
            {invalides.length > 0 && <div className="text-red-700 space-y-1">{invalides.slice(0, 10).map((x) => <p key={x.index}>Ligne {x.index} : {x.issues.join(" ; ")}.</p>)}{invalides.length > 10 && <p>… et {invalides.length - 10} autre(s) ligne(s) à corriger.</p>}</div>}
            <div className="max-h-52 overflow-auto"><table className="w-full text-xs"><thead><tr><th className="text-left">Ligne</th><th className="text-left">Espèce</th><th className="text-left">Identifiant</th><th className="text-left">Nom</th><th className="text-left">Race</th>{modeMaj && <th className="text-left">Action</th>}</tr></thead><tbody>{analyses.slice(0, 20).map((a) => <tr key={a.index} className="border-t"><td>{a.index}</td><td>{a.espece?.nom ?? a.row.espece}</td><td>{a.row.identifiant || "—"}</td><td>{a.row.nom || "—"}</td><td>{a.row.race || "—"}</td>{modeMaj && <td>{a.issues.length ? "—" : a.completeMasque ? `complète ${a.masqueApparie?.identifiant}` : a.maj ? "mise à jour" : "création"}</td>}</tr>)}</tbody></table></div>
          </div>}
          <div className="flex justify-end"><Button onClick={submit} disabled={loading || !rows.length || invalides.length > 0}>{loading ? "Import en cours…" : `Importer ${rows.length || ""}`}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
