import { apresDemain, MESSAGE_SOIN_FAIT_FUTUR } from '@/lib/interventions/date-realisee'
import prisma from '@/lib/prisma'
import { verrouillerReglements } from '@/lib/comptabilite/verrou-reglements'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
import { createDepenseFromSoinAnimal } from '@/lib/auto-compta'
import { invalidateKpi } from '@/lib/kpi'
import { effectifTraiteAuJour } from '@/lib/elevage/effectif-traite'
import { soinSchema } from '@/lib/validations/elevage-soin'
import { calendrierInjections } from '@/lib/elevage/injections'
import { lotMedicamentPerime, refusUnitePrelevement } from '@/lib/elevage/stock-medicament'
import { randomUUID } from 'node:crypto'
import { ciblesLaitAffectees, resyncEcartementLait } from '@/lib/elevage/attente-lait'
import { estEspeceSansDelaiLait } from '@/lib/elevage/cibles-collecte-lait'
import { TYPES_SOIN_MEDICAMENTEUX as TYPES_MEDICAMENTEUX } from '@/lib/elevage/types-soin'
import { refusDelaisSaisieLibre, type CibleDelaisSaisieLibre } from '@/lib/elevage/delais-saisie-libre'
import {
  PLANCHER_CASCADE_LAIT_J, PLANCHER_CASCADE_VIANDE_J, PLANCHER_CASCADE_OEUFS_J,
  resoudreDelaisVeterinaires, type EspecePourDelai,
} from '@/lib/elevage/delais-veterinaires'

function reponse<T>(body: T, options: { status: number }) {
  return { body, status: options.status }
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

/** Création commune au formulaire et à l’assistant : soin, rappel, injections,
 * pharmacie, écartement du lait et miroir comptable dans la même transaction. */
export async function creerSoinAnimal(body: unknown, userId: string) {
  try {
    const parsed = soinSchema.safeParse(body)
    if (!parsed.success) {
      return reponse({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
    }

    const d = parsed.data
    const dateSoin = d.date || new Date()
    // Un soin fait ne se date pas dans le futur : il s'enregistrait dix ans à
    // l'avance, dépense comprise (équipe debug, D115).
    if (d.fait && apresDemain(dateSoin)) {
      return reponse({ error: MESSAGE_SOIN_FAIT_FUTUR, champ: 'date' }, { status: 422 })
    }

    // Audit élevage 2026-06-11 — validation tenant : l'animal/le lot soigné
    // doit appartenir au user (sinon le soin référence — et la réponse
    // expose via include — la fiche d'un animal d'un autre compte).
    let cibleEspece: EspecePourDelai | null = null
    let cibleDelais: CibleDelaisSaisieLibre | null = null
    if (d.animalId != null) {
      const a = await prisma.animal.findFirst({
        where: { id: d.animalId, userId: userId },
        select: {
          id: true,
          sexe: true,
          orientationProduction: true,
          especeAnimale: {
            select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true },
          },
        },
      })
      if (!a) return reponse({ error: 'Animal introuvable' }, { status: 404 })
      cibleEspece = a.especeAnimale
      cibleDelais = a
    }
    if (d.lotId != null) {
      const l = await prisma.lotAnimaux.findFirst({
        where: { id: d.lotId, userId: userId },
        select: {
          id: true,
          especeAnimale: {
            select: { id: true, nom: true, categorieReglementaire: true, type: true, production: true, productions: true },
          },
        },
      })
      if (!l) return reponse({ error: 'Lot introuvable' }, { status: 404 })
      cibleEspece = l.especeAnimale
      cibleDelais = l
    }

    // B6 (contre-revue 2026-11-15) — un soin médicamenteux administré sans
    // médicament de la pharmacie n'a aucun délai AMM à reprendre : les délais
    // prescrits doivent être saisis, sur la cible chargée ci-dessus (scopée par
    // propriétaire). Viande toujours, lait pour une cible laitière, œufs pour
    // des pondeuses ; 0 accepté s'il est saisi. Règle unique
    // (`refusDelaisSaisieLibre`) pour le formulaire (POST /api/elevage/soins)
    // et l'assistant (create_soin). Un soin planifié (fait=false) se crée sans
    // délai : la même règle lui est opposée quand il passe à « fait »
    // (ADV88 : PATCH /api/elevage/soins, injection réalisée par PATCH
    // /api/elevage/soins/[id]/injections ou par l'outil dater_injection), cf.
    // `src/lib/elevage/delais-validation-soin.ts`.
    if (d.fait) {
      const refus = refusDelaisSaisieLibre(d, cibleDelais, d, 'creation')
      if (refus) {
        const { status, ...corps } = refus
        return reponse(corps, { status })
      }
    }

    // Snapshot temps d'attente depuis le produit FK si renseigné
    let tempsLait = 0
    let tempsViande = 0
    let tempsOeufs = 0
    let nomProduit = d.produit || null
    let delaiAttenteSource: string | null = d.produitId ? 'referentiel_produit' : 'saisie_libre'
    let produitHorsAmm = false
    if (d.produitId) {
      const p = await prisma.produitVeterinaire.findUnique({
        where: { id: d.produitId },
        include: {
          delaisParEspece: cibleEspece
            ? { where: { especeAnimaleId: cibleEspece.id } }
            : false,
        },
      })
      if (!p) return reponse({ error: 'Produit vétérinaire introuvable' }, { status: 400 })
      const resolus = resoudreDelaisVeterinaires(p, cibleEspece)
      tempsLait = resolus.tempsAttenteLaitJ
      tempsViande = resolus.tempsAttenteViandeJ
      tempsOeufs = resolus.tempsAttenteOeufsJ
      delaiAttenteSource = resolus.source
      produitHorsAmm = !resolus.couvertAmm
      if (!nomProduit) nomProduit = p.nom
    }
    const soinMedicamenteux = TYPES_MEDICAMENTEUX.has(d.type)
    if (soinMedicamenteux && d.produitId && !d.stockMedicamentId) {
      return reponse(
        {
          error: "Sélectionnez un lot de pharmacie pour ce médicament.",
          code: "LOT_PHARMACIE_REQUIS",
        },
        { status: 422 },
      )
    }
    const stockMedicament = d.stockMedicamentId
      ? await prisma.stockMedicamentElevage.findFirst({
          where: { id: d.stockMedicamentId, userId: userId },
        })
      : null
    if (d.stockMedicamentId && !stockMedicament) {
      return reponse({ error: "Lot de pharmacie introuvable." }, { status: 404 })
    }
    if (stockMedicament && stockMedicament.produitId !== d.produitId) {
      return reponse(
        { error: "Le lot de pharmacie ne correspond pas au produit sélectionné." },
        { status: 422 },
      )
    }
    if (stockMedicament && lotMedicamentPerime(stockMedicament.datePeremption, dateSoin)) {
      return reponse(
        { error: `Le lot ${stockMedicament.numeroLot} est périmé à la date du soin.` },
        { status: 422 },
      )
    }
    const refusUnite = stockMedicament ? refusUnitePrelevement(d.unite, stockMedicament.unite) : null
    if (refusUnite) return reponse({ error: refusUnite, champ: 'unite' }, { status: 422 })
    if (stockMedicament && (!d.quantite || d.quantite <= 0)) {
      return reponse(
        { error: `Renseignez la quantité prélevée en ${stockMedicament.unite}.` },
        { status: 422 },
      )
    }
    // QA caprin cms1v5j14 — délais surchargeables par soin : la valeur AMM du
    // produit n'est qu'un défaut, l'ordonnance du vétérinaire prime (usage hors
    // AMM/cascade : délais majorés). null = conserver la valeur du produit.
    const defautLait = tempsLait
    const defautViande = tempsViande
    if (d.tempsAttenteLaitJ != null) {
      tempsLait = produitHorsAmm
        ? Math.max(PLANCHER_CASCADE_LAIT_J, d.tempsAttenteLaitJ)
        : d.tempsAttenteLaitJ
    }
    if (d.tempsAttenteViandeJ != null) {
      tempsViande = produitHorsAmm
        ? Math.max(PLANCHER_CASCADE_VIANDE_J, d.tempsAttenteViandeJ)
        : d.tempsAttenteViandeJ
    }
    if (d.tempsAttenteOeufsJ != null) {
      tempsOeufs = produitHorsAmm
        ? Math.max(PLANCHER_CASCADE_OEUFS_J, d.tempsAttenteOeufsJ)
        : d.tempsAttenteOeufsJ
    }
    if (d.tempsAttenteLaitJ != null || d.tempsAttenteViandeJ != null) {
      if (tempsLait !== defautLait || tempsViande !== defautViande) {
        delaiAttenteSource = 'prescription'
      }
    }
    // QA 2026-07-30 — Un traitement sur un lot de pondeuses affichait « LAIT
    // 03/08 » : ni le formulaire ni cette route ne vérifiaient que l'espèce
    // ciblée produit du lait, et la matrice AMM décline le délai lait sur
    // toutes les espèces couvertes, volailles incluses. Un délai œufs n'existe
    // pas encore au schéma : on neutralise donc le délai lait plutôt que
    // d'afficher une date de retrait trompeuse.
    if (tempsLait > 0 && estEspeceSansDelaiLait(cibleEspece)) {
      // QA 2026-07-30 (2e passage) — Neutraliser le délai lait ne suffisait pas :
      // l'éleveur saisissait 5 j pour ses pondeuses et ne voyait plus AUCUN
      // délai. Sur une espèce avicole, un délai « lait » saisi ou hérité de la
      // matrice AMM est en réalité un délai œufs : on le reporte au lieu de
      // le perdre, sans jamais écraser une valeur œufs explicite.
      if (tempsOeufs === 0) tempsOeufs = tempsLait
      tempsLait = 0
    }
    // Un délai de 0 jour SAISI est une information (« aucun délai prescrit ») :
    // il est conservé tel quel. L'écrire à null le faisait relire comme « non
    // saisi », et la validation du soin planifié ou de son rappel était refusée
    // (DELAIS_ATTENTE_REQUIS) alors que l'éleveur avait bien répondu.
    const delaiStocke = (jours: number, saisi: number | null | undefined) =>
      jours > 0 || saisi != null ? jours : null
    // PROMPT 30 — un traitement peut compter plusieurs injections (ex. J0/J1/J2).
    // Le délai d'attente court depuis la DERNIÈRE injection.
    const nbInjections = d.nbInjections ?? 1
    const intervalleH = d.intervalleInjectionsHeures ?? null
    const derniereInjection = nbInjections > 1 && intervalleH
      ? new Date(dateSoin.getTime() + (nbInjections - 1) * intervalleH * 3_600_000)
      : dateSoin
    // Un soin planifie n'est pas encore administre : on conserve le snapshot
    // des delais du produit, mais la fenetre ne devient effective qu'au
    // passage a `fait=true`.
    // QA cmsqlj7bn — quand le rappel est matérialisé en soin distinct (plus bas),
    // le soin exécuté ne doit PAS conserver la date du rappel comme date prévue :
    // l'écran affichait alors « 19/08 — Fait en avance le 12/08 » pour un soin
    // administré le 12/08, et le rappel apparaissait deux fois au calendrier.
    const rappelMaterialise = Boolean(d.fait && d.datePrevue && d.datePrevue.getTime() > dateSoin.getTime())

    const finLait = d.fait && tempsLait > 0 ? addDays(derniereInjection, tempsLait) : null
    const finViande = d.fait && tempsViande > 0 ? addDays(derniereInjection, tempsViande) : null
    const finOeufs = d.fait && tempsOeufs > 0 ? addDays(derniereInjection, tempsOeufs) : null

    const result = await prisma.$transaction(async (tx) => {
      await verrouillerReglements(tx, userId)
      const quantitePrelevee = d.fait && stockMedicament ? d.quantite ?? 0 : 0
      if (quantitePrelevee > 0) {
        const decremente = await tx.stockMedicamentElevage.updateMany({
          where: {
            id: stockMedicament!.id,
            userId: userId,
            quantite: { gte: quantitePrelevee },
          },
          data: { quantite: { decrement: quantitePrelevee } },
        })
        if (decremente.count !== 1) {
          throw new Error(`STOCK_MEDICAMENT_INSUFFISANT:${stockMedicament!.quantite}`)
        }
      }
      // C10 : effectif figé au jour de l’administration, commun à tous les canaux.
      const effectifTraite = d.fait
        ? await effectifTraiteAuJour(tx, userId, d.lotId, dateSoin)
        : null
      const soin = await tx.soinAnimal.create({
        data: {
          userId: userId,
          animalId: d.animalId ?? null,
          lotId: d.lotId ?? null,
          effectifTraite,
          date: dateSoin,
          type: d.type,
          description: d.description ?? null,
          produit: nomProduit,
          produitId: d.produitId ?? null,
          stockMedicamentId: stockMedicament?.id ?? null,
          numeroLotMedicament: stockMedicament?.numeroLot ?? null,
          peremptionMedicament: stockMedicament?.datePeremption ?? null,
          quantitePreleveeStock: quantitePrelevee,
          dose: d.dose ?? null,
          voie: d.voie ?? null,
          motif: d.motif ?? null,
          ordonnanceUrl: d.ordonnanceUrl || stockMedicament?.ordonnanceUrl || null,
          quantite: d.quantite ?? null,
          unite: d.unite ?? null,
          cout: d.cout ?? null,
          veterinaire: d.veterinaire ?? null,
          datePrevue: rappelMaterialise ? null : (d.datePrevue ?? null),
          fait: d.fait,
          notes: d.notes ?? null,
          nbInjections,
          intervalleInjectionsHeures: intervalleH,
          tempsAttenteLaitJ: delaiStocke(tempsLait, d.tempsAttenteLaitJ),
          tempsAttenteViandeJ: delaiStocke(tempsViande, d.tempsAttenteViandeJ),
          tempsAttenteOeufsJ: delaiStocke(tempsOeufs, d.tempsAttenteOeufsJ),
          delaiAttenteSource,
          finAttenteLait: finLait,
          finAttenteViande: finViande,
          finAttenteOeufs: finOeufs,
        },
        include: { animal: true, lot: true, produitVeterinaire: true },
      })
      const calendrier = calendrierInjections(dateSoin, nbInjections, intervalleH, d.fait)
      for (const injection of calendrier) {
        await tx.$executeRaw`
          INSERT INTO injections_soins
            (id, user_id, soin_id, numero, date_prevue, date_realisee, statut, created_at, updated_at)
          VALUES
            (${randomUUID()}, ${userId}, ${soin.id}, ${injection.numero},
             ${injection.datePrevue}, ${injection.dateRealisee ?? null}, ${injection.statut},
             NOW(), NOW())
        `
      }

      // Ticket cmsof7ccx — le champ « Rappel planifié » d'un soin déjà effectué
      // ne produisait JAMAIS de rappel : GET ?rappels=1 exige fait=false, or le
      // soin créé ici est fait=true (sa datePrevue future restait invisible).
      // On matérialise le rappel par un second soin planifié (fait=false) daté
      // de datePrevue — mêmes cible, produit, protocole et délais — calqué sur
      // la duplication côté client (AlimentationTab, cms1vau9l). Il apparaît
      // ainsi dans les soins à faire et le calendrier.
      let rappel: { id: number } | null = null
      if (rappelMaterialise && d.datePrevue) {
        const rappelCree = await tx.soinAnimal.create({
          data: {
            userId: userId,
            animalId: d.animalId ?? null,
            lotId: d.lotId ?? null,
            date: d.datePrevue,
            type: d.type,
            description: d.description ?? null,
            produit: nomProduit,
            produitId: d.produitId ?? null,
            stockMedicamentId: stockMedicament?.id ?? null,
            numeroLotMedicament: stockMedicament?.numeroLot ?? null,
            peremptionMedicament: stockMedicament?.datePeremption ?? null,
            dose: d.dose ?? null,
            voie: d.voie ?? null,
            motif: d.motif ?? null,
            ordonnanceUrl: d.ordonnanceUrl || stockMedicament?.ordonnanceUrl || null,
            quantite: d.quantite ?? null,
            unite: d.unite ?? null,
            // QA cmsqmqwn9 — le rappel héritait du coût du soin exécuté : le
            // coût sanitaire de l'animal doublait à chaque rappel programmé.
            // Un soin non administré n'a pas coûté : le coût se saisit à sa
            // validation, comme le prélèvement de stock.
            cout: null,
            veterinaire: d.veterinaire ?? null,
            datePrevue: d.datePrevue,
            fait: false,
            notes: `Rappel du soin du ${dateSoin.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`,
            nbInjections,
            intervalleInjectionsHeures: intervalleH,
            tempsAttenteLaitJ: delaiStocke(tempsLait, d.tempsAttenteLaitJ),
            tempsAttenteViandeJ: delaiStocke(tempsViande, d.tempsAttenteViandeJ),
            tempsAttenteOeufsJ: delaiStocke(tempsOeufs, d.tempsAttenteOeufsJ),
            delaiAttenteSource,
            // fait=false : fenêtres d'attente nulles tant que non administré,
            // et aucun prélèvement de stock avant validation.
          },
        })
        rappel = { id: rappelCree.id }
        for (const injection of calendrierInjections(d.datePrevue, nbInjections, intervalleH, false)) {
          await tx.$executeRaw`
            INSERT INTO injections_soins
              (id, user_id, soin_id, numero, date_prevue, date_realisee, statut, created_at, updated_at)
            VALUES
              (${randomUUID()}, ${userId}, ${rappelCree.id}, ${injection.numero},
               ${injection.datePrevue}, ${injection.dateRealisee ?? null}, ${injection.statut},
               NOW(), NOW())
          `
        }
      }

      // Écartement des collectes (cross-granularité individu↔lot, recompute).
      let nbEcartees = 0
      if (finLait) {
        const cibles = await ciblesLaitAffectees(tx, userId, d.animalId ?? null, d.lotId ?? null)
        nbEcartees = await resyncEcartementLait(tx, userId, cibles, dateSoin, finLait)
      }
      await createDepenseFromSoinAnimal(userId, {
        id: soin.id,
        type: soin.type,
        cout: soin.cout,
        date: soin.date,
        fait: soin.fait,
      }, tx)
      return { soin, nbEcartees, rappel }
    })
    invalidateKpi(userId)

    const infos = [
      result.nbEcartees > 0
        ? `${result.nbEcartees} collecte(s) de lait écartée(s) jusqu'au ${finLait?.toLocaleDateString('fr-FR')}.`
        : null,
      result.rappel
        ? `Rappel planifié le ${d.datePrevue?.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.`
        : null,
    ].filter(Boolean)
    return reponse(
      {
        data: result.soin,
        rappel: result.rappel,
        info: infos.length > 0 ? infos.join(' ') : null,
      },
      { status: 201 }
    )
  } catch (err) {
    if (err instanceof ErreurReglement) return reponse({ error: err.message }, { status: err.status })
    console.error('POST /api/elevage/soins error:', err)
    if (err instanceof Error && err.message.startsWith('STOCK_MEDICAMENT_INSUFFISANT:')) {
      const disponible = err.message.split(':')[1]
      return reponse(
        { error: `Stock insuffisant : ${disponible} disponible(s).`, code: 'STOCK_MEDICAMENT_INSUFFISANT' },
        { status: 422 },
      )
    }
    return reponse({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
