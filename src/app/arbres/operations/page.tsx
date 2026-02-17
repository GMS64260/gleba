"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OperationsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/arbres?tab=operations") }, [router])
  return null
}
