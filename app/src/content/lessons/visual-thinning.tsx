import { Eye, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { BODY, ThinScene, type PresetId, type ThinState, type TopKind, type ViewId } from "./visual-thinning.scene"
import type { LessonDef } from "./types"

/** 6.1.1 「视觉减薄」. */

const VIEW_LABEL: Record<ViewId, string> = {
  desk: t("坐在桌前", "Seated at a desk"),
  counter: t("站在台面前", "Standing at a counter"),
  level: t("平视", "Eye level"),
}

const PRESET_LABEL: Record<PresetId, string> = {
  plain: t("原样", "As is"),
  tuck: t("下壳内收", "Tuck the base"),
  curve: t("下壳弧形", "Curve the base under"),
  chamfer: t("下边倒角", "Chamfer the bottom"),
  dark: t("下壳深色", "Darker base"),
  split: t("分型线下移", "Lower parting line"),
  round: t("顶边大圆角", "Large top round"),
}

const mm = (v: number) => v.toFixed(1)
const thinner = (s: ThinState) => Math.round((1 - s.sil / s.base) * 100)

function Measures({ s, lit, volume }: { s: ThinState; lit?: boolean; volume?: boolean }) {
  const pct = thinner(s)
  return (
    <div className="mt-3 flex flex-wrap gap-y-1">
      <Readout label={t("看起来", "Looks")} value={mm(s.sil)} unit="mm" tone="primary" />
      <Readout label={t("比原样", "vs as is")} value={pct > 0 ? `−${pct}%` : pct < 0 ? `+${-pct}%` : "0%"} tone={pct >= 25 ? "success" : undefined} />
      {lit && <Readout label={t("亮面", "Bright band")} value={mm(s.lit)} unit="mm" />}
      {volume && <Readout label={t("内部空间", "Inside volume")} value={Math.round(s.volume)} unit="%" tone={s.volume >= 90 ? "success" : "warning"} />}
    </div>
  )
}

function ViewSwitch({ s, c }: { s: ThinState; c: ThinScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("视点", "Eye point")}</span>
      <Segmented
        size="sm"
        aria-label={t("视点", "Eye point")}
        value={s.view}
        onValueChange={(v: ViewId) => c.setView(v)}
        options={(["desk", "counter", "level"] as ViewId[]).map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
      />
    </div>
  )
}

function PresetGrid({ s, c }: { s: ThinState; c: ThinScene }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-1.5">
      {(Object.keys(PRESET_LABEL) as PresetId[]).map((p) => (
        <Button key={p} size="sm" variant={s.preset === p ? "primary" : "secondary"} className={cn("justify-start", p === "plain" && "col-span-2")} onClick={() => c.setPreset(p)}>
          {PRESET_LABEL[p]}
        </Button>
      ))}
    </div>
  )
}

function TopSwitch({ s, c }: { s: ThinState; c: ThinScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("顶边", "Top edge")}</span>
      <Segmented
        size="sm"
        aria-label={t("顶边", "Top edge")}
        value={s.topKind}
        onValueChange={(k: TopKind) => c.setShape({ topKind: k })}
        options={[
          { value: "round", label: t("圆角", "Round") },
          { value: "chamfer", label: t("45° 倒角", "45° chamfer") },
        ]}
      />
    </div>
  )
}

function SideButton({ s, c }: { s: ThinState; c: ThinScene }) {
  return (
    <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.setSide(!s.side)}>
      {s.side ? <Eye /> : <ScanLine />}
      {s.side ? t("回到用户视角", "Back to the user's eye") : t("看侧面", "View from the side")}
    </Button>
  )
}

const lesson: LessonDef<ThinState, ThinScene> = {
  id: "visual-thinning",
  codes: ["6.1.1"],
  title: t("视觉减薄", "Visual thinning"),
  create: (v, emit) => new ThinScene(v, emit),
  steps: [
    {
      title: t("从用户的眼睛看", "From the user's eye"),
      body: byLocale(
        <>
          <p>一台路由器放在桌上，实际高 36 mm。人坐在桌前，眼睛比桌面高约 450 mm，离它约 600 mm（按常见的坐高和桌高估算）。</p>
          <p>从这里往下看，顶面占了画面的大半，侧面被压扁了。「看起来的厚度」就量这一段：从顶面的边到轮廓的最下沿，在画面里有多高，换算成产品前缘那个距离上的毫米数。</p>
          <p>产品渲染图常用平视，正好把侧面放到最大。判断厚薄，要回到用户真实的视点。</p>
        </>,
        <>
          <p>A router sits on a desk. It's really 36 mm tall. Someone seated at the desk has their eyes about 450 mm above the desktop and about 600 mm away from it (estimated from typical seated eye heights and desk heights).</p>
          <p>
            Looking down from there, the top fills most of the picture and the side is squashed. “How thick it looks” measures that side: from the edge of the top down to the lowest point of the outline, as a height in the
            picture, converted to millimetres at the distance of the product's front edge.
          </p>
          <p>Product renders are often shot at eye level, which shows the side at its largest. To judge thickness, go back to where the user's eye really is.</p>
        </>,
      ),
      task: { label: t("三个视点都看一遍", "Look from all three eye points"), done: (s) => s.seenViews.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <ViewSwitch s={s} c={c} />
          <div className="mt-3 flex flex-wrap gap-y-1">
            <Readout label={t("侧面看起来", "Side looks")} value={mm(s.sil)} unit="mm" tone="primary" />
            <Readout label={t("顶面看起来", "Top looks")} value={mm(s.topSeen)} unit="mm" />
            <Readout label={t("俯角", "Looking down")} value={Math.round(s.look)} unit="°" />
          </div>
        </>
      ),
    },
    {
      title: t("先猜：哪种改法最薄", "Guess first: which change is thinnest"),
      body: byLocale(
        <p>实际高度都不变，还是 36 mm，只改侧面的样子。先猜，再在视图里把每种改法都换上去，比较读数。</p>,
        <p>The real height stays at 36 mm in every case; only the side changes. Guess first, then put each change on in the view and compare the readings.</p>,
      ),
      task: { label: t("至少比较 4 种改法", "Compare at least 4 changes"), done: (s) => s.seenPresets.length >= 4 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("从坐姿视点看，哪一种让轮廓最薄？", "From the seated eye point, which makes the outline thinnest?")}
            options={byLocale(
              ["下壳向里收 12 mm", "下壳改成深色", "分型线降到离桌面 6 mm", "顶边改成 R12 大圆角"],
              ["Tuck the lower shell in by 12 mm", "Make the lower shell dark", "Lower the parting line to 6 mm above the table", "Give the top edge a large R12 round"],
            )}
            answer={0}
            explain={t(
              "收进去的下壳朝下、背着光，从上往下看又被压扁，轮廓少了约 7 mm。深色和分型线根本不改轮廓；R12 圆角只有上半段读作顶面，轮廓只薄了不到 1 mm。",
              "The tucked lower shell faces down, away from the light, and is squashed when seen from above: the outline loses about 7 mm. Colour and the parting line don't change the outline at all; on an R12 round only the upper half reads as top, so the outline gets less than 1 mm thinner.",
            )}
            onReveal={() => c.setPreset("tuck")}
          />
          <PresetGrid s={s} c={c} />
          <Measures s={s} lit />
          <p className="mt-1 text-caption text-muted-foreground">
            {t("亮面：侧面上朝着你、又被顶光照到的浅色部分。", "Bright band: the part of the side that faces you, catches the overhead light and is in the light colour.")}
          </p>
        </>
      ),
    },
    {
      title: t("下壳为什么藏进阴影", "Why the lower shell disappears"),
      body: byLocale(
        <>
          <p>从侧面看视线：它从斜上方来。收进去的下壳朝下，于是有三件事同时发生：</p>
          <p>一，顶光照不到它，它比侧面暗，和桌上的阴影连在一起。二，它和视线接近平行，在画面里被压得很扁。三，收得比视线还陡，它就整个躲到上壳后面，轮廓的下沿变成转折处，下面只剩一道阴影。</p>
          <p>坐姿视点的俯角约 36°。下壳和竖直方向的夹角超过 90° − 36° = 54°，就完全看不见了。</p>
        </>,
        <>
          <p>Look at the sight lines from the side: they come down at an angle. The tucked lower shell faces down, and three things happen at once.</p>
          <p>
            One, the overhead light doesn't reach it, so it's darker than the side and runs into the shadow on the table. Two, it's nearly parallel to the line of sight, so it's squashed flat in the picture. Three, tuck it
            in more steeply than the sight line and it hides completely behind the upper shell: the bottom of the outline becomes the crease, with only a strip of shadow below.
          </p>
          <p>From the seated eye point you look down at about 36°. Once the lower shell leans more than 90° − 36° = 54° from vertical, it can't be seen at all.</p>
        </>,
      ),
      task: { label: t("让下壳从坐姿视点完全看不见", "Hide the lower shell completely from the seated eye point"), done: (s) => s.hidden },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("下壳内收", "Tuck the lower shell")} value={s.tuck} min={0} max={14} onChange={(v) => c.setShape({ tuck: v })} />
          <ParamSlider
            className="px-0"
            label={t("分型线高度", "Parting line height")}
            value={s.split}
            min={4}
            max={24}
            onChange={(v) => c.setShape({ split: v })}
            hint={t("下壳从分型线开始往里收。", "The lower shell tucks in from the parting line down.")}
          />
          <div className="mt-2 flex flex-wrap gap-y-1">
            <Readout label={t("下壳倾角", "Lower shell lean")} value={Math.round(s.tuckAngle)} unit="°" tone={s.hidden ? "success" : undefined} />
            <Readout label={t("看不见的门槛", "Hidden beyond")} value={Math.round(90 - s.look)} unit="°" />
          </div>
          <Measures s={s} />
          {s.hidden && (
            <Hint>
              {t(
                "下壳整个躲到了上壳后面。轮廓下沿就是分型线所在的转折处，下面只剩阴影：产品像是浮在桌上。",
                "The lower shell is now entirely behind the upper one. The bottom of the outline is the crease where the parting line sits, with only shadow below: the product seems to float above the desk.",
              )}
            </Hint>
          )}
          <SideButton s={s} c={c} />
        </>
      ),
    },
    {
      title: t("顶边：圆角还是倒角", "The top edge: round or chamfer"),
      body: byLocale(
        <>
          <p>顶边的倒角和圆角朝上、迎着灯，比侧面亮得多，看上去属于顶面。侧面从它们下面才开始算。</p>
          <p>45° 倒角整条都迎着光，侧面直接从倒角下沿开始。圆角从竖直慢慢转到水平，只有上半段像顶面，下半段还是侧面，所以轮廓只薄一点；它的作用更多是把顶光反射成一条柔和的亮边。</p>
          <p>代价也量得出来：顶边越大，顶面能用的平面和内部空间越少。</p>
        </>,
        <>
          <p>A chamfer or round on the top edge faces up into the light and is much brighter than the side, so it reads as part of the top. The side only starts below it.</p>
          <p>
            A 45° chamfer faces the light along its whole width, so the side starts right at its lower edge. A round turns gradually from vertical to horizontal: only its upper half looks like top and the lower half is still
            side, so the outline gets only a little thinner. What a round mostly does is reflect the overhead light as a soft bright edge.
          </p>
          <p>The cost is measurable too: the bigger the top edge, the less flat top you can use and the less room inside.</p>
        </>,
      ),
      task: { label: t("圆角和倒角都试到 8 mm 以上", "Try both a round and a chamfer of 8 mm or more"), done: (s) => s.tops === 3 },
      extra: ({ s, c }) => (
        <>
          <TopSwitch s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label={s.topKind === "round" ? t("顶边圆角半径", "Top round radius") : t("顶边倒角距离", "Top chamfer size")} value={s.top} min={1} max={12} onChange={(v) => c.setShape({ top: v })} />
          <Measures s={s} volume />
        </>
      ),
      terms: ["fillet", "chamfer"],
    },
    {
      title: t("颜色、分型线和桌面", "Colour, the parting line and the table"),
      body: byLocale(
        <>
          <p>把下壳改成深色，轮廓的读数一点没变，变的只是亮面。深色下壳放在深色桌上，和阴影连成一片，像阴影的一部分；放在浅色桌上，它就是一条看得见的深色带。这招灵不灵，取决于环境。</p>
          <p>分型线是一条细缝，眼睛会把它当成边。放在转折处，它和明暗交界合成一条线；放在一块平面的中间，侧面就被切成两条。</p>
        </>,
        <>
          <p>
            Make the lower shell dark and the outline reading doesn't move at all; only the bright band changes. On a dark desk the dark shell merges with the shadow and reads as part of it; on a light desk it's a dark
            stripe you can plainly see. Whether the trick works depends on where the product sits.
          </p>
          <p>The parting line is a thin gap, and the eye treats it as an edge. On the crease it merges with the light/shadow boundary into a single line; in the middle of a flat face it cuts the side into two bands.</p>
        </>,
      ),
      task: { label: t("下壳改深色，浅色和深色桌面都看看", "Make the lower shell dark and look at it on both a light and a dark desk"), done: (s) => s.dark && s.tables === 3 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("下壳", "Lower shell")}</span>
            <Segmented
              size="sm"
              aria-label={t("下壳颜色", "Lower shell colour")}
              value={s.dark ? "dark" : "light"}
              onValueChange={(v) => c.setShape({ dark: v === "dark" })}
              options={[
                { value: "light", label: t("同色", "Same colour") },
                { value: "dark", label: t("深色", "Dark") },
              ]}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-small font-medium">{t("桌面", "Desk")}</span>
            <Segmented
              size="sm"
              aria-label={t("桌面颜色", "Desk colour")}
              value={s.darkTable ? "dark" : "light"}
              onValueChange={(v) => c.setDarkTable(v === "dark")}
              options={[
                { value: "light", label: t("浅色", "Light") },
                { value: "dark", label: t("深色", "Dark") },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("分型线高度", "Parting line height")} value={s.split} min={4} max={24} onChange={(v) => c.setShape({ split: v })} />
          <Measures s={s} lit />
        </>
      ),
    },
    {
      title: t("组合：看着薄，空间不少", "Combine: looks thin, keeps the room"),
      body: byLocale(
        <>
          <p>真把产品做薄，内部空间按比例减少。收边和倒角只削掉边角上的一点体积，却能把轮廓减下来。</p>
          <p>目标：看起来比原样薄 25% 以上，内部空间留 90% 以上。</p>
        </>,
        <>
          <p>Actually making the product thinner costs inside room in proportion. Tucks and chamfers only shave a little volume off the edges, yet they take a lot off the outline.</p>
          <p>Target: looks at least 25% thinner than as is, while keeping at least 90% of the inside volume.</p>
        </>,
      ),
      task: {
        label: t("看起来薄 25% 以上，空间留 90% 以上", "At least 25% thinner-looking, at least 90% of the room"),
        done: (s) => s.sil <= s.base * 0.75 && s.volume >= 90,
      },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("下壳内收", "Tuck the lower shell")} value={s.tuck} min={0} max={14} onChange={(v) => c.setShape({ tuck: v })} />
          <ParamSlider className="px-0" label={t("下壳弧形", "Curve the lower shell under")} value={s.curve} min={0} max={12} onChange={(v) => c.setShape({ curve: v })} />
          <ParamSlider className="px-0" label={t("分型线高度", "Parting line height")} value={s.split} min={4} max={24} onChange={(v) => c.setShape({ split: v })} />
          <ParamSlider className="px-0" label={t("下边倒角", "Bottom chamfer")} value={s.chamfer} min={0} max={8} onChange={(v) => c.setShape({ chamfer: v })} />
          <TopSwitch s={s} c={c} />
          <ParamSlider className="mt-2 px-0" label={t("顶边大小", "Top edge size")} value={s.top} min={1} max={12} onChange={(v) => c.setShape({ top: v })} />
          <Measures s={s} volume />
          <p className="mt-1 text-small text-muted-foreground">
            {byLocale(
              <>
                直接把高度做到看起来一样薄（{mm((BODY.h * s.sil) / s.base)} mm 高），空间只剩 <span className="font-medium tabular text-foreground">{Math.round((s.sil / s.base) * 100)}%</span>。
              </>,
              <>
                Making it actually that thin ({mm((BODY.h * s.sil) / s.base)} mm tall) would leave only <span className="font-medium tabular text-foreground">{Math.round((s.sil / s.base) * 100)}%</span> of the room.
              </>,
            )}
          </p>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("下壳改成深色，从坐姿看，轮廓的厚度会怎样？", "You make the lower shell dark. Seen from a seated position, what happens to the thickness of the outline?"),
      options: byLocale(
        ["变薄：深色让轮廓收进去", "不变：轮廓没动，变的只是亮面有多高", "变厚：深色显得更重"],
        ["Thinner: the dark colour pulls the outline in", "Unchanged: the outline hasn't moved; only the height of the bright band changes", "Thicker: the dark colour looks heavier"],
      ),
      answer: 1,
      explain: t(
        "颜色不改几何。深色下壳只在深色桌面、阴影里才和背景连成一片；放在浅色桌上，它是一条看得见的深色带。",
        "Colour doesn't change geometry. A dark lower shell only merges with its surroundings on a dark desk or in shadow; on a light desk it's a dark stripe you can see.",
      ),
    },
    {
      q: t("桌面设备为什么常把底部向里收？", "Why do desktop devices so often tuck their base in?"),
      options: byLocale(
        ["让它放得更稳", "用户从上往下看：收进去的部分朝下、背光、被压扁，收得够陡就整个看不见", "主要为了省材料"],
        ["So it stands more steadily", "Users look down on it: the tucked part faces down, away from the light, and is foreshortened, and if it's steep enough it can't be seen at all", "Mainly to save material"],
      ),
      answer: 1,
      explain: t(
        "收底让支撑面变小，并不更稳；省下的材料也很少。它的作用是视觉上的：从用户的视点，下半截藏进阴影，轮廓变薄。",
        "A tucked base makes the footprint smaller, which doesn't make it steadier, and it saves little material. Its job is visual: from the user's eye, the lower part disappears into shadow and the outline gets thinner.",
      ),
    },
    {
      q: t("评估一个桌面产品看起来有多厚，应该从哪里看？", "To judge how thick a desktop product looks, where should you look from?"),
      options: byLocale(
        ["正前方平视的渲染图", "用户实际坐着或站着时眼睛的位置", "正上方俯视"],
        ["An eye-level render, straight on", "Where the user's eye really is, seated or standing", "Straight down from above"],
      ),
      answer: 1,
      explain: t(
        "平视会把侧面放到最大，俯视则完全看不到侧面。看起来的厚度取决于视点，要在用户真实的视点判断。",
        "Eye level shows the side at its largest; straight down hides it entirely. How thick a product looks depends on the eye point, so judge it from where the user really looks.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "看起来的厚度取决于视点：从用户眼睛的位置量，不要拿平视渲染图判断",
      "下壳内收、弧形收底、下边倒角让侧面朝下、背光、被压扁，收得够陡就整个藏到上壳后面；顶边倒角读作顶面",
      "深色下壳和分型线不改轮廓，只改亮面，灵不灵取决于桌面和灯光；分型线放在转折处",
    ],
    [
      "How thick a product looks depends on the eye point: measure from where the user's eye is, not from an eye-level render",
      "A tucked, curved-under or chamfered base faces down, away from the light, and is foreshortened; steep enough, it hides behind the upper shell. A top chamfer reads as part of the top",
      "A dark lower shell and the parting line don't change the outline, only the bright band, and how well that works depends on the desk and the light. Put the parting line on the crease",
    ],
  ),
  next: {
    to: "/lesson/fillet-hierarchy",
    label: t("圆角的层级与角落", "Fillet hierarchy and corners"),
    text: t("顶边、竖边、底边的圆角怎么分主次，三条边在角上怎么收。", "How to rank the radii on the top, vertical and bottom edges, and how three of them meet at a corner."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {VIEW_LABEL[s.view]} · {t("俯角", "looking down")} {Math.round(s.look)}°
      </SceneChip>
      <SceneChip tone="primary">
        {t(`看起来 ${mm(s.sil)} mm · 实际 ${BODY.h} mm`, `Looks ${mm(s.sil)} mm · really ${BODY.h} mm`)}
      </SceneChip>
    </div>
  ),
}

export default lesson
