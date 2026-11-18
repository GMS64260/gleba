"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LIBELLES_UTILISATION,
  UTILISATION_SEMIS_TRAITE,
  UTILISATION_TRAITEMENT_SEMENCES,
  UTILISATIONS_SEMENCES,
} from "@/lib/tracabilite/utilisation-semences"

export const CHAMPS_SEMENCES_VIDES = {
  utilisationPhyto: "",
  substancesActives: "",
  quantiteSemences: "",
  uniteQuantiteSemences: "",
  densiteSemis: "",
  uniteDensiteSemis: "",
  gpsLat: "",
  gpsLng: "",
  rpgIlot: "",
  rpgParcelle: "",
  rpgCommuneInsee: "",
}

export type ErreurSaisieIntervention = { champ: string; message: string } | null

export function ErreurChampIntervention({ champ, erreur }: { champ: string; erreur: ErreurSaisieIntervention }) {
  return erreur?.champ === champ
    ? <p id={`erreur-intervention-${champ}`} role="alert" className="mt-1 text-sm text-red-700 break-words">{erreur.message}</p>
    : null
}

type Valeurs = typeof CHAMPS_SEMENCES_VIDES & { intrantNumLot: string }

export function UtilisationPhytoFields({ value, typeIntervention, onChange, erreur }: {
  value: Valeurs
  typeIntervention: string
  onChange: (next: Partial<Valeurs>) => void
  erreur: ErreurSaisieIntervention
}) {
  const semences = value.utilisationPhyto !== ""
  const semis = value.utilisationPhyto === UTILISATION_SEMIS_TRAITE
  const champ = (nom: keyof Valeurs, label: string, options: { type?: "number"; placeholder?: string; maxLength?: number } = {}) => (
    <div className="min-w-0">
      <Label htmlFor={`phyto-${nom}`}>{label}</Label>
      <Input
        id={`phyto-${nom}`}
        name={nom}
        value={value[nom]}
        onChange={(e) => onChange({ [nom]: e.target.value })}
        className="min-w-0"
        aria-invalid={erreur?.champ === nom || undefined}
        aria-describedby={erreur?.champ === nom ? `erreur-intervention-${nom}` : undefined}
        step={options.type === "number" ? "any" : undefined}
        {...options}
      />
      <ErreurChampIntervention champ={nom} erreur={erreur} />
    </div>
  )

  return (
    <fieldset className="min-w-0 rounded-lg border p-3 space-y-4">
      <legend className="px-1 text-sm font-semibold">Utilisation phytosanitaire</legend>
      <div className="min-w-0">
        <Label htmlFor="phyto-utilisationPhyto">Type d&apos;utilisation</Label>
        <select
          id="phyto-utilisationPhyto"
          name="utilisationPhyto"
          value={value.utilisationPhyto}
          onChange={(e) => onChange({ utilisationPhyto: e.target.value })}
          className="w-full min-w-0 h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-invalid={erreur?.champ === "utilisationPhyto" || undefined}
          aria-describedby={erreur?.champ === "utilisationPhyto" ? "erreur-intervention-utilisationPhyto" : undefined}
        >
          <option value="">{typeIntervention === "traitement_phyto" ? LIBELLES_UTILISATION.surface : "Sans utilisation C/D"}</option>
          {UTILISATIONS_SEMENCES.map((utilisation) => (
            <option key={utilisation} value={utilisation}>{LIBELLES_UTILISATION[utilisation]} ({utilisation === UTILISATION_TRAITEMENT_SEMENCES ? "C" : "D"})</option>
          ))}
        </select>
        <ErreurChampIntervention champ="utilisationPhyto" erreur={erreur} />
      </div>
      {semences && <>
        <p className="text-xs text-muted-foreground">
          {semis
            ? "D : semences traitées dont le traitement n’a pas été réalisé et enregistré dans cette exploitation. Localisez la surface semée par GPS ou par référence RPG complète."
            : "C : traitement de semences ou de plants dans cette exploitation. Les coordonnées GPS localisent l’installation de traitement."}
        </p>
        {champ("substancesActives", "Substances actives", { maxLength: 500 })}
        <div className="grid gap-4 sm:grid-cols-2">
          {semis ? <>
            {champ("densiteSemis", "Densité de semis", { type: "number" })}
            {champ("uniteDensiteSemis", "Unité de la densité de semis", { placeholder: "Ex. graines/m², kg/ha", maxLength: 50 })}
          </> : <>
            {champ("quantiteSemences", "Quantité de semences ou plants traitée", { type: "number" })}
            {champ("uniteQuantiteSemences", "Unité de la quantité traitée", { placeholder: "Ex. kg, graines, plants", maxLength: 50 })}
          </>}
        </div>
        {champ("intrantNumLot", "N° de lot des semences ou plants", { maxLength: 100 })}
        <div className="grid gap-4 sm:grid-cols-2">
          {champ("gpsLat", "Latitude GPS (WGS84)", { type: "number", placeholder: "Ex. 43.29512" })}
          {champ("gpsLng", "Longitude GPS (WGS84)", { type: "number", placeholder: "Ex. -0.37079" })}
        </div>
        {semis && <div className="grid gap-4 sm:grid-cols-3">
          {champ("rpgIlot", "Îlot RPG", { maxLength: 4 })}
          {champ("rpgParcelle", "Parcelle RPG", { maxLength: 3 })}
          {champ("rpgCommuneInsee", "Code commune INSEE", { placeholder: "Ex. 64000", maxLength: 5 })}
        </div>}
      </>}
    </fieldset>
  )
}
