import * as React from "react"
import { Link, useLocation, useSearchParams } from "react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/ui/data-table"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OpIcon } from "@/components/op-icon"
import { OPS, type Op, type OpId } from "@/content/ops"
import { TERMS, termAside, type Term } from "@/content/terms"
import { LESSONS } from "@/content/lessons"
import { useModelIndex } from "@/lib/use-async"
import { OpDrawer } from "@/routes/atlas"
import { isEn, t } from "@/lib/i18n"

const columns: ColumnDef<Op, unknown>[] = [
  {
    id: "name",
    header: t("命令", "Command"),
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <OpIcon op={row.original.id} className="size-4 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
        {!isEn && <span className="text-small text-faint-foreground">{row.original.en}</span>}
      </span>
    ),
    meta: { width: "15rem", mobile: "title" },
  },
  { id: "sw", header: "SOLIDWORKS", accessorFn: (o) => o.names.solidworks ?? "—", meta: { mobile: "meta" } },
  { id: "fusion", header: "Fusion", accessorFn: (o) => o.names.fusion ?? "—", meta: { mobile: "meta", hideBelow: "md" } },
  { id: "onshape", header: "Onshape", accessorFn: (o) => o.names.onshape ?? "—", meta: { hideBelow: "lg", mobile: "hidden" } },
  {
    id: "b3d",
    header: "build123d",
    accessorFn: (o) => o.names.build123d ?? "—",
    cell: ({ getValue }) => <span className="font-mono text-small">{getValue() as string}</span>,
    meta: { hideBelow: "lg", mobile: "hidden" },
  },
]

const GROUPS: Term["group"][] = ["草图与参数化", "特征树", "装配", "读图与公差", "制造", "曲面"]

/** The concept groups' headings on English pages (the groups themselves are named in the content). */
const GROUP_EN: Record<Term["group"], string> = {
  草图与参数化: "Sketches and parameters",
  特征树: "The feature tree",
  装配: "Assemblies",
  读图与公差: "Reading drawings and tolerances",
  制造: "Manufacturing",
  曲面: "Surfaces",
}

export function GlossaryPage() {
  const [params, setParams] = useSearchParams()
  const open = params.get("op") as OpId | null
  const tab = params.get("tab") === "concepts" ? "concepts" : "commands"
  const op = open ? OPS.find((o) => o.id === open) : undefined
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title={t("术语表", "Glossary")}
        info={t(
          "命令：同一个操作在 8 个软件里怎么叫，点一行看要点。概念：命令背后的道理，以及在哪节课、哪个拆解里学到。",
          "Commands: what one operation is called in 8 CAD packages; click a row for the key points. Concepts: the reasoning behind the commands, and the lesson or teardown where you meet it.",
        )}
      />
      <Tabs value={tab} onValueChange={(v) => update({ tab: v === "concepts" ? "concepts" : null })}>
        <TabsList>
          <TabsTrigger value="commands">{t(`命令（${OPS.length}）`, `Commands (${OPS.length})`)}</TabsTrigger>
          <TabsTrigger value="concepts">{t(`概念（${TERMS.length}）`, `Concepts (${TERMS.length})`)}</TabsTrigger>
        </TabsList>
        <TabsContent value="commands" className="pt-4">
          <div className="h-[min(720px,calc(100dvh-220px))]">
            <DataTable aria-label={t("命令", "Commands")} columns={columns} data={OPS} getRowId={(o) => o.id} onRowClick={(o) => update({ op: o.id })} activeRowId={open ?? undefined} />
          </div>
        </TabsContent>
        <TabsContent value="concepts" className="pt-2">
          <Concepts />
        </TabsContent>
      </Tabs>
      <OpDrawer op={op} onClose={() => update({ op: null })} />
    </Page>
  )
}

function Concepts() {
  const models = useModelIndex()
  // Concept links (from 图文卡) land on their card: /glossary?tab=concepts#tnp
  const { hash } = useLocation()
  React.useEffect(() => {
    if (!hash) return
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "center" })
  }, [hash])
  return (
    <>
      {GROUPS.map((g) => (
        <Section key={g} title={t(g, GROUP_EN[g])}>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {TERMS.filter((term) => term.group === g).map((term) => {
              const lessons = (term.lessons ?? []).map((id) => LESSONS.find((l) => l.id === id)).filter((l) => !!l)
              const ms = models.filter((m) => term.models?.includes(m.id))
              return (
                <div key={term.id} id={term.id} className="rounded-lg border p-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-heading font-semibold">{term.name}</span>
                    {termAside(term) && <span className="text-small text-faint-foreground">{termAside(term)}</span>}
                  </div>
                  <p className="mt-1.5 text-body">{term.def}</p>
                  <p className="mt-1.5 text-small text-muted-foreground">{term.why}</p>
                  {(lessons.length > 0 || ms.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {lessons.map((l) => (
                        <Link key={l.id} to={`/lesson/${l.id}`} className="rounded-sm border px-2 py-0.5 text-small hover:bg-accent">
                          {t("课", "Lesson")} · {l.title}
                        </Link>
                      ))}
                      {ms.map((m) => (
                        <Link key={m.id} to={`/teardown/${m.id}`} className="rounded-sm border px-2 py-0.5 text-small hover:bg-accent">
                          {t("拆解", "Teardown")} · {m.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </>
  )
}
