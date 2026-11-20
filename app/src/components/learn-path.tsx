import { Link } from "react-router"
import { ArrowRight, Box, Check, FileText, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROUTE_LABELS, START_ROUTE, STARTING_POINTS } from "@/content/start"
import { lessonById, lessonDone, shortTitle, type TopicItem } from "@/lib/learn-items"
import { useProgress } from "@/lib/progress"
import { t } from "@/lib/i18n"

/**
 * The learning path's building blocks, shared by /learn and the home page: the start route, the four
 * starting points, and one tile per thing that can be opened (what goes in them: lib/learn-items.ts).
 */

/** The five foundation lessons as stepping stones joined by a line; the next one to take is ringed. */
export function StartRoute({ className }: { className?: string }) {
  const { done } = useProgress()
  const lessons = START_ROUTE.flatMap((id) => lessonById(id) ?? [])
  const label = (id: string) => ROUTE_LABELS[id as keyof typeof ROUTE_LABELS]
  const next = lessons.findIndex((l) => !lessonDone(l.codes, done))
  return (
    <ol className={cn("relative grid grid-cols-5 gap-4 max-lg:grid-cols-1 max-lg:gap-2", className)}>
      {/* The line the stones sit on (a vertical one when they stack). */}
      <span aria-hidden className="absolute top-5 right-[10%] left-[10%] h-px bg-border max-lg:top-5 max-lg:bottom-5 max-lg:left-5 max-lg:h-auto max-lg:w-px" />
      {lessons.map((l, i) => {
        const finished = lessonDone(l.codes, done)
        const isNext = i === next
        return (
          <li key={l.id} className="relative">
            <Link
              to={`/lesson/${l.id}`}
              title={l.gist}
              className="group flex flex-col items-center rounded-lg px-2 pb-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:flex-row max-lg:gap-3 max-lg:px-0 max-lg:text-left"
            >
              <span
                className={cn(
                  "relative grid size-10 shrink-0 place-items-center rounded-full border-2 bg-background text-body font-semibold tabular transition-colors duration-(--duration-fast)",
                  finished
                    ? "border-primary bg-primary text-primary-foreground"
                    : isNext
                      ? "border-primary text-primary shadow-[0_0_0_4px_var(--color-selected)]"
                      : "border-border text-muted-foreground group-hover:border-input group-hover:text-foreground",
                )}
              >
                {finished ? <Check className="size-4" aria-label={t("已完成", "Done")} /> : i + 1}
              </span>
              <span className="mt-3 flex flex-col max-lg:mt-0">
                <span className="text-body font-medium group-hover:underline group-hover:underline-offset-4">{label(l.id) ?? shortTitle(l.title)}</span>
                <span className="text-small text-muted-foreground">
                  {isNext ? (done.length ? t("下一节", "Up next") : t("从这里开始", "Start here")) : t(`${l.minutes} 分钟`, `${l.minutes} min`)}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/** Four kinds of learner, each with the few lessons to take first. */
export function StartingPoints({ className }: { className?: string }) {
  const { done } = useProgress()
  return (
    <div className={cn("grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1", className)}>
      {STARTING_POINTS.map((p) => {
        const lessons = p.lessons.flatMap((id) => lessonById(id) ?? [])
        return (
          <div key={p.id} className="flex flex-col rounded-lg border p-4">
            <div className="text-heading font-semibold">{p.who}</div>
            <p className="mt-1 text-small text-muted-foreground">{p.why}</p>
            <ol className="mt-3 flex flex-1 flex-col gap-0.5">
              {lessons.map((l, i) => (
                <li key={l.id}>
                  <Link to={`/lesson/${l.id}`} title={l.gist} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-body hover:bg-accent">
                    <span className="mt-0.5 w-4 shrink-0 text-center text-caption tabular text-faint-foreground">{lessonDone(l.codes, done) ? <Check className="mx-auto size-3.5 text-success" /> : i + 1}</span>
                    <span className="min-w-0 line-clamp-2">{shortTitle(l.title)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

const KIND_ICON = { lesson: Box, card: FileText, teardown: Layers } as const

/** One thing to open: what it is, how long, whether it's done. */
export function ItemTile({ item }: { item: TopicItem }) {
  const Icon = KIND_ICON[item.kind]
  return (
    <Link
      id={item.anchor}
      to={item.to}
      className="group flex scroll-mt-24 items-start gap-3 rounded-lg border p-3 transition-colors duration-(--duration-fast) hover:border-input hover:bg-accent/40 target:border-primary target:bg-selected"
    >
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4", item.kind === "lesson" ? "bg-selected text-primary" : "bg-muted text-muted-foreground")}>
        <Icon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{item.title}</span>
        <span className="block text-small text-muted-foreground">{item.meta}</span>
      </span>
      {item.done && <Check className="mt-1 size-4 shrink-0 text-success" aria-label={t("已完成", "Done")} />}
    </Link>
  )
}

/** A topic's cards: a lighter list under its lessons, each still an anchor for /learn#<code>. */
export function CardList({ items }: { items: TopicItem[] }) {
  return (
    <div className="mt-3 rounded-lg bg-sunken px-3 py-2">
      <div className="flex items-center gap-1.5 px-1.5 pt-1 text-caption text-faint-foreground">
        <FileText className="size-3.5" />
        {t(`图文卡 · 每张 3–5 分钟`, `Cards · 3–5 min each`)}
      </div>
      <ul className="mt-1 grid grid-cols-3 gap-x-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {items.map((item) => (
          <li key={item.key}>
            <Link id={item.anchor} to={item.to} className="flex scroll-mt-24 items-center gap-2 rounded-md px-1.5 py-1.5 text-body hover:bg-accent target:bg-selected">
              <span className="min-w-0 flex-1 truncate" title={item.title}>
                {item.title}
              </span>
              {item.done && <Check className="size-3.5 shrink-0 text-success" aria-label={t("已完成", "Done")} />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A quiet link to everything. */
export function MoreLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
      {children}
      <ArrowRight className="size-4" />
    </Link>
  )
}
