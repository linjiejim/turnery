import * as React from "react"
import { Download, MessageSquare, PanelLeft, Plug, Redo2, RotateCw, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { StatusDot } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { LanguageMenu } from "@/components/language-menu"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { DocState, PickRequest, Snapshot, UpdateStatus } from "../core/protocol"
import { TurneryWordmark } from "@/components/turnery-mark"
import { useAssistant } from "../use-assistant"
import { ago, commandLabel, useNow } from "./words"

/**
 * The window's top bar, beside the left panel (which has the brand, and on macOS the traffic lights, at its
 * top). Left: where you are (project / assembly / part), or with the panel closed the button that brings it
 * back. Right: the update, undo, redo, export, the conversation, and 「接入 Agent」 until one has worked here.
 * The bar drags the window.
 */
export function TitleBar({
  snapshot,
  doc,
  onSetup,
  setup,
  chat,
  sidebar,
  onSidebar,
}: {
  snapshot: Snapshot | null
  doc: DocState | null
  onSetup: () => void
  /** 「接入 Agent」 in the bar: until an agent has worked here (the menu and the status bar keep it after). */
  setup: boolean
  /** The built-in assistant's button: shows or puts away the conversation; spins while a turn runs. */
  chat: { open: boolean; onToggle: () => void }
  /** The left panel: open (it holds the brand and the traffic lights), closed, or none at all (the start page). */
  sidebar: boolean | null
  onSidebar: () => void
}) {
  const busy = useAssistant().busy
  const mac = turnery.platform === "darwin"
  const call = (name: string) => void turnery.call(name, {}, doc?.path)
  const project = snapshot?.project
  const context = doc?.context
  const noDrag = "[-webkit-app-region:no-drag]"
  // With the left panel open the traffic lights are over it; otherwise they are over this bar.
  const lights = mac && !sidebar
  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-1 border-b pr-2 pl-3 select-none [-webkit-app-region:drag]", lights && "pl-22")}>
      {sidebar === null ? (
        <TurneryWordmark className="mr-1 h-[18px]" />
      ) : (
        !sidebar && (
          <IconButton label={t("展开左栏（⌘B）", "Show left panel (⌘B)")} size="icon-sm" className={cn("-ml-1 text-muted-foreground", noDrag)} onClick={onSidebar}>
            <PanelLeft />
          </IconButton>
        )
      )}
      <nav aria-label={t("位置", "Location")} className="ml-1 flex min-w-0 items-center gap-1.5">
        {project && project.name !== doc?.name && (
          <>
            <span className="max-w-48 truncate text-body text-muted-foreground" title={project.root}>
              {project.name}
            </span>
            {doc && <span className="text-faint-foreground">/</span>}
          </>
        )}
        {context && (
          <>
            <button type="button" title={t(`回到装配：${context.assembly}`, `Back to assembly: ${context.assembly}`)} className={cn("max-w-40 truncate rounded-sm text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", noDrag)} onClick={() => void turnery.call("open_part", { path: context.assembly })}>
              {context.name}
            </button>
            <span className="text-faint-foreground">/</span>
          </>
        )}
        {doc && (
          <span className="truncate text-body font-medium" title={doc.path}>
            {doc.name}
          </span>
        )}
        {context && <span className="shrink-0 rounded-sm bg-muted px-1.5 text-caption text-muted-foreground">{t("在装配里", "In assembly")}</span>}
      </nav>
      <div className={cn("ml-auto flex items-center gap-0.5", noDrag)}>
        <UpdateStatusButton />
        {doc && (
          <>
            <IconButton label={t("撤销（⌘Z）", "Undo (⌘Z)")} size="icon-sm" disabled={!doc?.canUndo} onClick={() => call("undo")}>
              <Undo2 />
            </IconButton>
            <IconButton label={t("重做（⇧⌘Z）", "Redo (⇧⌘Z)")} size="icon-sm" disabled={!doc?.canRedo} onClick={() => call("redo")}>
              <Redo2 />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={t("导出", "Export")} size="icon-sm" disabled={!doc}>
                  <Download />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void turnery.exportPart("step")}>{t("导出 STEP…", "Export STEP…")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("stl")}>{t("导出 STL…", "Export STL…")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("3mf")}>{t("导出 3MF…", "Export 3MF…")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("py")}>{t("导出 build123d 代码…", "Export build123d code…")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void turnery.exportPart("json")}>{t("导出特征树 JSON…", "Export feature tree JSON…")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          </>
        )}
        <LanguageMenu size="icon-sm" />
        <IconButton label={chat.open ? t("收起对话", "Hide chat") : t("对话", "Chat")} size="icon-sm" aria-pressed={chat.open} className={cn(chat.open && "bg-selected text-primary")} onClick={chat.onToggle}>
          {busy ? <Spinner /> : <MessageSquare />}
        </IconButton>
        {setup && (
          <Button size="sm" variant="secondary" className="ml-1" onClick={onSetup}>
            <Plug />
            {t("接入 Agent", "Connect an agent")}
          </Button>
        )}
      </div>
    </header>
  )
}

/** What the agent is doing right now, or when it last did something. */
export function AgentStatus({ snapshot, pick, className }: { snapshot: Snapshot | null; pick: PickRequest | null; className?: string }) {
  const now = useNow()
  const a = snapshot?.agent
  const who = a?.who === "assistant" ? t("助手", "Assistant") : "Agent"
  if (pick) return <StatusDot tone="warning" className={className}>{t(`${who} 在等你点选`, `${who} is waiting for your pick`)}</StatusDot>
  if (a?.busy && a.tool)
    return (
      <StatusDot tone="info" className={className}>
        {t(`${who} 正在${commandLabel(a.tool)}…`, `${who}: ${commandLabel(a.tool)}…`)}
      </StatusDot>
    )
  if (a?.at && a.tool)
    return (
      <StatusDot tone="success" className={cn("text-muted-foreground", className)}>
        {t(`${who} ${ago(a.at, now)}${commandLabel(a.tool)}`, `${who}: ${commandLabel(a.tool)}, ${ago(a.at, now)}`)}
      </StatusDot>
    )
  return <StatusDot className={cn("text-muted-foreground", className)}>{t("没有 agent 在动", "No agent at work")}</StatusDot>
}

function useUpdateStatus() {
  const [status, setStatus] = React.useState<UpdateStatus>({ phase: "idle" })
  React.useEffect(() => {
    let alive = true
    const off = turnery.onUpdate(setStatus)
    void turnery.update().then((s) => alive && setStatus(s))
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

/** A downloaded update waits for a restart; a download the person asked for shows its progress. */
function UpdateStatusButton() {
  const status = useUpdateStatus()
  if (status.phase === "ready")
    return (
      <Button size="sm" variant="primary" className="mr-2" onClick={() => void turnery.restartToUpdate()}>
        <RotateCw />
        {t(`重启以更新到 ${status.version}`, `Restart to update to ${status.version}`)}
      </Button>
    )
  if (status.phase === "downloading" && status.asked)
    return (
      <span className="mr-2 text-caption text-muted-foreground tabular">
        {t(`正在下载 ${status.version}`, `Downloading ${status.version}`)}
        {status.percent !== null ? ` · ${status.percent}%` : "…"}
      </span>
    )
  return null
}
