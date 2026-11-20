import * as React from "react"
import { Link, useLocation } from "react-router"
import { Box, ChevronRight, FileText, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { useProgress } from "@/lib/progress"
import { lessonById, PROJECTS, TRACKS } from "@/content/curriculum"
import { CardList, ItemTile, StartingPoints, StartRoute } from "@/components/learn-path"
import { COUNTS, topicItems } from "@/lib/learn-items"
import { useModelIndex } from "@/lib/use-async"
import { cardQuizKey, reviewDue, useContinue, type ReviewItem } from "@/lib/progress"
import { LESSONS } from "@/content/lessons"
import { CARDS } from "@/content/cards"
import { t } from "@/lib/i18n"

export function LearnPage() {
  const progress = useProgress()
  const next = useContinue()
  const models = useModelIndex()
  const { hash } = useLocation()
  // A link to one entry (/learn#1.2.5, from the atlas or a card): open its topic's planned list if it
  // is there, then bring it into view.
  React.useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.closest("details")?.setAttribute("open", "")
    el?.scrollIntoView({ block: "center" })
  }, [hash, models.length])

  const topics = TRACKS.map((track) => ({ track, ...topicItems(track, models, progress.done) }))
  const all = topics.flatMap((x) => x.items)
  const finished = all.filter((i) => i.done).length

  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title={t("学习路径", "Learning path")}
        info={t(
          "课程大纲依据各厂商官方课程、认证考纲和 DFM 设计指南整理。要动手才学得会的做成 3D 互动课，读懂就够的做成图文卡，学完都有小测。",
          "The syllabus follows the vendors' official courses, certification exams and DFM design guides. What you have to try with your hands is a 3D lesson, what you only need to understand is a card, and every one ends with a quiz.",
        )}
        actions={
          <Button asChild variant="primary">
            <Link to={next.to}>{next.label}</Link>
          </Button>
        }
      />
      <p className="-mt-2 max-w-[44em] text-reading text-muted-foreground">
        {t(
          `${COUNTS.lessons} 节 3D 互动课、${COUNTS.cards} 张图文卡和 ${models.length || 9} 个真实零件的拆解，按六个主题排好了顺序。不用一次看完：从下面五节开始，或者按你的背景挑起点。`,
          `${COUNTS.lessons} hands-on 3D lessons, ${COUNTS.cards} cards and ${models.length || 9} teardowns of real parts, in six topics. No need to take it all in at once: start with the five below, or pick a starting point for your background.`,
        )}
        {finished > 0 && <span className="ml-1 font-medium text-foreground">{t(`你已学完 ${finished} / ${all.length}。`, `You've finished ${finished} of ${all.length}.`)}</span>}
      </p>

      <ReviewList due={reviewDue(progress)} />

      <section className="mt-10 rounded-xl border bg-sunken px-6 pt-6 pb-4 max-sm:px-4">
        <h2 className="text-title font-semibold">{t("从这里开始", "Start here")}</h2>
        <p className="mt-1 text-body text-muted-foreground">{t("五节课，一个小时左右。后面所有的课都建立在它们上面。", "Five lessons, about an hour. Everything after builds on them.")}</p>
        <StartRoute className="mt-6" />
      </section>

      <Section title={t("按你的背景挑起点", "Or start from your background")} className="mt-12">
        <StartingPoints />
      </Section>

      <h2 className="mt-14 text-title font-semibold">{t("六个主题", "Six topics")}</h2>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Box className="size-3.5 text-primary" />
          {t("3D 互动课：在 3D 里动手，自由度、特征依赖、剖视这类概念看视频学不会", "3D lesson: hands-on, for ideas like degrees of freedom, feature dependencies and sections that a video can't teach")}
        </span>
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5" />
          {t("图文卡：读懂就够", "Card: a short read")}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="size-3.5" />
          {t("拆解：真实零件一步步重建", "Teardown: a real part, rebuilt step by step")}
        </span>
      </div>

      {topics.map(({ track, items, planned }, i) => {
        const [name, rest] = splitTitle(track.title)
        const done = items.filter((x) => x.done).length
        // What you do (3D lessons, teardowns) leads; the cards to read follow as a lighter list.
        const main = items.filter((x) => x.kind !== "card")
        const cards = items.filter((x) => x.kind === "card")
        const hours = hoursOf(track.note)
        return (
          <section key={track.id} className="mt-10 border-t pt-6">
            <div className="flex items-baseline gap-3 max-sm:flex-col max-sm:gap-1">
              <span aria-hidden className="text-title font-semibold tabular text-faint-foreground">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-title font-semibold">{name}</h3>
                {rest && <p className="mt-0.5 text-body text-muted-foreground">{rest}</p>}
              </div>
              <span className="shrink-0 text-small text-faint-foreground tabular">
                {t(`${done} / ${items.length} 已学`, `${done} / ${items.length} done`)}
                {hours && <span className="max-md:hidden"> · {hours}</span>}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {main.map((item) => (
                <ItemTile key={item.key} item={item} />
              ))}
            </div>
            {cards.length > 0 && <CardList items={cards} />}
            {planned.length > 0 && (
              <details className="group mt-3 text-small">
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-muted-foreground select-none hover:text-foreground">
                  <ChevronRight className="size-3.5 transition-transform duration-(--duration-fast) group-open:rotate-90" />
                  {t(`还有 ${planned.length} 个话题在写`, planned.length === 1 ? "1 more topic being written" : `${planned.length} more topics being written`)}
                </summary>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-5 text-faint-foreground">
                  {planned.map((p) => (
                    <li key={p.id} id={p.id} className="scroll-mt-24 target:font-medium target:text-foreground">
                      {p.title}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )
      })}

      {PROJECTS.length > 0 && (
        <section className="mt-12 border-t pt-6 pb-4">
          <h3 className="text-heading font-semibold">{t("还在写：综合项目", "Coming: projects")}</h3>
          <p className="mt-1 text-body text-muted-foreground">{t("把前面的课串起来，从头做完一件东西。", "Projects that tie the lessons together, from start to a finished thing.")}</p>
          <ul className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1 text-small text-faint-foreground max-md:grid-cols-1">
            {PROJECTS.map((p) => (
              <li key={p.id}>{p.title.replace(/[（(][^）)]*[）)]$/, "")}</li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  )
}

/** Just the time a topic takes (「所有人必修，约 6–8 小时」 → 「约 6–8 小时」); its other remarks need the outline's codes. */
function hoursOf(note: string) {
  const h = /(约\s*[\d–-]+\s*小时|about\s+[\d–-]+\s+hours?)/i.exec(note)?.[1] ?? ""
  return h.replace(/^About/, "about")
}

/** 「公共地基：空间、视图与几何表示」 → name and what it covers. */
function splitTitle(title: string): [string, string] {
  const m = /^([^：:]+)[：:]\s*(.*)$/.exec(title)
  return m ? [m[1].trim(), m[2].trim()] : [title, ""]
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
