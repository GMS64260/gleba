/**
 * Page de connexion Gleba - Landing page nature
 */

import { Suspense } from "react"
import Image from "next/image"
import { LoginForm } from "@/components/auth/LoginForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Leaf,
  Calendar,
  BarChart3,
  Droplets,
  Sun,
  TreeDeciduous,
  Sprout,
  Package,
  Shield,
  Zap,
  Heart
} from "lucide-react"

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-green-600" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-7xl mx-4">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Colonne gauche - Présentation */}
        <div className="space-y-8">
          {/* Logo et titre */}
          <div>
            <div className="mb-4">
              <Image
                src="/gleba.png"
                alt="Gleba - Gestion de potager"
                width={300}
                height={100}
                className="h-24 w-auto"
                priority
              />
            </div>

            <p className="text-xl text-gray-700 leading-relaxed">
              Votre compagnon <span className="font-semibold text-green-700">100% gratuit</span> pour
              la gestion complète de votre potager et verger.
            </p>
          </div>

          {/* Badges valeurs */}
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1">
              <Heart className="h-3 w-3 mr-1" />
              Gratuit & Open Source
            </Badge>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1">
              <Shield className="h-3 w-3 mr-1" />
              Données privées
            </Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1">
              <Leaf className="h-3 w-3 mr-1" />
              Agriculture bio
            </Badge>
          </div>

          {/* Fonctionnalités principales */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Fonctionnalités
            </h3>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border border-green-100">
                <div className="p-2 rounded-lg bg-green-100">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Planification intelligente</h4>
                  <p className="text-sm text-gray-600">
                    Assistant maraîcher, calendrier de semis, rotations des cultures
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border border-cyan-100">
                <div className="p-2 rounded-lg bg-cyan-100">
                  <Droplets className="h-5 w-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Gestion de l'eau</h4>
                  <p className="text-sm text-gray-600">
                    Irrigations planifiées, suivi des besoins, optimisation
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border border-purple-100">
                <div className="p-2 rounded-lg bg-purple-100">
                  <BarChart3 className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Suivi production</h4>
                  <p className="text-sm text-gray-600">
                    Récoltes, rendements, valorisation économique
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border border-amber-100">
                <div className="p-2 rounded-lg bg-amber-100">
                  <TreeDeciduous className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">Plan du jardin 2D</h4>
                  <p className="text-sm text-gray-600">
                    Visualisation, planches, arbres, drag & drop
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
            <div className="flex items-start gap-3">
              <Sprout className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Notre mission</h3>
                <p className="text-sm text-gray-700 leading-relaxed">
                  Gleba est un projet <strong>open source</strong> créé pour démocratiser
                  l'accès aux outils professionnels de maraîchage. Nous croyons qu'une
                  agriculture locale, biologique et raisonnée commence par de bons outils,
                  accessibles à tous, gratuitement.
                </p>
              </div>
            </div>
          </div>

          {/* Stats communauté (fictives pour l'instant) */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">100%</div>
              <div className="text-xs text-muted-foreground">Gratuit</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">135+</div>
              <div className="text-xs text-muted-foreground">Espèces</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">∞</div>
              <div className="text-xs text-muted-foreground">Cultures</div>
            </div>
          </div>
        </div>

        {/* Colonne droite - Formulaire de connexion */}
        <div>
          <Card className="border-2 shadow-2xl shadow-green-100/50 overflow-hidden">
            {/* Header avec dégradé */}
            <div className="h-2 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600" />

            <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-b from-green-50/30 to-transparent">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Bienvenue</CardTitle>
              <CardDescription className="text-base">
                Connectez-vous pour accéder à votre jardin
              </CardDescription>
            </CardHeader>

            <CardContent className="pb-8">
              <Suspense fallback={<LoginFormFallback />}>
                <LoginForm />
              </Suspense>

              {/* Footer du formulaire */}
              <div className="mt-6 pt-6 border-t">
                <p className="text-center text-sm text-muted-foreground">
                  Première visite ?{" "}
                  <span className="text-green-600 font-medium">
                    Contactez votre administrateur
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Info technique */}
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Gleba v1.0.0 • AGPL-3.0 License • Made with 🌱 for gardeners
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              <a href="https://github.com/GMS64260/gleba" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">
                github.com/GMS64260/gleba
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
