"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { filtrerSaisieDecimale, lireNombreSaisi, versChampNombre } from "@/lib/saisie/nombre"

type Props = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "inputMode"> & {
  value: string
  /** Reçoit la saisie filtrée (chiffres et un séparateur), à relire avec `lireNombreSaisi`. */
  onValeur: (saisie: string) => void
  /** Autorise un signe moins en tête. */
  negatif?: boolean
}

/**
 * Champ pour un nombre à décimales : clavier décimal sur téléphone, virgule
 * et point acceptés quelle que soit la langue du navigateur.
 *
 * Un `<input type="number">` suit la langue du NAVIGATEUR : réglé sur
 * l'anglais, il avale la virgule de « 2,50 » et le formulaire envoie 250
 * (équipe debug, D72). Ce champ garde la saisie telle quelle, en texte ;
 * `lireNombreSaisi` la convertit à l'envoi.
 */
export const ChampDecimal = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onValeur, negatif, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...props}
      value={value}
      onChange={(e) => onValeur(filtrerSaisieDecimale(e.target.value, { negatif }))}
    />
  ),
)
ChampDecimal.displayName = "ChampDecimal"

type PropsNombre = Omit<Props, "value" | "onValeur"> & {
  value: number | null | undefined
  /** Reçoit le nombre lu, ou `null` pour un champ vide ou une saisie incomplète. */
  onNombre: (valeur: number | null) => void
}

/**
 * Variante pour un état NUMÉRIQUE (react-hook-form, par exemple) : garde la
 * saisie en texte tant qu'on tape (« 2, » ne redevient pas « 2 »), et se
 * réaligne quand la valeur change de l'extérieur (réinitialisation, choix
 * d'une planche qui préremplit la longueur).
 */
export const ChampDecimalNombre = React.forwardRef<HTMLInputElement, PropsNombre>(
  ({ value, onNombre, ...props }, ref) => {
    const [saisie, setSaisie] = React.useState(() => versChampNombre(value))
    React.useEffect(() => {
      setSaisie((courante) => {
        const lue = lireNombreSaisi(courante)
        const memeValeur = (lue === null || Number.isNaN(lue) ? null : lue) === (value ?? null)
        return memeValeur ? courante : versChampNombre(value)
      })
    }, [value])
    return (
      <ChampDecimal
        ref={ref}
        {...props}
        value={saisie}
        onValeur={(texte) => {
          setSaisie(texte)
          const n = lireNombreSaisi(texte)
          onNombre(n === null || Number.isNaN(n) ? null : n)
        }}
      />
    )
  },
)
ChampDecimalNombre.displayName = "ChampDecimalNombre"
