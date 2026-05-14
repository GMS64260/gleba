import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import { FeedbackForm } from "./FeedbackForm"
import { FeedbackDone } from "./FeedbackDone"

export const dynamic = "force-dynamic"

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const record = await prisma.feedbackToken.findUnique({
    where: { token },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!record) {
    notFound()
  }

  if (record.usedAt) {
    return <FeedbackDone alreadyAnswered />
  }

  return (
    <FeedbackForm
      token={token}
      userName={record.user.name}
      userEmail={record.user.email}
    />
  )
}
