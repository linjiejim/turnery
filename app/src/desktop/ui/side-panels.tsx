import * as React from "react"
import { Check, Crosshair, PenLine, RotateCcw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { StateView } from "@/components/ui/state"
import { Hint } from "@/components/hint"
import { turnery } from "../bridge"
import type { Actor, DocState, PartNote } from "../core/protocol"
import { Textarea } from "@/components/ui/input"
import { pinned } from "../core/notes"
import { ACTOR_LABEL, ago, noteAbout, useNow } from "./words"

/** The person's notes on the part: what the agent reads with get_notes, and what it answered. */
export function NotesPanel({ doc, onLocate, onWrite }: { doc: DocState; onLocate: (n: PartNote) => void; onWrite: () => void }) {
  const [filter, setFilter] = React.useState<"open" | "all">("open")
  const open = doc.notes.filter((n) => n.status === "open")
  const list = (filter === "open" ? open : [...doc.notes].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.n - a.n)).slice()
  const update = (n: PartNote, input: Record<string, unknown>) => turnery.call("update_note", { id: n.id, ...input }, doc.path)
  const whole = doc.kind === "assembly" ? t("装配", "assembly") : t("零件", "part")
  /** The note whose words are being changed here. */
  const [editing, setEditing] = React.useState<string | null>(null)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <Segmented
          size="sm"
          aria-label={t("显示哪些备注", "Which notes to show")}
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "open", label: t(`未处理 ${open.length}`, `Open ${open.length}`) },
            { value: "all", label: t(`全部 ${doc.notes.length}`, `All ${doc.notes.length}`) },
          ]}
        />
        <div className="flex items-center gap-1">
          <Hint
            label={t("备注怎么用", "How notes work")}
            align="end"
            tips={[
              t("备注模式（C）下单击一个面或一条边，写下要改什么；选中零件时按 C，写的是关于这些零件的。", "In note mode (C), click a face or an edge and write what to change. With parts selected, C writes a note about those parts."),
              t("R 框出一片、P 用画笔圈出一处，再写备注。", "R boxes an area and P circles one with the pen; then write the note."),
              t(`关于整个${whole}的，点「写一条」。点模型上的编号或这里的文字可以改。`, `For a note about the whole ${whole}, click “Write one”. Click a number on the model or the text here to edit a note.`),
              t("agent 用 get_notes 读备注，改完会写一句回复。", "The agent reads notes with get_notes and writes a reply when it’s done."),
            ]}
          />
          <Button size="sm" variant="ghost" onClick={onWrite}>
            <PenLine />
            {t("写一条", "Write one")}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <StateView
            size="sm"
            kind="empty"
            title={filter === "open" && doc.notes.length ? t("备注都处理完了", "All notes resolved") : t("还没有备注", "No notes yet")}
          />
        ) : (
          <ul className="divide-y">
            {list.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-caption font-semibold tabular",
                      n.status === "open" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {n.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      {editing === n.id ? (
                        <NoteText note={n} onDone={() => setEditing(null)} onSave={async (text) => (await update(n, { text })).ok} />
                      ) : (
                        <button
                          type="button"
                          title={t("点一下改文字", "Click to edit")}
                          className={cn("min-w-0 cursor-text rounded-sm text-left text-body break-words outline-none focus-visible:ring-2 focus-visible:ring-ring", !n.text && "text-muted-foreground")}
                          onClick={() => setEditing(n.id)}
                        >
                          {n.text || t("（只标了位置）", "(location only)")}
                        </button>
                      )}
                      <Badge tone={n.status === "open" ? "warning" : "success"}>{n.status === "open" ? t("未处理", "Open") : t("已处理", "Resolved")}</Badge>
                    </div>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {noteAbout(n, whole)} · {n.id}
                    </p>
                    {n.reply && (
                      <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-small">
                        <span className="font-medium">{t("Agent：", "Agent: ")}</span>
                        {n.reply}
                      </p>
                    )}
                    <div className="mt-1.5 -ml-2 flex flex-wrap gap-0.5">
                      {pinned(n) && (
                        <Button size="sm" variant="ghost" onClick={() => onLocate(n)}>
                          <Crosshair />
                          {t("定位", "Locate")}
                        </Button>
                      )}
                      {n.status === "open" ? (
                        <Button size="sm" variant="ghost" onClick={() => void update(n, { status: "resolved" })}>
                          <Check />
                          {t("标为已处理", "Mark resolved")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => void update(n, { status: "open" })}>
                          <RotateCcw />
                          {t("重新打开", "Reopen")}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void update(n, { remove: true })}>
                        <Trash2 />
                        {t("删除", "Delete")}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** A note's words, changed in place: ↵ saves, Esc or leaving the field without a change puts them back. */
function NoteText({ note, onSave, onDone }: { note: PartNote; onSave: (text: string) => Promise<boolean>; onDone: () => void }) {
  const [text, setText] = React.useState(note.text)
  const done = React.useRef(false)
  const finish = async (keep: boolean) => {
    if (done.current) return
    done.current = true
    if (keep && text.trim() !== note.text.trim() && !(await onSave(text))) {
      done.current = false
      return
    }
    onDone()
  }
  return (
    <Textarea
      autoFocus
      rows={2}
      maxLength={600}
      className="min-w-0 flex-1 resize-none"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => void finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          void finish(false)
        } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          void finish(true)
        }
      }}
      aria-label={t(`备注 ${note.n} 的文字`, `Text of note ${note.n}`)}
    />
  )
}

const ACTOR_TONE: Record<Actor, "info" | "neutral" | "outline"> = { agent: "info", assistant: "info", user: "neutral", file: "outline" }

/** Who changed the part and how, newest first. What the agent is doing now is in the status bar. */
export function ActivityPanel({ doc }: { doc: DocState }) {
  const now = useNow()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-4">
        <span className="text-caption text-muted-foreground">{t("谁改了什么，最新的在上面", "Who changed what, newest first")}</span>
        <Hint
          className="ml-auto"
          align="end"
          label={t("动态是什么", "What activity shows")}
          tips={[
            t("agent、你在窗口里，或者直接改文件：每一次改动都记在这里。", "Every change is recorded here: the agent’s, yours in the window, or edits made to the file directly."),
            t("每一条都能撤销（⌘Z）。", "Each one can be undone (⌘Z)."),
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {doc.changes.length === 0 ? (
          <StateView size="sm" kind="empty" title={t("还没有改动", "No changes yet")} />
        ) : (
          <ul className="divide-y">
            {doc.changes.map((c) => (
              <li key={c.seq ?? `${c.rev}-${c.at}`} className="flex items-start gap-2.5 px-4 py-2.5">
                <Badge tone={ACTOR_TONE[c.actor]} className={cn("mt-0.5 justify-center", byLocale("w-11", "min-w-11"))}>
                  {ACTOR_LABEL[c.actor]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-body break-words">{c.summary}</p>
                  <p className="mt-0.5 text-caption text-faint-foreground tabular">
                    {t(`第 ${c.rev} 版 · ${ago(c.at, now)}`, `Version ${c.rev} · ${ago(c.at, now)}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
