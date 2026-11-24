import * as React from "react"
import { Link } from "react-router"
import { CircleCheck, CircleDashed, X } from "lucide-react"
import { Hint } from "@/components/hint"
import { Button, IconButton } from "@/components/ui/button"
import { practiceById, type Practice } from "@/content/practice"
import { markDone, useProgress } from "@/lib/progress"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { CheckResult } from "../kernel/check"
import { practiceKey, practiceState } from "../practice-state"

/**
 * The practice on top of the side panel: the task, its requirements ticking
 * as the model changes, hints behind the ⓘ, and 「看参考做法」 (the reference
 * answer replayed in a part of its own). All met → done, recorded in the
 * learning progress.
 */
export function PracticeCard({ practice: p, results, rolledBack, onExit, onSolution }: { practice: Practice; results: CheckResult[] | undefined; rolledBack: boolean; onExit: () => void; onSolution?: () => void }) {
  const { rows, passed, done } = practiceState(p, results)
  const progress = useProgress()
  const recorded = progress.done.includes(practiceKey(p.id))
  React.useEffect(() => {
    if (done && !rolledBack && !recorded) markDone(practiceKey(p.id))
  }, [done, rolledBack, recorded, p.id])
  return (
    <section aria-label={t("练习", "Practice")} className={cn("shrink-0 border-b px-4 py-3", done && "bg-success-subtle")}>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-small font-medium", done ? "text-success" : "text-muted-foreground")}>{done ? t("练习完成", "Practice done") : t("练习", "Practice")}</span>
        <span className="truncate text-body font-semibold">{p.title}</span>
        <Hint label={t("提示", "Hints")} tips={p.tips} />
        <span className="ml-auto text-caption text-faint-foreground tabular">
          {passed}/{rows.length}
        </span>
        <IconButton label={t("退出练习", "Leave practice")} size="icon-sm" className="-mr-1.5" onClick={onExit}>
          <X />
        </IconButton>
      </div>
      <p className="mt-1 text-body">{p.task}</p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-small">
            {r.result?.pass ? <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-success" aria-label={t("做到了", "Met")} /> : <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" aria-label={t("还没做到", "Not met yet")} />}
            <span className={cn("min-w-0", r.result?.pass ? "text-foreground" : "text-muted-foreground")}>
              {r.said}
              {r.result && !r.result.pass && !r.result.invalid && <span className="text-faint-foreground">{t(`（现在 ${r.result.actual}）`, ` (now ${r.result.actual})`)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {onSolution && !done && (
        <Button size="sm" variant="ghost" className="mt-1.5 -ml-2 text-muted-foreground" onClick={onSolution}>
          {t("看参考做法", "See a reference answer")}
        </Button>
      )}
      {rolledBack && <p className="mt-2 text-caption text-faint-foreground">{t("回滚中：按最新一步判断", "Rolled back: checked against the latest step")}</p>}
      {done && (
        <p className="mt-2 text-small text-success">
          {t("全部做到了。", "All met.")}
          <AfterPractice p={p} />
        </p>
      )}
    </section>
  )
}

const linkClass = "ml-1 underline decoration-success/40 underline-offset-4 hover:decoration-success"

/**
 * Where to go once a practice is met: a project's next step (a fresh load, so the workbench opens
 * it like any practice arriving from a link), the learning path after a project's last step, or
 * back to the lesson.
 */
function AfterPractice({ p }: { p: Practice }) {
  const next = p.next ? practiceById(p.next) : undefined
  if (next)
    return (
      <Link reloadDocument to={`/studio?practice=${next.id}`} className={linkClass}>
        {t(`下一步：${next.title}`, `Next: ${next.title}`)}
      </Link>
    )
  if (p.project)
    return (
      <Link to={`/learn#${p.project.id}`} className={linkClass}>
        {t("项目完成，回到学习路径", "Project done: back to the learning path")}
      </Link>
    )
  if (p.lesson)
    return (
      <Link to={`/lesson/${p.lesson}`} className={linkClass}>
        {t("回到课程", "Back to the lesson")}
      </Link>
    )
  return null
}
