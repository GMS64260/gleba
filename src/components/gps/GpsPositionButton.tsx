"use client"

/**
 * Bouton « Ma position » : remplit des coordonnées GPS depuis le téléphone,
 * sans recopie depuis une app externe (feedback LVBB40430). L'utilisateur
 * se place au pied de l'arbre et tape le bouton.
 */

import * as React from "react"
import { LocateFixed, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getCurrentGpsFix, type GpsFix } from "@/lib/geolocation"

interface GpsPositionButtonProps {
  onPosition: (fix: GpsFix) => void
  label?: string
  className?: string
}

export function GpsPositionButton({
  onPosition,
  label = "Ma position",
  className,
}: GpsPositionButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      const fix = await getCurrentGpsFix()
      onPosition(fix)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Géolocalisation impossible",
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <LocateFixed className="h-4 w-4 mr-1.5" />
      )}
      {loading ? "Recherche GPS…" : label}
    </Button>
  )
}
