"use client"

import { useState } from "react"
import {
  t,
  BLOCKER_CODES,
  MODULE_CODES,
  type Lang,
  type BlockerCode,
  type ModuleCode,
} from "./translations"
import { FeedbackDone } from "./FeedbackDone"

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "fr"
  return navigator.language?.toLowerCase().startsWith("fr") ? "fr" : "en"
}

export function FeedbackForm({
  token,
  userName,
  userEmail,
}: {
  token: string
  userName: string | null
  userEmail: string
}) {
  const [lang, setLang] = useState<Lang>(detectLang())
  const L = t[lang]

  const [rating, setRating] = useState<number | null>(null)
  const [blockers, setBlockers] = useState<BlockerCode[]>([])
  const [whatBlocked, setWhatBlocked] = useState("")
  const [missing, setMissing] = useState("")
  const [modules, setModules] = useState<ModuleCode[]>([])
  const [willReturn, setWillReturn] = useState<string>("")
  const [comment, setComment] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return <FeedbackDone lang={lang} />
  }

  const toggle = <T extends string>(arr: T[], value: T, setter: (v: T[]) => void) => {
    setter(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (rating === null) {
      setError(lang === "fr" ? "Merci de choisir une note." : "Please pick a rating.")
      return
    }
    if (blockers.length === 0) {
      setError(
        lang === "fr"
          ? "Merci de cocher au moins un point bloquant."
          : "Please tick at least one blocker."
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          rating,
          blockers,
          whatBlocked: whatBlocked.trim() || null,
          missing: missing.trim() || null,
          modules,
          willReturn: willReturn || null,
          comment: comment.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || L.errorGeneric)
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError(L.errorGeneric)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-900 underline-offset-4 hover:underline"
          >
            {L.langSwitch}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {L.pageTitle}
          </h1>
          <p className="mt-3 text-slate-600">{L.hello(userName)}</p>
          <p className="mt-2 text-sm text-slate-500">{L.intro}</p>
          <p className="mt-1 text-xs text-slate-400">
            {userEmail} · {L.requiredHint}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* Q1 rating */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">
                {L.q1Title}
              </legend>
              <p className="mt-1 text-xs text-slate-500">{L.q1Hint}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`h-10 w-10 rounded-lg border text-sm font-medium transition ${
                      rating === n
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Q2 blockers */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">
                {L.q2Title}
              </legend>
              <p className="mt-1 text-xs text-slate-500">{L.q2Hint}</p>
              <div className="mt-3 space-y-2">
                {BLOCKER_CODES.map((code) => (
                  <label
                    key={code}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={blockers.includes(code)}
                      onChange={() => toggle(blockers, code, setBlockers)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">{L.blockers[code]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Q3 whatBlocked */}
            <div>
              <label
                htmlFor="whatBlocked"
                className="text-sm font-semibold text-slate-900"
              >
                {L.q3Title}
              </label>
              <textarea
                id="whatBlocked"
                rows={3}
                value={whatBlocked}
                onChange={(e) => setWhatBlocked(e.target.value)}
                placeholder={L.q3Placeholder}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Q4 missing */}
            <div>
              <label
                htmlFor="missing"
                className="text-sm font-semibold text-slate-900"
              >
                {L.q4Title}
              </label>
              <textarea
                id="missing"
                rows={3}
                value={missing}
                onChange={(e) => setMissing(e.target.value)}
                placeholder={L.q4Placeholder}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Q5 modules */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">
                {L.q5Title}
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_CODES.map((code) => (
                  <label
                    key={code}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={modules.includes(code)}
                      onChange={() => toggle(modules, code, setModules)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">{L.modules[code]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Q6 willReturn */}
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">
                {L.q6Title}
              </legend>
              <div className="mt-3 space-y-2">
                {(["yes", "maybe", "no"] as const).map((opt) => (
                  <label
                    key={opt}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="willReturn"
                      value={opt}
                      checked={willReturn === opt}
                      onChange={(e) => setWillReturn(e.target.value)}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700">{L.q6Options[opt]}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Q7 comment */}
            <div>
              <label
                htmlFor="comment"
                className="text-sm font-semibold text-slate-900"
              >
                {L.q7Title}
              </label>
              <textarea
                id="comment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={L.q7Placeholder}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? L.sending : L.submit}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          <a href="https://gleba.fr" className="hover:text-slate-600">
            gleba.fr
          </a>
        </p>
      </div>
    </div>
  )
}
