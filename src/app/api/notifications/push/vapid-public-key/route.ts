import { NextResponse } from "next/server"
import { getVapidPublicKey } from "@/lib/push"

export const dynamic = "force-dynamic"
export const revalidate = 0

const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate" }

export async function GET() {
  const publicKey = await getVapidPublicKey()
  if (!publicKey) {
    return NextResponse.json(
      { error: "Notifications push non configurées" },
      { status: 503, headers: NO_STORE }
    )
  }

  return NextResponse.json({ publicKey }, { headers: NO_STORE })
}
