"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { MessageSquarePlus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

const feedbackTypes = [
  { value: "bug", label: "Bug" },
  { value: "evolution", label: "Demande d'évolution" },
  { value: "autre", label: "Autre" },
] as const

export function FeedbackWidget() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>("bug")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  if (status !== "authenticated" || !session?.user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (message.length < 10) {
      setError("Le message doit contenir au moins 10 caractères")
      return
    }

    if (message.length > 2000) {
      setError("Le message ne peut pas dépasser 2000 caractères")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          viewport:
            typeof window !== "undefined"
              ? `${window.innerWidth}x${window.innerHeight}`
              : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Erreur",
          description: data.error || "Impossible d'envoyer le feedback.",
          variant: "destructive",
        })
        return
      }

      // Bug cmp8sh147 (Marc 2026-05-16) — Toast bloquait le bouton pendant
      // ~15s (duration par défaut). On force une durée courte (3s) pour
      // permettre des feedbacks successifs sans attente.
      toast({
        title: "Merci !",
        description: "Votre feedback a été envoyé.",
        duration: 3000,
      })
      setSent(true)
      setTimeout(() => {
        setOpen(false)
        setType("bug")
        setMessage("")
        setError("")
        setSent(false)
      }, 1000)
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le feedback.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Envoyer un feedback"
        className="fixed bottom-4 right-4 z-50 rounded-full bg-primary p-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors sm:bottom-6 sm:right-6"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Envoyer un feedback</DialogTitle>
            <DialogDescription>
              Signaler un bug ou proposer une amélioration.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="feedback-type" className="text-sm font-medium">
                Type
              </label>
              <select
                id="feedback-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {feedbackTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="feedback-message" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  if (error) setError("")
                }}
                placeholder="Décrivez le bug ou votre suggestion..."
                rows={5}
                maxLength={2000}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              />
              <div className="flex justify-between mt-1">
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {message.length}/2000
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || sent}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Envoi..." : sent ? "Envoyé !" : "Envoyer"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
