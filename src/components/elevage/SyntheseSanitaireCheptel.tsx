"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Synthese = {
  maladieId: string
  maladie: string
  indemne: number
  enCours: number
  positif: number
  inconnu: number
  qualification: "indemne" | "en_cours" | "positif" | "inconnu"
}

const label = {
  indemne: "Indemne",
  en_cours: "Contrôles en cours",
  positif: "Positif détecté",
  inconnu: "Statut incomplet",
}
const classe = {
  indemne: "border-emerald-200 bg-emerald-50 text-emerald-800",
  en_cours: "border-blue-200 bg-blue-50 text-blue-800",
  positif: "border-red-200 bg-red-50 text-red-800",
  inconnu: "border-amber-200 bg-amber-50 text-amber-800",
}

export function SyntheseSanitaireCheptel() {
  const [data, setData] = React.useState<Synthese[]>([])
  React.useEffect(() => {
    fetch("/api/elevage/statuts-sanitaires")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => setData(payload?.syntheseCheptel ?? []))
      .catch(() => {})
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Qualification sanitaire du cheptel
        </CardTitle>
        <CardDescription>
          Synthèse prudente : un résultat positif ou inconnu l’emporte sur une qualification indemne.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
              <div key={item.maladieId} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.maladie}</span>
                  <Badge variant="outline" className={classe[item.qualification]}>{label[item.qualification]}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.indemne} indemne · {item.enCours} en cours · {item.positif} positif · {item.inconnu} inconnu
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Aucune qualification structurée : le statut du cheptel est inconnu.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
