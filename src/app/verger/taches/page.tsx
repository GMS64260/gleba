"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function TachesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/arbres?tab=calendrier") }, [router])
  return null
}
