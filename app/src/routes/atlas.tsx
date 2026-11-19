import * as React from "react"
import { Link, useSearchParams } from "react-router"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Segmented } from "@/components/ui/segmented"
import { Viewport } from "@/components/viewport"
import { ParamSlider } from "@/components/param-slider"
import { OpIcon } from "@/components/op-icon"
import { OPS, SOFTWARE, type Op, type OpCategory, type OpId } from "@/content/ops"
import { demoDefaults, demoFor, type Demo } from "@/content/demos"
import { availableFor, lessonById } from "@/content/curriculum"
import { useModelIndex } from "@/lib/use-async"
import { acquireSnapshotter, releaseSnapshotter } from "@/three/snapshot"
import { onThemeChange } from "@/three/tokens"
import { disposeObject, type Viewer } from "@/three/viewer"
import { ease, prefersReducedMotion } from "@/three/tween"
import { isEn, t } from "@/lib/i18n"

const CATEGORIES: OpCategory[] = ["基准与草图", "生成实体", "修饰特征", "阵列与变换", "组合与曲面"]

/** The categories' names on English pages (the content names them in Chinese). */
const CATEGORY_EN: Record<OpCategory, string> = {
  基准与草图: "Datums and sketches",
  生成实体: "Creating solids",
  修饰特征: "Dress-up features",
  阵列与变换: "Patterns and transforms",
  组合与曲面: "Combining bodies and surfaces",
}
const categoryName = (c: OpCategory) => t(c, CATEGORY_EN[c])

/** What a curriculum entry opens as, on English pages (the Chinese label comes from the curriculum). */
const KIND_EN = { lesson: "Lesson", teardown: "Teardown", card: "Card" } as const

export function AtlasPage() {
  const [params, setParams] = useSearchParams()
  const open = params.get("op") as OpId | null
  const op = open ? OPS.find((o) => o.id === open) : undefined
  const setOpen = (id: OpId | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set("op", id)
    else next.delete("op")
    setParams(next, { replace: true })
  }
  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title={t("工具图鉴", "Command atlas")}
        info={t(
          "每个建模命令一张卡：它做什么、要什么输入、常见的坑，以及在各个软件里叫什么。悬停卡片看它怎么生成形体。",
          "One entry per modeling command: what it does, what it needs, the usual pitfalls, and what each CAD package calls it. Hover an entry to watch it build the shape.",
        )}
      />
      {CATEGORIES.map((c) => (
        <Section key={c} title={categoryName(c)}>
          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2">
            {OPS.filter((o) => o.category === c).map((o) => (
              <OpCard key={o.id} op={o} onOpen={() => setOpen(o.id)} />
            ))}
          </div>
        </Section>
      ))}
      <OpDrawer op={op} onClose={() => setOpen(null)} />
    </Page>
  )
}

function OpCard({ op, onOpen }: { op: Op; onOpen: () => void }) {
  const demo = demoFor(op.id)
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const anim = React.useRef(0)

  const drawAt = React.useCallback(
    (t: number) => {
      const c = canvas.current
      if (!c || !demo) return
      const snap = acquireSnapshotter()
      const w = c.clientWidth
      const h = c.clientHeight
      const dpr = Math.min(window.devicePixelRatio, 2)
      if (c.width !== Math.round(w * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      const obj = demo.build(snap.kit, t, demoDefaults(demo), demo.modes?.[0].id ?? "")
      snap.draw(c.getContext("2d")!, obj, { w, h, box: demo.box, dir: demo.dir, padding: 1.12 })
      disposeObject(obj)
      releaseSnapshotter()
    },
    [demo],
  )

  React.useEffect(() => {
    if (!demo) return
    const snap = acquireSnapshotter()
    const draw = () => {
      snap.refreshTheme()
      drawAt(1)
    }
    const id = requestAnimationFrame(draw)
    const off = onThemeChange(() => requestAnimationFrame(draw))
    return () => {
      cancelAnimationFrame(id)
      cancelAnimationFrame(anim.current)
      off()
      releaseSnapshotter()
    }
  }, [demo, drawAt])

  const replay = () => {
    if (!demo || prefersReducedMotion()) return
    cancelAnimationFrame(anim.current)
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 1300)
      drawAt(ease.inOut(k))
      if (k < 1) anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={replay}
      onFocus={replay}
      className="group flex flex-col overflow-hidden rounded-lg border text-left transition-colors duration-(--duration-fast) hover:border-input"
    >
      <div className="relative aspect-[4/3] bg-scene">
        {demo ? (
          <canvas ref={canvas} className="size-full" aria-hidden />
        ) : (
          <div className="grid size-full place-items-center text-faint-foreground">
            <OpIcon op={op.id} className="size-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 border-t p-3">
        <div className="flex items-center gap-1.5">
          <OpIcon op={op.id} className="size-4 text-muted-foreground" />
          <span className="text-heading font-semibold">{op.name}</span>
          {!isEn && <span className="truncate text-small text-faint-foreground">{op.en}</span>}
        </div>
        <p className="line-clamp-2 text-small text-muted-foreground">{op.gist}</p>
      </div>
    </button>
  )
}

export function OpDrawer({ op, onClose }: { op?: Op; onClose: () => void }) {
  // Keep the last op while the drawer animates closed (derived state, updated during render).
  const [shown, setShown] = React.useState(op)
  if (op && op !== shown) setShown(op)
  const o = op ?? shown
  return (
    <Drawer open={!!op} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent size="lg">
        {o && (
          <>
            <DrawerHeader title={isEn ? o.name : `${o.name} ${o.en}`} description={categoryName(o.category)} />
            <DrawerBody className="space-y-6">
              {demoFor(o.id) && <DemoView key={o.id} demo={demoFor(o.id)!} />}
              <p className="text-reading">{o.gist}</p>
              <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
                <ListBlock title={t("需要的输入", "Inputs")} items={o.inputs} />
                <ListBlock title={t("常用选项", "Common options")} items={o.options} />
              </div>
              <ListBlock title={t("常见的坑", "Pitfalls")} items={o.pitfalls} tone="warning" />
              <div>
                <h3 className="mb-2 text-heading font-semibold">{t("各软件里叫什么", "What each package calls it")}</h3>
                <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-body">
                  {SOFTWARE.filter((s) => o.names[s.id]).map((s) => (
                    <div key={s.id} className="contents">
                      <dt className="text-muted-foreground">{s.name}</dt>
                      <dd className={cn(s.id === "build123d" && "font-mono text-small")}>{o.names[s.id]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-caption text-faint-foreground">
                  {t(
                    "中文名以各软件简体中文界面为准，正式上线前逐条核对官方帮助。",
                    "Names follow each package's English interface. A name still in Chinese is one whose English name hasn't been checked yet.",
                  )}
                </p>
              </div>
              <Related op={o} />
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function ListBlock({ title, items, tone }: { title: string; items: string[]; tone?: "warning" }) {
  return (
    <div>
      <h3 className="mb-2 text-heading font-semibold">{title}</h3>
      <ul className={cn("space-y-1.5 text-body", tone === "warning" && "[&>li]:bg-warning-subtle [&>li]:text-warning [&>li]:rounded-md [&>li]:px-3 [&>li]:py-1.5")}>
        {items.map((i) => (
          <li key={i} className={cn(!tone && "flex gap-2 before:mt-2.5 before:size-1 before:shrink-0 before:rounded-full before:bg-faint-foreground")}>
            {i}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Related({ op }: { op: Op }) {
  const lessons = op.lessons.map(lessonById).filter((l) => !!l)
  const index = useModelIndex()
  const models = index.filter((m) => op.models.includes(m.id))
  if (!lessons.length && !models.length) return null
  return (
    <div>
      <h3 className="mb-2 text-heading font-semibold">{t("在哪儿学到它", "Where to learn it")}</h3>
      <div className="flex flex-col gap-1">
        {lessons.map((l) => {
          const avail = availableFor(l.id)
          return (
            <Link key={l.id} to={avail?.to ?? `/learn#${l.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-body hover:bg-accent">
              <span className="w-10 shrink-0 font-mono text-caption tabular text-faint-foreground">{l.id}</span>
              <span className="min-w-0 flex-1">{l.title}</span>
              {avail ? <Badge tone="info">{isEn ? KIND_EN[avail.kind] : avail.label}</Badge> : <span className="shrink-0 text-caption text-faint-foreground">{t("规划中", "Planned")}</span>}
            </Link>
          )
        })}
        {models.map((m) => (
          <Link key={m.id} to={`/teardown/${m.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-body hover:bg-accent">
            <Badge tone="info" className={cn("justify-center", !isEn && "w-10")}>
              {t("拆解", "Teardown")}
            </Badge>
            {m.title}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** The operation's live demo: replay its creation, turn its knobs. */
function DemoView({ demo }: { demo: Demo }) {
  const viewer = React.useRef<Viewer | null>(null)
  const [opts, setOpts] = React.useState(() => demoDefaults(demo))
  const [mode, setMode] = React.useState(demo.modes?.[0].id ?? "")
  const [time, setT] = React.useState(0)
  const state = React.useRef({ t: 0, opts, mode })
  state.current = { t: time, opts, mode }

  const render = React.useCallback(
    (tt: number) => {
      const v = viewer.current
      if (!v) return
      v.setContent(demo.build(v.kit, tt, state.current.opts, state.current.mode))
    },
    [demo],
  )

  const play = React.useCallback(() => {
    const v = viewer.current
    if (!v) return
    v.tweens.run(
      1400,
      (k) => {
        setT(k)
        render(k)
      },
      { tag: "demo", ease: ease.inOut },
    )
  }, [render])

  const onReady = React.useCallback(
    (v: Viewer) => {
      viewer.current = v
      v.setGrid(80, 5)
      v.fit(demo.box, { dir: demo.dir ?? undefined, view: demo.dir ? undefined : "iso", padding: 1.35, animate: false })
      render(0)
      // The drawer is still sliding in on the first frame; frame again at full width.
      const refit = setTimeout(() => v.fit(demo.box, { dir: demo.dir ?? undefined, view: demo.dir ? undefined : "iso", padding: 1.2, animate: false }), 280)
      const id = setTimeout(play, 320)
      return () => {
        clearTimeout(refit)
        clearTimeout(id)
        viewer.current = null
      }
    },
    [demo, play, render],
  )

  React.useEffect(() => {
    render(time)
    // Options and mode re-render the current frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, mode])

  return (
    <div className="overflow-hidden rounded-lg border">
      <Viewport className="h-72" onReady={onReady} viewCube={false} triadClassName="bottom-2 left-2" />
      <div className="space-y-2 border-t p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={play}>
            <Play />
            {t("重放生成过程", "Replay the build")}
          </Button>
          {demo.modes && <Segmented size="sm" value={mode} onValueChange={setMode} options={demo.modes.map((m) => ({ value: m.id, label: m.label }))} />}
        </div>
        <ParamSlider
          className="px-0"
          label={t("生成过程", "Progress")}
          unit="%"
          value={Math.round(time * 100)}
          min={0}
          max={100}
          onChange={(v) => {
            viewer.current?.tweens.cancel("demo")
            setT(v / 100)
            render(v / 100)
          }}
        />
        <div className="grid grid-cols-2 gap-x-4 max-sm:grid-cols-1">
          {demo.options.map((o) => (
            <ParamSlider
              key={o.id}
              className="px-0"
              label={o.label}
              value={opts[o.id]}
              min={o.min}
              max={o.max}
              step={o.step}
              unit={o.unit}
              onChange={(v) => setOpts((p) => ({ ...p, [o.id]: v }))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

