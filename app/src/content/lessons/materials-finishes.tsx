import { Eye, Fingerprint, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { FinishScene, METALS, PLASTICS, SHOWS, type Finish, type FinishState, type Rating } from "./materials-finishes.scene"
import type { LessonDef } from "./types"

/** 6.3.1 「材质与表面处理」. */

const NAME: Record<Finish, string> = {
  custom: t("自定义", "Custom"),
  gloss: t("高光", "High gloss"),
  matte: t("哑光", "Matte"),
  texture: t("咬花", "Textured"),
  soft: t("类肤感", "Soft-touch"),
  anodized: t("阳极氧化", "Anodized"),
  brushed: t("拉丝", "Brushed"),
  painted: t("喷漆", "Painted"),
}

/** How each finish is made, and on what. */
const PROCESS: Record<Finish, string> = {
  custom: t("自定义材质", "Custom material"),
  gloss: t("塑料 · 模具镜面抛光", "Plastic · mirror-polished mold"),
  matte: t("塑料 · 模具喷砂或油石", "Plastic · blasted or stoned mold"),
  texture: t("塑料 · 模具蚀纹", "Plastic · etched mold texture"),
  soft: t("塑料 · 软触涂层", "Plastic · soft-touch coating"),
  anodized: t("铝合金 · 喷砂 + 阳极氧化", "Aluminum · bead blast + anodize"),
  brushed: t("不锈钢 · 拉丝", "Stainless steel · brushed"),
  painted: t("金属漆 + 清漆", "Metallic base coat + clear coat"),
}

function FinishPicker({ s, c, group, label }: { s: FinishState; c: FinishScene; group: Finish[]; label: string }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="w-10 shrink-0 text-small font-medium">{label}</span>
      <Segmented size="sm" aria-label={label} value={s.finish} onValueChange={(f: Finish) => c.setFinish(f)} options={group.map((f) => ({ value: f, label: NAME[f] }))} />
    </div>
  )
}

function Sliders({ s, c, only }: { s: FinishState; c: FinishScene; only?: "roughness" | "metalness" }) {
  return (
    <div className="mt-3 space-y-1">
      {only !== "metalness" && (
        <ParamSlider
          className="px-0"
          label={t("粗糙度", "Roughness")}
          unit=""
          value={s.roughness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => c.setRoughness(v)}
          hint={t("0 是镜面，1 是完全漫射。", "0 is a mirror, 1 fully diffuse.")}
        />
      )}
      {only !== "roughness" && (
        <ParamSlider
          className="px-0"
          label={t("金属度", "Metalness")}
          unit=""
          value={s.metalness}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => c.setMetalness(v)}
          hint={t("0 是塑料、漆、玻璃这类非金属，1 是裸金属。", "0 is a non-metal such as plastic, paint or glass; 1 is bare metal.")}
        />
      )}
    </div>
  )
}

const LEVEL = [t("不显", "Hides it"), t("会显", "Shows"), t("很显", "Shows clearly")]

function Meter({ value }: { value: Rating }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("h-1.5 w-4 rounded-full", i <= value ? (value === 2 ? "bg-warning" : "bg-foreground") : "bg-muted")} />
      ))}
      <span className="ml-1.5 text-small text-muted-foreground">{LEVEL[value]}</span>
    </span>
  )
}

function Shows({ finish }: { finish: Finish }) {
  if (finish === "custom") return null
  const r = SHOWS[finish]
  const rows: [string, Rating][] = [
    [t("指纹", "Fingerprints"), r.prints],
    [t("细划痕", "Fine scratches"), r.scratches],
    [t("凹陷起伏", "Dents and waviness"), r.dents],
  ]
  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="text-small font-medium text-muted-foreground">
        {NAME[finish]} · {t("大致倾向", "Typical tendency")}
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <span className="text-small">{k}</span>
            <Meter value={v} />
          </div>
        ))}
      </div>
    </div>
  )
}

const lesson: LessonDef<FinishState, FinishScene> = {
  id: "materials-finishes",
  codes: ["6.3.1"],
  title: t("材质与表面处理", "Materials and finishes"),
  create: (v, emit) => new FinishScene(v, emit),
  steps: [
    {
      title: t("粗糙度：高光的大小和清晰度", "Roughness: how big and how sharp the highlight is"),
      body: byLocale(
        <>
          <p>产品放在一个摄影棚里，后上方挂着一条长灯箱。顶面上那条亮带，就是灯箱的倒影。</p>
          <p>粗糙度描述表面微观上有多不平。越粗糙，反射光散得越开：倒影从清楚的灯箱，变成一大片柔和的亮。</p>
        </>,
        <>
          <p>The product sits in a photo studio with a long strip softbox above and behind it. The bright band on the top face is the reflection of that softbox.</p>
          <p>
            Roughness describes how uneven the surface is at a microscopic scale. The rougher it is, the more the reflected light spreads: the reflection goes from a crisp softbox to
            a broad, soft glow.
          </p>
        </>,
      ),
      task: { label: t("把粗糙度拉到 0.1 以下，再拉到 0.6 以上", "Drag the roughness below 0.1, then above 0.6"), done: (s) => s.lowR && s.highR },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="rough"
            question={t("粗糙度从 0.04 拉到 0.6，灯箱的倒影会怎样？", "Roughness goes from 0.04 to 0.6. What happens to the softbox's reflection?")}
            options={byLocale(
              ["越来越暗，最后消失", "变大变糊，光摊开了", "不变，只是颜色变浅"],
              ["It gets darker and finally disappears", "It grows and blurs as the light spreads out", "Nothing, it just gets paler"],
            )}
            answer={1}
            explain={t(
              "反射的总光量差不多，只是分散到更大的角度里：倒影变大、边缘变糊、最亮处变暗。",
              "About the same total light is reflected, just spread over a wider range of angles: the reflection grows, its edges blur, and its peak gets dimmer.",
            )}
            onReveal={() => c.sweepRoughness()}
          />
          <Sliders s={s} c={c} only="roughness" />
        </>
      ),
    },
    {
      title: t("金属度：高光是什么颜色", "Metalness: what color the highlight is"),
      body: byLocale(
        <>
          <p>非金属（塑料、漆、陶瓷）有两层光：底下是带颜色的漫反射，表面是一层不带颜色的反光。正对着看反光很弱，斜着看变强。</p>
          <p>金属没有漫反射，全部是反光，而且反光本身带着金属的颜色，所以黄铜的高光是黄的。</p>
          <p>真实材料基本只有 0 或 1。中间值只用来近似混合的东西，比如漆里混了金属片、金属上积了灰。</p>
        </>,
        <>
          <p>
            Non-metals (plastic, paint, ceramics) have two kinds of light: a colored diffuse layer underneath and an uncolored reflection on the surface. The reflection is weak when
            you look straight on and grows stronger at a glancing angle.
          </p>
          <p>Metals have no diffuse light at all. Everything is reflection, and the reflection itself takes the metal's color, which is why brass has yellow highlights.</p>
          <p>Real materials are almost always 0 or 1. In-between values only approximate mixtures, such as metal flakes in paint or dust on metal.</p>
        </>,
      ),
      task: { label: t("把金属度拉到 0，再拉到 1，看高光的颜色", "Drag the metalness to 0, then to 1, and watch the highlight's color"), done: (s) => s.m0 && s.m1 },
      extra: ({ s, c }) => <Sliders s={s} c={c} />,
    },
    {
      title: t("塑料的四种表面", "Four plastic surfaces"),
      body: byLocale(
        <>
          <p>注塑件的光面、哑光和咬花，都是模具钢面的样子复制到塑料上：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>高光：模具镜面抛光，常用 SPI A 级（钻石膏抛光）。</li>
            <li>哑光：模具用油石或喷砂打毛，对应 SPI C、D 级。</li>
            <li>咬花：模具表面化学蚀纹（Mold-Tech 等纹理厂）或激光纹理，皮纹、砂纹、几何纹都有。</li>
          </ul>
          <p>类肤感不是模具做的：是喷一层软触漆（弹性聚氨酯涂层），或者包一层 TPE 软胶。</p>
        </>,
        <>
          <p>Gloss, matte and texture on a molded part are all copies of the mold steel's surface:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>High gloss: a mirror-polished mold, typically SPI grade A (diamond buff).</li>
            <li>Matte: the mold is stoned or bead-blasted, SPI grades C and D.</li>
            <li>Textured: the mold surface is chemically etched (by texture houses such as Mold-Tech) or laser-textured, in leather, sand or geometric patterns.</li>
          </ul>
          <p>Soft-touch doesn't come from the mold: it's a sprayed soft-touch coating (an elastomeric polyurethane), or an overmolded layer of TPE.</p>
        </>,
      ),
      task: { label: t("四种表面都看一遍", "Look at all four surfaces"), done: (s) => PLASTICS.every((f) => s.seen.includes(f)) },
      extra: ({ s, c }) => (
        <>
          <FinishPicker s={s} c={c} group={PLASTICS} label={t("塑料", "Plastic")} />
          <Sliders s={s} c={c} />
          {s.finish === "soft" && (
            <Hint>
              {t(
                "类肤感摸着舒服，但涂层不耐磨：常摸的地方会磨亮，有的涂层几年后还会发黏。",
                "Soft-touch feels good, but the coating wears: spots that are handled a lot get shiny, and some coatings turn sticky after a few years.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "SPI 是美国塑料工业协会的模具表面等级（A 光、B 砂纸、C 油石、D 喷砂）；VDI 3400 是按粗糙度分级的电火花纹理，数字越大越粗。",
        "SPI is the US plastics industry's grading of mold finishes (A polished, B paper, C stone, D blasted); VDI 3400 grades EDM textures by roughness, and the higher the number, the coarser.",
      ),
      noteTitle: t("标准", "Standards"),
    },
    {
      title: t("金属和喷漆", "Metal and paint"),
      body: byLocale(
        <>
          <p>阳极氧化是电化学工艺：在铝的表面长出一层硬的氧化膜，膜里能染色。它只用于铝（还有钛、镁合金），钢做不了。先喷砂再氧化，就是笔记本外壳那种细腻的哑光。</p>
          <p>拉丝是用砂带或砂轮刷出一条条平行细纹。细纹让高光朝垂直于纹路的方向拉长。</p>
          <p>喷漆通常两层：带颜色的底漆（金属漆里有铝片，会闪），上面罩一层透明清漆。清漆给出清楚的倒影，底漆给颜色和闪点。</p>
        </>,
        <>
          <p>
            Anodizing is an electrochemical process: a hard oxide layer grows out of the aluminum surface, and that layer can be dyed. It works on aluminum (and titanium and
            magnesium alloys), not on steel. Bead-blast first and then anodize, and you get the fine matte of a laptop case.
          </p>
          <p>Brushing draws fine parallel lines with an abrasive belt or wheel. The lines stretch the highlight out at right angles to them.</p>
          <p>
            Paint usually comes in two layers: a colored base coat (metallic paint has aluminum flakes that sparkle) under a transparent clear coat. The clear coat gives the crisp
            reflection; the base coat gives the color and the sparkle.
          </p>
        </>,
      ),
      task: {
        label: t("三种都看一遍，再把拉丝转个方向", "Look at all three, then turn the brushing direction"),
        done: (s) => METALS.every((f) => s.seen.includes(f)) && s.turned,
      },
      extra: ({ s, c }) => (
        <>
          <FinishPicker s={s} c={c} group={METALS} label={t("表面", "Finish")} />
          {s.finish === "brushed" && (
            <div className="mt-3 flex items-center gap-3">
              <span className="w-10 shrink-0 text-small font-medium">{t("纹路", "Lines")}</span>
              <Segmented
                size="sm"
                aria-label={t("纹路", "Lines")}
                value={s.brushAcross ? "across" : "along"}
                onValueChange={(v) => c.setBrushAcross(v === "across")}
                options={[
                  { value: "along", label: t("沿长边", "Lengthwise") },
                  { value: "across", label: t("沿短边", "Crosswise") },
                ]}
              />
            </div>
          )}
          <Sliders s={s} c={c} />
        </>
      ),
    },
    {
      title: t("哪种表面最怕指纹和划痕", "Which surface fears fingerprints and scratches most"),
      body: byLocale(
        <>
          <p>顶面上现在有两枚指纹、几道细划痕，左前方还有一个很浅的凹陷（为了看得见，这里稍微夸张了）。</p>
          <p>指纹是一层油：在光面上把倒影弄糊，在哑光面上反而发亮。凹陷改变的是形状，只有清楚的倒影才会把它弯给你看。</p>
        </>,
        <>
          <p>
            The top face now has two fingerprints, a few fine scratches and, front left, a very shallow dent (slightly exaggerated here so you can see it).
          </p>
          <p>A fingerprint is a film of oil: on a glossy face it blurs the reflection, on a matte one it shines. A dent changes the shape, and only a crisp reflection bends to show it.</p>
        </>,
      ),
      task: {
        label: t("开着瑕疵，比较至少四种表面（包括高光和咬花）", "With the flaws on, compare at least four surfaces (including gloss and textured)"),
        done: (s) => s.flawSeen.length >= 4 && s.flawSeen.includes("gloss") && s.flawSeen.includes("texture"),
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="flaws"
            question={t("同样的指纹、划痕和凹陷，哪种表面上最显眼？", "Same fingerprints, scratches and dent. On which surface do they stand out most?")}
            options={byLocale(["咬花", "高光", "喷砂阳极氧化"], ["Textured", "High gloss", "Bead-blasted anodized"])}
            answer={1}
            explain={t(
              "高光面像一面镜子：油膜把倒影弄糊，划痕把光散开，凹陷让倒影弯掉，样样都看得见。咬花和喷砂本身就把光打散了，小瑕疵混在里面。",
              "A glossy face is a mirror: the oil blurs the reflection, the scratches scatter light and the dent bends the reflection, so all of it shows. Texture and bead blast already scatter the light, so small flaws blend in.",
            )}
            onReveal={() => c.setFinish("gloss")}
          />
          <FinishPicker s={s} c={c} group={PLASTICS} label={t("塑料", "Plastic")} />
          <FinishPicker s={s} c={c} group={METALS} label={t("其他", "Other")} />
          <Button size="sm" variant={s.flaws ? "secondary" : "primary"} className="mt-3" onClick={() => c.setFlaws(!s.flaws)}>
            <Fingerprint />
            {s.flaws ? t("去掉瑕疵", "Remove flaws") : t("加上瑕疵", "Add flaws")}
          </Button>
          <Shows finish={s.finish} />
          {s.finish === "brushed" && (
            <Hint>{t("拉丝面上，顺着纹路的划痕几乎看不见，横着纹路的很显眼。", "On brushed metal, scratches along the lines almost vanish; scratches across them stand out.")}</Hint>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t(
        "客户想要不锈钢外壳，「做成笔记本那样的喷砂阳极氧化深空灰」。怎么回？",
        "A client wants a stainless steel housing “bead-blasted and anodized space grey, like a laptop”. What do you tell them?",
      ),
      options: byLocale(
        ["可以，不锈钢阳极氧化后也能染色", "阳极氧化是铝（以及钛、镁）的工艺；要么改用铝合金，要么不锈钢喷砂后做 PVD 镀膜之类的上色", "可以，只要先喷砂"],
        [
          "Fine, stainless steel can be anodized and dyed too",
          "Anodizing is a process for aluminum (and titanium and magnesium); either switch to aluminum, or color the blasted stainless with something like a PVD coating",
          "Fine, as long as it's bead-blasted first",
        ],
      ),
      answer: 1,
      explain: t(
        "阳极氧化是让铝自己长出一层多孔的氧化膜再染色，钢上长不出这样的膜。不锈钢的颜色一般靠 PVD 镀膜或喷涂。",
        "Anodizing grows a porous oxide layer out of the aluminum itself and dyes it; steel can't grow such a layer. Stainless steel is usually colored with a PVD coating or paint.",
      ),
    },
    {
      q: t("一个天天被手握、还常丢进包里的遥控器背壳，哪种表面最省心？", "A remote control's back shell is held every day and thrown into bags. Which surface gives the least trouble?"),
      options: byLocale(["高光钢琴黑", "咬花", "类肤感漆"], ["Piano-black high gloss", "Textured", "Soft-touch paint"]),
      answer: 1,
      explain: t(
        "高光最显指纹和划痕；类肤感手感好，但显油印、会磨亮；咬花把光打散，指纹和小擦伤都藏得住，而且是模具做出来的，不会掉。",
        "High gloss shows fingerprints and scratches most; soft-touch feels nice but shows oil and wears shiny. Texture scatters the light, so prints and small scuffs hide, and it comes from the mold, so it can't wear off.",
      ),
    },
    {
      q: t("拉丝金属上的高光拉成了一条长亮带。亮带和拉丝纹是什么关系？", "On brushed metal the highlight stretches into a long bright band. How does it relate to the brush lines?"),
      options: byLocale(["和纹路平行", "和纹路垂直", "没有关系，看灯的形状"], ["Parallel to the lines", "At right angles to the lines", "Unrelated; it depends on the light's shape"]),
      answer: 1,
      explain: t(
        "细纹的截面是一排小沟，法向在横过纹路的方向上来回变，所以光在这个方向散开：亮带垂直于纹路。",
        "In cross-section the lines are rows of tiny grooves, so the normal swings back and forth across the lines and spreads the light in that direction: the band runs at right angles to the lines.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "粗糙度管高光的大小和清晰度，金属度管高光有没有颜色、有没有漫反射；真实材料的金属度基本只有 0 或 1",
      "工艺名要对：塑料的光面、哑光、咬花来自模具表面；类肤感是涂层或包胶；阳极氧化只用于铝、钛、镁",
      "越光的表面越显指纹、划痕和凹陷；常被手摸的地方用咬花、喷砂或哑光",
    ],
    [
      "Roughness sets how big and sharp a highlight is; metalness sets whether the highlight is colored and whether there is diffuse light. Real materials are almost always metalness 0 or 1",
      "Name processes correctly: gloss, matte and texture on plastics come from the mold surface; soft-touch is a coating or an overmold; anodizing is for aluminum, titanium and magnesium",
      "The glossier the surface, the more it shows fingerprints, scratches and dents; use texture, bead blast or matte where hands touch",
    ],
  ),
  next: {
    to: "/lesson/sink-marks",
    label: t("光面会放大缺陷", "Sink marks on gloss"),
    text: t("同一个凹陷，为什么在高光面上一眼可见，在咬花面上几乎看不到。", "Why the same dent jumps out on a glossy face and nearly vanishes on a textured one."),
  },
  overlay: ({ s, c }) => (
    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>
        <Eye />
        {PROCESS[s.finish]}
      </SceneChip>
      <SceneChip tone="primary">
        {t("粗糙度", "Roughness")} {s.roughness.toFixed(2)} · {t("金属度", "Metalness")} {s.metalness.toFixed(2)}
      </SceneChip>
      <button type="button" className="pointer-events-auto" onClick={() => c.keyView()} aria-label={t("回到原视角", "Back to the original view")} title={t("回到原视角", "Back to the original view")}>
        <SceneChip>
          <LocateFixed />
        </SceneChip>
      </button>
    </div>
  ),
}

export default lesson
