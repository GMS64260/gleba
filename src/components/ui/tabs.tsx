"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { cn } from "@/lib/utils"

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  /** Cle stable facultative. Sans cle, elle est derivee de la route et des valeurs. */
  persistenceKey?: string
  /** Désactive uniquement la mémorisation automatique pour un groupe spécialisé. */
  persist?: boolean
}

function collectTabValues(children: React.ReactNode): string[] {
  const values: string[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || child.type !== TabsList) return
    const visit = (node: React.ReactNode) => {
      React.Children.forEach(node, (item) => {
        if (!React.isValidElement<{ value?: string; children?: React.ReactNode }>(item)) return
        if (typeof item.props.value === "string") values.push(item.props.value)
        if (item.props.children) visit(item.props.children)
      })
    }
    visit((child.props as { children?: React.ReactNode }).children)
  })
  return [...new Set(values)]
}

/**
 * Faut-il mémoriser la valeur d'un groupe d'onglets contrôlé, changée par le
 * code de l'écran ? Oui si elle a changé depuis le rendu précédent sous la
 * même clé de stockage et qu'elle désigne un onglet existant. Non à la
 * première passe avec une clé : la restauration de la préférence décide.
 */
export function ongletAMemoriser(
  avant: { cle: string | null; valeur: string | undefined },
  cle: string,
  valeur: string,
  onglets: readonly string[],
): boolean {
  return avant.cle === cle && avant.valeur !== valeur && onglets.includes(valeur)
}

/**
 * Racine d'onglets avec mémorisation transverse.
 *
 * - clé isolée par route, groupe d'onglets et utilisateur ;
 * - compatible avec les onglets contrôlés et non contrôlés ;
 * - une valeur explicite dans l'URL reste prioritaire ;
 * - les valeurs disparues ne sont jamais restaurées.
 */
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({ persistenceKey, persist = true, value, defaultValue, onValueChange, children, ...props }, ref) => {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const values = React.useMemo(() => collectTabValues(children), [children])
  const signature = values.join("|")
  const userScope = status === "loading" ? null : session?.user?.id || "anonymous"
  const baseKey = persistenceKey || `gleba:tabs:${pathname}:${signature}`
  const storageKey = persist && signature && userScope ? `${baseKey}:user:${userScope}` : null
  const [internalValue, setInternalValue] = React.useState(defaultValue)
  const onValueChangeRef = React.useRef(onValueChange)
  onValueChangeRef.current = onValueChange
  const controlled = value !== undefined

  React.useEffect(() => {
    if (!storageKey) return
    const allowedValues = signature.split("|")
    // Les liens profonds gagnent sur la préférence mémorisée.
    const currentParams = new URLSearchParams(window.location.search)
    const hasExplicitDeepLink = Array.from(currentParams.values()).some((requested) => allowedValues.includes(requested))
    if (hasExplicitDeepLink) return
    const stored = window.localStorage.getItem(storageKey)
    if (!stored || !allowedValues.includes(stored)) return
    if (controlled) onValueChangeRef.current?.(stored)
    else setInternalValue(stored)
  }, [controlled, signature, storageKey])

  // Un onglet choisi par le code de l'écran (carte, bouton « tout afficher »)
  // est mémorisé comme un clic sur l'onglet : sinon l'ancien filtre revenait
  // au rechargement (équipe debug, D254). La première passe avec une clé de
  // stockage laisse la restauration ci-dessus décider.
  const precedente = React.useRef<{ cle: string | null; valeur: string | undefined }>({ cle: null, valeur: undefined })
  React.useEffect(() => {
    const avant = precedente.current
    precedente.current = { cle: storageKey, valeur: value }
    if (controlled && storageKey && value !== undefined && ongletAMemoriser(avant, storageKey, value, signature.split("|"))) {
      window.localStorage.setItem(storageKey, value)
    }
  }, [controlled, signature, storageKey, value])

  const handleValueChange = React.useCallback((next: string) => {
    if (!controlled) setInternalValue(next)
    if (storageKey) window.localStorage.setItem(storageKey, next)
    onValueChangeRef.current?.(next)
  }, [controlled, storageKey])

  return (
    <TabsPrimitive.Root
      ref={ref}
      value={controlled ? value : internalValue}
      onValueChange={handleValueChange}
      {...props}
    >
      {children}
    </TabsPrimitive.Root>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
