"use client"

/**
 * PROMPT DEV 2 Bug #12 — Combobox searchable pour les espèces.
 *
 * Marc 2026-05-14 : "130+ items dans un select, je perds 4-5 secondes à chaque
 * création de culture, et il y a même des arbres fruitiers mélangés".
 *
 * - Recherche tolérante (accents/casse/début/contient) via cmdk.
 * - Onglets de filtrage par type (Tous / Légumes / Aromatiques / Engrais verts
 *   / Arbres fruitiers / Petits fruits). Le module qui consomme passe son
 *   filtre par défaut (couvre aussi Bug #31 — pas de verger dans Maraîchage).
 * - "Récemment utilisés" persistés en localStorage (3 dernières sélections).
 */

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { getCategorieEmoji } from "@/lib/categories-emojis"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { normaliserRecherche, scoreEspece } from "@/lib/especes/recherche"
import { libelleTypeEspece } from "@/lib/validations/espece"

/**
 * Valeur cmdk de l'entrée « Créer l'espèce … ». Préfixe sentinelle : le filtre
 * lui donne un score plancher non nul pour qu'elle reste visible en toute
 * dernière position, quelle que soit la recherche.
 */
const VALEUR_CREATION = "__creer__"

export type EspeceType =
  | "legume"
  | "aromatique"
  | "fleur"
  | "engrais_vert"
  | "arbre_fruitier"
  | "petit_fruit"
  | "ornement"

export type EspeceOption = {
  id: string
  /** Nom affiché : = id pour l'officiel, `nom` saisi pour le perso (id=cuid). */
  nom?: string | null
  type?: EspeceType | string | null
  categorie?: string | null
  couleur?: string | null
  // Origine catalogue : userId null = Gleba officiel ; sinon = créée par un membre.
  userId?: string | null
  partageCommunaute?: boolean
}

/** Badge d'origine d'une entrée catalogue (null = Gleba officiel, pas de badge). */
function origineBadge(o: EspeceOption, currentUserId?: string | null) {
  if (o.userId == null) return null
  if (currentUserId && o.userId === currentUserId) return { label: "Perso", cls: "bg-amber-100 text-amber-700" }
  return { label: "Communauté", cls: "bg-sky-100 text-sky-700" }
}

/** Nom affiché/recherché d'une option (perso → `nom`, officiel → id lisible). */
const nomOf = (o: EspeceOption) => o.nom ?? o.id

type TabKey = "all" | EspeceType

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "legume", label: "Légumes" },
  { key: "aromatique", label: "Aromatiques" },
  // Ticket FB-PMWX8O — une ferme florale conduit ses fleurs sur planche comme
  // des légumes ; sans cet onglet, ses espèces restaient introuvables au tri.
  { key: "fleur", label: "Fleurs" },
  { key: "engrais_vert", label: "Engrais verts" },
  { key: "arbre_fruitier", label: "Arbres fruitiers" },
  { key: "petit_fruit", label: "Petits fruits" },
]

// Stockage des récemment utilisés (par contexte d'usage, ex: "maraichage" vs "verger").
function getRecents(storageKey: string): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, 5) : []
  } catch {
    return []
  }
}

function pushRecent(storageKey: string, id: string) {
  if (typeof window === "undefined") return
  try {
    const current = getRecents(storageKey)
    const next = [id, ...current.filter((x) => x !== id)].slice(0, 5)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  } catch {
    // localStorage indisponible (mode privé strict) → no-op.
  }
}

type Props = {
  options: EspeceOption[]
  value: string | null
  onChange: (id: string | null) => void
  /** Types autorisés par défaut. Si non fourni, tous types acceptés. */
  defaultTypes?: EspeceType[]
  /** Onglets visibles. Si non fourni, tous les onglets sauf "ornement". */
  visibleTabs?: TabKey[]
  placeholder?: string
  /** Clé localStorage pour les récemment utilisés (ex: "espece-recents-maraichage"). */
  recentStorageKey?: string
  disabled?: boolean
  className?: string
  /** Id de l'utilisateur courant, pour distinguer ses espèces perso. */
  currentUserId?: string | null
  /**
   * Si fourni, propose « Créer l'espèce … ». `typeSuggere` reprend l'onglet
   * actif quand il en désigne un : créer depuis l'onglet « Aromatiques » ne
   * doit plus produire un légume (friction du 2026-07-30).
   */
  onCreate?: (nom: string, typeSuggere?: EspeceType) => void
}

export function EspeceCombobox({
  options,
  value,
  onChange,
  defaultTypes,
  visibleTabs = ["all", "legume", "aromatique", "fleur", "engrais_vert", "arbre_fruitier", "petit_fruit"],
  placeholder = "Rechercher une espèce…",
  recentStorageKey = "espece-recents-default",
  disabled,
  className,
  currentUserId,
  onCreate,
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const initialTab: TabKey =
    defaultTypes && defaultTypes.length === 1 ? defaultTypes[0] : "all"
  const [tab, setTab] = React.useState<TabKey>(initialTab)
  const [recents, setRecents] = React.useState<string[]>(() => getRecents(recentStorageKey))

  // Lorsque l'utilisateur ouvre le popover, on rafraîchit les récents
  // (l'autre form peut avoir inséré entre temps).
  React.useEffect(() => {
    if (open) setRecents(getRecents(recentStorageKey))
  }, [open, recentStorageKey])

  const filtered = React.useMemo(() => {
    let list = options
    if (tab === "all") {
      if (defaultTypes && defaultTypes.length > 0) {
        list = list.filter((o) => !o.type || defaultTypes.includes(o.type as EspeceType))
      }
    } else {
      list = list.filter((o) => o.type === tab)
    }
    return [...list].sort((a, b) => nomOf(a).localeCompare(nomOf(b), "fr"))
  }, [options, tab, defaultTypes])

  const recentOptions = React.useMemo(
    () =>
      recents
        .map((id) => options.find((o) => o.id === id))
        .filter((o): o is EspeceOption => o !== undefined),
    [recents, options]
  )

  /**
   * Espèces écartées par l'onglet courant mais qui répondent à la recherche.
   *
   * Friction du 2026-07-30 : le dialogue de culture masque les `petit_fruit`,
   * donc chercher « Groseillers » ou « Fraise » en maraîchage ne renvoyait
   * rien et poussait à créer un doublon perso. On les propose désormais dans
   * un groupe séparé plutôt que de les rendre introuvables.
   */
  const horsOnglet = React.useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const visibles = new Set(filtered.map((o) => o.id))
    return options
      .filter((o) => !visibles.has(o.id) && scoreEspece(nomOf(o), q) > 0)
      .sort((a, b) => scoreEspece(nomOf(b), q) - scoreEspece(nomOf(a), q))
      .slice(0, 8)
  }, [options, filtered, query])

  // La création reste offerte même quand la recherche remonte des voisins :
  // « Pois chiche » propose « Pois » sans empêcher de créer le pois chiche.
  // On la masque seulement si le nom saisi existe déjà à l'identique.
  const nomExistant = React.useMemo(() => {
    const q = normaliserRecherche(query)
    if (!q) return true
    return options.some((o) => normaliserRecherche(nomOf(o)) === q)
  }, [options, query])

  const selected = options.find((o) => o.id === value)

  const handleSelect = (id: string) => {
    onChange(id)
    pushRecent(recentStorageKey, id)
    setRecents(getRecents(recentStorageKey))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {(() => {
                const emoji = getCategorieEmoji(selected.categorie)
                if (emoji) return <span className="inline-block shrink-0">{emoji}</span>
                if (selected.couleur) return (
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: selected.couleur }}
                  />
                )
                return null
              })()}
              {nomOf(selected)}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex flex-wrap gap-1 p-2 border-b bg-slate-50">
          {TABS.filter((t) => visibleTabs.includes(t.key)).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                tab === t.key
                  ? "bg-green-600 text-white"
                  : "bg-white border hover:bg-slate-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Command
          // Matching tolérant au pluriel et à la faute de frappe (cf.
          // lib/especes/recherche). Le score sert aussi au tri de cmdk :
          // la correspondance exacte reste en tête, la suggestion faible
          // (saisie composée) en bas, et l'entrée de création toujours après.
          filter={(value, search) => {
            if (value.startsWith(VALEUR_CREATION)) return 0.0001
            return scoreEspece(value, search)
          }}
        >
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              <span className="px-2 py-1.5 text-sm text-muted-foreground">Aucune espèce trouvée.</span>
            </CommandEmpty>
            {tab === "all" && recentOptions.length > 0 && (
              <>
                <CommandGroup heading="Récemment utilisés">
                  {recentOptions.map((o) => (
                    <CommandItem
                      key={`recent-${o.id}`}
                      value={nomOf(o)}
                      onSelect={() => handleSelect(o.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === o.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {(() => {
                        const emoji = getCategorieEmoji(o.categorie)
                        if (emoji) return <span className="mr-2">{emoji}</span>
                        if (o.couleur) return (
                          <span
                            className="inline-block w-2 h-2 rounded-full mr-2"
                            style={{ backgroundColor: o.couleur }}
                          />
                        )
                        return null
                      })()}
                      {nomOf(o)}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading={tab === "all" ? "Toutes les espèces" : undefined}>
              {filtered.map((o) => (
                <CommandItem key={o.id} value={nomOf(o)} onSelect={() => handleSelect(o.id)}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {(() => {
                    const emoji = getCategorieEmoji(o.categorie)
                    if (emoji) return <span className="mr-2">{emoji}</span>
                    if (o.couleur) return (
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: o.couleur }}
                      />
                    )
                    return null
                  })()}
                  {nomOf(o)}
                  <span className="ml-auto flex items-center gap-1">
                    {(() => {
                      const b = origineBadge(o, currentUserId)
                      return b ? (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", b.cls)}>{b.label}</span>
                      ) : null
                    })()}
                    {o.type && o.type !== "legume" && (
                      <span className="text-xs text-muted-foreground">{libelleTypeEspece(o.type)}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {horsOnglet.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Dans d'autres catégories">
                  {horsOnglet.map((o) => (
                    <CommandItem key={`hors-${o.id}`} value={nomOf(o)} onSelect={() => handleSelect(o.id)}>
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === o.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {o.couleur && (
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-2"
                          style={{ backgroundColor: o.couleur }}
                        />
                      )}
                      {nomOf(o)}
                      <span className="ml-auto flex items-center gap-1">
                        {(() => {
                          const b = origineBadge(o, currentUserId)
                          return b ? (
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded", b.cls)}>{b.label}</span>
                          ) : null
                        })()}
                        {o.type && (
                          <span className="text-xs text-muted-foreground">{o.type.replace("_", " ")}</span>
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {onCreate && query.trim() && !nomExistant && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`${VALEUR_CREATION}${query.trim()}`}
                    onSelect={() => {
                      onCreate(query.trim(), tab === "all" ? undefined : tab)
                      setOpen(false)
                      setQuery("")
                    }}
                    className="text-green-700"
                  >
                    ＋ Créer l&apos;espèce « {query.trim()} » (perso)
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
