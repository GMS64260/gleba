"use client"

import { Label } from "@/components/ui/label"
import { SelectNatif } from "@/components/ui/select-natif"
import { MODES_REGLEMENT } from "@/lib/validations/reglement"

type Encaissement = { paye: boolean; modeReglement: string }

/** Mêmes choix explicites pour une vente saisie depuis chaque atelier. */
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
          onChange={(e) => onChange({ modeReglement: e.target.value })}
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
          onChange={(e) => onChange({ paye: e.target.checked })}
        />
        Encaissement confirmé
      </label>
      <p className="text-xs text-muted-foreground">
        Cochez après vérification sur votre compte ou en caisse. Le mode de règlement ne confirme pas l&apos;encaissement.
      </p>
    </div>
  )
}
