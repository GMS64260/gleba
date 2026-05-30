import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { UnsubscribeClient } from "./UnsubscribeClient"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Désabonnement — Gleba",
  robots: { index: false, follow: false },
}

export default async function DesabonnementPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true, emailOptOut: true },
  })

  if (!user) {
    notFound()
  }

  return (
    <UnsubscribeClient
      token={token}
      email={user.email}
      initiallyOptedOut={user.emailOptOut}
    />
  )
}
