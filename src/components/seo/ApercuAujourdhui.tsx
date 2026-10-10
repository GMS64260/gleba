import {
  CalendarCheck,
  Cloud,
  CloudRain,
  CloudSun,
  Leaf,
  MapTrifold,
  Plant,
  Snowflake,
  Sparkle,
  Sun,
  Tree,
  Wallet,
  Bird,
} from "@/lib/phosphor-icons"

import { LigneRegistre } from "@/components/accueil/LigneRegistre"
import { PastilleEtat, type EtatRegistre } from "@/components/accueil/PastilleEtat"
import { Repere } from "@/components/accueil/Repere"
import { cn } from "@/lib/utils"

/**
 * Aperçu de l'écran « Aujourd'hui » pour la vitrine : les vrais composants de
 * l'accueil v2 (repères, lignes de registre, pastilles) remplis avec une
 * journée d'exemple, sans aucune donnée de compte. Rendu serveur, net à toute
 * résolution et sans image au premier affichage.
 *
 * Illustration, pas une interface : rien n'y est focalisable, le bloc est
 * masqué aux lecteurs d'écran et décrit par la légende de la figure.
 */

type Ligne = { etat: EtatRegistre; titre: string; meta: string[]; pastille: string; action: string }

const LIGNES: Ligne[] = [
  { etat: "critique", titre: "Arroser B3, B4", meta: ["Laitues, Radis", "réserve du sol basse", "pas de pluie avant vendredi"], pastille: "À arroser", action: "Noter" },
  { etat: "critique", titre: "Récolter Radis de 18 jours", meta: ["C1", "prêts depuis 3 j"], pastille: "En retard", action: "Récolter" },
  { etat: "attention", titre: "Semer Carotte Nantaise", meta: ["A2", "fenêtre sèche ce matin"], pastille: "À semer", action: "Fait" },
  { etat: "attention", titre: "Planter Tomate Cœur de bœuf", meta: ["Serre S1", "28 plants"], pastille: "À planter", action: "Fait" },
  { etat: "info", titre: "Vermifuge · Poules pondeuses", meta: ["lot de 24", "prévu jeudi"], pastille: "Sous 7 j", action: "Ouvrir" },
  { etat: "neutre", titre: "Relancer la facture F-2026-0014", meta: ["Épicerie du village", "échue depuis 9 j", "186,00 €"], pastille: "Échue", action: "Ouvrir" },
]

const RAIL = [
  { libelle: "Aujourd'hui", icone: CalendarCheck, actif: true },
  { libelle: "Plan & carte", icone: MapTrifold },
  { libelle: "Cultures", icone: Plant },
  { libelle: "Verger", icone: Tree },
  { libelle: "Élevage", icone: Bird },
  { libelle: "Comptabilité", icone: Wallet },
  { libelle: "Météo", icone: CloudSun },
]

const SEMAINE = [
  { jour: "mar", icone: Sun, max: 18, detail: "sec" },
  { jour: "mer", icone: CloudSun, max: 17, detail: "sec" },
  { jour: "jeu", icone: Snowflake, max: 9, detail: "gel −1°", alerte: true },
  { jour: "ven", icone: CloudRain, max: 12, detail: "6 mm" },
  { jour: "sam", icone: CloudRain, max: 13, detail: "3 mm" },
  { jour: "dim", icone: CloudSun, max: 16, detail: "sec" },
  { jour: "lun", icone: Cloud, max: 15, detail: "sec" },
]

// Planches du plan d'exemple : x, y, largeur, hauteur, état du jour.
const PLANCHES: [number, number, number, number, "arroser" | "recolter" | "neutre"][] = [
  [18, 22, 12, 76, "neutre"],
  [36, 22, 12, 76, "arroser"],
  [54, 22, 12, 76, "arroser"],
  [72, 22, 12, 76, "recolter"],
  [90, 22, 12, 76, "neutre"],
  [108, 22, 12, 76, "neutre"],
  [126, 22, 12, 76, "neutre"],
  [18, 110, 66, 26, "neutre"],
]

const ARBRES: [number, number, number][] = [
  [168, 30, 11], [196, 46, 13], [222, 28, 10], [176, 74, 12], [208, 92, 14], [236, 70, 10], [182, 118, 11], [226, 124, 12],
]

const COULEUR_PLANCHE = {
  arroser: "fill-argile-doux stroke-argile",
  recolter: "fill-paille-doux stroke-paille",
  neutre: "fill-lin-doux stroke-lin",
}

const ACTION = "inline-flex min-h-9 items-center rounded-lg border border-lin bg-craie px-3 text-[13px] font-semibold text-sauge"

function Cadre({ titre, sousTitre, droite, children, className }: { titre: string; sousTitre?: string; droite?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl border border-lin bg-craie", className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-lin px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">{titre}</p>
          {sousTitre && <p className="mt-0.5 text-xs text-ardoise">{sousTitre}</p>}
        </div>
        {droite && <span className="text-xs font-semibold text-sauge">{droite}</span>}
      </div>
      {children}
    </div>
  )
}

export function ApercuAujourdhui({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none select-none overflow-hidden rounded-[20px] border border-lin bg-papier text-left text-encre shadow-fiche",
        className,
      )}
    >
      <div className="flex">
        {/* Rail de navigation, comme dans l'application en bureau */}
        <div className="hidden w-[188px] shrink-0 flex-col gap-0.5 border-r border-lin bg-craie px-3 pb-6 pt-4 lg:flex">
          <p className="mb-3 px-2 font-display text-[22px] font-semibold text-foret">Gleba</p>
          {RAIL.map(({ libelle, icone: Icone, actif }) => (
            <span
              key={libelle}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px]",
                actif ? "bg-sauge-doux font-semibold text-foret" : "text-encre",
              )}
            >
              <Icone className="h-[18px] w-[18px] shrink-0" weight={actif ? "duotone" : "regular"} />
              {libelle}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-3.5 p-3.5 sm:p-5">
          {/* Barre de commande et météo du moment */}
          <div className="flex items-center gap-3">
            <div className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-lin bg-craie px-3.5 text-[13.5px] text-ardoise">
              <Sparkle className="h-4 w-4 shrink-0 text-sauge" weight="duotone" />
              <span className="truncate">Demander ou chercher dans Gleba…</span>
            </div>
            <div className="hidden items-center gap-2 text-[13px] text-ardoise md:flex">
              <CloudSun className="h-5 w-5 text-paille" weight="duotone" />
              <span>
                <b className="font-semibold text-encre">11 °C</b> · Potager nord
              </span>
            </div>
          </div>

          {/* En-tête : date et fenêtre de travail */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-[28px] font-medium leading-tight tracking-tight sm:text-[32px]">Mardi 14 avril</p>
              <p className="mt-0.5 text-[13.5px] text-ardoise">
                Fenêtre de travail : <b className="font-semibold text-prairie">matinée sèche</b> · vent 9 km/h · gel possible jeudi
              </p>
            </div>
            <div className="hidden gap-2 sm:flex">
              <span className="inline-flex min-h-10 items-center rounded-lg border border-lin bg-craie px-3.5 text-sm font-semibold">Noter</span>
              <span className="inline-flex min-h-10 items-center rounded-lg border border-sauge bg-sauge px-3.5 text-sm font-semibold text-craie">+ Récolte</span>
            </div>
          </div>

          {/* Repères */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Repere libelle="Cultures en place" valeur="38" unite="/ 41" detail="3 non démarrées" />
            <Repere libelle="Surface cultivée" valeur="1 240" unite="m²" detail="26 planches" />
            <Repere libelle="Récoltes 2026" valeur="412" unite="kg" detail="+64 kg cette semaine" className="hidden lg:block" />
            <Repere libelle="Semaine" valeur="14" unite="tâches" alerte="3 en retard" className="hidden lg:block" />
          </div>

          <div className="grid gap-3.5 lg:grid-cols-12">
            {/* Liste du jour */}
            <Cadre titre="Aujourd'hui" sousTitre="6 choses · classées par urgence" className="lg:col-span-7">
              <div>
                {LIGNES.map((l, i) => (
                  <LigneRegistre
                    key={l.titre}
                    etat={l.etat}
                    titre={l.titre}
                    meta={l.meta}
                    pastille={<PastilleEtat etat={l.etat} libelle={l.pastille} className="hidden sm:inline-flex" />}
                    secondaire={<span className={ACTION}>{l.action}</span>}
                    className={cn("py-2.5", i >= 4 && "hidden sm:grid")}
                  />
                ))}
              </div>
            </Cadre>

            <div className="hidden min-w-0 flex-col gap-3.5 lg:col-span-5 lg:flex">
              {/* Plan vivant */}
              <Cadre titre="Plan" sousTitre="Potager nord · état du jour peint sur les planches" droite="Ouvrir">
                <div className="px-3 pb-2 pt-3">
                  <svg viewBox="0 0 260 146" className="h-auto w-full" role="presentation">
                    <rect x="2" y="2" width="256" height="142" rx="10" className="fill-sauge-doux stroke-lin" />
                    <path d="M4 104 C 60 98, 120 140, 256 112" className="fill-none stroke-lin" strokeWidth="5" strokeLinecap="round" />
                    {PLANCHES.map(([x, y, w, h, etat], i) => (
                      <rect key={i} x={x} y={y} width={w} height={h} rx="2" strokeWidth="1.5" className={COULEUR_PLANCHE[etat]} />
                    ))}
                    {ARBRES.map(([cx, cy, r], i) => (
                      <circle key={i} cx={cx} cy={cy} r={r} className="fill-craie stroke-prairie" strokeWidth="1.2" />
                    ))}
                  </svg>
                  <p className="mt-2 flex gap-4 text-xs text-ardoise">
                    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-argile" />2 à arroser</span>
                    <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-paille" />1 à récolter</span>
                    <span className="inline-flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-prairie" />8 arbres</span>
                  </p>
                </div>
              </Cadre>

              {/* Semaine météo */}
              <Cadre titre="Semaine" sousTitre="Prévisions à la parcelle" droite="Météo">
                <div className="grid grid-cols-7 gap-1 px-2 py-3 text-center">
                  {SEMAINE.map(({ jour, icone: Icone, max, detail, alerte }, i) => (
                    <div key={jour} className={cn("rounded-lg py-1.5", i === 0 && "bg-eau-doux", alerte && "bg-argile-doux")}>
                      <p className="text-[11px] text-ardoise">{jour}</p>
                      <Icone className={cn("mx-auto my-0.5 h-4 w-4", alerte ? "text-argile" : "text-eau")} weight="duotone" />
                      <p className="text-[13px] font-semibold tabular-nums">{max}°</p>
                      <p className={cn("text-[10.5px]", alerte ? "font-semibold text-argile" : "text-ardoise")}>{detail}</p>
                    </div>
                  ))}
                </div>
              </Cadre>
            </div>
          </div>

          {/* Agent */}
          <div className="hidden items-center gap-3 rounded-2xl border border-lin bg-craie px-4 py-3 lg:flex">
            <Snowflake className="h-5 w-5 shrink-0 text-argile" weight="duotone" />
            <p className="min-w-0 flex-1 text-[13.5px]">
              <b className="font-semibold">Gel annoncé jeudi au lever du jour</b>
              <span className="text-ardoise"> · −1 °C prévu sur la parcelle Potager nord.</span>
            </p>
            <span className={ACTION}>Demander à Gleba</span>
          </div>
        </div>
      </div>
    </div>
  )
}
