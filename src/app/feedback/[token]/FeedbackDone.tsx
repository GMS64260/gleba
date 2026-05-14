"use client"

import { t, type Lang } from "./translations"

export function FeedbackDone({
  lang = "fr",
  alreadyAnswered = false,
}: {
  lang?: Lang
  alreadyAnswered?: boolean
}) {
  const L = t[lang]
  const title = alreadyAnswered ? L.alreadyTitle : L.thanksTitle
  const body = alreadyAnswered ? L.alreadyBody : L.thanksBody

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              className="h-7 w-7 text-emerald-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-4 text-slate-600">{body}</p>
          <a
            href="https://gleba.fr"
            className="mt-6 inline-block text-sm font-medium text-emerald-700 hover:text-emerald-900"
          >
            gleba.fr →
          </a>
        </div>
      </div>
    </div>
  )
}
