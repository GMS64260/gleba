import Link from "next/link"
import { ArrowLeft, ExternalLink, Scale } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "Licence — Gleba",
  description: "Informations sur la licence libre AGPL-3.0 de Gleba.",
}

export default function LicencePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
            <Scale className="h-5 w-5 text-emerald-700" />
          </div>
          <CardTitle>Licence AGPL-3.0</CardTitle>
          <CardDescription>
            Le socle libre de Gleba est distribué sous la GNU Affero General Public License v3.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm text-slate-600">
          <p>
            Cette licence autorise l’utilisation, l’étude, la modification et la
            redistribution du logiciel. Toute version modifiée mise à disposition
            via un réseau doit également proposer son code source sous la même licence.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a
                href="https://github.com/GMS64260/gleba/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                Texte complet
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à Gleba
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
