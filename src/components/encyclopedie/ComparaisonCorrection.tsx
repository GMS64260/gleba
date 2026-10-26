import { valeurRenseignee } from "@/lib/referentiel-valeur"
import { CHAMPS_CORRECTION, type DetailCorrection, type ValeurCorrection, type ValeursCorrection } from "@/lib/encyclopedie/types"

function valeurLisible(valeur: ValeurCorrection | undefined) {
  if (valeur === null || valeur === undefined || valeur === "") return "Non renseigné"
  if (typeof valeur === "boolean") return valeur ? "Oui" : "Non"
  return typeof valeur === "string" ? valeurRenseignee(valeur) ?? "Non renseigné" : String(valeur)
}

export function ComparaisonCorrection({ detail, actuelles }: { detail: DetailCorrection; actuelles?: ValeursCorrection }) {
  return <div className="max-w-full overflow-x-auto rounded-lg border border-lin">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Modifications de {detail.titre}</caption>
      <thead className="bg-papier text-ardoise"><tr><th scope="col" className="p-3 font-medium">Élément</th><th scope="col" className="p-3 font-medium">Au départ</th><th scope="col" className="p-3 font-medium">Proposé</th>{actuelles && <th scope="col" className="p-3 font-medium">Actuel</th>}</tr></thead>
      <tbody className="divide-y divide-lin">{Object.keys(detail.changements).map(cle => {
        const champ = CHAMPS_CORRECTION[detail.cibleType].find(champ => champ.cle === cle)
        return <tr key={cle}><th scope="row" className="p-3 align-top font-medium">{champ?.libelle ?? cle}{champ?.unite && <span className="mt-1 block text-xs font-normal text-ardoise">{champ.unite}</span>}</th><td className="max-w-xs whitespace-pre-wrap break-words p-3 align-top text-ardoise">{valeurLisible(detail.avant[cle])}</td><td className="max-w-xs whitespace-pre-wrap break-words bg-sauge-doux/40 p-3 align-top text-encre">{valeurLisible(detail.apres[cle])}</td>{actuelles && <td className="max-w-xs whitespace-pre-wrap break-words p-3 align-top text-ardoise">{valeurLisible(actuelles[cle])}</td>}</tr>
      })}</tbody>
    </table>
  </div>
}
