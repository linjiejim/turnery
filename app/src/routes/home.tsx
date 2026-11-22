import * as React from "react"
import * as THREE from "three"
import { Link } from "react-router"
import { ArrowRight, BookOpen, Layers, PencilRuler, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Viewport } from "@/components/viewport"
import { OpIcon } from "@/components/op-icon"
import { useBakedThumbnail } from "@/components/thumbnail"
import { useContinue } from "@/lib/progress"
import { LESSONS } from "@/content/lessons"
import { mug } from "@/content/procedural/mug"
import { defaults } from "@/content/procedural/types"
import { featureNameEn, OPS } from "@/content/ops"
import { CARDS } from "@/content/cards"
import { MoreLink, StartingPoints, StartRoute } from "@/components/learn-path"
import { TurneryMark } from "@/components/turnery-mark"
import { useModelIndex } from "@/lib/use-async"
import { PartScene } from "@/three/teardown-scene"
import type { Viewer } from "@/three/viewer"
import type { ModelIndexEntry } from "@/three/baked"
import { byLocale, isEn, t } from "@/lib/i18n"

/** The mug's features are named like 「圆角2」; on English pages that reads "Fillet2", as CAD packages write it. */
const featureName = (name: string) => (isEn ? featureNameEn(name) : name)

export function HomePage() {
  const models = useModelIndex()
  const next = useContinue()
  return (
    <main>
      <section className="relative overflow-hidden border-b">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-[1fr_1.15fr] items-center gap-10 px-6 pb-16 pt-12 max-lg:grid-cols-1 max-sm:px-4">
          <div>
            <div className="font-mono text-small text-primary">{t("Turnery / 工业建模互动课", "Turnery / A hands-on course in mechanical CAD")}</div>
            <h1 className="mt-3 text-hero font-semibold tracking-tight">
              {byLocale(
                <>
                  看懂每一个特征
                  <br />
                  是怎么长出来的
                </>,
                <>
                  See how every feature
                  <br />
                  takes shape
                </>,
              )}
            </h1>
            <p className="mt-4 max-w-[34em] text-reading text-muted-foreground">
              {t(
                "从草图、约束到抽壳、装配，用能亲手操作的 3D 一步步学参数化建模。先讲清概念，再对照 SOLIDWORKS、Fusion、Onshape 里的叫法。",
                "Learn parametric modeling one step at a time, from sketches and constraints to shells and assemblies, in 3D you work with yourself. Each concept comes first, then what SOLIDWORKS, Fusion and Onshape call it.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="primary" size="lg">
                <Link to={next.to}>{next.label}</Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link to="/teardown">{t("看案例拆解", "See the teardowns")}</Link>
              </Button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-4 gap-4">
              <Stat value={LESSONS.length} label={t("节互动课", "interactive lessons")} />
              <Stat value={models.length} label={t("个拆解案例", "teardowns")} />
              <Stat value={OPS.length} label={t("个建模命令", "modeling commands")} />
              <Stat value={CARDS.length} label={t("张图文卡", "illustrated cards")} />
            </dl>
          </div>
          <HeroBuild />
        </div>
      </section>

      <section className="bg-sunken">
        <div className="mx-auto max-w-[1200px] px-6 py-12 max-sm:px-4">
          <h2 className="text-title-lg font-semibold">{t("三步，从看懂到做出来", "Three steps, from understanding to making")}</h2>
          <ol className="relative mt-6 grid grid-cols-3 gap-4 max-md:grid-cols-1">
            <span aria-hidden className="absolute top-9 right-[16%] left-[16%] h-px bg-border max-md:hidden" />
            <Step
              n={1}
              icon={<BookOpen />}
              title={t("动手学概念", "Learn the idea, hands-on")}
              text={t(
                `${LESSONS.length} 节 3D 互动课，一步一个概念：拖角点、加约束、拉箭头，先猜结果再看发生了什么。`,
                `${LESSONS.length} 3D lessons, one concept per step: drag a corner, add a constraint, pull an arrow, guess the result before you see it.`,
              )}
              links={[{ to: "/learn", label: t("看学习路径", "See the learning path") }]}
            />
            <Step
              n={2}
              icon={<Layers />}
              title={t("看真零件怎么做", "See how real parts are made")}
              text={t(
                "马克杯、齿轮、带铰链的盒子按特征树一步步重建，每个面都标着是哪一步做出来的。",
                "A mug, a gear, a hinged box, rebuilt feature by feature, with every face marked by the step that made it.",
              )}
              links={[{ to: "/teardown", label: t("看案例拆解", "Browse the teardowns") }]}
            />
            <Step
              n={3}
              icon={<PencilRuler />}
              title={t("自己做一个", "Make one yourself")}
              text={t(
                "在工作台里亲手一步步建，练课后的练习；要让自己的 Claude Code、Codex 建真东西，用桌面版。",
                "Build it yourself step by step in the Workbench, and do the lessons’ practices there; to have your own Claude Code or Codex build real things, use the desktop app.",
              )}
              links={[
                { to: "/studio", label: t("打开工作台", "Open the Workbench") },
                { to: "/desktop", label: t("桌面版", "Desktop app") },
              ]}
            />
          </ol>
          <p className="mt-6 text-small text-muted-foreground">
            {t("查资料：", "Look things up: ")}
            <Link to="/atlas" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("工具图鉴", "Command atlas")}
            </Link>
            {t(`（${OPS.length} 个命令在 8 个软件里的叫法）· `, ` (${OPS.length} commands, named as in 8 CAD packages) · `)}
            <Link to="/glossary" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t("术语表", "Glossary")}
            </Link>
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-12 max-sm:px-4">
        <div className="flex items-end gap-4 max-sm:flex-col max-sm:items-start">
          <div className="flex-1">
            <h2 className="text-title-lg font-semibold">{t("从这五节开始", "Start with these five")}</h2>
            <p className="mt-1 text-body text-muted-foreground">{t("一个小时左右，后面所有的课都建立在它们上面。", "About an hour. Everything after builds on them.")}</p>
          </div>
          <MoreLink to="/learn">{t(`全部 ${LESSONS.length} 节课和 ${CARDS.length} 张图文卡`, `All ${LESSONS.length} lessons and ${CARDS.length} cards`)}</MoreLink>
        </div>
        <StartRoute className="mt-8" />
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-12 max-sm:px-4">
        <div className="flex items-center">
          <h2 className="flex-1 text-title-lg font-semibold">{t("案例拆解", "Teardowns")}</h2>
          <Link to="/teardown" className="flex items-center gap-1 text-body text-muted-foreground hover:text-foreground">
            {t(`全部 ${models.length} 个案例`, `All ${models.length} teardowns`)}
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {featured(models).map((m) => (
            <MiniModelCard key={m.id} id={m.id} title={m.title} subtitle={m.subtitle} />
          ))}
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-[1200px] px-6 py-12 max-sm:px-4">
          <h2 className="text-title-lg font-semibold">{t("按你的背景挑起点", "Pick a starting point")}</h2>
          <StartingPoints className="mt-4" />
        </div>
      </section>

      <section className="border-t bg-sunken">
        <div className="mx-auto flex max-w-[1200px] items-center gap-8 px-6 py-12 max-md:flex-col max-md:items-start max-sm:px-4">
          <TurneryMark className="size-14 shrink-0" />
          <div className="flex-1">
            <h2 className="text-title-lg font-semibold">{t("学会了，就让你的 agent 来建", "Once you know how, let your agent build it")}</h2>
            <p className="mt-2 max-w-[44em] text-body text-muted-foreground">
              {t(
                "Turnery 桌面版让 Claude Code、Codex 等 coding agent 建参数化零件和装配：每一步你都看得到，参数能拖，尺寸和间隙每次重建都自动核对。和这里是同一个内核、同一种文件。",
                "The Turnery desktop app lets Claude Code, Codex and other coding agents build parametric parts and assemblies: you watch every step, drag the parameters, and every rebuild checks the dimensions and clearances. Same kernel and same files as here.",
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="primary">
              <Link to="/desktop">{t("了解桌面版", "About the desktop app")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-6 py-6 text-small text-faint-foreground max-sm:px-4">
          <span>Turnery · 2026</span>
          <span>{t("几何：build123d + OpenCascade · 渲染：three.js · 草图求解：FreeCAD planegcs", "Geometry: build123d + OpenCascade · Rendering: three.js · Sketch solver: FreeCAD planegcs")}</span>
        </div>
      </footer>
    </main>
  )
}

/** Four teardowns that differ: a turned part, a patterned one, a gear, an assembly (else the first four). */
const FEATURED = ["mug", "brick", "gear", "enclosure"]
const featured = (models: ModelIndexEntry[]) => {
  const picked = FEATURED.flatMap((id) => models.find((m) => m.id === id) ?? [])
  return picked.length === FEATURED.length ? picked : models.slice(0, 4)
}

function MiniModelCard({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  const src = useBakedThumbnail(id, { w: 280, h: 210 })
  return (
    <Link to={`/teardown/${id}`} className="flex flex-col overflow-hidden rounded-lg border transition-colors duration-(--duration-fast) hover:border-input">
      <div className="aspect-[4/3] bg-scene">{src && <img src={src} alt="" className="size-full object-contain" />}</div>
      <div className="border-t p-3">
        <div className="text-body font-medium">{title}</div>
        <div className="truncate text-small text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <div className="text-display font-semibold tabular">{value}</div>
        <div className="text-small text-muted-foreground">{label}</div>
      </dd>
    </div>
  )
}

/** One of the three steps on the home page: a big number, what it is, where to go. */
function Step({ n, icon, title, text, links }: { n: number; icon: React.ReactNode; title: string; text: string; links: { to: string; label: string }[] }) {
  return (
    <li className="relative flex flex-col rounded-lg border bg-background p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-primary text-body font-semibold text-primary-foreground tabular">{n}</span>
        <span className="text-primary [&_svg]:size-5">{icon}</span>
      </div>
      <div className="mt-4 text-heading font-semibold">{title}</div>
      <p className="mt-1 flex-1 text-body text-muted-foreground">{text}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="flex items-center gap-1 text-body font-medium hover:underline">
            {l.label}
            <ArrowRight className="size-4" />
          </Link>
        ))}
      </div>
    </li>
  )
}

/**
 * The mug builds itself once, feature by feature, against the ghost of the
 * finished part. It stops at the end (no decorative loop); Replay restarts.
 */
function HeroBuild() {
  const scene = React.useRef<PartScene | null>(null)
  const [step, setStep] = React.useState(-1)
  const [running, setRunning] = React.useState(false)
  const alive = React.useRef(true)

  const run = React.useCallback(async () => {
    const s = scene.current
    if (!s) return
    setRunning(true)
    for (let i = 0; i < mug.features.length; i++) {
      if (!alive.current || scene.current !== s) return
      setStep(i)
      await s.rollTo(i, { camera: false })
      await new Promise((r) => setTimeout(r, 650))
    }
    setRunning(false)
  }, [])

  const onReady = React.useCallback(
    (v: Viewer) => {
      alive.current = true
      const s = new PartScene(v, mug, defaults(mug.params))
      scene.current = s
      v.showGrid(false)
      v.fit(mug.bounds(defaults(mug.params)), { dir: new THREE.Vector3(1, -1.25, 0.7), padding: 1.15, animate: false })
      s.rollTo(0, { animate: false, camera: false })
      const id = setTimeout(run, 500)
      return () => {
        alive.current = false
        clearTimeout(id)
        s.dispose()
        scene.current = null
      }
    },
    [run],
  )

  const f = step >= 0 ? mug.features[step] : null
  return (
    <div className="relative">
      <Viewport className="aspect-[5/4] rounded-xl border" onReady={onReady} viewCube={false} triad={false}>
        <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1">
          {mug.features.map((x, i) => (
            <div
              key={x.id}
              className={
                i === step
                  ? "flex h-6 items-center gap-1.5 text-small font-medium text-foreground transition-colors duration-(--duration-base) [&_svg]:size-3.5 [&_svg]:text-primary"
                  : i < step
                    ? "flex h-6 items-center gap-1.5 text-small text-muted-foreground transition-colors duration-(--duration-base) [&_svg]:size-3.5"
                    : "flex h-6 items-center gap-1.5 text-small text-faint-foreground/60 transition-colors duration-(--duration-base) [&_svg]:size-3.5"
              }
            >
              <OpIcon op={x.op} />
              {featureName(x.name)}
              {i === step && <span className="font-normal text-muted-foreground max-sm:hidden">· {x.title}</span>}
            </div>
          ))}
        </div>
        {!running && step >= 0 && (
          <Button variant="secondary" size="sm" className="absolute bottom-4 right-4" onClick={run}>
            <RotateCcw />
            {t("重播", "Replay")}
          </Button>
        )}
      </Viewport>
      {f && <span className="sr-only">{t("当前步骤：", "Current step: ")}{featureName(f.name)}</span>}
    </div>
  )
}
