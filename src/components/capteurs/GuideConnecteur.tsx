"use client"

/**
 * Marche à suivre côté serveur de réseau (ou outil de la ferme) pour envoyer
 * les mesures à Gleba. Affichée avec le jeton, juste après sa création ou sa
 * régénération : c'est le seul moment où il est visible.
 */
import * as React from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GRANDEURS, GRANDEURS_IDS } from "@/lib/capteurs/grandeurs"
import { PROFILS_IDS } from "@/lib/capteurs/decodage"
import type { TypeConnecteur } from "@/lib/capteurs/connecteurs"

function Copiable({ valeur, libelle }: { valeur: string; libelle: string }) {
  const [copie, setCopie] = React.useState(false)
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 break-all rounded bg-slate-100 px-2 py-1 text-xs">{valeur}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Copier ${libelle}`}
        onClick={() => {
          navigator.clipboard?.writeText(valeur).then(() => {
            setCopie(true)
            setTimeout(() => setCopie(false), 2000)
          })
        }}
      >
        {copie ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function GuideConnecteur({ type, jeton }: { type: TypeConnecteur; jeton: string }) {
  const [url, setUrl] = React.useState("https://gleba.fr/api/capteurs/ingestion")
  React.useEffect(() => setUrl(`${window.location.origin}/api/capteurs/ingestion`), [])
  const entete = `Bearer ${jeton}`

  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium text-amber-800">
        Copiez le jeton maintenant : il ne sera plus jamais affiché. Perdu, il se régénère (l&apos;ancien cesse alors de fonctionner).
      </p>
      <div className="space-y-1">
        <p className="text-xs text-slate-500">Adresse d&apos;envoi</p>
        <Copiable valeur={url} libelle="l'adresse" />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-slate-500">En-tête Authorization</p>
        <Copiable valeur={entete} libelle="l'en-tête" />
      </div>

      {type === "ttn" && (
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          <li>Console TTN : votre application, puis Integrations &gt; Webhooks &gt; Add webhook &gt; Custom webhook.</li>
          <li>Webhook format : JSON. Base URL : l&apos;adresse ci-dessus.</li>
          <li>Additional headers : nom <code>Authorization</code>, valeur l&apos;en-tête ci-dessus.</li>
          <li>Cochez « Uplink message » (chemin vide), puis enregistrez.</li>
          <li>
            Chaque capteur doit avoir un décodeur (Payload formatters). Le plus simple : l&apos;enregistrer depuis le
            Device Repository, ce qui indique aussi son modèle à Gleba.
          </li>
        </ol>
      )}
      {type === "chirpstack" && (
        <ol className="list-decimal space-y-1 pl-5 text-slate-700">
          <li>ChirpStack : votre application, puis Integrations &gt; HTTP.</li>
          <li>Payload encoding : JSON. Event endpoint URL : l&apos;adresse ci-dessus.</li>
          <li>Headers : nom <code>Authorization</code>, valeur l&apos;en-tête ci-dessus.</li>
          <li>Le profil d&apos;appareil doit porter un codec : sans lui, les trames arrivent illisibles.</li>
        </ol>
      )}
      {type === "generique" && (
        <div className="space-y-2 text-slate-700">
          <p>Un envoi par capteur, ou jusqu&apos;à 20 sous <code>trames</code>. Exemple :</p>
          <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs">{`curl -X POST ${url} \\
  -H "Authorization: ${entete}" \\
  -H "Content-Type: application/json" \\
  -d '{"capteur":"serre-nord","mesures":{"temperature_air":18.4,"humidite_air":71}}'`}</pre>
          <p>
            <code>mesureeA</code> : date ISO 8601 avec fuseau (<code>2026-10-23T10:00:00Z</code> ou{" "}
            <code>…+11:00</code>), sept jours de rattrapage au plus. Sans elle, l&apos;heure de réception fait foi : renvoyer
            le même envoi écrit alors une seconde mesure. Facultatifs : <code>batterie</code> (%), <code>lat</code> et{" "}
            <code>lng</code>, <code>modele</code> (un profil Gleba : {PROFILS_IDS.join(", ")}). Grandeurs reconnues telles
            quelles :
          </p>
          <p className="text-xs text-slate-500">
            {GRANDEURS_IDS.map((g) => `${g} (${GRANDEURS[g].unite})`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  )
}
