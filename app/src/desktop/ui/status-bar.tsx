import * as React from "react"
import { StatusDot } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import type { DocState, PickRequest, Snapshot } from "../core/protocol"
import { AgentStatus } from "./title-bar"
import { ACTOR_LABEL, ago, useNow } from "./words"

/** Where a status item leads: a panel, the first step that didn't build, or how to plug an agent in. */
export type StatusTarget = "activity" | "failed" | "params" | "notes" | "setup"

/**
 * The strip along the bottom: how things stand, never what to do. Who is working on the model, whether
 * it built, how many of the stated requirements hold, notes waiting, and the version with who made it.
 * Each item says itself in a few words; the panels hold the detail, and an item with one clear place to
 * go (the activity, the failed step, the checks, the notes) goes there when clicked.
 */
export function StatusBar({ snapshot, doc, pick, onGo, agentSeen = true, sheet = false, onSheet }: {
  snapshot: Snapshot | null
  doc: DocState | null
  pick: PickRequest | null
  onGo: (to: StatusTarget) => void
  agentSeen?: boolean
  /** 「工程图」 over the 3D view: switched now and then, so it lives down here, at the far right. */
  sheet?: boolean
  onSheet?: (on: boolean) => void
}) {
  const now = useNow()
  const kernel = snapshot?.kernel
  const loading = snapshot?.loading
  const report = doc?.report
  const failed = report?.features.filter((f) => f.state === "error").length ?? 0
  const checks = report?.checks?.filter((c) => !c.invalid) ?? []
  const passed = checks.filter((c) => c.pass).length
  const openNotes = doc?.notes.filter((n) => n.status === "open").length ?? 0
  const last = doc?.changes[0]
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t px-3 text-caption text-muted-foreground select-none" aria-label={t("状态", "Status")}>
      <Go label={agentSeen ? t("看动态", "Show activity") : t("接入 Agent", "Connect an agent")} onClick={() => onGo(agentSeen ? "activity" : "setup")}>
        <AgentStatus snapshot={snapshot} pick={pick} className="text-caption" />
      </Go>
      {kernel?.phase === "loading" && <Item><Spinner className="size-3" />{t("内核加载中", "Loading the kernel")}</Item>}
      {kernel?.phase === "error" && <StatusDot className="text-caption" tone="danger">{t("内核出错", "Kernel error")}</StatusDot>}
      {doc && (
        <>
          {loading ? (
            <Item>
              <Spinner className="size-3" />
              {loading.progress?.stage === "checks" ? t("正在核对", "Checking") : t("正在重建", "Rebuilding")}
            </Item>
          ) : doc.error ? (
            <StatusDot className="text-caption" tone="danger">{t("文件读不了，显示的是上一版", "Can’t read the file; showing the last version")}</StatusDot>
          ) : failed ? (
            <Go label={t("到没建成的那一步", "Go to the failed step")} onClick={() => onGo("failed")}>
              <StatusDot className="text-caption" tone="danger">{t(`${failed} 步没建成`, failed === 1 ? "1 step failed" : `${failed} steps failed`)}</StatusDot>
            </Go>
          ) : report ? (
            <StatusDot className="text-caption" tone="success">{t("已重建", "Rebuilt")}{report.ms ? ` · ${report.ms < 1000 ? `${Math.round(report.ms)} ms` : `${(report.ms / 1000).toFixed(1)} s`}` : ""}</StatusDot>
          ) : null}
          {checks.length > 0 && !loading && (
            <Go label={t("看核对", "Show checks")} onClick={() => onGo("params")}>
              <StatusDot className="text-caption" tone={passed === checks.length ? "success" : "warning"}>
                {t(`核对 ${passed}/${checks.length}`, `Checks ${passed}/${checks.length}`)}
              </StatusDot>
            </Go>
          )}
          {report?.checksPending && <Item><Spinner className="size-3" />{t("后台核对中", "Checking in the background")}</Item>}
          {openNotes > 0 && (
            <Go label={t("看备注", "Show notes")} onClick={() => onGo("notes")}>
              {t(`${openNotes} 条备注待处理`, openNotes === 1 ? "1 open note" : `${openNotes} open notes`)}
            </Go>
          )}
          <span className="flex-1" />
          <Go label={t("看动态", "Show activity")} onClick={() => onGo("activity")}>
            <span className="tabular">
              {t(`第 ${doc.rev} 版`, `Version ${doc.rev}`)}
              {last ? t(` · ${ACTOR_LABEL[last.actor]} ${ago(last.at, now)}`, ` · ${ACTOR_LABEL[last.actor]}, ${ago(last.at, now)}`) : ""}
            </span>
          </Go>
          {onSheet && (
            <div role="radiogroup" aria-label={t("视图", "View")} className="-mr-1.5 flex items-center gap-0.5">
              {([["3D", false], [t("工程图", "Drawing"), true]] as const).map(([label, on]) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={sheet === on}
                  className={cn("h-5 rounded-sm px-1.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", sheet === on && "bg-muted font-medium text-foreground")}
                  onClick={() => onSheet(on)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </footer>
  )
}

/** A status item that leads somewhere: looks like the others until pointed at. */
function Go({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={label} className="-mx-1 flex items-center rounded px-1 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick}>
      {children}
    </button>
  )
}

function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("flex items-center gap-1.5", className)}>{children}</span>
}
