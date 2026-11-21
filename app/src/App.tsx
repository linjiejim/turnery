import type * as React from "react"
import { createBrowserRouter, Outlet, redirect, RouterProvider, ScrollRestoration } from "react-router"
import { SiteHeader } from "@/components/site-header"
import { HomePage } from "@/routes/home"
import { syncDocumentTitle } from "@/lib/document-title"
import { routerBase } from "@/lib/i18n"

/** Pages other than home load on demand: each brings only its own code. */
const lazy =
  <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  async () => ({ Component: (await load())[name] })

function SiteLayout() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <Outlet />
      <ScrollRestoration />
    </div>
  )
}

const routes = [
  {
    element: <SiteLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/learn", lazy: lazy(() => import("@/routes/learn"), "LearnPage") },
      { path: "/teardown", lazy: lazy(() => import("@/routes/teardown"), "TeardownIndex") },
      { path: "/atlas", lazy: lazy(() => import("@/routes/atlas"), "AtlasPage") },
      { path: "/glossary", lazy: lazy(() => import("@/routes/glossary"), "GlossaryPage") },
      { path: "/card/:code", lazy: lazy(() => import("@/routes/card"), "CardPage") },
      { path: "/community", lazy: lazy(() => import("@/routes/community"), "CommunityPage") },
      { path: "/community/:handle", lazy: lazy(() => import("@/routes/community-profile"), "CommunityProfilePage") },
      { path: "/community/:handle/c/:slug", lazy: lazy(() => import("@/routes/community-collection"), "CommunityCollectionPage") },
      { path: "/desktop", lazy: lazy(() => import("@/routes/desktop"), "DesktopPage") },
      // 「练习」was taken down on 2026-11-06; old links land on the learning path.
      { path: "/practice", loader: () => redirect("/learn") },
      { path: "*", lazy: lazy(() => import("@/routes/not-found"), "NotFoundPage") },
    ],
  },
  // Immersive pages: their own header, the viewport takes the screen.
  { path: "/lesson/:id", lazy: lazy(() => import("@/routes/lesson"), "LessonPage") },
  { path: "/teardown/:id", lazy: lazy(() => import("@/routes/teardown"), "TeardownPage") },
  {
    path: "/studio",
    lazy: lazy(() => {
      // The kernel downloads while the page's code does.
      void import("@/studio/boot").then((b) => b.startKernel())
      return import("@/routes/studio")
    }, "StudioPage"),
  },
  {
    // A shared link: the same studio, read-only.
    path: "/studio/s/:id",
    lazy: lazy(() => {
      void import("@/studio/boot").then((b) => b.startKernel())
      return import("@/routes/studio-share")
    }, "StudioSharePage"),
  },
  {
    // Community project interactive 3D viewer (latest release)
    path: "/community/:handle/:slug",
    lazy: lazy(() => {
      void import("@/studio/boot").then((b) => b.startKernel())
      return import("@/routes/community-project")
    }, "CommunityProjectPage"),
  },
  {
    // Community project interactive 3D viewer (pinned version)
    path: "/community/:handle/:slug/v/:version",
    lazy: lazy(() => {
      void import("@/studio/boot").then((b) => b.startKernel())
      return import("@/routes/community-project")
    }, "CommunityProjectPage"),
  },
] satisfies Parameters<typeof createBrowserRouter>[0]

/**
 * Made on the first render, not when this module loads: a page that is about to move to its /en twin
 * (main.tsx, lib/i18n.ts) never starts a route (the workbench's starts the kernel download).
 */
let router: ReturnType<typeof createBrowserRouter> | null = null
function appRouter() {
  if (router) return router
  // English pages are the same routes under /en (lib/i18n.ts).
  router = createBrowserRouter(routes, { basename: routerBase })
  // Per-route <title>, matching the prerendered HTML (lib/page-meta.ts).
  syncDocumentTitle(router.state.location.pathname)
  router.subscribe((s) => syncDocumentTitle(s.location.pathname))
  return router
}

export function App() {
  return <RouterProvider router={appRouter()} />
}
