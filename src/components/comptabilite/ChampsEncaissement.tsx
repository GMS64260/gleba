"use client"

import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import { MODES_REGLEMENT } from "@/lib/validations/reglement"
import { changerEncaissement, type Encaissement } from "@/lib/comptabilite/encaissement-vente"

/**
 * Mêmes choix pour une vente saisie depuis chaque atelier. La vente démarre
 * payée (décision du 2026-10-30) ; la décocher en fait une vente à crédit.
 */
export function ChampsEncaissement({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string
  value: Encaissement
  onChange: (changement: Partial<Encaissement>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-mode-reglement`}>Mode de règlement</Label>
        <SelectNatif
          id={`${idPrefix}-mode-reglement`}
          value={value.modeReglement}
          onChange={(e) => onChange(changerEncaissement(value, { modeReglement: e.target.value }))}
        >
          <option value="">Non renseigné</option>
          {MODES_REGLEMENT.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
        </SelectNatif>
      </div>
      <label htmlFor={`${idPrefix}-encaissee`} className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-encaissee`}
          type="checkbox"
          checked={value.paye}
          onChange={(e) => onChange(changerEncaissement(value, { paye: e.target.checked }))}
        />
        Vente payée
      </label>
      <p className="text-xs text-muted-foreground">
        {value.paye
          ? "Décochez pour une vente à crédit : elle restera à encaisser jusqu’à son règlement."
          : "Vente à crédit : elle reste à encaisser. Saisissez ses versements dans Comptabilité > Règlements."}
      </p>
    </div>
  )
}
