"use client"

import * as React from "react"
import { Bell, CloudSun, Mail, RefreshCw, Save, Send, Smartphone } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

type Provenance = "db" | "env" | "defaut"
type SettingValue = boolean | number | string
type SettingDetails = {
  valeur: SettingValue
  provenance: Provenance
}

type SettingKey =
  | "notif.enabled"
  | "notif.resumeHeure"
  | "notif.meteoIntervalMin"
  | "notif.timezone"
  | "seuil.gel"
  | "seuil.canicule"
  | "seuil.ventFort"
  | "seuil.pluieAbondante"
  | "smtp.host"
  | "smtp.port"
  | "smtp.user"
  | "smtp.pass"
  | "smtp.from"
  | "vapid.publicKey"
  | "vapid.privateKey"
  | "vapid.subject"
type Reglages = Record<SettingKey, SettingDetails>

const clesNotifications: SettingKey[] = [
  "notif.enabled",
  "notif.resumeHeure",
  "notif.meteoIntervalMin",
  "notif.timezone",
]

const clesSeuils: SettingKey[] = [
  "seuil.gel",
  "seuil.canicule",
  "seuil.ventFort",
  "seuil.pluieAbondante",
]

const fuseauxHoraires = [
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Geneva",
  "Europe/London",
  "Europe/Madrid",
  "America/Montreal",
  "America/Toronto",
  "America/New_York",
  "UTC",
]

const champsSeuils = [
  {
    cle: "seuil.gel",
    label: "Gel",
    unite: "°C",
    description: "Alerte si température minimale ≤ ce seuil",
  },
  {
    cle: "seuil.canicule",
    label: "Canicule",
    unite: "°C",
    description: "Alerte si température maximale ≥ ce seuil",
  },
  {
    cle: "seuil.ventFort",
    label: "Vent fort",
    unite: "km/h",
    description: "Alerte si rafales ≥ ce seuil",
  },
  {
    cle: "seuil.pluieAbondante",
    label: "Pluie abondante",
    unite: "mm/jour",
    description: "Alerte si précipitations ≥ ce seuil",
  },
] as const

const provenanceLabels: Record<Provenance, string> = {
  db: "base",
  env: "variable d'environnement",
  defaut: "défaut",
}

function extraireMessageErreur(data: unknown, messageParDefaut: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error
  }
  return messageParDefaut
}

function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return (
    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
      {provenanceLabels[provenance]}
    </Badge>
  )
}

function valeursEgales(gauche: SettingValue, droite: SettingValue): boolean {
  return String(gauche) === String(droite)
}

function validerVapid(reglages: Reglages): string | null {
  const sujet = String(reglages["vapid.subject"].valeur).trim()
  if (sujet && !sujet.startsWith("mailto:")) {
    return "Le sujet VAPID doit commencer par mailto:."
  }
  return null
}

function validerReglages(reglages: Reglages, cles: SettingKey[]): string | null {
  for (const cle of cles) {
    const valeur = reglages[cle].valeur

    if (cle === "notif.resumeHeure") {
      if (typeof valeur !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valeur)) {
        return "L'heure du résumé doit être au format HH:MM."
      }
    }

    if (cle === "notif.meteoIntervalMin") {
      const intervalle = typeof valeur === "number" ? valeur : Number(valeur)
      if (!Number.isInteger(intervalle) || intervalle < 5 || intervalle > 1440) {
        return "La fréquence météo doit être un nombre entier entre 5 et 1440 minutes."
      }
    }

    if (clesSeuils.includes(cle)) {
      const seuil = typeof valeur === "number" ? valeur : Number(valeur)
      if (typeof valeur === "string" && valeur.trim() === "") {
        return "Les seuils météo doivent être des nombres valides."
      }
      if (!Number.isFinite(seuil)) {
        return "Les seuils météo doivent être des nombres valides."
      }
    }
  }

  return null
}

export function ReglagesNotifications() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const emailSession = session?.user?.email

  const [reglages, setReglages] = React.useState<Reglages | null>(null)
  const [reglagesInitiaux, setReglagesInitiaux] = React.useState<Reglages | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState<"notifications" | "seuils" | "smtp" | "vapid" | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)

  const [motDePasseSaisi, setMotDePasseSaisi] = React.useState("")
  const [clePriveeVapidSaisie, setClePriveeVapidSaisie] = React.useState("")
  const [generationVapidEnCours, setGenerationVapidEnCours] = React.useState(false)
  const [emailTestInput, setEmailTestInput] = React.useState("")
  const [sendingTest, setSendingTest] = React.useState(false)

  const chargerReglages = React.useCallback(async (afficherChargement = true): Promise<boolean> => {
    if (afficherChargement) setLoading(true)

    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(extraireMessageErreur(data, "Impossible de charger les réglages."))
      }

      const valeurs = data as Reglages
      setReglages(valeurs)
      setReglagesInitiaux(valeurs)
      setMotDePasseSaisi("")
      setClePriveeVapidSaisie("")
      setErreur(null)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les réglages."
      setErreur(message)
      if (afficherChargement) {
        toast({
          variant: "destructive",
          title: "Réglages non chargés",
          description: message,
        })
      }
      return false
    } finally {
      if (afficherChargement) setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    void chargerReglages()
  }, [chargerReglages])

  const modifierValeur = (cle: SettingKey, valeur: SettingValue) => {
    setReglages((precedent) => {
      if (!precedent) return precedent
      return {
        ...precedent,
        [cle]: { ...precedent[cle], valeur },
      }
    })
  }

  const enregistrer = async (
    groupe: "notifications" | "seuils",
    cles: SettingKey[]
  ) => {
    if (!reglages || !reglagesInitiaux) return

    const messageValidation = validerReglages(reglages, cles)
    if (messageValidation) {
      toast({
        variant: "destructive",
        title: "Réglages invalides",
        description: messageValidation,
      })
      return
    }

    const clesModifiees = cles.filter((cle) =>
      !valeursEgales(reglages[cle].valeur, reglagesInitiaux[cle].valeur)
    )
    if (clesModifiees.length === 0) {
      toast({ title: "Aucune modification à enregistrer" })
      return
    }

    setSaving(groupe)
    try {
      for (const cle of clesModifiees) {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle, valeur: reglages[cle].valeur }),
        })
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(extraireMessageErreur(data, "Impossible d'enregistrer les réglages."))
        }
      }

      const actualises = await chargerReglages(false)
      if (actualises) {
        toast({ title: "Réglages enregistrés" })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer les réglages.",
      })
    } finally {
      setSaving(null)
    }
  }

  const validerSmtp = (r: Reglages): string | null => {
    const port = typeof r["smtp.port"].valeur === "number"
      ? r["smtp.port"].valeur
      : Number(r["smtp.port"].valeur)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "Le port SMTP doit être un nombre entier entre 1 et 65535."
    }

    const fromVal = String(r["smtp.from"].valeur).trim()
    if (fromVal) {
      const matchAngle = fromVal.match(/<([^>]+)>/)
      const emailToTest = matchAngle ? matchAngle[1].trim() : fromVal
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToTest)) {
        return "L'adresse d'expéditeur (From) doit être une adresse email valide."
      }
    }

    return null
  }

  const enregistrerSmtp = async () => {
    if (!reglages || !reglagesInitiaux) return

    const messageValidation = validerSmtp(reglages)
    if (messageValidation) {
      toast({
        variant: "destructive",
        title: "Réglages invalides",
        description: messageValidation,
      })
      return
    }

    const clesSmtpSansPass: SettingKey[] = ["smtp.host", "smtp.port", "smtp.user", "smtp.from"]
    const modifiees = clesSmtpSansPass.filter(
      (cle) => !valeursEgales(reglages[cle].valeur, reglagesInitiaux[cle].valeur)
    )
    const passModifie = motDePasseSaisi !== ""

    if (modifiees.length === 0 && !passModifie) {
      toast({ title: "Aucune modification à enregistrer" })
      return
    }

    setSaving("smtp")
    try {
      for (const cle of modifiees) {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle, valeur: reglages[cle].valeur }),
        })
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(extraireMessageErreur(data, "Impossible d'enregistrer les réglages."))
        }
      }

      if (passModifie) {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle: "smtp.pass", valeur: motDePasseSaisi }),
        })
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(extraireMessageErreur(data, "Impossible d'enregistrer le mot de passe."))
        }
      }

      const actualises = await chargerReglages(false)
      if (actualises) {
        toast({ title: "Réglages enregistrés" })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer les réglages.",
      })
    } finally {
      setSaving(null)
    }
  }

  const genererVapid = async () => {
    setGenerationVapidEnCours(true)
    try {
      const response = await fetch("/api/admin/settings/generate-vapid-keys", { method: "POST" })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(extraireMessageErreur(data, "Impossible de générer les clés VAPID."))
      }

      const reponse = data as { publicKey?: unknown; privateKey?: unknown }
      if (typeof reponse.publicKey !== "string" || typeof reponse.privateKey !== "string") {
        throw new Error("Réponse invalide lors de la génération des clés VAPID.")
      }

      modifierValeur("vapid.publicKey", reponse.publicKey)
      setClePriveeVapidSaisie(reponse.privateKey)
      toast({ title: "Nouvelles clés générées — enregistrez-les pour les activer" })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de la génération",
        description: error instanceof Error ? error.message : "Impossible de générer les clés VAPID.",
      })
    } finally {
      setGenerationVapidEnCours(false)
    }
  }

  const enregistrerVapid = async () => {
    if (!reglages || !reglagesInitiaux) return

    const messageValidation = validerVapid(reglages)
    if (messageValidation) {
      toast({
        variant: "destructive",
        title: "Réglages invalides",
        description: messageValidation,
      })
      return
    }

    const clesVapidSansPrivee: SettingKey[] = ["vapid.publicKey", "vapid.subject"]
    const modifiees = clesVapidSansPrivee.filter(
      (cle) => !valeursEgales(reglages[cle].valeur, reglagesInitiaux[cle].valeur)
    )
    const clePriveeModifiee = clePriveeVapidSaisie !== ""

    if (modifiees.length === 0 && !clePriveeModifiee) {
      toast({ title: "Aucune modification à enregistrer" })
      return
    }

    setSaving("vapid")
    try {
      for (const cle of modifiees) {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle, valeur: reglages[cle].valeur }),
        })
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(extraireMessageErreur(data, "Impossible d'enregistrer les réglages VAPID."))
        }
      }

      if (clePriveeModifiee) {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cle: "vapid.privateKey", valeur: clePriveeVapidSaisie }),
        })
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(extraireMessageErreur(data, "Impossible d'enregistrer la clé privée VAPID."))
        }
      }

      const actualises = await chargerReglages(false)
      if (actualises) {
        toast({ title: "Réglages VAPID enregistrés" })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer les réglages VAPID.",
      })
    } finally {
      setSaving(null)
    }
  }

  const envoyerEmailTestHandler = async () => {
    setSendingTest(true)
    try {
      const response = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinataire: emailTestInput.trim() || undefined }),
      })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(extraireMessageErreur(data, "Impossible d'envoyer l'email de test."))
      }
      const message =
        typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
          ? data.message
          : `Email de test envoyé`
      toast({
        title: "Email de test envoyé",
        description: message,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Échec de l'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer l'email de test.",
      })
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-live="polite" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <span className="sr-only">Chargement…</span>
      </div>
    )
  }

  if (!reglages) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-sm text-muted-foreground">{erreur || "Impossible de charger les réglages."}</p>
          <Button onClick={() => void chargerReglages()}>
            Réessayer
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-amber-900">Réglages des notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez les notifications globales et les seuils des alertes météo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Notifications
          </CardTitle>
          <CardDescription>
            Paramètres du résumé quotidien et de la surveillance météo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="notif-enabled">Activer les notifications</Label>
                <ProvenanceBadge provenance={reglages["notif.enabled"].provenance} />
              </div>
              <p id="notif-enabled-description" className="text-sm text-muted-foreground">
                Coupe l&apos;ensemble des envois (résumé quotidien, météo, alertes urgentes)
              </p>
            </div>
            <Switch
              id="notif-enabled"
              checked={reglages["notif.enabled"].valeur === true}
              onCheckedChange={(value) => modifierValeur("notif.enabled", value)}
              aria-describedby="notif-enabled-description"
              disabled={saving !== null}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="notif-resume-heure">Heure du résumé quotidien</Label>
              <ProvenanceBadge provenance={reglages["notif.resumeHeure"].provenance} />
            </div>
            <Input
              id="notif-resume-heure"
              type="time"
              value={String(reglages["notif.resumeHeure"].valeur)}
              onChange={(event) => modifierValeur("notif.resumeHeure", event.target.value)}
              disabled={saving !== null}
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="notif-meteo-interval">Fréquence de surveillance météo</Label>
              <ProvenanceBadge provenance={reglages["notif.meteoIntervalMin"].provenance} />
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="notif-meteo-interval"
                type="number"
                min={5}
                max={1440}
                value={String(reglages["notif.meteoIntervalMin"].valeur)}
                onChange={(event) => modifierValeur("notif.meteoIntervalMin", event.target.value)}
                disabled={saving !== null}
              />
              <span className="shrink-0 text-sm text-muted-foreground">minutes</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Fréquence du scan météo temps réel et des alertes urgentes (entre 5 et 1440 min)
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="notif-timezone">Fuseau horaire</Label>
              <ProvenanceBadge provenance={reglages["notif.timezone"].provenance} />
            </div>
            <Select
              value={String(reglages["notif.timezone"].valeur)}
              onValueChange={(value) => modifierValeur("notif.timezone", value)}
              disabled={saving !== null}
            >
              <SelectTrigger id="notif-timezone">
                <SelectValue placeholder="Choisir un fuseau horaire" />
              </SelectTrigger>
              <SelectContent>
                {fuseauxHoraires.map((fuseau) => (
                  <SelectItem key={fuseau} value={fuseau}>
                    {fuseau}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Fuseau utilisé pour l&apos;heure du résumé quotidien
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => void enregistrer("notifications", clesNotifications)}
              disabled={saving !== null}
            >
              <Save className="h-4 w-4" />
              {saving === "notifications" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-sky-600" />
            Seuils d&apos;alerte météo
          </CardTitle>
          <CardDescription>
            Définissez les seuils à partir desquels une alerte météo est déclenchée.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {champsSeuils.map((champ) => (
              <div key={champ.cle} className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor={champ.cle}>{champ.label}</Label>
                  <ProvenanceBadge provenance={reglages[champ.cle].provenance} />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={champ.cle}
                    type="number"
                    value={String(reglages[champ.cle].valeur)}
                    onChange={(event) => modifierValeur(champ.cle, event.target.value)}
                    disabled={saving !== null}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">{champ.unite}</span>
                </div>
                <p className="text-sm text-muted-foreground">{champ.description}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => void enregistrer("seuils", clesSeuils)}
              disabled={saving !== null}
            >
              <Save className="h-4 w-4" />
              {saving === "seuils" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-600" />
            Envoi des emails (SMTP)
          </CardTitle>
          <CardDescription>
            Configurez le serveur d&apos;envoi de courriels pour l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="smtp-host">Serveur hôte (SMTP)</Label>
                <ProvenanceBadge provenance={reglages["smtp.host"].provenance} />
              </div>
              <Input
                id="smtp-host"
                type="text"
                placeholder="smtp.exemple.fr"
                value={String(reglages["smtp.host"].valeur)}
                onChange={(event) => modifierValeur("smtp.host", event.target.value)}
                disabled={saving !== null}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="smtp-port">Port</Label>
                <ProvenanceBadge provenance={reglages["smtp.port"].provenance} />
              </div>
              <Input
                id="smtp-port"
                type="number"
                min={1}
                max={65535}
                value={String(reglages["smtp.port"].valeur)}
                onChange={(event) => modifierValeur("smtp.port", event.target.value)}
                disabled={saving !== null}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="smtp-user">Nom d&apos;utilisateur</Label>
                <ProvenanceBadge provenance={reglages["smtp.user"].provenance} />
              </div>
              <Input
                id="smtp-user"
                type="text"
                placeholder="utilisateur@exemple.fr"
                value={String(reglages["smtp.user"].valeur)}
                onChange={(event) => modifierValeur("smtp.user", event.target.value)}
                disabled={saving !== null}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="smtp-pass">Mot de passe</Label>
                <ProvenanceBadge provenance={reglages["smtp.pass"].provenance} />
              </div>
              <Input
                id="smtp-pass"
                type="password"
                placeholder={
                  reglages["smtp.pass"].valeur === "••••••••"
                    ? "•••••••• (configuré)"
                    : "Mot de passe SMTP"
                }
                value={motDePasseSaisi}
                onChange={(event) => setMotDePasseSaisi(event.target.value)}
                disabled={saving !== null}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="smtp-from">Adresse d&apos;expéditeur (From)</Label>
              <ProvenanceBadge provenance={reglages["smtp.from"].provenance} />
            </div>
            <Input
              id="smtp-from"
              type="text"
              placeholder="Gleba <noreply@exemple.fr>"
              value={String(reglages["smtp.from"].valeur)}
              onChange={(event) => modifierValeur("smtp.from", event.target.value)}
              disabled={saving !== null}
            />
            <p className="text-sm text-muted-foreground">
              Nom et adresse affichés aux destinataires (ex. Gleba &lt;noreply@exemple.fr&gt;)
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => void enregistrerSmtp()}
              disabled={saving !== null}
            >
              <Save className="h-4 w-4" />
              {saving === "smtp" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>

          <div className="space-y-4 border-t pt-6">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Email de test</h3>
              <p className="text-sm text-muted-foreground">
                Envoyez un email de test pour vérifier la configuration SMTP.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <Input
                type="email"
                placeholder={emailSession || "destinataire@exemple.fr"}
                value={emailTestInput}
                onChange={(event) => setEmailTestInput(event.target.value)}
                disabled={sendingTest || saving !== null}
                className="flex-1"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void envoyerEmailTestHandler()}
                disabled={sendingTest || saving !== null}
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
                {sendingTest ? "Envoi…" : "Envoyer un email de test"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneNfc className="h-5 w-5 text-amber-600" />
            Notifications push (VAPID)
          </CardTitle>
          <CardDescription>
            Configurez les clés utilisées pour les notifications push dans les navigateurs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="vapid-public-key">Clé publique</Label>
                <ProvenanceBadge provenance={reglages["vapid.publicKey"].provenance} />
              </div>
              <Input
                id="vapid-public-key"
                type="text"
                value={String(reglages["vapid.publicKey"].valeur)}
                onChange={(event) => modifierValeur("vapid.publicKey", event.target.value)}
                disabled={saving !== null || generationVapidEnCours}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="vapid-private-key">Clé privée</Label>
                <ProvenanceBadge provenance={reglages["vapid.privateKey"].provenance} />
              </div>
              <Input
                id="vapid-private-key"
                type="password"
                placeholder={
                  reglages["vapid.privateKey"].valeur === "••••••••"
                    ? "•••••••• (configurée)"
                    : "Clé privée VAPID"
                }
                value={clePriveeVapidSaisie}
                onChange={(event) => setClePriveeVapidSaisie(event.target.value)}
                disabled={saving !== null || generationVapidEnCours}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="vapid-subject">Sujet VAPID</Label>
              <ProvenanceBadge provenance={reglages["vapid.subject"].provenance} />
            </div>
            <Input
              id="vapid-subject"
              type="text"
              value={String(reglages["vapid.subject"].valeur)}
              onChange={(event) => modifierValeur("vapid.subject", event.target.value)}
              disabled={saving !== null || generationVapidEnCours}
            />
            <p className="text-sm text-muted-foreground">
              Adresse de contact au format mailto: utilisée par les serveurs push
            </p>
          </div>

          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Régénérer les clés invalide les abonnements push existants. Après enregistrement des
            nouvelles clés, chaque navigateur déjà abonné devra se rendre sur <Link href="/parametres" className="underline font-medium">la page Paramètres</Link> (section « Notifications push »), désactiver puis réactiver les notifications push pour que le changement soit pris en compte.
          </p>

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => void genererVapid()}
              disabled={saving !== null || generationVapidEnCours}
            >
              <RefreshCw className="h-4 w-4" />
              {generationVapidEnCours ? "Génération…" : "Générer de nouvelles clés"}
            </Button>
            <Button
              onClick={() => void enregistrerVapid()}
              disabled={saving !== null || generationVapidEnCours}
            >
              <Save className="h-4 w-4" />
              {saving === "vapid" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
