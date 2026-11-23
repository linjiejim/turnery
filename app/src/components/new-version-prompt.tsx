import { lazy, Suspense } from "react"

// Loaded after the page: only a tab left open across a deploy needs it.
const Check = lazy(() => import("@/components/new-version-check"))

/**
 * The website ships on every push to main (deploy.yml). A tab left open on an older build says
 * 「新版本已发布，刷新后生效 · 刷新页面」 and waits: it never reloads by itself, since the workbench may
 * be in the middle of something.
 */
export function NewVersionPrompt() {
  return (
    <Suspense>
      <Check />
    </Suspense>
  )
}
