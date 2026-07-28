"use client"

/**
 * Sélecteur de race recherchable, calqué sur AnimalCombobox.
 *
 * Nécessaire depuis l'enrichissement du référentiel (catalogue compagnie/équin/
 * NAC : 92 races canines, 52 félines, 40 chevalines…) : une liste déroulante
 * simple n'est plus praticable. La recherche porte sur le nom, l'origine et les
 * aptitudes (« berger », « chasse », « France »…).
 *
 * Garde la valeur historique `__legacy__` (race saisie en texte libre avant le
 * référentiel, cf. AnimauxTab) pour ne pas la perdre à l'édition.
 */

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type RaceOption = {
  id: string
  nom: string
  especeAnimaleId: string
  origine?: string | null
  aptitudes?: string[]
}

interface Props {
  races: RaceOption[]
  /** Id de race sélectionné, "" (non renseignée) ou "__legacy__". */
  value: string
  onChange: (id: string) => void
  /** Race saisie en texte libre avant le référentiel, à conserver telle quelle. */
  raceHistorique?: string
  disabled?: boolean
  className?: string
}

export function RaceCombobox({ races, value, onChange, raceHistorique, disabled, className }: Props) {
  const [open, setOpen] = React.useState(false)
  const selected = races.find((r) => r.id === value)
  const legacy = value === "__legacy__" && raceHistorique

  const libelle = selected
    ? selected.nom
    : legacy
      ? `Historique à confirmer : ${raceHistorique}`
      : "Race non renseignée"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="truncate">{libelle}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Race, origine, aptitude…" className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs">
              {races.length === 0
                ? "Aucune race au référentiel pour cette espèce"
                : "Aucune race trouvée"}
            </CommandEmpty>
            <CommandGroup>
              {legacy && (
                <CommandItem value={`__legacy__ ${raceHistorique}`} onSelect={() => setOpen(false)}>
                  <span className="flex-1 truncate">Historique à confirmer : {raceHistorique}</span>
                  <Check className="h-3 w-3 shrink-0 text-green-600" />
                </CommandItem>
              )}
              <CommandItem
                value="__none__ race non renseignée"
                onSelect={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                <span className="flex-1 text-muted-foreground">Race non renseignée</span>
                {!value && <Check className="h-3 w-3 shrink-0 text-green-600" />}
              </CommandItem>
              {races.map((race) => {
                // La recherche porte sur nom + origine + aptitudes.
                const searchValue = [race.nom, race.origine, ...(race.aptitudes ?? [])]
                  .filter(Boolean)
                  .join(" ")
                const secondaire = [race.origine, ...(race.aptitudes ?? []).filter((a) => a !== "variété")]
                  .filter(Boolean)
                  .join(" · ")
                return (
                  <CommandItem
                    key={race.id}
                    value={searchValue}
                    onSelect={() => {
                      onChange(race.id)
                      setOpen(false)
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{race.nom}</div>
                      {secondaire && (
                        <div className="text-[11px] text-muted-foreground truncate">{secondaire}</div>
                      )}
                    </div>
                    {value === race.id && <Check className="h-3 w-3 shrink-0 text-green-600" />}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
