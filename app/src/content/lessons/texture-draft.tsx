import { ArrowDown, ArrowUp, Columns2, Eye, MoveUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { TextureDraftScene, needed, sineRelease, verdict, type Status, type TexState } from "./texture-draft.scene"
import type { LessonDef } from "./types"

/** 6.3.3 「咬花与拔模」. */

function DepthSlider({ s, c, max = 150 }: { s: TexState; c: TextureDraftScene; max?: number }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("纹理深度", "Texture depth")}
      unit="µm"
      value={s.depth}
      min={10}
      max={max}
      step={5}
      onChange={(v) => c.setDepth(v)}
      hint={t(`${(s.depth / 25.4).toFixed(1)} 千分之一英寸（纹理厂常用的单位）`, `${(s.depth / 25.4).toFixed(1)} thou (the unit texture houses often use)`)}
    />
  )
}

function DraftSlider({ s, c, max = 10 }: { s: TexState; c: TextureDraftScene; max?: number }) {
  return (
    <ParamSlider className="mt-1 px-0" label={t("拔模角", "Draft angle")} unit="°" value={s.draft} min={0} max={max} step={0.25} onChange={(v) => c.setDraft(v)} />
  )
}

const TONE: Record<Status, "success" | "warning" | undefined> = { good: "success", warn: "warning", bad: "warning" }
const WORD: Record<Status, string> = { good: t("够", "Enough"), warn: t("勉强", "Marginal"), bad: t("不够", "Too little") }

function Need({ s }: { s: TexState }) {
  const n = needed(s.textured ? s.depth : 0, s.inside)
  const v = verdict(s)
  const st = s.inside ? v.inner : v.outer
  return (
    <div className="mt-2">
      <Readout label={t("要", "Needs")} value={`${n.lo.toFixed(1)}–${n.hi.toFixed(1)}`} unit="°" />
      <Readout label={t("现在", "Now")} value={`${s.draft}° · ${WORD[st]}`} tone={TONE[st]} />
    </div>
  )
}

function Legend() {
  const rows = [
    { cls: "bg-success", text: t("够：达到经验值的上限", "Enough: at the top of the guideline") },
    { cls: "bg-warning", text: t("勉强：在经验值范围里，看纹理厂怎么说", "Marginal: inside the guideline; ask the texture house") },
    { cls: "bg-destructive", text: t("不够：开模会刮花", "Too little: it will scuff on opening") },
  ]
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      {rows.map((r) => (
        <div key={r.cls} className="contents">
          <span className={cn("size-3 rounded-xs", r.cls)} />
          <span>{r.text}</span>
        </div>
      ))}
    </div>
  )
}

const lesson: LessonDef<TexState, TextureDraftScene> = {
  id: "texture-draft",
  codes: ["6.3.3"],
  title: t("咬花与拔模", "Texture and draft"),
  create: (v, emit) => new TextureDraftScene(v, emit),
  steps: [
    {
      title: t("咬花：刻在钢里的纹理", "Texture: etched into the steel"),
      body: byLocale(
        <>
          <p>外观面上的皮纹、砂纹，是先做在模具钢面上，再一模一模复制到塑料上的。常见的做法有三种：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>化学蚀纹：钢面上贴好图案保护，再用酸腐蚀出凹凸。Mold-Tech 是最大的纹理厂之一，纹号写成 MT-11010 这样。</li>
            <li>电火花纹：按德国工程师协会的 VDI 3400 分级，数字越大越粗，VDI 12 约 Ra 0.4 µm，VDI 30 约 Ra 3.2 µm，VDI 45 约 Ra 18 µm。</li>
            <li>激光纹理：用激光一层层烧出图案，能做很规整的几何纹。</li>
          </ul>
        </>,
        <>
          <p>The leather and sand grains on a show face are made on the mold steel first and then copied onto every molded part. There are three common ways:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Chemical etching: the pattern is masked onto the steel and acid eats away the rest. Mold-Tech is one of the largest texture houses; its textures have numbers like MT-11010.</li>
            <li>EDM texture: graded by VDI 3400, a guideline of the Association of German Engineers, coarser as the number rises: VDI 12 is about Ra 0.4 µm, VDI 30 about Ra 3.2 µm, VDI 45 about Ra 18 µm.</li>
            <li>Laser texturing: a laser burns the pattern in layer by layer, which suits very regular geometric patterns.</li>
          </ul>
        </>,
      ),
      task: { label: t("把外壁换成咬花", "Switch the outer walls to a texture"), done: (s) => s.toggled },
      extra: ({ s, c }) => (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-small font-medium">{t("外壁", "Outer walls")}</span>
          <Segmented
            size="sm"
            aria-label={t("外壁", "Outer walls")}
            value={s.textured ? "tex" : "smooth"}
            onValueChange={(v) => c.setTextured(v === "tex")}
            options={[
              { value: "smooth", label: t("光面", "Smooth") },
              { value: "tex", label: t("咬花", "Textured") },
            ]}
          />
        </div>
      ),
    },
    {
      title: t("放大看：每个凸起都是一个小倒扣", "Up close: every bump is a tiny undercut"),
      body: byLocale(
        <>
          <p>这是一小段侧壁的截面，横向放大了 10 倍。左边是塑料，右边是型腔钢，钢面上是纹理的反形，两边咬在一起。</p>
          <p>开模时钢沿开模方向走。有拔模，钢在往上走的同时也在离开壁面；可凸起的侧坡如果比拔模角陡，钢就得从它上面犁过去。纹理越深，侧坡越陡。</p>
        </>,
        <>
          <p>This is a section through a short piece of side wall, magnified 10× across. Plastic on the left, cavity steel on the right, carrying the texture's negative; the two interlock.</p>
          <p>
            When the mold opens, the steel moves along the pull direction. With draft, it also moves away from the wall as it rises; but if a bump's flank is steeper than the draft,
            the steel has to plough over it. The deeper the texture, the steeper the flanks.
          </p>
        </>,
      ),
      task: { label: t("调拔模角，让钢一开模就干净离开", "Set the draft so the steel releases cleanly when it opens"), done: (s) => s.cleanPull },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="double"
            question={t("纹理深度从 50 µm 加到 100 µm，要的拔模角会怎样？", "The texture goes from 50 µm to 100 µm deep. What happens to the draft it needs?")}
            options={byLocale(["差不多不变", "大约翻一倍", "反而变小"], ["About the same", "Roughly doubles", "Gets smaller"])}
            answer={1}
            explain={t(
              "图案一样，深度翻倍，侧坡的斜率也翻倍。小角度下拔模角和斜率成正比，所以要的拔模大约也翻倍。",
              "Same pattern, twice as deep: the flanks are twice as steep. At small angles draft is proportional to that slope, so the draft needed roughly doubles too.",
            )}
            onReveal={() => c.setDepth(100)}
          />
          <DepthSlider s={s} c={c} />
          <DraftSlider s={s} c={c} />
          <div className="mt-2">
            <Readout label={t("这个纹理要", "This texture needs")} value={`≥ ${sineRelease(s.depth).toFixed(1)}`} unit="°" />
          </div>
          <Button size="sm" variant="primary" className="mt-3" onClick={() => c.pullSteel()}>
            <MoveUpRight />
            {t("开模", "Open")}
          </Button>
          {s.pull >= 1 && s.rubbed && <Hint tone="warning">{t("钢犁过了凸起：加大拔模角再开一次。", "The steel ploughed over the bumps: add draft and open again.")}</Hint>}
        </>
      ),
    },
    {
      title: t("按深度给拔模", "Draft by depth"),
      body: byLocale(
        <>
          <p>
            Mold-Tech 的技术资料给的经验：纹理每深 0.0005–0.0006″（12.5–15 µm），侧壁加 1° 拔模。以前流传的「每 0.001″ 1.5°」，它自己说已经不适用。Protolabs 的要求更直接：轻喷砂纹（PM-T1）至少 3°，中等（PM-T2）至少 5°。
          </p>
          <p>这些只是起点。同样的深度，图案和材料不同，要的拔模也不同：每个纹号最后以纹理厂和模厂给的数为准。</p>
        </>,
        <>
          <p>
            Mold-Tech's technical data sheet gives this rule of thumb: 1° of side-wall draft for every 0.0005–0.0006″ (12.5–15 µm) of texture depth. The old “1.5° per 0.001″” it
            now calls no longer valid. Protolabs puts it more simply: at least 3° for a light bead-blast texture (PM-T1) and 5° for a medium one (PM-T2).
          </p>
          <p>These are starting points. At the same depth, different patterns and materials need different drafts: for each texture, go by the numbers the texture house and the molder give you.</p>
        </>,
      ),
      task: {
        label: t("把纹理加深到 75 µm 以上，再把拔模加到四面都变绿", "Deepen the texture to 75 µm or more, then add draft until all four walls are green"),
        done: (s) => s.depth >= 75 && verdict(s).worst === "good",
      },
      extra: ({ s, c }) => (
        <>
          <DepthSlider s={s} c={c} />
          <DraftSlider s={s} c={c} />
          <Need s={s} />
          <Legend />
        </>
      ),
      terms: ["draft"],
    },
    {
      title: t("拔模不够：开模时拖花", "Too little draft: drag marks on opening"),
      body: byLocale(
        <>
          <p>现在纹理深 75 µm，拔模只有 2°。开一次模看看。</p>
          <p>钢面一路刮过去，凸起的顶被磨平、磨亮，留下一道道顺着开模方向的亮痕，叫拖花。纹理越深越容易出，件也可能卡在模里。</p>
        </>,
        <>
          <p>The texture is now 75 µm deep with only 2° of draft. Open the mold and see.</p>
          <p>
            The steel scrapes all the way along, flattening and polishing the tops of the bumps into shiny streaks that run with the pull direction: drag marks. The deeper the
            texture, the more likely they are, and the part may stick in the mold as well.
          </p>
        </>,
      ),
      task: {
        label: t("先开一次看拖花，再把拔模加够，重新开模", "Open once to see the drag marks, then add enough draft and open again"),
        done: (s) => s.ejectedBad && s.ejectedClean,
      },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="primary" className="mt-3" onClick={() => c.eject()}>
            <Columns2 />
            {s.lift > 0 ? t("再开一模", "Mold another") : t("开模", "Open the mold")}
          </Button>
          <DraftSlider s={s} c={c} />
          <Need s={s} />
          {s.ejectedBad && !s.ejectedClean && s.lift >= 1 && verdict(s).worst === "good" && (
            <Hint>{t("拔模够了，再开一模看看。", "The draft is enough now. Mold another one.")}</Hint>
          )}
        </>
      ),
    },
    {
      title: t("型芯一侧更难", "The core side is harder"),
      body: byLocale(
        <>
          <p>塑料冷却会收缩。外壁从型腔上缩开，帮着脱模；内壁却抱紧型芯。Mold-Tech 说，抱紧钢面的地方要 2–3 倍的拔模。</p>
          <p>所以纹理尽量放在型腔一侧的外观面。内侧非要纹理，就给足拔模，或者换浅纹理、只在局部减浅。</p>
        </>,
        <>
          <p>Plastic shrinks as it cools. The outer walls shrink away from the cavity, which helps release; the inner walls grip the core. Mold-Tech says faces that shrink onto steel need 2–3 times the draft.</p>
          <p>So keep texture on the show faces on the cavity side. If the inside really needs texture, give it plenty of draft, or use a shallower texture, or make it shallower locally.</p>
        </>,
      ),
      task: {
        label: t("把纹理换到内壁，再用深度和拔模让内壁变绿", "Move the texture to the inner walls, then use depth and draft to turn them green"),
        done: (s) => s.inside && verdict(s).inner === "good",
      },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("纹理在", "Texture on")}</span>
            <Segmented
              size="sm"
              aria-label={t("纹理在", "Texture on")}
              value={s.inside ? "in" : "out"}
              onValueChange={(v) => c.setInside(v === "in")}
              options={[
                { value: "out", label: t("外壁 · 型腔", "Outside · cavity") },
                { value: "in", label: t("内壁 · 型芯", "Inside · core") },
              ]}
            />
          </div>
          <DepthSlider s={s} c={c} max={100} />
          <DraftSlider s={s} c={c} max={12} />
          <Need s={s} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => c.lookInside()}>
              <ArrowUp />
              {t("从下面看", "View from below")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => c.lookOutside()}>
              <ArrowDown />
              {t("从上面看", "View from above")}
            </Button>
          </div>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("外观面原来是光面，拔模 1°。设计改成深约 50 µm 的皮纹，拔模要怎样？", "A show face was smooth with 1° of draft. The design now calls for a leather grain about 50 µm deep. What about the draft?"),
      options: byLocale(
        ["不用变，纹理会帮着脱模", "大约要 3–4°，以纹理厂给的为准", "纹理和拔模没关系，看材料就行"],
        ["Leave it; the texture helps the part release", "It needs roughly 3–4°; go by what the texture house says", "Texture has nothing to do with draft; only the material matters"],
      ),
      answer: 1,
      explain: t(
        "纹理的每个凸起都是一个微小的倒扣。按 Mold-Tech 每 12.5–15 µm 加 1° 的经验，50 µm 要 3.3–4°；具体纹号以纹理厂的表为准。",
        "Every bump of a texture is a tiny undercut. With Mold-Tech's 1° per 12.5–15 µm, 50 µm needs 3.3–4°; for a specific texture, go by the texture house's chart.",
      ),
    },
    {
      q: t("开模后外壁上出现一道道顺着开模方向的亮痕，最可能是？", "After opening, the outer walls show shiny streaks running with the pull direction. What's the most likely cause?"),
      options: byLocale(
        ["材料没烘干", "拔模不够，钢面刮过纹理留下的拖花", "浇口太小"],
        ["The material wasn't dried", "Too little draft: the steel scraped over the texture and left drag marks", "The gate is too small"],
      ),
      answer: 1,
      explain: t(
        "顺着开模方向、出现在纹理面上，是拖花的特征：凸起被钢刮平磨亮。材料受潮造成的是顺着料流方向的银纹，和开模方向无关。",
        "Streaks along the pull direction on a textured face are the signature of drag marks: the steel rubbed the bumps flat and shiny. Wet material causes silver streaks along the flow direction, unrelated to the pull direction.",
      ),
    },
    {
      q: t("同样深的纹理，放在哪种面上要的拔模最大？", "The same texture depth. On which kind of face does it need the most draft?"),
      options: byLocale(
        ["型腔一侧、塑料缩离钢面的外壁", "型芯一侧、塑料抱紧钢面的内壁", "两边一样"],
        ["Cavity side, an outer wall the plastic shrinks away from", "Core side, an inner wall the plastic shrinks onto", "Both the same"],
      ),
      answer: 1,
      explain: t(
        "冷却收缩让内壁抱紧型芯，纹理被压得更紧。Mold-Tech 建议这种面给 2–3 倍的拔模。",
        "Shrinkage makes the inner walls grip the core, pressing the texture in harder. Mold-Tech recommends 2–3 times the draft on such faces.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "纹理是钢面上的微小凹凸，开模时它们是一圈小倒扣：纹理越深，要的拔模越大",
      "起点：Mold-Tech 每 12.5–15 µm 深加 1°，Protolabs 轻纹理至少 3°、中等至少 5°；具体纹号以纹理厂和模厂为准",
      "型芯一侧（塑料抱紧钢面）要 2–3 倍拔模；纹理尽量放在外观面，拔模不够会拖花",
    ],
    [
      "A texture is tiny bumps and pits in the steel, and on opening they act as a field of small undercuts: the deeper the texture, the more draft",
      "Starting points: Mold-Tech's 1° per 12.5–15 µm of depth; Protolabs' 3° minimum for light and 5° for medium textures. For a specific texture, go by the texture house and the molder",
      "The core side, where the plastic shrinks onto the steel, needs 2–3 times the draft; keep texture on show faces, and too little draft leaves drag marks",
    ],
  ),
  next: {
    to: "/lesson/draft-analysis",
    label: t("注塑：拔模与分型线", "Injection molding: draft and parting lines"),
    text: t("把整个零件拿来做拔模分析，再看分型线和倒扣。", "Run a draft analysis on a whole part, then look at the parting line and undercuts."),
  },
  overlay: ({ s }) => {
    const v = verdict(s)
    const st = s.inside ? v.inner : v.outer
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <SceneChip>
          <Eye />
          {s.step === 1
            ? t("放大的截面", "Magnified section")
            : s.textured
              ? t(`咬花 ${s.depth} µm · ${s.inside ? "内壁" : "外壁"}`, `Texture ${s.depth} µm · ${s.inside ? "inside" : "outside"}`)
              : t("光面", "Smooth")}
        </SceneChip>
        <SceneChip tone="primary">
          {t("拔模", "Draft")} {s.draft}°{s.step !== 1 && s.textured ? ` · ${WORD[st]}` : ""}
        </SceneChip>
      </div>
    )
  },
}

export default lesson
