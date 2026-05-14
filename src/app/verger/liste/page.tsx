"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ListeArbresRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/verger?tab=arbres") }, [router])
  return null
}
