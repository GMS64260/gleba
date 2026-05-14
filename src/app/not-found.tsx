import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import {
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  Compass,
  MessageCircle,
  Home,
  ArrowRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MODULES, MODULE_IDS, type ModuleId } from "@/lib/modules"

export const metadata: Metadata = {
  title: "Page introuvable — Gleba",
  description:
    "Cette page n'existe pas ou plus. Retournez à l'accueil ou explorez les modules de Gleba.",
  robots: { index: false, follow: false },
}

const MODULE_STYLES: Record<
  ModuleId,
  { icon: React.ComponentType<{ className?: string }>; accent: string; ring: string }
> = {
  maraichage: {
    icon: Sprout,
    accent: "text-emerald-700",
    ring: "hover:border-emerald-200 hover:bg-emerald-50/60",
  },
  verger: {
    icon: TreeDeciduous,
    accent: "text-lime-700",
    ring: "hover:border-lime-200 hover:bg-lime-50/60",
  },
  elevage: {
    icon: Bird,
    accent: "text-amber-700",
    ring: "hover:border-amber-200 hover:bg-amber-50/60",
  },
  comptabilite: {
    icon: Wallet,
    accent: "text-blue-700",
    ring: "hover:border-blue-200 hover:bg-blue-50/60",
  },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon-192.png"
              alt="Gleba"
              width={32}
              height={32}
              className="rounded"
            />
            <span className="font-semibold text-slate-800">Gleba</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <Home className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-10">
          <p className="text-7xl font-bold text-slate-300 mb-4">404</p>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">
            Cette page n&apos;existe pas ou plus
          </h1>
          <p className="text-slate-600 max-w-lg mx-auto">
            Vérifiez l&apos;URL ou choisissez l&apos;un des modules ci-dessous
            pour reprendre votre travail.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {MODULE_IDS.map((id) => {
            const def = MODULES[id]
            const style = MODULE_STYLES[id]
            const Icon = style.icon
            return (
              <Link key={id} href={def.path} className="group">
                <Card
                  className={`h-full border transition-colors ${style.ring}`}
                >
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg bg-slate-100 ${style.accent}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          {def.label}
                          <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs">
                          {def.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/roadmap">
            <Button variant="outline" size="sm">
              <Compass className="h-4 w-4 mr-2" />
              Roadmap
            </Button>
          </Link>
          <a
            href="https://github.com/GMS64260/gleba/issues/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <MessageCircle className="h-4 w-4 mr-2" />
              Signaler un problème
            </Button>
          </a>
        </div>
      </main>
    </div>
  )
}
