import * as React from "react"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** What the bar needs from the router (react-router's data router). */
type Navigating = { subscribe: (fn: () => void) => () => void; state: { navigation: { state: string } } }

/** A switch faster than this never shows the bar, so a quick one doesn't flash. */
const DELAY = 150
/** How long the finished bar takes to run to the end and fade. */
const FINISH = 300

/**
 * A thin bar along the top while the next page's code downloads. Pages load on demand, and until
 * their code arrives the router keeps the old page on screen: on a slow connection a click would
 * otherwise look dead for seconds. The bar creeps towards the end (it can't know how far along the
 * download is), then runs out and fades once the page is there.
 */
export function NavigationProgress({ router }: { router: Navigating }) {
  const busy = React.useSyncExternalStore(
    router.subscribe,
    () => router.state.navigation.state !== "idle",
    () => false,
  )
  const [shown, setShown] = React.useState(false)
  const [ending, setEnding] = React.useState(false)
  React.useEffect(() => {
    if (busy) {
      const show = window.setTimeout(() => {
        setEnding(false)
        setShown(true)
      }, DELAY)
      return () => window.clearTimeout(show)
    }
    const end = window.setTimeout(() => setEnding(true), 0)
    const hide = window.setTimeout(() => {
      setShown(false)
      setEnding(false)
    }, FINISH)
    return () => {
      window.clearTimeout(end)
      window.clearTimeout(hide)
    }
  }, [busy])
  if (!shown) return null
  return (
    <div role="progressbar" aria-label={t("正在打开页面", "Opening the page")} className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5">
      <div
        className={cn(
          "h-full bg-primary",
          ending ? "w-full opacity-0 transition-[width,opacity] duration-300 ease-out" : "w-[85%] transition-[width] duration-[8s] ease-out starting:w-0",
        )}
      />
    </div>
  )
}
