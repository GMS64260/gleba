"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BoisRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/verger?tab=productions") }, [router])
  return null
}
