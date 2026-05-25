/**
 * Page d'inscription Gleba
 */

import type { Metadata } from "next"
import { Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { Loader2, ArrowLeft } from "lucide-react"

export const metadata: Metadata = {
  title: {
    absolute: "Créer un compte Gleba · Inscription gratuite",
  },
  description:
    "Créez votre compte Gleba gratuit en 1 minute. Accédez immédiatement à la planification maraîchage, au verger, à l'élevage et à la comptabilité. Hébergé en France.",
  alternates: {
    canonical: "https://gleba.fr/register",
  },
  robots: {
    index: false,
    follow: true,
  },
}

function RegisterFormFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/login" className="mb-8 animate-fade-in-up">
        <Image
          src="/gleba-logo.png"
          alt="Gleba"
          width={400}
          height={136}
          className="h-24 sm:h-32 w-auto"
          priority
        />
      </Link>

      {/* Card inscription */}
      <div className="w-full max-w-[420px] animate-fade-in-up-2">
        <div className="card-glow rounded-2xl">
          <div className="bg-white/75 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-900/[0.06] p-8 sm:p-9">
            <div className="text-center mb-7">
              <h2 className="font-heading text-xl font-medium text-slate-900 tracking-tight">
                Créer un compte
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Rejoignez Gleba pour gérer votre exploitation
              </p>
            </div>

            <Suspense fallback={<RegisterFormFallback />}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Retour */}
      <Link
        href="/login"
        className="mt-6 flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-600 transition-colors duration-200 animate-fade-in-up-3"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Retour à l&apos;accueil
      </Link>
    </div>
  )
}
