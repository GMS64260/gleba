import { NextResponse } from "next/server"
import { requireAdminApi } from "@/lib/auth-utils"
import { genererClesVapid } from "@/lib/push"

export async function POST() {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    return NextResponse.json(genererClesVapid())
  } catch (error) {
    console.error("POST /api/admin/settings/generate-vapid-keys error:", error)
    return NextResponse.json(
      { error: "Impossible de générer les clés VAPID" },
      { status: 500 }
    )
  }
}
