"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function BoisRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/arbres?tab=productions") }, [router])
  return null
}
