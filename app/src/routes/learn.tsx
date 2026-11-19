import * as React from "react"
import { Link, useLocation } from "react-router"
import { Box, CircleCheck, Circle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Tooltip } from "@/components/ui/tooltip"
import { useProgress } from "@/lib/progress"
import { availableFor, lessonById, PERSONAS, PROJECTS, TRACKS, type Lesson } from "@/content/curriculum"
import { cardQuizKey, reviewDue, useContinue, type ReviewItem } from "@/lib/progress"
import { LESSONS } from "@/content/lessons"
import { CARDS } from "@/content/cards"
import { byLocale, isEn, t } from "@/lib/i18n"

/** English names of what a curriculum entry opens as (the Chinese label comes from the curriculum). */
const KIND_EN = { lesson: "Lesson", teardown: "Teardown", card: "Card" } as const

export function LearnPage() {
  const progress = useProgress()
  const next = useContinue()
  const { hash } = useLocation()
  React.useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ block: "center" })
  }, [hash])

  const total = TRACKS.reduce((n, t) => n + t.modules.reduce((m, mod) => m + mod.lessons.length, 0), 0)
  const done = progress.done.filter((id) => /^\d/.test(id)).length

  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title={t("学习路径", "Learning path")}
        info={t(
          "一条公共地基加五条主轨。每节课一个概念：要动手的做成 3D 互动课，读懂就够的做成图文卡，学完都有小测。课程大纲依据各厂商官方课程、认证考纲和 DFM 设计指南整理。",
          "One shared foundation and five main tracks. Each lesson covers one concept: what you have to try with your hands is a 3D lesson, what you only need to understand is a card, and every one ends with a quiz. The syllabus follows the vendors' official courses, certification exams and DFM design guides.",
        )}
        actions={
          <Button asChild variant="primary">
            <Link to={next.to}>{next.label}</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-muted-foreground">
        <span>
          {byLocale(
            <>
              已完成 <span className="font-medium tabular text-foreground">{done}</span> / <span className="tabular">{total}</span> 节
            </>,
            <>
              <span className="font-medium tabular text-foreground">{done}</span> / <span className="tabular">{total}</span> done
            </>,
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Box className="size-3.5" />
          {t("标 3D 的课，交互是必需的：自由度、特征依赖、剖视这类概念看视频学不会", "Lessons marked 3D need the interaction: degrees of freedom, feature dependencies and sections don't come across in a video")}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5" />
          {byLocale(
            <>
              图文卡：读 3–5 分钟，配示意图和小测，共 <span className="tabular">{CARDS.length}</span> 张
            </>,
            <>
              Cards: a 3–5 minute read with diagrams and a quiz, <span className="tabular">{CARDS.length}</span> in all
            </>,
          )}
        </span>
      </div>

      <ReviewList due={reviewDue(progress)} />

      <Section title={t("按你的背景选入口", "Where to start, by background")} className="mt-8">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {PERSONAS.map((p) => (
            <div key={p.name} className="rounded-lg border p-3">
              <div className="text-body font-medium">{p.name}</div>
              <div className="mt-1 text-small text-muted-foreground">{p.path}</div>
            </div>
          ))}
        </div>
      </Section>

      {TRACKS.map((t) => (
        <Section
          key={t.id}
          title={
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-small text-faint-foreground">{t.id}</span>
              {t.title}
            </span>
          }
          actions={<span className="text-small text-faint-foreground max-sm:hidden">{t.note}</span>}
        >
          <div className="overflow-hidden rounded-lg border">
            {t.modules.map((m, mi) => (
              <div key={m.id} className={cn(mi > 0 && "border-t")}>
                <div className="flex items-baseline gap-2 bg-sunken px-3 py-2">
                  <span className="font-mono text-caption text-faint-foreground">{m.id}</span>
                  <span className="text-small font-medium">{m.title}</span>
                  {m.note && <span className="truncate text-caption text-faint-foreground">{m.note}</span>}
                </div>
                {m.lessons.map((l) => (
                  <LessonRow key={l.id} lesson={l} done={progress.done.includes(l.id)} current={progress.last === l.id} />
                ))}
              </div>
            ))}
          </div>
        </Section>
      ))}

      <Section title={t("贯穿项目", "Projects through the course")}>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          {PROJECTS.map((p) => (
            <div key={p.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-caption text-faint-foreground">{p.id}</span>
                <span className="text-body font-medium">{p.title}</span>
              </div>
              <div className="mt-1 text-caption text-muted-foreground">{t("先修：", "Prerequisites: ")}{p.prereq}</div>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  )
}

function LessonRow({ lesson: l, done, current }: { lesson: Lesson; done: boolean; current: boolean }) {
  const avail = availableFor(l.id)
  const body = (
    <>
      {done ? <CircleCheck className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-input" />}
      <span className="w-10 shrink-0 font-mono text-caption tabular text-faint-foreground">{l.id}</span>
      <span className="min-w-0 shrink-0 text-body max-md:flex-1 max-md:shrink max-md:truncate">{l.title}</span>
      <span className="min-w-0 flex-1 truncate text-small text-muted-foreground max-md:hidden">{l.goal}</span>
      {l.interactive === 2 && (
        <Tooltip content={l.interactiveNote ? t(`3D 交互：${l.interactiveNote}`, `3D interaction: ${l.interactiveNote}`) : t("3D 交互是这节课的核心", "This lesson is built around 3D interaction")}>
          <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
            <Box className="size-3.5" />
            3D
          </span>
        </Tooltip>
      )}
      <span className={cn("shrink-0 text-right", isEn ? "w-20" : "w-16")}>
        {avail ? (
          <Badge tone="info">{isEn ? KIND_EN[avail.kind] : avail.label}</Badge>
        ) : (
          <span className="text-caption text-faint-foreground">{t("规划中", "Planned")}</span>
        )}
      </span>
    </>
  )
  const cls = cn("flex h-10 items-center gap-3 border-t px-3", current && "bg-selected")
  return avail ? (
    <Link id={l.id} to={avail.to} className={cn(cls, "transition-colors duration-(--duration-fast) hover:bg-accent")}>
      {body}
    </Link>
  ) : (
    <div id={l.id} className={cls}>
      {body}
    </div>
  )
}

function ReviewList({ due }: { due: ReviewItem[] }) {
  const items = due.flatMap((d) => {
    const lesson = LESSONS.find((l) => l.id === d.lessonId)
    if (lesson) return [{ ...d, title: lesson.title, to: `/lesson/${lesson.id}?quiz=1` }]
    const card = CARDS.find((c) => cardQuizKey(c.code) === d.lessonId)
    const entry = card && lessonById(card.code)
    if (entry) return [{ ...d, title: entry.title, to: `/card/${entry.id}?quiz=1` }]
    return []
  })
  if (!items.length) return null
  return (
    <Section title={t("该复习了", "Due for review")} className="mt-8">
      <div className="overflow-hidden rounded-lg border">
        {items.map((d) => (
          <Link key={d.lessonId} to={d.to} className="flex h-10 items-center gap-3 border-t px-3 first:border-t-0 hover:bg-accent">
            <span className="min-w-0 truncate text-body">{d.title}</span>
            <span className="shrink-0 text-small text-muted-foreground max-sm:hidden">{d.reason}</span>
            <span className="ml-auto shrink-0 text-small font-medium">{t("重做小测", "Retake the quiz")}</span>
          </Link>
        ))}
      </div>
    </Section>
  )
}
