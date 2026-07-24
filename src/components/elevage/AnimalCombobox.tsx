"use client"

/**
 * Sélecteur d'animal recherchable par NUMÉRO DE BOUCLE (IPG) ou nom.
 * Feedback éleveur caprin 2026-07-21 : les contrôleurs (PAC/bio) et la saisie
 * rapide fonctionnent au n° de boucle, pas au nom. Réutilisé pour choisir une
 * mère, une femelle, un mâle ou l'animal d'un soin.
 */

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type AnimalOption = {
  id: number
  nom?: string | null
  identifiant?: string | null
  especeAnimale?: { nom?: string | null } | null
}

/** Libellé d'affichage : boucle en tête (identifiant IPG), puis nom. */
export function labelAnimal(a: AnimalOption): string {
  const boucle = a.identifiant?.trim()
  const nom = a.nom?.trim()
  if (boucle && nom) return `${boucle} — ${nom}`
  return boucle || nom || `#${a.id}`
}

interface Props {
  animaux: AnimalOption[]
  value: string // id sélectionné (string) ou ""
  onChange: (id: string) => void
  placeholder?: string
  emptyLabel?: string // libellé de l'option « aucun »
  allowEmpty?: boolean
  disabled?: boolean
  className?: string
}

export function AnimalCombobox({
  animaux,
  value,
  onChange,
  placeholder = "N° de boucle ou nom…",
  emptyLabel = "Non renseignée",
  allowEmpty = true,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const selected = animaux.find((a) => String(a.id) === value)

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
          <span className="truncate">{selected ? labelAnimal(selected) : emptyLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: "var(--radix-popover-trigger-width)" }} align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue contient boucle + nom + espèce (voir CommandItem value)
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder={placeholder} className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs">Aucun animal trouvé</CommandEmpty>
            <CommandGroup>
              {allowEmpty && (
                <CommandItem
                  value="__aucun__ non renseignée"
                  onSelect={() => { onChange(""); setOpen(false) }}
                >
                  <span className="flex-1 text-muted-foreground">{emptyLabel}</span>
                  {!value && <Check className="h-3 w-3 shrink-0 text-green-600" />}
                </CommandItem>
              )}
              {animaux.map((a) => {
                const boucle = a.identifiant?.trim()
                const nom = a.nom?.trim()
                const espece = a.especeAnimale?.nom
                // La valeur de recherche inclut boucle + nom + espèce
                const searchValue = [boucle, nom, espece, `#${a.id}`].filter(Boolean).join(" ")
                return (
                  <CommandItem
                    key={a.id}
                    value={searchValue}
                    onSelect={() => { onChange(String(a.id)); setOpen(false) }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {boucle && <span className="font-mono font-medium">{boucle}</span>}
                        {boucle && nom && <span className="text-muted-foreground"> — </span>}
                        {nom && <span>{nom}</span>}
                        {!boucle && !nom && <span>#{a.id}</span>}
                      </div>
                      {espece && <div className="text-[11px] text-muted-foreground truncate">{espece}</div>}
                    </div>
                    {value === String(a.id) && <Check className="h-3 w-3 shrink-0 text-green-600" />}
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
