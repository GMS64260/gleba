"use client"

import { useEffect } from "react"
import { MessageSquarePlus } from "lucide-react"

import { Button } from "@/components/ui/button"

export const OPEN_FEEDBACK_EVENT = "gleba:feedback:open"

export function OpenFeedbackButton({ autoOpen = false }: { autoOpen?: boolean }) {
  useEffect(() => {
    if (!autoOpen) return
    const timeout = window.setTimeout(
      () => window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT)),
      0,
    )
    return () => window.clearTimeout(timeout)
  }, [autoOpen])

  return (
    <Button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT))}
    >
      <MessageSquarePlus className="mr-2 h-4 w-4" />
      Ouvrir le formulaire
    </Button>
  )
}
