/** GET — ce que les commandes « à produire » de la boutique attendent de l'élevage (œufs, ruche). */
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { besoinsAProduire } from "@/lib/boutique/stock-lie-disponible"

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error
  const besoins = await prisma.$transaction((tx) => besoinsAProduire(tx, session!.user.id))
  return NextResponse.json(besoins.filter((b) => b.type === "oeufs" || b.type === "ruche"), { headers: { "Cache-Control": "private, no-store" } })
}
