'use client'

import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNatif } from '@/components/ui/select-natif'
import { MODES_REGLEMENT } from '@/lib/validations/reglement'
import { todayLocalISO } from '@/lib/format-utils'
import { paiementVenteInitial } from '@/lib/comptabilite/encaissement-vente'

// « Règlement reçu » coché par défaut (décision du 2026-10-30) ; décoché, la
// vente part à crédit et reste à encaisser.
export { paiementVenteInitial }
type Paiement = ReturnType<typeof paiementVenteInitial>

export function ReglementVente({ value, onChange }: { value: Paiement; onChange: (v: Paiement) => void }) {
  const id = useId()
  return <div className="space-y-3 rounded-lg border p-3">
    <div className="flex items-center gap-2"><Checkbox id={`${id}-paye`} checked={value.paye} onCheckedChange={v => onChange({ ...value, paye: v === true })} /><Label htmlFor={`${id}-paye`}>Règlement reçu</Label></div>
    {value.paye ? <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor={`${id}-mode`}>Mode du règlement *</Label><SelectNatif id={`${id}-mode`} value={value.modeReglement} onChange={e => onChange({ ...value, modeReglement: e.target.value })}>
          <option value="">Choisir un mode</option>{MODES_REGLEMENT.filter(m => m !== 'À crédit').map(m => <option key={m} value={m}>{m}</option>)}
        </SelectNatif></div>
        <div><Label htmlFor={`${id}-date`}>Date du règlement *</Label><Input id={`${id}-date`} type="date" max={todayLocalISO()} value={value.datePaiement} onChange={e => onChange({ ...value, datePaiement: e.target.value })} /></div>
      </div>
      {!value.modeReglement && <p className="text-xs text-muted-foreground">Choisissez le mode du règlement, ou décochez « Règlement reçu » pour une vente à crédit.</p>}
    </> : <p className="text-xs text-muted-foreground">Vente à crédit : elle restera à encaisser. Vous pourrez saisir ses versements dans Comptabilité &gt; Règlements.</p>}
  </div>
}
