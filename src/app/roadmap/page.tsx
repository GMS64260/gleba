"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Github,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Bug,
  Lightbulb,
  Sparkles,
  ExternalLink,
} from "lucide-react"

const REPO = "GMS64260/gleba"

interface GitHubLabel {
  name: string
  color: string
}

interface GitHubIssue {
  id: number
  number: number
  title: string
  html_url: string
  labels: GitHubLabel[]
  created_at: string
  state: string
}

type RoadmapStatus = "done" | "in-progress" | "planned"

interface RoadmapItem {
  id: number
  number: number
  title: string
  url: string
  status: RoadmapStatus
  category: "bug" | "feature" | "improvement"
  createdAt: string
}

function getStatus(issue: GitHubIssue): RoadmapStatus {
  const labels = issue.labels.map((l) => l.name.toLowerCase())
  if (issue.state === "closed" || labels.includes("terminé") || labels.includes("done")) return "done"
  if (labels.includes("en-cours") || labels.includes("in-progress")) return "in-progress"
  return "planned"
}

function getCategory(issue: GitHubIssue): "bug" | "feature" | "improvement" {
  const labels = issue.labels.map((l) => l.name.toLowerCase())
  if (labels.includes("bug")) return "bug"
  if (labels.includes("enhancement") || labels.includes("amélioration")) return "improvement"
  return "feature"
}

const STATUS_CONFIG = {
  "in-progress": {
    title: "En cours",
    icon: Loader2,
    iconClass: "text-amber-500 animate-spin",
    cardBorder: "border-amber-200",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-400",
  },
  planned: {
    title: "Prévu",
    icon: Circle,
    iconClass: "text-slate-400",
    cardBorder: "border-slate-200",
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    dot: "bg-slate-300",
  },
  done: {
    title: "Terminé",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
    cardBorder: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-400",
  },
}

const CATEGORY_CONFIG = {
  bug: { icon: Bug, label: "Bug", className: "text-red-500" },
  feature: { icon: Sparkles, label: "Fonctionnalité", className: "text-teal-500" },
  improvement: { icon: Lightbulb, label: "Amélioration", className: "text-amber-500" },
}

function RoadmapColumn({ status, items }: { status: RoadmapStatus; items: RoadmapItem[] }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-5">
        <Icon className={`h-5 w-5 ${config.iconClass}`} strokeWidth={1.5} />
        <h2 className="font-heading text-lg font-medium text-slate-900 tracking-tight">
          {config.title}
        </h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${config.badge}`}>
          {items.length}
        </span>
      </div>

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-slate-400 italic py-4">Aucun élément</p>
        )}
        {items.map((item) => {
          const cat = CATEGORY_CONFIG[item.category]
          const CatIcon = cat.icon
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-xl border ${config.cardBorder} bg-white/80 backdrop-blur-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group`}
            >
              <div className="flex items-start gap-3">
                <CatIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cat.className}`} strokeWidth={1.5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 leading-snug group-hover:text-emerald-700 transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">#{item.number}</span>
                    <span className={`text-xs ${cat.className}`}>{cat.label}</span>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0 mt-0.5 transition-colors" />
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function RoadmapPage() {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchRoadmap() {
      try {
        // Fetch open issues with roadmap label
        const openRes = await fetch(
          `https://api.github.com/repos/${REPO}/issues?labels=roadmap&state=open&per_page=100&sort=created&direction=desc`,
          { next: { revalidate: 300 } }
        )
        // Fetch closed issues with roadmap label (recently done)
        const closedRes = await fetch(
          `https://api.github.com/repos/${REPO}/issues?labels=roadmap&state=closed&per_page=20&sort=updated&direction=desc`,
          { next: { revalidate: 300 } }
        )

        if (!openRes.ok || !closedRes.ok) {
          setError("Impossible de charger la roadmap")
          return
        }

        const openIssues: GitHubIssue[] = await openRes.json()
        const closedIssues: GitHubIssue[] = await closedRes.json()

        const allIssues = [...openIssues, ...closedIssues]
        const roadmapItems: RoadmapItem[] = allIssues.map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          status: getStatus(issue),
          category: getCategory(issue),
          createdAt: issue.created_at,
        }))

        setItems(roadmapItems)
      } catch {
        setError("Erreur de connexion")
      } finally {
        setLoading(false)
      }
    }
    fetchRoadmap()
  }, [])

  const inProgress = items.filter((i) => i.status === "in-progress")
  const planned = items.filter((i) => i.status === "planned")
  const done = items.filter((i) => i.status === "done")

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Nav */}
      <nav className="w-full px-6 md:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/login" className="flex items-center gap-2">
          <Image
            src="/gleba-logo.png"
            alt="Gleba"
            width={400}
            height={136}
            className="h-12 sm:h-14 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Connexion</span>
          </Link>
          <a
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">Source</span>
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-8 pb-16 px-4 text-center">
        <p className="text-xs tracking-[0.25em] uppercase text-emerald-600/60 font-medium mb-4">
          Feuille de route
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extralight text-slate-900 tracking-tight mb-6">
          Roadmap <span className="font-normal">Gleba</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-400 font-light max-w-lg mx-auto leading-relaxed">
          Les fonctionnalités en cours de développement et celles prevues.
          Chaque item est lié à une issue GitHub.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <a
            href={`https://github.com/${REPO}/issues?q=label%3Aroadmap`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Github className="h-4 w-4" />
            Voir sur GitHub
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pb-20">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="ml-3 text-slate-400">Chargement de la roadmap...</span>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">{error}</p>
            <a
              href={`https://github.com/${REPO}/issues?q=label%3Aroadmap`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              Consulter directement sur GitHub
            </a>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-20">
            <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">La roadmap est en cours de construction.</p>
            <p className="text-sm text-slate-400">
              Les issues avec le label <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">roadmap</code> apparaîtront ici.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8">
            <RoadmapColumn status="in-progress" items={inProgress} />
            <RoadmapColumn status="planned" items={planned} />
            <RoadmapColumn status="done" items={done} />
          </div>
        )}

        {/* Legend */}
        {!loading && !error && items.length > 0 && (
          <div className="mt-16 flex flex-wrap justify-center gap-6 text-xs text-slate-400">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <span key={key} className="flex items-center gap-1.5">
                  <Icon className={`h-3.5 w-3.5 ${config.className}`} strokeWidth={1.5} />
                  {config.label}
                </span>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-100/80">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span>Gleba — Logiciel libre de gestion agricole</span>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-600 transition-colors">
              Connexion
            </Link>
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-600 transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
