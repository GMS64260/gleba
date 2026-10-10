"use client"

import * as React from "react"
import Link from "next/link"
import { ChatCircleDots, CloudSun, Coins, Drop, MapTrifold, Package, Plant, Stethoscope } from "@/lib/phosphor-icons"

import { ouvrirAssistant } from "@/lib/accueil/evenements"
import type { CarteAccueil, JournalAccueil, StocksAccueil, TresorerieAccueil, VentesAccueil } from "@/lib/accueil/types"
import type { VergerAccueil } from "@/lib/accueil/verger"
import { formatMontantDevise } from "@/lib/format-utils"
import type { ModuleId } from "@/lib/modules"
import { cn } from "@/lib/utils"

import { CLASSES_LIEN_DISCRET } from "./boutons"
import { LigneRegistre } from "./LigneRegistre"
import { PastilleEtat, type EtatRegistre } from "./PastilleEtat"
import { Tuile } from "./Tuile"

/**
 * Tuiles du catalogue (2026-10-10, « chacun construit sa page en fonction de
 * son activité ») : trésorerie et créances, verger à faire, stocks et
 * péremptions, ventes récentes, journal de bord, raccourcis, carte. Chacune
 * reçoit les données composées côté serveur seulement si elle est affichée.
 */

interface PropsCommunes {
  chargement: boolean
  rang?: number
}

function Squelette({ lignes = 2, libelle }: { lignes?: number; libelle: string }) {
  return (
    <ul className="divide-y divide-lin-doux" aria-label={libelle}>
      {Array.from({ length: lignes }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <span className="h-9 w-1 rounded-sm bg-lin" />
          <span className="h-4 w-1/2 rounded bg-lin-doux motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  )
}

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" })
const DATE_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" })

// ── Trésorerie et créances ───────────────────────────────────────────────

export function TuileTresorerie({ tresorerie, chargement, rang }: PropsCommunes & { tresorerie: TresorerieAccueil | null | undefined }) {
  const t = tresorerie ?? null
  const etatCreance = (retard: number): EtatRegistre => (retard > 30 ? "critique" : retard > 0 ? "attention" : "neutre")
  return (
    <Tuile
      idTuile="tresorerie"
      titre="Trésorerie et créances"
      sousTitre={
        t
          ? `résultat ${formatMontantDevise(t.beneficeYtd, t.devise)} · marge ${t.margePercentYtd} %`
          : chargement
            ? "lecture en cours"
            : undefined
      }
      rang={rang}
      actions={
        <Link href="/comptabilite" className={CLASSES_LIEN_DISCRET}>
          Comptabilité
        </Link>
      }
      vide={!chargement && (!t || t.creances.length === 0)}
      messageVide={t ? "Aucune facture en attente d'encaissement." : "Comptabilité indisponible pour le moment."}
      actionVide={
        t && t.nbDepensesNonPayees > 0 ? (
          <Link href="/comptabilite/transactions" className={CLASSES_LIEN_DISCRET}>
            {t.nbDepensesNonPayees} dépense{t.nbDepensesNonPayees > 1 ? "s" : ""} à régler · {formatMontantDevise(t.depensesNonPayees, t.devise)}
          </Link>
        ) : undefined
      }
    >
      {chargement || !t ? (
        <Squelette libelle="Chargement de la trésorerie" />
      ) : (
        <>
          <div role="list">
            {t.creances.map((c) => (
              <LigneRegistre
                key={c.id}
                role="listitem"
                etat={etatCreance(c.retardJours)}
                titre={c.client}
                meta={[c.numero, c.retardJours > 0 ? `échue depuis ${c.retardJours} j` : c.echeance ? `échéance le ${DATE_COURTE.format(new Date(c.echeance))}` : "", formatMontantDevise(c.montant, t.devise)]}
                pastille={<PastilleEtat etat={etatCreance(c.retardJours)} libelle={c.retardJours > 0 ? "À relancer" : "À encaisser"} className="hidden sm:inline-flex" />}
                action={{ libelle: "Ouvrir", href: "/comptabilite/factures" }}
              />
            ))}
          </div>
          <p className="flex flex-wrap justify-between gap-2 border-t border-lin-doux px-4 py-2 text-xs text-ardoise">
            <span>
              À encaisser : <b className="font-semibold text-encre">{formatMontantDevise(t.totalCreances, t.devise)}</b>
            </span>
            {t.nbDepensesNonPayees > 0 && (
              <Link href="/comptabilite/transactions" className="hover:underline">
                {t.nbDepensesNonPayees} dépense{t.nbDepensesNonPayees > 1 ? "s" : ""} à régler · {formatMontantDevise(t.depensesNonPayees, t.devise)}
              </Link>
            )}
          </p>
        </>
      )}
    </Tuile>
  )
}

// ── Verger à faire ───────────────────────────────────────────────────────

export function TuileVerger({ verger, chargement, rang }: PropsCommunes & { verger: VergerAccueil | null | undefined }) {
  const v = verger ?? null
  return (
    <Tuile
      idTuile="verger"
      titre="Verger à faire"
      sousTitre={v ? `${v.counts.aFaire} à faire · ${v.counts.aVenir} à venir` : chargement ? "lecture en cours" : undefined}
      rang={rang}
      actions={
        <Link href="/verger?tab=calendrier" className={CLASSES_LIEN_DISCRET}>
          Calendrier
        </Link>
      }
      vide={!chargement && (!v || v.lots.length === 0)}
      messageVide={v ? "Rien à faire au verger aujourd'hui : les fenêtres ouvertes sont soldées." : "Verger indisponible pour le moment."}
      actionVide={
        <Link href="/verger" className={CLASSES_LIEN_DISCRET}>
          Ouvrir le verger
        </Link>
      }
    >
      {chargement || !v ? (
        <Squelette libelle="Chargement du verger" />
      ) : (
        <div role="list">
          {v.lots.map((lot) => (
            <LigneRegistre
              key={lot.cle}
              role="listitem"
              etat={lot.enRetard ? "critique" : "attention"}
              titre={lot.libelle}
              meta={[
                `${lot.nbArbres} ${lot.nbArbres > 1 ? "arbres" : "arbre"}${lot.nbArbres <= 3 ? ` : ${lot.arbres.join(", ")}` : ""}`,
                lot.fenetre ? `fenêtre ${lot.fenetre}` : lot.echeance ? `prévu le ${DATE_COURTE.format(new Date(lot.echeance))}` : "",
              ]}
              pastille={<PastilleEtat etat={lot.enRetard ? "critique" : "attention"} libelle={lot.enRetard ? "En retard" : "À faire"} className="hidden sm:inline-flex" />}
              action={{ libelle: "Ouvrir", href: "/verger?tab=calendrier" }}
            />
          ))}
        </div>
      )}
    </Tuile>
  )
}

// ── Stocks et péremptions ────────────────────────────────────────────────

export function TuileStocks({ stocks, chargement, rang }: PropsCommunes & { stocks: StocksAccueil | null | undefined }) {
  const s = stocks ?? null
  const n = s ? s.aliments.length + s.peremptions.length : 0
  return (
    <Tuile
      idTuile="stocks"
      titre="Stocks et péremptions"
      sousTitre={s ? (n > 0 ? `${n} à regarder` : "tout est au-dessus des seuils") : chargement ? "lecture en cours" : undefined}
      rang={rang}
      actions={
        <Link href="/elevage?tab=alimentation&sub=stocks" className={CLASSES_LIEN_DISCRET}>
          Stocks
        </Link>
      }
      vide={!chargement && (!s || n === 0)}
      messageVide={s ? "Aliments au-dessus des seuils d'alerte, aucun médicament proche de la péremption." : "Stocks indisponibles pour le moment."}
      actionVide={
        <Link href="/elevage?tab=alimentation&sub=stocks" className={CLASSES_LIEN_DISCRET}>
          Ouvrir les stocks
        </Link>
      }
    >
      {chargement || !s ? (
        <Squelette libelle="Chargement des stocks" />
      ) : (
        <div role="list">
          {s.aliments.map((a) => (
            <LigneRegistre
              key={`aliment:${a.id}`}
              role="listitem"
              etat={a.stock <= 0 ? "critique" : "attention"}
              titre={a.nom}
              meta={[`${a.stock.toLocaleString("fr-FR")} kg en stock`, `seuil ${a.stockMin.toLocaleString("fr-FR")} kg`]}
              pastille={<PastilleEtat etat={a.stock <= 0 ? "critique" : "attention"} libelle={a.stock <= 0 ? "Épuisé" : "Sous le seuil"} className="hidden sm:inline-flex" />}
              action={{ libelle: "Ouvrir", href: "/elevage?tab=alimentation&sub=stocks" }}
            />
          ))}
          {s.peremptions.map((p) => {
            const etat: EtatRegistre = p.joursRestants !== null && p.joursRestants <= 0 ? "critique" : "attention"
            return (
              <LigneRegistre
                key={p.id}
                role="listitem"
                etat={etat}
                titre={p.titre}
                meta={[p.detail ?? ""]}
                pastille={<PastilleEtat etat={etat} libelle={p.joursRestants !== null && p.joursRestants <= 0 ? "Périmé" : "Bientôt périmé"} className="hidden sm:inline-flex" />}
                action={{ libelle: "Ouvrir", href: "/elevage?tab=alimentation&sub=registre" }}
              />
            )
          })}
        </div>
      )}
    </Tuile>
  )
}

// ── Ventes récentes ──────────────────────────────────────────────────────

export function TuileVentes({ ventes, chargement, rang }: PropsCommunes & { ventes: VentesAccueil | null | undefined }) {
  const v = ventes ?? null
  return (
    <Tuile
      idTuile="ventes"
      titre="Ventes récentes"
      sousTitre={v ? `${formatMontantDevise(v.totalMois, v.devise)} ce mois · ${v.nbMois} vente${v.nbMois > 1 ? "s" : ""}` : chargement ? "lecture en cours" : undefined}
      rang={rang}
      actions={
        <Link href="/comptabilite/transactions" className={CLASSES_LIEN_DISCRET}>
          Transactions
        </Link>
      }
      vide={!chargement && (!v || v.dernieres.length === 0)}
      messageVide={v ? "Aucune vente enregistrée pour l'instant." : "Ventes indisponibles pour le moment."}
      actionVide={
        <Link href="/comptabilite/transactions" className={CLASSES_LIEN_DISCRET}>
          Saisir une vente
        </Link>
      }
    >
      {chargement || !v ? (
        <Squelette libelle="Chargement des ventes" />
      ) : (
        <div role="list">
          {v.dernieres.map((x) => (
            <LigneRegistre
              key={x.id}
              role="listitem"
              etat={x.paye ? "ok" : "attention"}
              titre={x.description}
              meta={[DATE_COURTE.format(new Date(x.date)), x.client ?? "", formatMontantDevise(x.montant, v.devise)]}
              pastille={x.paye ? undefined : <PastilleEtat etat="attention" libelle="À encaisser" className="hidden sm:inline-flex" />}
            />
          ))}
        </div>
      )}
    </Tuile>
  )
}

// ── Journal de bord ──────────────────────────────────────────────────────

export function TuileJournal({ journal, chargement, rang }: PropsCommunes & { journal: JournalAccueil | null | undefined }) {
  const j = journal ?? null
  return (
    <Tuile
      idTuile="journal"
      titre="Journal de bord"
      sousTitre={j ? (j.entrees.length > 0 ? "dernières interventions" : undefined) : chargement ? "lecture en cours" : undefined}
      rang={rang}
      actions={
        <Link href="/interventions" className={CLASSES_LIEN_DISCRET}>
          Interventions
        </Link>
      }
      vide={!chargement && (!j || j.entrees.length === 0)}
      messageVide={j ? "Rien dans le journal. Une intervention notée ici garde la trace de votre travail." : "Journal indisponible pour le moment."}
      actionVide={
        <Link href="/interventions" className={CLASSES_LIEN_DISCRET}>
          Noter une intervention
        </Link>
      }
    >
      {chargement || !j ? (
        <Squelette libelle="Chargement du journal" />
      ) : (
        <div role="list">
          {j.entrees.map((e) => (
            <LigneRegistre
              key={e.id}
              role="listitem"
              etat="ok"
              titre={<span className="capitalize">{e.titre}</span>}
              meta={[DATE_JOUR.format(new Date(e.date)), e.detail ?? ""]}
              action={{ libelle: "Ouvrir", href: e.href }}
            />
          ))}
        </div>
      )}
    </Tuile>
  )
}

// ── Raccourcis ───────────────────────────────────────────────────────────

interface Raccourci {
  libelle: string
  detail: string
  icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  href?: string
  onClick?: () => void
  module?: ModuleId
}

const RACCOURCIS: Raccourci[] = [
  { libelle: "Noter une récolte", detail: "quantité, planche, date", icone: Package, href: "/maraichage/recoltes", module: "maraichage" },
  { libelle: "Arrosage et tâches", detail: "la semaine au champ", icone: Drop, href: "/taches", module: "maraichage" },
  { libelle: "Soin", detail: "vaccin, vermifuge, traitement", icone: Stethoscope, href: "/elevage?tab=alimentation&sub=soins", module: "elevage" },
  { libelle: "Vente ou dépense", detail: "saisie comptable", icone: Coins, href: "/comptabilite/transactions", module: "comptabilite" },
  { libelle: "Plan de la ferme", detail: "planches, arbres, objets", icone: Plant, href: "/jardin" },
  { libelle: "Carte", detail: "parcelles et cadastre", icone: MapTrifold, href: "/parcelles" },
  { libelle: "Météo", detail: "prévisions à la parcelle", icone: CloudSun, href: "/meteo" },
  { libelle: "Demander à Gleba", detail: "une question, une dictée", icone: ChatCircleDots, onClick: () => ouvrirAssistant() },
]

const CLASSES_RACCOURCI =
  "flex min-h-11 items-center gap-2.5 rounded-lg border border-lin bg-craie px-3 py-2 text-left text-sm text-encre transition-colors duration-fast hover:border-sauge hover:bg-sauge-doux focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"

export function TuileRaccourcis({ modules, rang }: { modules: readonly ModuleId[]; rang?: number }) {
  const visibles = RACCOURCIS.filter((r) => !r.module || modules.includes(r.module))
  return (
    <Tuile idTuile="raccourcis" titre="Raccourcis" sousTitre="en un geste" rang={rang}>
      <ul className="grid gap-2 p-3 sm:grid-cols-2">
        {visibles.map((r) => {
          const contenu = (
            <>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sauge-doux text-sauge" aria-hidden>
                <r.icone className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-tight">
                <b className="block truncate font-semibold">{r.libelle}</b>
                <span className="block truncate text-xs text-ardoise">{r.detail}</span>
              </span>
            </>
          )
          return (
            <li key={r.libelle} className="min-w-0">
              {r.href ? (
                <Link href={r.href} className={CLASSES_RACCOURCI}>
                  {contenu}
                </Link>
              ) : (
                <button type="button" onClick={r.onClick} className={cn(CLASSES_RACCOURCI, "w-full")}>
                  {contenu}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Tuile>
  )
}

// ── Carte ────────────────────────────────────────────────────────────────

export function TuileCarte({ carte, chargement, rang }: PropsCommunes & { carte: CarteAccueil | null | undefined }) {
  const c = carte ?? null
  const v = c?.vignette
  return (
    <Tuile
      idTuile="carte"
      titre="Carte"
      sousTitre={c ? `${c.nbParcelles} parcelle${c.nbParcelles > 1 ? "s" : ""}${c.surfaceHa > 0 ? ` · ${c.surfaceHa.toLocaleString("fr-FR")} ha` : ""}` : chargement ? "lecture en cours" : undefined}
      rang={rang}
      actions={
        <Link href="/parcelles" className={CLASSES_LIEN_DISCRET}>
          Ouvrir la carte
        </Link>
      }
      vide={!chargement && (!c || !v || v.formes.length === 0)}
      messageVide={c ? "Aucune parcelle dessinée. La carte permet d'importer le cadastre ou de tracer à la main." : "Carte indisponible pour le moment."}
      actionVide={
        <Link href="/parcelles" className={CLASSES_LIEN_DISCRET}>
          Dessiner une parcelle
        </Link>
      }
    >
      {chargement || !c || !v ? (
        <div className="m-3 h-40 rounded-xl bg-lin-doux motion-safe:animate-pulse" aria-label="Chargement de la carte" />
      ) : (
        <Link href="/parcelles" className="block p-3" title="Ouvrir la carte">
          <svg viewBox={`0 0 ${v.largeur} ${v.hauteur}`} className="h-auto w-full rounded-xl bg-[#e6ecdf] dark:bg-[#1f2a22]" role="img" aria-label={`Carte des parcelles : ${v.formes.map((f) => f.nom).join(", ")}`}>
            {v.formes.map((f) =>
              f.anneaux.map((points, i) => (
                <polygon
                  key={`${f.id}:${i}`}
                  points={points}
                  fill={f.couleur ?? "var(--sauge)"}
                  fillOpacity={0.35}
                  stroke={f.couleur ?? "var(--foret)"}
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                >
                  <title>{f.nom}</title>
                </polygon>
              )),
            )}
          </svg>
        </Link>
      )}
    </Tuile>
  )
}
