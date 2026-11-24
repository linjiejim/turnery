import * as React from "react"
import * as THREE from "three"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Viewport } from "@/components/viewport"
import { OpIcon } from "@/components/op-icon"
import { useBakedThumbnail } from "@/components/thumbnail"
import { mug } from "@/content/procedural/mug"
import { defaults } from "@/content/procedural/types"
import { featureNameEn } from "@/content/ops"
import { PartScene } from "@/three/teardown-scene"
import type { Viewer } from "@/three/viewer"
import { isEn, t } from "@/lib/i18n"

/**
 * The home page's 3D: the mug that builds itself and the teardowns' thumbnails. A chunk of its own
 * with three.js (routes/home.tsx loads it lazily), so the home page's text, and every other page,
 * shows without waiting for three.js.
 */

/** The mug's features are named like 「圆角2」; on English pages that reads "Fillet2", as CAD packages write it. */
const featureName = (name: string) => (isEn ? featureNameEn(name) : name)

/** A teardown's thumbnail, rendered once from its baked model. */
export function ModelThumb({ id }: { id: string }) {
  const src = useBakedThumbnail(id, { w: 280, h: 210 })
  return src ? <img src={src} alt="" className="size-full object-contain" /> : null
}

/**
 * The mug builds itself once, feature by feature, against the ghost of the
 * finished part. It stops at the end (no decorative loop); Replay restarts.
 */
export function HeroBuild() {
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
