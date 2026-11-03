"use client"

/**
 * Bilan matière du lait (2026-11-03), sous le calendrier de collecte :
 * les 7 jours affichés et le mois en cours. Règles :
 * src/lib/elevage/bilan-lait.ts.
 */
import type { BilanLait } from "@/lib/elevage/bilan-lait"

const litres = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} L`
const jourCourt = (jour: string) => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`

const LIGNES: { cle: keyof BilanLait; libelle: string; retrait?: boolean }[] = [
  { cle: "collecte", libelle: "Collecté" },
  { cle: "ecarte", libelle: "dont écarté (délai d'attente)", retrait: true },
  { cle: "livre", libelle: "Livré à la laiterie" },
  { cle: "venduCru", libelle: "Vendu cru" },
  { cle: "transforme", libelle: "Transformé" },
]

export function BilanLaitResume({ bilans }: { bilans: { jours7: BilanLait; mois: BilanLait } | null }) {
  if (!bilans) return null
  const { jours7, mois } = bilans
  const horsLitres = Math.max(jours7.ventesHorsLitres, mois.ventesHorsLitres)
  return (
    <section className="space-y-2 rounded-md border p-3" data-testid="bilan-lait">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium">Bilan du lait</h3>
        <p className="text-xs text-muted-foreground">Une sortie au-delà de la traite des 7 derniers jours demande confirmation.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 text-left font-normal" />
              <th className="py-1 pl-2 text-right font-normal">7 jours<br />{jourCourt(jours7.debut)} au {jourCourt(jours7.fin)}</th>
              <th className="py-1 pl-2 text-right font-normal">Mois<br />depuis le {jourCourt(mois.debut)}</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES.map(({ cle, libelle, retrait }) => (
              <tr key={cle} className={retrait ? "text-xs text-muted-foreground" : undefined}>
                <td className={`py-0.5 ${retrait ? "pl-3" : ""}`}>{libelle}</td>
                <td className="py-0.5 pl-2 text-right tabular-nums">{litres(jours7[cle] as number)}</td>
                <td className="py-0.5 pl-2 text-right tabular-nums">{litres(mois[cle] as number)}</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="py-1">Non affecté</td>
              {[jours7, mois].map((b, i) => (
                <td key={i} className={`py-1 pl-2 text-right tabular-nums ${b.nonAffecte < 0 ? "text-amber-700" : ""}`}>
                  {litres(b.nonAffecte)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Non affecté : pertes, lait donné aux veaux, autoconsommation ou saisie manquante.
      </p>
      {jours7.nbCollectes === 0 && (
        <p className="text-xs text-muted-foreground">Aucune collecte saisie sur ces 7 jours : les sorties ne sont pas contrôlées.</p>
      )}
      {jours7.nbCollectes > 0 && jours7.nonAffecte < 0 && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Plus de lait sorti que collecté sur ces 7 jours : vérifiez les ventes, livraisons et fabrications, ou saisissez la collecte manquante.
        </p>
      )}
      {horsLitres > 0 && (
        <p className="text-xs text-muted-foreground">
          {horsLitres > 1 ? `${horsLitres} ventes de lait` : "Une vente de lait"} sans volume en litres (bouteille, unité) {horsLitres > 1 ? "ne sont pas comptées" : "n’est pas comptée"}.
        </p>
      )}
    </section>
  )
}
