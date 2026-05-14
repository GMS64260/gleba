"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ListeArbresRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/arbres?tab=arbres") }, [router])
  return null
}
