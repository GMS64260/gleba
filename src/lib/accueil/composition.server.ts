/**
 * Composition serveur de l'accueil v2 (« La ferme d'abord », bento) : la
 * liste Aujourd'hui classée par urgence, l'état du jour des planches pour la
 * vignette du plan, les repères et l'agenda élevage, en UNE réponse.
 *
 * Règles (plan d'implémentation du 2026-10-08) :
 * - on appelle les services existants (`getTachesPotager`,
 *   `computeConseilIrrigation`, `getKpiMaraichage`, `getKpiCompta`,
 *   `chargerAgendaElevage`, `chargerDeclarationsReglementaires`), jamais un
 *   second calcul ;
 * - lecture seule : aucune auto-validation persistée, même pour un compte
 *   qui pourrait écrire (`persistAutoValidation: false`) ;
 * - scopée par le TENANT (`getUserId`) pour les données métier, par
 *   l'ACTEUR (`getActeurId`) pour les préférences, comme les routes appelées ;
 * - une source en panne ne vide pas la page : elle est nommée dans
 *   `sourcesEnErreur` et l'écran le dit.
 */

import prisma from "@/lib/prisma"
import type { SessionExploitation } from "@/lib/auth-utils"
import { getActeurId, getUserId } from "@/lib/exploitation/garde-session"
import { getTachesPotager } from "@/lib/taches-potager"
import { computeConseilIrrigation } from "@/lib/irrigation-conseil"
import { getKpiCompta, getKpiMaraichage } from "@/lib/kpi"
import { chargerAgendaElevage } from "@/lib/elevage/agenda.server"
import { chargerDeclarationsReglementaires } from "@/lib/elevage/declarations-reglementaires.server"
import { DEFAULT_MODULES_ACTIFS, sanitizeModulesActifs, type ModuleId } from "@/lib/modules"
import { formatMontantDevise } from "@/lib/format-utils"
import { deviseDuTerritoire } from "@/lib/territoires"

import {
  bornesSemaineISO,
  classerParUrgence,
  etatPourRetard,
  jourLocalISO,
  libelleRetard,
  listerNoms,
} from "./classement"
import { echeanceDuJour, etatEcheance, hrefEcheance } from "./elevage"
import { recolteDominante } from "./reperes"
import { mutationEtapeCulture, mutationIrrigationFaite } from "./mutations"

/** Une variété de repli (« Non spécifiée ») n'est pas une information à afficher. */
function varieteAffichable(nom: string | null | undefined): string {
  if (!nom) return ""
  return /non sp[ée]cifi/i.test(nom) ? "" : nom
}
import type {
  AccueilAujourdhui,
  ElementAujourdhui,
  EtatPlanche,
  EtatRegistre,
  PlanVignetteDonnees,
  ReperesAccueil,
} from "./types"

export interface OptionsComposition {
  /** Instant de référence (tests). */
  maintenant?: Date
}

/** Largeur et longueur par défaut d'une planche sans dimensions, comme le plan 2D. */
const PLANCHE_LARGEUR_DEFAUT = 0.8
const PLANCHE_LONGUEUR_DEFAUT = 2

/** Horizon de l'agenda élevage affiché à l'accueil. */
const HORIZON_ELEVAGE_JOURS = 7

async function lireModulesAffichables(acteurId: string, restriction: ModuleId[] | null | undefined): Promise<ModuleId[]> {
  let modules: ModuleId[] = DEFAULT_MODULES_ACTIFS
  try {
    const pref = await prisma.userPreference.findUnique({
      where: { userId_key: { userId: acteurId, key: "modulesActifs" } },
      select: { value: true },
    })
    if (pref) {
      let valeur: unknown
      try {
        valeur = JSON.parse(pref.value)
      } catch {
        valeur = pref.value
      }
      modules = sanitizeModulesActifs(valeur)
    }
  } catch (e) {
    console.error("[accueil] préférence modulesActifs illisible :", e)
  }
  // Les modules d'un membre organisent l'affichage ; la restriction de
  // l'exploitation (propriétaire) s'y ajoute. Aucun n'est une autorisation.
  return restriction ? modules.filter((m) => restriction.includes(m)) : modules
}

export async function composerAujourdhui(
  session: SessionExploitation,
  options: OptionsComposition = {},
): Promise<AccueilAujourdhui> {
  const maintenant = options.maintenant ?? new Date()
  const userId = getUserId(session)
  const acteurId = getActeurId(session)
  const annee = maintenant.getFullYear()
  const aujourdhui = jourLocalISO(maintenant)
  const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate())
  const semaine = bornesSemaineISO(maintenant)
  const sourcesEnErreur = new Set<string>()

  const lire = async <T>(source: string, fn: () => Promise<T>, repli: T): Promise<T> => {
    try {
      return await fn()
    } catch (e) {
      console.error(`[accueil] source « ${source} » en erreur :`, e)
      sourcesEnErreur.add(source)
      return repli
    }
  }

  const [modules, exploitation] = await Promise.all([
    lireModulesAffichables(acteurId, session.user.modulesExploitation ?? null),
    lire(
      "exploitation",
      () => prisma.exploitation.findUnique({ where: { userId }, select: { raisonSociale: true, territoire: true } }),
      null,
    ),
  ])
  const maraichageActif = modules.includes("maraichage")
  const elevageActif = modules.includes("elevage")
  const comptaActif = modules.includes("comptabilite")
  const devise = deviseDuTerritoire(exploitation?.territoire)

  const [taches, conseil, kpiMaraichage, agenda, animauxActifs, declarations, factures, kpiCompta, planches, arbres, objets] =
    await Promise.all([
      maraichageActif
        ? lire(
            "tâches",
            () => getTachesPotager(userId, { start: semaine.debut, end: semaine.fin, annee, persistAutoValidation: false }),
            null,
          )
        : null,
      maraichageActif ? lire("irrigation", () => computeConseilIrrigation(userId, annee, false), null) : null,
      maraichageActif ? lire("repères maraîchage", () => getKpiMaraichage(userId, annee, maintenant), null) : null,
      elevageActif
        ? lire("élevage", () => chargerAgendaElevage(userId, { horizonJours: HORIZON_ELEVAGE_JOURS, maintenant }), null)
        : null,
      elevageActif ? lire("élevage", () => prisma.animal.count({ where: { userId, statut: "actif" } }), 0) : 0,
      elevageActif
        ? lire("déclarations", () => chargerDeclarationsReglementaires(userId, { year: annee, maintenant }), null)
        : null,
      comptaActif
        ? lire(
            "factures",
            () =>
              prisma.facture.findMany({
                where: {
                  userId,
                  type: { not: "avoir" },
                  OR: [{ statut: "brouillon" }, { statut: "emise", dateEcheance: { lt: debutJour } }],
                },
                select: { id: true, numero: true, statut: true, clientNom: true, totalTTC: true, dateEcheance: true, date: true },
                orderBy: { date: "desc" },
                take: 20,
              }),
            [],
          )
        : [],
      comptaActif ? lire("repères comptabilité", () => getKpiCompta(userId, annee, maintenant), null) : null,
      lire(
        "plan",
        () =>
          prisma.planche.findMany({
            where: { userId },
            select: {
              id: true,
              nom: true,
              posX: true,
              posY: true,
              largeur: true,
              longueur: true,
              rotation2D: true,
              // Même définition de « culture en place » que GET /api/jardin :
              // année courante non terminée, ou vivace non terminée.
              cultures: {
                where: { terminee: null, OR: [{ annee }, { espece: { vivace: true } }] },
                select: { id: true },
              },
            },
          }),
        [],
      ),
      lire(
        "plan",
        () => prisma.arbre.findMany({ where: { userId }, select: { id: true, posX: true, posY: true, envergure: true } }),
        [],
      ),
      lire(
        "plan",
        () =>
          prisma.objetJardin.findMany({
            where: { userId },
            select: { id: true, type: true, posX: true, posY: true, largeur: true, longueur: true, rotation2D: true },
          }),
        [],
      ),
    ])

  const elements: ElementAujourdhui[] = []
  const planchesAArroser = new Set<string>()
  const planchesARecolter = new Set<string>()

  // ── Irrigation : conseil (réserve en eau) ─────────────────────────────
  if (conseil) {
    const pousser = (urgence: "critique" | "haute", etat: EtatRegistre) => {
      const groupe = conseil.data.filter((c) => c.urgence === urgence)
      if (groupe.length === 0) return
      const ids = Array.from(new Set(groupe.map((c) => c.planche?.id).filter((id): id is string => Boolean(id))))
      const noms = groupe.map((c) => c.planche?.nom).filter((n): n is string => Boolean(n))
      ids.forEach((id) => planchesAArroser.add(id))
      const liste = listerNoms(noms)
      elements.push({
        id: `irrigation:${urgence}`,
        source: "irrigation",
        module: "maraichage",
        etat,
        titre: liste ? `Arroser ${liste}` : `Arroser ${groupe.length} culture${groupe.length > 1 ? "s" : ""}`,
        meta: [
          `${groupe.length} culture${groupe.length > 1 ? "s" : ""}`,
          groupe[0].raisonUrgence,
        ].filter((m): m is string => Boolean(m)),
        action: { libelle: "Noter", href: "/maraichage/cultures/irriguer" },
        retardJours: urgence === "critique" ? 1 : 0,
        plancheIds: ids,
      })
    }
    pousser("critique", "critique")
    pousser("haute", "attention")
  }

  // ── Tâches du calendrier : du jour ou en retard ───────────────────────
  const estDuJourOuEnRetard = (t: { date: string; fait: boolean; retardJours: number }) =>
    !t.fait && (t.retardJours > 0 || (t.date !== "" && jourLocalISO(new Date(t.date)) === aujourdhui))

  if (taches) {
    for (const r of taches.recoltes.filter(estDuJourOuEnRetard)) {
      if (r.plancheRefId) planchesARecolter.add(r.plancheRefId)
      elements.push({
        id: `recolte:${r.id}`,
        source: "recolte",
        module: "maraichage",
        etat: etatPourRetard(r.retardJours, { critiqueApres: 21 }),
        titre: `Récolter ${r.especeNom}${r.plancheId ? ` ${r.plancheId}` : ""}`,
        meta: [r.retardJours > 0 ? `prête depuis ${r.retardJours} j` : "prête aujourd'hui", varieteAffichable(r.varieteNom)].filter(Boolean),
        action: { libelle: "Récolte", href: "/maraichage/recoltes" },
        retardJours: r.retardJours,
        plancheIds: r.plancheRefId ? [r.plancheRefId] : [],
      })
    }
    for (const s of taches.semis.filter(estDuJourOuEnRetard)) {
      elements.push({
        id: `semis:${s.id}`,
        source: "semis",
        module: "maraichage",
        etat: etatPourRetard(s.retardJours),
        titre: `Semer ${s.especeNom}${s.plancheId ? ` ${s.plancheId}` : ""}`,
        meta: [libelleRetard(s.retardJours), varieteAffichable(s.varieteNom)].filter(Boolean),
        action: {
          libelle: "Fait",
          href: "/taches",
          mutation: mutationEtapeCulture(s.id, "semis", [s.especeNom, s.plancheId].filter(Boolean).join(" · ")),
        },
        retardJours: s.retardJours,
        plancheIds: s.plancheRefId ? [s.plancheRefId] : [],
      })
    }
    for (const p of taches.plantations.filter(estDuJourOuEnRetard)) {
      elements.push({
        id: `plantation:${p.id}`,
        source: "plantation",
        module: "maraichage",
        etat: etatPourRetard(p.retardJours),
        titre: `Planter ${p.especeNom}${p.plancheId ? ` ${p.plancheId}` : ""}`,
        meta: [libelleRetard(p.retardJours), varieteAffichable(p.varieteNom)].filter(Boolean),
        action: {
          libelle: "Fait",
          href: "/taches",
          mutation: mutationEtapeCulture(p.id, "plantation", [p.especeNom, p.plancheId].filter(Boolean).join(" · ")),
        },
        retardJours: p.retardJours,
        plancheIds: p.plancheRefId ? [p.plancheRefId] : [],
      })
    }
    for (const i of taches.irrigation) {
      if (i.fait || i.probablementInutile) continue
      if (!estDuJourOuEnRetard({ date: i.datePrevue, fait: i.fait, retardJours: i.retardJours })) continue
      // Déjà couvert par le conseil d'irrigation (même planche) : une seule ligne.
      if (i.plancheRefId && planchesAArroser.has(i.plancheRefId)) continue
      if (i.plancheRefId) planchesAArroser.add(i.plancheRefId)
      elements.push({
        id: `irrigation:planifiee:${i.id}`,
        source: "irrigation",
        module: "maraichage",
        etat: etatPourRetard(i.retardJours, { critiqueApres: 2 }),
        titre: `Arroser ${i.plancheId ?? i.especeNom}`,
        meta: [i.plancheId ? i.especeNom : "", i.retardJours > 0 ? `prévu il y a ${i.retardJours} j` : "prévu aujourd'hui"].filter(
          Boolean,
        ),
        action: {
          libelle: "Noter",
          href: "/taches",
          mutation: mutationIrrigationFaite(i.id, [i.especeNom, i.plancheId].filter(Boolean).join(" · ")),
        },
        retardJours: i.retardJours,
        plancheIds: i.plancheRefId ? [i.plancheRefId] : [],
      })
    }
  }

  // ── Élevage : échéances du jour ou urgentes ───────────────────────────
  if (agenda) {
    for (const e of agenda.echeances.filter(echeanceDuJour)) {
      elements.push({
        id: `elevage:${e.id}`,
        source: "elevage",
        module: "elevage",
        etat: etatEcheance(e),
        titre: e.titre,
        meta: [e.detail ?? ""].filter(Boolean),
        action: { libelle: "Ouvrir", href: hrefEcheance(e) },
        retardJours: -(e.joursRestants ?? 0),
        plancheIds: [],
      })
    }
  }

  // ── Déclarations réglementaires sous délai ────────────────────────────
  if (declarations) {
    for (const d of declarations.declarations) {
      const aFaire = d.statut === "A_DECLARER" || d.statut === "HORS_DELAI" || d.statut === "A_COMPLETER"
      if (!aFaire || d.joursRestants > 7) continue
      const retard = -d.joursRestants
      elements.push({
        id: `declaration:${d.key}`,
        source: "declaration",
        module: "elevage",
        etat: d.statut === "HORS_DELAI" ? "critique" : etatPourRetard(retard, { critiqueApres: 0 }),
        titre: `Déclarer ${d.libelle}`,
        meta: [d.organisme, retard > 0 ? `hors délai depuis ${retard} j` : d.joursRestants === 0 ? "dernier jour" : `sous ${d.joursRestants} j`],
        action: { libelle: "Ouvrir", href: "/elevage?tab=alimentation&sub=registre" },
        retardJours: retard,
        plancheIds: [],
      })
    }
  }

  // ── Comptabilité : brouillons prêts et créances échues ────────────────
  for (const f of factures) {
    const montant = formatMontantDevise(f.totalTTC, devise)
    if (f.statut === "brouillon") {
      elements.push({
        id: `facture:${f.id}`,
        source: "facture",
        module: "comptabilite",
        etat: "ok",
        titre: `Facture ${f.clientNom}`,
        meta: ["brouillon prêt", montant],
        action: { libelle: "Envoyer", href: "/comptabilite/factures" },
        retardJours: 0,
        plancheIds: [],
      })
      continue
    }
    const echeance = f.dateEcheance ? new Date(f.dateEcheance) : null
    const retard = echeance ? Math.max(0, Math.round((debutJour.getTime() - echeance.getTime()) / 86_400_000)) : 0
    elements.push({
      id: `creance:${f.id}`,
      source: "creance",
      module: "comptabilite",
      etat: etatPourRetard(retard, { critiqueApres: 30 }),
      titre: `Relancer ${f.clientNom}`,
      meta: [f.numero, `échue depuis ${retard} j`, montant],
      action: { libelle: "Ouvrir", href: "/comptabilite/factures" },
      retardJours: retard,
      plancheIds: [],
    })
  }

  // ── Vignette du plan : état du jour peint sur les planches ────────────
  const plan: PlanVignetteDonnees = {
    planches: planches
      .filter((p) => p.posX !== null && p.posY !== null)
      .map((p) => {
        let etat: EtatPlanche = p.cultures.length > 0 ? "en-place" : "libre"
        if (planchesAArroser.has(p.id)) etat = "arroser"
        else if (planchesARecolter.has(p.id)) etat = "recolter"
        return {
          id: p.id,
          nom: p.nom,
          posX: p.posX as number,
          posY: p.posY as number,
          largeur: p.largeur ?? PLANCHE_LARGEUR_DEFAUT,
          longueur: p.longueur ?? PLANCHE_LONGUEUR_DEFAUT,
          rotation2D: p.rotation2D ?? 0,
          etat,
        }
      }),
    arbres: arbres.map((a) => ({ id: a.id, posX: a.posX, posY: a.posY, envergure: a.envergure })),
    objets: objets.map((o) => ({
      id: o.id,
      type: o.type,
      posX: o.posX,
      posY: o.posY,
      largeur: o.largeur,
      longueur: o.longueur,
      rotation2D: o.rotation2D,
    })),
  }

  // ── Repères ───────────────────────────────────────────────────────────
  const tachesSemaine = taches
    ? [...taches.semis, ...taches.plantations, ...taches.recoltes, ...taches.irrigation].filter(
        (t) => !t.fait,
      )
    : []
  const reperes: ReperesAccueil = {
    maraichage: kpiMaraichage
      ? {
          culturesActives: kpiMaraichage.culturesActives,
          culturesPlanifiees: kpiMaraichage.culturesPlanifiees,
          surfaceCultiveeM2: Math.round(kpiMaraichage.surfaceCultiveeM2),
          planchesCount: kpiMaraichage.planchesCount,
          recoltes: recolteDominante(kpiMaraichage),
        }
      : null,
    comptabilite: kpiCompta
      ? {
          beneficeYtd: Math.round(kpiCompta.beneficeYtd),
          margePercentYtd: Math.round(kpiCompta.margePercentYtd),
          nbRevenusNonPayes: kpiCompta.nbRevenusNonPayes,
          devise,
        }
      : null,
    semaine: {
      aFaire: tachesSemaine.length,
      enRetard: taches?.stats.enRetard ?? 0,
    },
  }

  return {
    date: aujourdhui,
    annee,
    exploitation: { nom: exploitation?.raisonSociale ?? null },
    modules,
    elements: classerParUrgence(elements),
    plan,
    reperes,
    elevage: agenda
      ? {
          animauxActifs,
          echeances: agenda.echeances.slice(0, 6),
          counts: { total: agenda.counts.total, urgent: agenda.counts.urgent },
        }
      : null,
    sourcesEnErreur: Array.from(sourcesEnErreur),
  }
}
