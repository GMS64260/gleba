/**
 * Page de connexion
 */

import { Suspense } from "react"
import Image from "next/image"
import { LoginForm } from "@/components/auth/LoginForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin text-green-600" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="w-full max-w-2xl mx-4 space-y-8">
      {/* Hero avec logo et description */}
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <Image
            src="/gleba.png"
            alt="Gleba - Gestion de potager"
            width={300}
            height={200}
            className=""
            priority
          />
        </div>
        <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed mb-2">
          Votre compagnon pour la gestion complète de votre potager.
        </p>
        <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
          Planifiez vos cultures et rotations, suivez vos récoltes,
          gérez vos planches maraîchères et vos arbres fruitiers.
          Du semis à la récolte, optimisez votre production en respectant
          les cycles naturels de votre jardin.
        </p>
      </div>

      {/* Carte de connexion */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl text-gray-900">Connexion</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder à votre jardin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormFallback />}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
