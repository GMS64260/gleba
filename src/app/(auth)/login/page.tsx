/**
 * Page de connexion Gleba — Formulaire pur
 *
 * La vraie landing marketing est désormais sur "/" (HomeLanding).
 * Cette page est noindex pour éviter toute duplication SEO.
 */

import type { Metadata } from "next"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { LoginForm } from "@/components/auth/LoginForm"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = {
  title: {
    absolute: "Connexion · Gleba",
  },
  description: "Connectez-vous à votre espace Gleba.",
  robots: {
    index: false,
    follow: true,
  },
  alternates: {
    canonical: "https://gleba.fr/login",
  },
}

function LoginFormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav minimaliste */}
      <nav className="w-full px-6 md:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" aria-label="Retour à l'accueil Gleba" className="flex items-center">
          <Image
            src="/gleba-logo.png"
            alt="Gleba"
            width={400}
            height={136}
            className="h-12 sm:h-14 w-auto"
            priority
          />
        </Link>
        <Link
          href="/register"
          className="text-sm text-slate-500 hover:text-emerald-700 font-medium transition-colors"
        >
          Créer un compte
        </Link>
      </nav>

      {/* Formulaire de connexion */}
      <main className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-[420px]">
          <div className="card-glow rounded-2xl">
            <div className="bg-white/75 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-900/[0.06] p-8 sm:p-9">
              <div className="text-center mb-7">
                <h1 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                  Connexion
                </h1>
                <p className="text-sm text-slate-400 mt-1.5">
                  Accédez à votre espace de gestion
                </p>
              </div>

              <Suspense fallback={<LoginFormFallback />}>
                <LoginForm />
              </Suspense>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Pas de compte ?{" "}
            <Link
              href="/register"
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Créer un compte
            </Link>
            {" "}— ou retournez à la{" "}
            <Link
              href="/"
              className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              page d&apos;accueil
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
