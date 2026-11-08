import { ATELIERS, GRATUITE_EXISTANTS_JUSQUAU, MOIS_ESSAI, estAtelier, type Atelier, type Formule } from "./catalogue"

export interface EtatAbonnement {
  gratuitAVie: boolean
  essaiDebut: Date | null
  essaiFin: Date | null
  formule: string | null
  atelier: string | null
  statut: string | null
  payeJusquau: Date | null
  graceJusquau: Date | null
}
export type EtatAcces = "libre" | "gratuit-vie" | "a-demarrer" | "essai" | "actif" | "grace" | "lecture"
export interface AccesService {
  etat: EtatAcces
  formule: Formule | null
  ateliers: Atelier[]
  ecriture: boolean
  ia: boolean
  meteo: boolean
  boutique: boolean
  comptabilite: boolean
  essaiFin: string | null
  valideJusquau: string | null
}
/** Addition calendaire UTC : le 31 août + 3 mois finit le 30 novembre. */
export function finEssai(debut: Date): Date {
  const fin = new Date(debut)
  const jour = fin.getUTCDate()
  fin.setUTCDate(1)
  fin.setUTCMonth(fin.getUTCMonth() + MOIS_ESSAI)
  const dernier = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth() + 1, 0)).getUTCDate()
  fin.setUTCDate(Math.min(jour, dernier))
  return fin
}
export function accesComplet(etat: EtatAcces, limite: Date | null = null): AccesService {
  return { etat, formule: "complet", ateliers: [...ATELIERS], ecriture: true, ia: true, meteo: true, boutique: true, comptabilite: true, essaiFin: etat === "essai" ? limite?.toISOString() ?? null : null, valideJusquau: limite?.toISOString() ?? null }
}
export function calculerAcces(createdAt: Date, abonnement: EtatAbonnement | null, maintenant = new Date(), actif = true): AccesService {
  if (!actif) return accesComplet("libre")
  if (createdAt.getTime() <= Date.parse(GRATUITE_EXISTANTS_JUSQUAU) || abonnement?.gratuitAVie) return accesComplet("gratuit-vie")
  const t = maintenant.getTime()
  // Une résiliation au terme garde la période réglée ; canceled/unpaid ne créent aucun renouvellement.
  const paye = abonnement?.payeJusquau && abonnement.payeJusquau.getTime() > t
  const grace = abonnement?.statut === "past_due" && abonnement.graceJusquau && abonnement.graceJusquau.getTime() > t
  if (abonnement && (paye || grace)) {
    const etat = paye ? "actif" : "grace"
    const limite = paye ? abonnement.payeJusquau : abonnement.graceJusquau
    if (abonnement.formule === "complet") return accesComplet(etat, limite)
    if (abonnement.formule === "essentiel" && estAtelier(abonnement.atelier)) return {
      etat, formule: "essentiel", ateliers: [abonnement.atelier], ecriture: true, ia: false, meteo: false, boutique: false, comptabilite: false,
      essaiFin: null, valideJusquau: limite?.toISOString() ?? null,
    }
  }
  if (abonnement?.essaiFin && abonnement.essaiDebut && abonnement.essaiFin.getTime() > t) return accesComplet("essai", abonnement.essaiFin)
  return { etat: abonnement?.essaiDebut ? "lecture" : "a-demarrer", formule: null, ateliers: [], ecriture: false, ia: false, meteo: false, boutique: false, comptabilite: false, essaiFin: abonnement?.essaiFin?.toISOString() ?? null, valideJusquau: null }
}
export type Capacite = Atelier | "ia" | "meteo" | "boutique" | "comptabilite" | "commun"
export function aCapacite(acces: AccesService, capacite: Capacite): boolean {
  if (capacite === "commun") return acces.ecriture
  if (estAtelier(capacite)) return acces.ecriture && acces.ateliers.includes(capacite)
  return acces.ecriture && acces[capacite]
}
