"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RecoltesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/verger?tab=productions") }, [router])
  return null
}
