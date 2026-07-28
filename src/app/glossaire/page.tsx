import Link from "next/link"
import { ArrowLeft, BookCopy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { listGlossaireEntries } from "@/lib/glossaire"

export const metadata = {
  title: "Glossaire agricole — Gleba",
  description: "Définitions des principaux termes agricoles et comptables utilisés dans Gleba.",
}

export default function GlossairePage() {
  const entries = listGlossaireEntries()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/aide">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Centre d’aide
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BookCopy className="h-6 w-6 text-emerald-700" />
            <h1 className="text-xl font-bold">Glossaire agricole</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-8">
        <p className="mb-6 text-sm text-slate-600">
          Les termes techniques employés dans les modules Maraîchage, Verger,
          Élevage et Comptabilité.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((entry) => (
            <Card key={entry.key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{entry.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-slate-600">
                  {entry.definition}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
