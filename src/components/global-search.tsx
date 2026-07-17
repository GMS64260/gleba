"use client"

/**
 * Recherche globale Cmd+K (PROMPT 20c).
 *
 * - Touche Cmd/Ctrl + K ouvre la palette
 * - Tape > 2 caractères pour interroger /api/search
 * - Touches ↑↓ et Enter pour naviguer (gérées par cmdk)
 * - Esc ferme
 *
 * Raccourcis globaux additionnels (gérés ici pour ne pas dupliquer
 * le hook keydown sur chaque page) :
 *  - g puis m  → /
 *  - g puis v  → /arbres
 *  - g puis e  → /elevage
 *  - g puis c  → /comptabilite
 *  - n        → bouton "Nouveau" contextuel (déclenche un event custom)
 *  - ?        → /raccourcis
 */

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Command } from "cmdk"
import { Search, Loader2, ArrowRight } from "lucide-react"

interface SearchItem {
  id: string
  label: string
  sub?: string | null
  type: string
  href: string
}

type Group = { type: string; items: SearchItem[] }

export function GlobalSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<SearchItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const lastQueryRef = React.useRef("")
  const gPressedAtRef = React.useRef(0)

  // Ouverture via Cmd+K / Ctrl+K + raccourcis g+x, n, ?
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ne pas intercepter quand on est dans un input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isEditable =
        tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable
      if (isEditable && !(e.key === "k" && (e.metaKey || e.ctrlKey))) return

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }

      // Hors palette ouverte : raccourcis g+x
      if (!open) {
        // ? → /raccourcis
        if (e.key === "?") {
          e.preventDefault()
          router.push("/raccourcis")
          return
        }
        // n → event "global:new" (les pages s'y abonnent)
        if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent("gleba:new"))
          return
        }
        if (e.key === "g") {
          gPressedAtRef.current = Date.now()
          return
        }
        const since = Date.now() - gPressedAtRef.current
        if (since < 1200) {
          let target: string | null = null
          // POSTREVIEW Sprint 6 — g+m vers /maraichage (avant : "/" legacy)
          if (e.key === "m") target = "/maraichage"
          else if (e.key === "v") target = "/verger"
          else if (e.key === "e") target = "/elevage"
          else if (e.key === "c") target = "/comptabilite"
          if (target) {
            e.preventDefault()
            gPressedAtRef.current = 0
            router.push(target)
          }
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, router])

  // Ferme la palette à chaque changement de route
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Debounce search
  React.useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setItems([])
      return
    }
    const handle = setTimeout(async () => {
      lastQueryRef.current = q
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        if (lastQueryRef.current === q) setItems(json.items || [])
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query, open])

  // Groupage par type pour cmdk
  const groups: Group[] = React.useMemo(() => {
    const m = new Map<string, SearchItem[]>()
    for (const it of items) {
      if (!m.has(it.type)) m.set(it.type, [])
      m.get(it.type)!.push(it)
    }
    return Array.from(m.entries()).map(([type, items]) => ({ type, items }))
  }, [items])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4"
      onClick={() => setOpen(false)}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
        <Command
          label="Recherche globale"
          className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200"
        >
          <div className="flex items-center gap-2 px-3 border-b border-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <Command.Input
              autoFocus
              placeholder="Rechercher une culture, un animal, une facture, un client..."
              value={query}
              onValueChange={setQuery}
              className="flex-1 h-12 outline-none text-sm bg-transparent"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            <kbd className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Esc</kbd>
          </div>
          <Command.List className="max-h-[60dvh] overflow-y-auto">
            {query.trim().length < 2 ? (
              <div className="p-6 text-sm text-slate-500 text-center">
                Tapez au moins 2 caractères pour rechercher dans cultures, variétés, arbres,
                animaux, lots, clients, factures, parcelles, soins, récoltes, produits boutique.
                <div className="mt-3 text-xs">
                  Raccourcis : <kbd className="bg-slate-100 px-1 rounded">g</kbd>+
                  <kbd className="bg-slate-100 px-1 rounded">m/v/e/c</kbd> · navigation modules
                </div>
              </div>
            ) : (
              <>
                <Command.Empty className="p-6 text-sm text-slate-500 text-center">
                  Aucun résultat pour "{query}".
                </Command.Empty>
                {groups.map((g) => (
                  <Command.Group key={g.type} heading={g.type} className="text-xs text-slate-500 px-2 pt-2 pb-1">
                    {g.items.map((it) => (
                      <Command.Item
                        key={it.id}
                        value={`${it.type} ${it.label} ${it.sub || ""}`}
                        onSelect={() => {
                          router.push(it.href)
                          setOpen(false)
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer aria-selected:bg-slate-100 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 truncate">{it.label}</div>
                          {it.sub && <div className="text-xs text-slate-500 truncate">{it.sub}</div>}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
