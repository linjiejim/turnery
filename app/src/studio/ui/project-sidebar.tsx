// Collapsible browser project sidebar: manage multiple projects and multi-file
// parts, assemblies, shared parameter files and imported STEP assets in Web Studio.
import * as React from "react"
import { Box, Boxes, FileCode2, FileJson, FolderOpen, Plus, SlidersHorizontal, Trash2, Upload } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { isAssemblyPath, isParamsPath, isPartPath, isStepPath } from "@/hub/package"
import type { WebProject } from "../project-store"

export function ProjectSidebar({
  projects,
  active,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onSelectFile,
  onAddFile,
  onDeleteFile,
  onUploadFiles,
}: {
  projects: WebProject[]
  active: WebProject
  onSelectProject: (id: string) => void
  onCreateProject: (kind: "part" | "assembly") => void
  onRenameProject: (name: string) => void
  onSelectFile: (path: string) => void
  onAddFile: (kind: "part" | "assembly" | "params") => void
  onDeleteFile: (path: string) => void
  onUploadFiles: () => void
}) {
  const [editingName, setEditingName] = React.useState(false)
  const [draftName, setDraftName] = React.useState(active.name)

  const filePaths = React.useMemo(() => Object.keys(active.files).sort((a, b) => a.localeCompare(b)), [active.files])
  const assemblies = filePaths.filter(isAssemblyPath)
  const parts = filePaths.filter(isPartPath)
  const params = filePaths.filter(isParamsPath)
  const steps = filePaths.filter(isStepPath)
  const others = filePaths.filter((p) => !isAssemblyPath(p) && !isPartPath(p) && !isParamsPath(p) && !isStepPath(p))

  const commitName = () => {
    setEditingName(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== active.name) onRenameProject(trimmed)
  }

  return (
    <aside aria-label={t("项目文件", "Project files")} className="flex w-56 shrink-0 flex-col border-r bg-sunken max-lg:hidden">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t("切换项目", "Switch project")} size="icon-sm">
              <FolderOpen />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => onSelectProject(p.id)}>
                <span className={cn("truncate", p.id === active.id && "font-semibold")}>{p.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onCreateProject("part")}>{t("新建单零件项目", "New part project")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCreateProject("assembly")}>{t("新建多零件装配项目", "New assembly project")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {editingName ? (
          <Input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName()
              if (e.key === "Escape") setEditingName(false)
            }}
            className="h-7 flex-1 px-1.5 text-small"
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate rounded-sm px-1 text-left text-small font-semibold hover:bg-accent"
            title={t("点击重命名项目", "Click to rename project")}
            onClick={() => {
              setDraftName(active.name)
              setEditingName(true)
            }}
          >
            {active.name}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label={t("添加文件", "Add file")} size="icon-sm">
              <Plus />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onAddFile("part")}>{t("新建零件 (.turnery.json)", "New part (.turnery.json)")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAddFile("assembly")}>{t("新建装配 (.turnery-asm.json)", "New assembly (.turnery-asm.json)")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAddFile("params")}>{t("新建共享参数 (.params.json)", "New shared params (.params.json)")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onUploadFiles}>
              <Upload className="size-3.5" />
              {t("导入 JSON / STEP / ZIP…", "Import JSON / STEP / ZIP…")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {assemblies.length > 0 && (
          <FileGroup
            title={t("装配体", "Assemblies")}
            files={assemblies}
            active={active.activeFile}
            icon={<Boxes className="size-3.5 shrink-0 text-primary" />}
            onSelect={onSelectFile}
            onDelete={filePaths.length > 1 ? onDeleteFile : undefined}
          />
        )}
        {parts.length > 0 && (
          <FileGroup
            title={t("零件", "Parts")}
            files={parts}
            active={active.activeFile}
            icon={<Box className="size-3.5 shrink-0 text-muted-foreground" />}
            onSelect={onSelectFile}
            onDelete={filePaths.length > 1 ? onDeleteFile : undefined}
          />
        )}
        {params.length > 0 && (
          <FileGroup
            title={t("共享参数", "Shared params")}
            files={params}
            active={active.activeFile}
            icon={<SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />}
            onSelect={onSelectFile}
            onDelete={onDeleteFile}
            readonlySelect
          />
        )}
        {steps.length > 0 && (
          <FileGroup
            title={t("STEP 参考件", "STEP assets")}
            files={steps}
            active={active.activeFile}
            icon={<FileCode2 className="size-3.5 shrink-0 text-muted-foreground" />}
            onSelect={onSelectFile}
            onDelete={onDeleteFile}
            readonlySelect
          />
        )}
        {others.length > 0 && (
          <FileGroup
            title={t("文档与清单", "Docs & Manifest")}
            files={others}
            active={active.activeFile}
            icon={<FileJson className="size-3.5 shrink-0 text-muted-foreground" />}
            onSelect={onSelectFile}
            onDelete={onDeleteFile}
            readonlySelect
          />
        )}
      </div>

      <div className="shrink-0 border-t p-2">
        <Button variant="secondary" size="sm" className="w-full" onClick={onUploadFiles}>
          <Upload />
          {t("导入 STEP / ZIP", "Import STEP / ZIP")}
        </Button>
      </div>
    </aside>
  )
}

function FileGroup({
  title,
  files,
  active,
  icon,
  onSelect,
  onDelete,
  readonlySelect,
}: {
  title: string
  files: string[]
  active: string
  icon: React.ReactNode
  onSelect: (path: string) => void
  onDelete?: (path: string) => void
  readonlySelect?: boolean
}) {
  return (
    <div>
      <div className="mb-1 px-1.5 text-caption font-medium text-faint-foreground">{title}</div>
      <ul className="space-y-0.5">
        {files.map((p) => {
          const isActive = p === active
          return (
            <li key={p} className="group flex items-center gap-1">
              <button
                type="button"
                disabled={readonlySelect}
                onClick={() => !readonlySelect && onSelect(p)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-small transition-colors duration-(--duration-fast)",
                  isActive ? "bg-pressed font-medium text-foreground" : readonlySelect ? "text-muted-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                title={p}
              >
                {icon}
                <span className="truncate">{p}</span>
              </button>
              {onDelete && !isActive && (
                <IconButton
                  label={t(`删除 ${p}`, `Delete ${p}`)}
                  size="icon-sm"
                  tooltip={false}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground"
                  onClick={() => onDelete(p)}
                >
                  <Trash2 />
                </IconButton>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
