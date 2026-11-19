import * as React from "react"
import { useLocation, useNavigate } from "react-router"
import { ArrowLeft, CircleAlert, Download, Ellipsis, Share2, Undo2, X } from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { practiceById, type Practice } from "@/content/practice"
import { PracticeCard } from "@/studio/ui/practice-card"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { ChatPanel } from "@/studio/ui/chat-panel"
import { buildCode } from "@/studio/codegen"
import { saveBlob } from "@/studio/download"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { readTreeFile } from "@/studio/import"
import { checkTree } from "@/studio/limits"
import { PANEL_DEFAULT, PANEL_MIN, usePanelWidth } from "@/studio/ui/panel-width"
import { ShareDialog } from "@/studio/ui/share-dialog"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import type { Hover } from "@/studio/scene"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { DesktopBanner } from "@/studio/ui/desktop-banner"
import { NO_PARTS_VIEW, type PartsView } from "@/studio/scene"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { useReselect } from "@/studio/use-reselect"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useStudio } from "@/studio/use-studio"
import { KEY_STORE, useStudioChat } from "@/studio/use-studio-chat"
import { t } from "@/lib/i18n"

type Status = { model: string; via?: "deepseek" | "openrouter" | "mock"; hostedKey: boolean; budgetExhausted: boolean }

/** What 「复制到我的工作台」 on a shared link hands over (router state, so it never touches storage). */
export type Incoming = { tree: Tree; title: string }

export function StudioPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const studio = useStudio()
  const chat = useStudioChat(studio)
  const annotations = useAnnotations(studio)
  // Pins of a sent message stay on the model until the reply is done.
  const { clearSent } = annotations
  React.useEffect(() => {
    if (!chat.busy) clearSent()
  }, [chat.busy, clearSent])
  const [hover, setHover] = React.useState<Hover | null>(null)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const reselect = useReselect(studio)
  // A split body: how far its parts are pulled apart, and which are hidden.
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  // A message started from a feature card brings the conversation forward.
  const [tab, setTab] = React.useState("chat")
  /** 「工程图」: the drawing sheet over the 3D view; the side panel stays, so parameters can be changed while looking at it. */
  const [sheet, setSheet] = React.useState(false)
  const [seenPrefill, setSeenPrefill] = React.useState(annotations.prefill)
  if (seenPrefill !== annotations.prefill) {
    setSeenPrefill(annotations.prefill)
    if (annotations.prefill) setTab("chat")
  }
  const [confirmNew, setConfirmNew] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const [codeOpen, setCodeOpen] = React.useState(false)
  /** A practice from a lesson (/studio?practice=<id>): its card over the chat, its checks pinned in the tree. */
  // From the address (a lesson's link) or, after a reload, from storage.
  const [arriving] = React.useState(() => new URL(window.location.href).searchParams.get("practice"))
  const [practice, setPractice] = React.useState<Practice | null>(() => practiceById(arriving ?? localStorage.getItem(PRACTICE_STORE) ?? "") ?? null)
  const { pinChecks } = studio
  React.useEffect(() => pinChecks(practice?.checks ?? null), [practice, pinChecks])
  const exitPractice = React.useCallback(() => {
    setPractice(null)
    localStorage.removeItem(PRACTICE_STORE)
  }, [])
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)
  const ready = studio.kernel.phase === "ready"
  const panel = usePanelWidth()

  React.useEffect(() => {
    fetch("/api/studio/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStatus(s))
      .catch(() => setStatus(null))
  }, [])

  const partCount = studio.report?.parts?.length ?? 0
  /** Swap in another model: undoable, and the chat gets a line saying so. */
  const { load, undo } = studio
  const { addDivider } = chat
  const { reset: resetAnnotations } = annotations
  const replaceModel = React.useCallback(
    (tree: Tree, divider: string, done: string) => {
      resetAnnotations()
      addDivider(divider)
      void load(tree).then(() => notify.undo(done, undo))
    },
    [resetAnnotations, addDivider, load, undo],
  )

  // A practice from a lesson: once the kernel is up, start from its tree (undoable) and drop the parameter.
  const practiceTaken = React.useRef(false)
  React.useEffect(() => {
    if (!ready || arriving === null || practiceTaken.current) return
    practiceTaken.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete("practice")
    window.history.replaceState(null, "", url)
    const p = practiceById(arriving)
    if (!p) return void notify.error(t("没有找到这道练习", "Practice not found"))
    localStorage.setItem(PRACTICE_STORE, p.id)
    pinChecks(p.checks)
    replaceModel({ ...(p.start ?? EMPTY_TREE), checks: p.checks }, t(`开始练习「${p.title}」`, `Started practice “${p.title}”`), t("已换成练习的起始模型", "Switched to the practice’s starting model"))
  }, [ready, arriving, pinChecks, replaceModel])

  // 「复制到我的工作台」 from a shared link: replace once the kernel is up, then drop the state so a reload doesn't do it again.
  const incoming = (location.state as { incoming?: Incoming } | null)?.incoming
  const took = React.useRef(false)
  React.useEffect(() => {
    if (!ready || !incoming || took.current) return
    took.current = true
    navigate(".", { replace: true, state: null })
    const checked = checkTree(incoming.tree)
    if (!checked.ok) return void notify.error(t(`没能复制这个模型：${checked.message}`, `Couldn’t copy this model: ${checked.message}`))
    replaceModel(checked.tree, t(`换成了分享的模型「${incoming.title}」`, `Switched to the shared model “${incoming.title}”`), t("已替换当前模型", "Replaced the current model"))
  }, [ready, incoming, navigate, replaceModel])

  // Import: a file from the menu or dropped on the view. Errors stay over the view until closed.
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [importError, setImportError] = React.useState<{ file: string; message: string } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const importFile = async (file: File) => {
    setImportError(null)
    if (!ready) return setImportError({ file: file.name, message: t("建模内核还没准备好，稍等再试", "The modeling kernel isn’t ready yet. Try again in a moment.") })
    if (chat.busy) return setImportError({ file: file.name, message: t("助教正在改模型，这一轮结束后再导入", "The tutor is changing the model. Import once it’s done.") })
    const r = await readTreeFile(file)
    if (!r.ok) return setImportError({ file: file.name, message: r.message })
    replaceModel(r.tree, t(`导入了特征树「${r.name}」`, `Imported feature tree “${r.name}”`), t(`已导入「${r.name}」`, `Imported “${r.name}”`))
  }

  const download = async (format: "step" | "stl" | "json" | "py") => {
    if (format === "py") {
      const { code, problems } = buildCode(studio.tree)
      if (problems.length) return notify.error(t(`有 ${problems.length} 处不能安全地写成代码，没有导出：${problems[0]}`, `Not exported: ${problems.length} ${problems.length === 1 ? "place" : "places"} can’t be written safely as code: ${problems[0]}`))
      return saveBlob(new Blob([code], { type: "text/x-python" }), "turnery-model.py")
    }
    const blob = format === "json" ? new Blob([JSON.stringify(studio.tree, null, 2)], { type: "application/json" }) : await studio.exportBody(format)
    if (!blob) return notify(t("还没有实体可以导出", "Nothing to export yet"))
    saveBlob(blob, `turnery-model.${format === "stl" && blob.type === "application/zip" ? "zip" : format}`)
  }

  return (
    <>
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label={t("返回首页", "Back to home")} onClick={() => navigate("/")}>
          <ArrowLeft />
        </IconButton>
        <span className="truncate text-body font-semibold">{t("工作台", "Workbench")}</span>
        {sheet ? (
          <Button size="sm" variant="secondary" className="mx-auto" onClick={() => setSheet(false)}>
            {t("回到 3D", "Back to 3D")}
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex items-center gap-1">
          <IconButton label={t("撤销上一步", "Undo last step")} disabled={!studio.canUndo || chat.busy} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("导出", "Export")}>
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => void download("step")}>{partCount > 1 ? t(`导出 STEP（${partCount} 个零件）`, `Export STEP (${partCount} parts)`) : t("导出 STEP", "Export STEP")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("stl")}>{partCount > 1 ? t("导出 STL（zip，每个零件一个文件）", "Export STL (zip, one file per part)") : t("导出 STL", "Export STL")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("py")}>{t("导出 build123d 代码", "Export build123d code")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("json")}>{t("导出特征树（JSON）", "Export feature tree (JSON)")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton label={t("分享", "Share")} disabled={!studio.tree.features.length || chat.busy} onClick={() => setSharing(true)}>
            <Share2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("更多", "More")}>
                <Ellipsis />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSheet(!sheet)}>{sheet ? t("回到 3D", "Back to 3D") : t("工程图", "Drawing")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCodeOpen(true)}>{t("代码", "Code")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!ready || chat.busy} onSelect={() => fileInput.current?.click()}>
                {t("导入特征树（JSON）…", "Import feature tree (JSON)…")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setKeyOpen(true)}>{t("使用自己的 key…", "Use your own key…")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" disabled={chat.busy} onClick={() => setConfirmNew(true)}>
            {t("新建零件", "New part")}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label={t("选择特征树文件", "Choose a feature tree file")}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0]
            e.currentTarget.value = ""
            if (f) void importFile(f)
          }}
        />
      </header>
      {/* Under the top bar, not over it: toasts open 56 px from the top and must not cover its actions. */}
      <DesktopBanner />

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <main
          className="relative min-h-0 min-w-0 flex-1"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "copy"
            if (!dragging) setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files[0]
            if (f) void importFile(f)
          }}
        >
          <StudioViewport studio={studio} hover={hover} annotations={annotations} busy={chat.busy} reselect={reselect} parts={partsView} onParts={setPartsView} />
          <TreeOverlay studio={studio} onHover={setHover} reselect={reselect} annotations={annotations} busy={chat.busy} parts={partsView} onParts={setPartsView} detailsIn={stepSlot} />
          {sheet && (
            <div className="absolute inset-0 z-30 bg-background">
              <DrawingSheet studio={studio} title={studio.tree.features.length ? t("零件", "Part") : ""} />
            </div>
          )}
          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-body font-medium">
              {t("松开鼠标，导入这个特征树（JSON）", "Drop to import this feature tree (JSON)")}
            </div>
          )}
          {importError && (
            <div
              role="alert"
              className="absolute top-3 left-1/2 z-20 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/40 bg-background p-3 text-small shadow-popover"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 break-words">
                <div className="font-medium">{t(`没能导入「${importError.file}」`, `Couldn’t import “${importError.file}”`)}</div>
                <div className="mt-0.5 text-muted-foreground">{importError.message}</div>
                <div className="mt-0.5 text-faint-foreground">{t("当前模型没有改动。", "The current model is unchanged.")}</div>
              </div>
              <IconButton label={t("关闭", "Close")} size="icon-sm" tooltip={false} className="-mt-1 -mr-1 text-muted-foreground" onClick={() => setImportError(null)}>
                <X />
              </IconButton>
            </div>
          )}
        </main>
        <ConnectorOverlay param={hover?.param ?? null} row={hover?.row ?? null} />

        <Tabs
          value={tab}
          onValueChange={setTab}
          style={{ "--panel-w": `${panel.width}px` } as React.CSSProperties}
          className="relative flex shrink-0 flex-col border-l lg:w-(--panel-w) max-lg:h-[55dvh] max-lg:w-full max-lg:border-t max-lg:border-l-0"
        >
          <ResizeHandle
            side="left"
            label={t("调整面板宽度", "Resize panel")}
            value={panel.width}
            min={PANEL_MIN}
            max={panel.max}
            defaultValue={PANEL_DEFAULT}
            onValueChange={(w) => panel.resize(w)}
            onValueCommit={(w) => panel.resize(w, true)}
            className="max-lg:hidden"
          />
          <TabsList className="shrink-0 px-3">
            <TabsTrigger value="chat">{t("对话", "Chat")}</TabsTrigger>
            <TabsTrigger value="params">{t("参数", "Parameters")}</TabsTrigger>
          </TabsList>
          <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" forceMount>
            {status && !status.hostedKey && !hasOwnKey() && (
              <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-small text-muted-foreground">
                {t("这里没有公共额度，要用自己的 DeepSeek key", "No shared quota here. Use your own DeepSeek key.")}
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setKeyOpen(true)}>
                  {t("填 key", "Add key")}
                </Button>
              </div>
            )}
            {practice && <PracticeCard practice={practice} results={studio.report?.checks} rolledBack={Boolean(studio.rollback)} onExit={exitPractice} />}
            <ChatPanel
              chat={chat}
              annotations={annotations}
              ready={ready}
              onSelectFeature={studio.showFeature}
              onLoad={studio.load}
              model={status?.model}
              practicing={Boolean(practice)}
            />
          </TabsContent>
          <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} onHover={setHover} annotations={annotations} />
          </TabsContent>
          {/* A step's details from the timeline cover this panel while shown. */}
          <div ref={setStepSlot} className="pointer-events-none absolute inset-0 z-20" />
        </Tabs>
      </div>

      <ShareDialog open={sharing} onOpenChange={setSharing} tree={studio.tree} messages={chat.messages} />
      <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} status={status} />
      <Drawer open={codeOpen} onOpenChange={setCodeOpen}>
        <DrawerContent size="lg">
          <DrawerHeader title={t("代码", "Code")} description={t("和特征树等价的 build123d 代码", "build123d code equivalent to the feature tree")} />
          <DrawerBody className="p-0">
            <CodePanel studio={studio} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title={t("新建零件？", "New part?")}
        description={t("会清空当前的特征树和对话。特征树可以用「撤销」找回，对话不能。", "This clears the current feature tree and chat. Undo brings back the feature tree, not the chat.")}
        confirmLabel={t("清空并新建", "Clear and start new")}
        tone="danger"
        onConfirm={() => {
          exitPractice()
          chat.clear()
          annotations.reset()
          studio.reset()
        }}
      />
    </div>
    </>
  )
}

const PRACTICE_STORE = "arbor:practice"

const hasOwnKey = () => Boolean(localStorage.getItem(KEY_STORE))

function KeyDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (o: boolean) => void; status: Status | null }) {
  const [key, setKey] = React.useState(() => localStorage.getItem(KEY_STORE) ?? "")
  const save = () => {
    const k = key.trim()
    if (k) localStorage.setItem(KEY_STORE, k)
    else localStorage.removeItem(KEY_STORE)
    notify(k ? t("已保存，之后的对话用你自己的 key", "Saved. Chats from now on use your own key.") : t("已清除，改用公共额度", "Cleared. Using the shared quota."))
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t("使用自己的 DeepSeek key", "Use your own DeepSeek key")} />
        <DialogBody>
        <p className="text-small text-muted-foreground">
          {status?.hostedKey
            ? t(
                `不填就用本站的公共额度（${status.via === "openrouter" ? "经 OpenRouter 调用同一个模型，" : ""}每天有上限）。`,
                `Leave it empty to use this site’s shared quota (${status.via === "openrouter" ? "the same model through OpenRouter, " : ""}with a daily limit). `,
              )
            : t("本站没有配置公共额度，需要填自己的 key。", "This site has no shared quota, so you need your own key. ")}
          {t(
            "key 只保存在这个浏览器里，随请求经本站服务器转发给 DeepSeek，服务器不保存。",
            "The key stays in this browser. It goes through this site’s server to DeepSeek with each request and is never stored there.",
          )}
        </p>
        <Input className="mt-3 font-mono" type="password" autoComplete="off" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="DeepSeek API key" />
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={save}>
            {t("保存", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
