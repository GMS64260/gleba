"use client"

/**
 * Boutons "Relancer le tour" par module (POSTREVIEW Sprint 6).
 * Affiché sur /aide. Chaque bouton :
 *  - supprime la clé localStorage `gleba.tour.<module>.done`
 *  - redirige vers la page racine du module (le tour se relance auto)
 */

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sprout, TreeDeciduous, Bird, Wallet, RefreshCw } from "lucide-react"
import { resetTour } from "@/components/guided-tour"

const TOURS = [
  { key: "maraichage", label: "Maraîchage", path: "/maraichage", icon: Sprout, color: "text-green-600" },
  { key: "verger", label: "Verger", path: "/verger", icon: TreeDeciduous, color: "text-emerald-700" },
  { key: "elevage", label: "Élevage", path: "/elevage", icon: Bird, color: "text-amber-700" },
  { key: "comptabilite", label: "Comptabilité", path: "/comptabilite", icon: Wallet, color: "text-blue-700" },
] as const

export function RelancerTours() {
  const router = useRouter()
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {TOURS.map((t) => (
        <Button
          key={t.key}
          variant="outline"
          className="justify-start"
          onClick={() => {
            resetTour(t.key)
            router.push(t.path)
          }}
        >
          <t.icon className={`h-4 w-4 mr-2 ${t.color}`} />
          <span className="flex-1 text-left">Relancer le tour {t.label}</span>
          <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
        </Button>
      ))}
    </div>
  )
}
