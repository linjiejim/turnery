// The website workbench's projects: the project menu (top bar and left panel), the ＋ beside the
// search, and the short dialogs they open. Projects and files live in this browser (studio/web-host).
import * as React from "react"
import { Box, Boxes, Check, ChevronDown, FileUp, Plus } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { fileStem } from "@/desktop/ui/words"
import type { NewKind, WebProject } from "../web-host/web-host"

/** What the project menu can do; the page carries each one out. */
export type ProjectActions = {
  projects: WebProject[]
  current: string | null
  /** The assistant is changing the model: switching or removing projects waits until it's done. */
  busy?: boolean
  /** The open project's files and the open one: listed in the top bar's menu (the left panel may be hidden). */
  files?: { path: string; name: string; kind: "part" | "assembly" }[]
  active?: string | null
  openFile?: (path: string) => void
  open: (root: string) => void
  newFile: (kind: NewKind) => void
  importFiles: () => void
  newProject: () => void
  renameProject: () => void
  exportProject: () => void
  deleteProject: () => void
}

/** The menu's items: (`withFiles`) the project's files, switch projects, make something new, the project itself. */
export function ProjectMenuItems({ actions: a, withFiles = false }: { actions: ProjectActions; withFiles?: boolean }) {
  const open = a.current !== null
  return (
    <>
      {withFiles && a.files && a.files.length > 0 && (
        <>
          <DropdownMenuLabel>{t("文件", "Files")}</DropdownMenuLabel>
          <div className="max-h-60 overflow-y-auto">
            {a.files.map((f) => (
              <DropdownMenuItem key={f.path} onSelect={() => f.path !== a.active && a.openFile?.(f.path)}>
                {f.kind === "assembly" ? <Boxes /> : <Box />}
                <span className={cn("truncate", f.path === a.active && "font-medium")}>{f.name}</span>
                {f.path === a.active && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
        </>
      )}
      <DropdownMenuLabel>{t("项目", "Projects")}</DropdownMenuLabel>
      <div className="max-h-60 overflow-y-auto">
        {a.projects.map((p) => (
          <DropdownMenuItem key={p.root} disabled={a.busy && p.root !== a.current} onSelect={() => p.root !== a.current && a.open(p.root)}>
            <span className={cn("truncate", p.root === a.current && "font-medium")}>{p.name}</span>
            {p.root === a.current && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </div>
      <DropdownMenuItem disabled={a.busy} onSelect={a.newProject}>
        <Plus />
        {t("新建项目…", "New project…")}
      </DropdownMenuItem>
      {open && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => a.newFile("part")}>{t("新建零件", "New part")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => a.newFile("assembly")}>{t("新建装配", "New assembly")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={a.importFiles}>{t("导入文件…", "Import files…")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={a.renameProject}>{t("重命名项目…", "Rename project…")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={a.exportProject}>{t("导出整个项目（.zip）", "Export whole project (.zip)")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" disabled={a.busy} onSelect={a.deleteProject}>
            {t("删除项目…", "Delete project…")}
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}

/** The project's name with its menu: in the top bar (`compact`) and at the top of the left panel. */
export function ProjectMenu({ actions, name, compact = false, className }: { actions: ProjectActions; name: string; compact?: boolean; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t(`项目：${name}`, `Project: ${name}`)}
          className={cn(
            "flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
            compact ? "text-body text-muted-foreground" : "text-body font-medium text-foreground",
            className,
          )}
        >
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-faint-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <ProjectMenuItems actions={actions} withFiles={compact} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The ＋ beside the left panel's search. */
export function AddFileMenu({ onNew, onImport }: { onNew: (kind: NewKind) => void; onImport: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={t("新建或导入", "New or import")} size="icon-sm" className="text-muted-foreground">
          <Plus />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onNew("part")}>
          <Box />
          {t("新建零件", "New part")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onNew("assembly")}>
          <Boxes />
          {t("新建装配", "New assembly")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onImport}>
          <FileUp />
          {t("导入文件…", "Import files…")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A short dialog for one name: the field, an error under it, one primary button. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  label,
  initial,
  placeholder,
  confirmLabel,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  label: string
  initial: string
  placeholder?: string
  confirmLabel: string
  /** Resolves to an error to show under the field, or null when done. */
  onSubmit: (name: string) => Promise<string | null>
}) {
  const [name, setName] = React.useState(initial)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [seen, setSeen] = React.useState(open)
  if (seen !== open) {
    setSeen(open)
    if (open) {
      setName(initial)
      setError(null)
    }
  }
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const err = await onSubmit(name.trim()).catch((e: unknown) => String((e as Error)?.message ?? e))
    setBusy(false)
    if (err) setError(err)
    else onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={title} />
        <DialogBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <Field label={label} error={error}>
              <Input autoFocus value={name} placeholder={placeholder} onFocus={(e) => e.currentTarget.select()} onChange={(e) => (setName(e.target.value), setError(null))} />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" disabled={!name.trim()} loading={busy} onClick={() => void submit()}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 新建项目: a name, and whether it is one part or several (an assembly with shared parameters). */
export function NewProjectDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string, kind: NewKind) => Promise<string | null> }) {
  const [name, setName] = React.useState("")
  const [kind, setKind] = React.useState<NewKind>("part")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [seen, setSeen] = React.useState(open)
  if (seen !== open) {
    setSeen(open)
    if (open) {
      setName("")
      setKind("part")
      setError(null)
    }
  }
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const err = await onCreate(name.trim(), kind).catch((e: unknown) => String((e as Error)?.message ?? e))
    setBusy(false)
    if (err) setError(err)
    else onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t("新建项目", "New project")} />
        <DialogBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <FieldGroup>
              <Field label={t("项目名", "Project name")} error={error}>
                <Input autoFocus value={name} placeholder={t("例如 传感器外壳", "e.g. Sensor enclosure")} onChange={(e) => (setName(e.target.value), setError(null))} />
              </Field>
              <Field label={t("里面有", "It holds")}>
                <RadioGroup<NewKind>
                  value={kind}
                  onValueChange={setKind}
                  options={[
                    { value: "part", label: t("一个零件", "One part"), description: t("支架、盒子、法兰这类单个零件", "A single part: a bracket, a box, a flange") },
                    { value: "assembly", label: t("几个零件（装配）", "Several parts (an assembly)"), description: t("外壳和上盖、带螺钉的组件；零件共用一份参数", "A case and its lid, parts with screws; the parts share one set of parameters") },
                  ]}
                />
              </Field>
            </FieldGroup>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" disabled={!name.trim()} loading={busy} onClick={() => void submit()}>
            {t("新建项目", "Create project")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 「已有零件或装配…」 / 「STEP 参考件…」 of an assembly's ＋: a file of the project, or one uploaded now. */
export function PickFileDialog({
  open,
  onOpenChange,
  kind,
  files,
  onPick,
  onUpload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: "part" | "step"
  files: { path: string; folder: string; assembly?: boolean }[]
  onPick: (path: string) => void
  onUpload: () => void
}) {
  const step = kind === "step"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader title={step ? t("放一个 STEP 参考件", "Place a STEP reference") : t("放一个已有的零件或装配", "Place an existing part or assembly")} />
        <DialogBody>
          {files.length ? (
            <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto" aria-label={t("项目里的文件", "Files of the project")}>
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onPick(f.path)}
                  >
                    {f.assembly ? <Boxes className="size-4 shrink-0 text-faint-foreground" /> : <Box className="size-4 shrink-0 text-faint-foreground" />}
                    <span className="truncate">{step ? (f.path.split("/").pop() ?? f.path) : fileStem(f.path)}</span>
                    {f.folder && <span className="ml-auto shrink-0 text-caption text-faint-foreground">{f.folder}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-small text-muted-foreground">
              {step ? t("项目里还没有 STEP 文件", "No STEP files in the project yet") : t("项目里没有别的零件或装配", "No other parts or assemblies in the project")}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant={files.length ? "secondary" : "primary"} onClick={onUpload}>
            <FileUp />
            {step ? t("从电脑上传 STEP…", "Upload a STEP…") : t("从电脑上传…", "Upload from computer…")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
