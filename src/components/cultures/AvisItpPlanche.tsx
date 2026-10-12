"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { LIBELLE_CONDUITE, type MotifProposition, verdictItpPlanche } from "@/lib/cultures/itp-planche"
import { nomAffichableItp } from "@/lib/itp-label"

/**
 * Avis sous le champ « Itinéraire technique » d'une culture (ticket QA
 * cmv4z6yhg) : la conduite de l'ITP (sous abri, plein champ) est confrontée au
 * type de la planche. Sans type de planche, rien n'est supposé : l'avis dit ce
 * qui manque et où le compléter, comme le conseil d'arrosage.
 */
export interface AvisItpPlancheProps {
  itp: { id: string; nom?: string | null; userId?: string | null; typePlanche?: string | null } | null
  planche: { id: string; nom?: string | null; type?: string | null } | null
  /** Pourquoi aucun ITP n'a été proposé d'office (formulaire de création). */
  motifSansProposition?: MotifProposition | null
  className?: string
}

export function AvisItpPlanche({ itp, planche, motifSansProposition = null, className }: AvisItpPlancheProps) {
  if (!planche) return null
  const nomPlanche = planche.nom || planche.id
  const lienPlanche = (
    <Link
      href={`/maraichage/planches/${encodeURIComponent(planche.id)}`}
      // Nouvel onglet : le formulaire en cours ne perd pas sa saisie.
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2"
    >
      Planche à compléter : type (plein champ, serre, tunnel)
    </Link>
  )

  let contenu: React.ReactNode = null
  if (!itp) {
    if (motifSansProposition === "planche_sans_type") {
      contenu = (
        <>
          {/* `{" "}` explicite : JSX retire l'espace en tête d'une ligne de texte
              qui en suit une autre (« Planche 15» constaté en production). */}
          Aucun itinéraire proposé d&rsquo;office : la planche « {nomPlanche}
          {" "}» n&rsquo;a pas de type, et les itinéraires de cette espèce sont conduits sous abri ou en plein champ. Choisissez
          l&rsquo;itinéraire vous-même, ou complétez la planche. {lienPlanche}
        </>
      )
    } else if (motifSansProposition === "aucun_compatible") {
      contenu = <>Aucun itinéraire de cette espèce n&rsquo;est conduit comme la planche « {nomPlanche} » ({planche.type}). Choisissez l&rsquo;itinéraire vous-même.</>
    }
  } else {
    const verdict = verdictItpPlanche(itp, planche)
    const nomItp = nomAffichableItp(itp)
    if (verdict.etat === "planche_sans_type") {
      contenu = (
        <>
          La planche « {nomPlanche} » n&rsquo;a pas de type : l&rsquo;itinéraire « {nomItp} » est conduit {LIBELLE_CONDUITE[verdict.conduite]}, sans
          qu&rsquo;on puisse le vérifier. {lienPlanche}
        </>
      )
    } else if (verdict.etat === "incompatible") {
      contenu = (
        <>
          L&rsquo;itinéraire « {nomItp} » est conduit {LIBELLE_CONDUITE[verdict.conduite]} ; la planche « {nomPlanche} » est{" "}
          {LIBELLE_CONDUITE[verdict.planche]} ({planche.type}). Choisissez un itinéraire {LIBELLE_CONDUITE[verdict.planche]}, ou changez de planche.
        </>
      )
    }
  }
  if (!contenu) return null
  return (
    <p role="status" className={`flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 ${className ?? ""}`}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{contenu}</span>
    </p>
  )
}
