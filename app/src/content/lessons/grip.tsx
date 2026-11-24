import { RotateCw } from "lucide-react"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  comfortDiameter,
  contactArea,
  GripScene,
  handLength,
  POWER_RANGE,
  PRECISION_RANGE,
  wrapOf,
  type GripKind,
  type GripState,
  type HandSize,
  type Section,
} from "./grip.scene"
import type { LessonDef } from "./types"

/** 6.2.2 「握持与把手」: power vs precision grip, handle diameter, hand size, cross-section, finger grooves. */

const GRIP_NAME: Record<GripKind, string> = { power: t("力量型握持", "Power grip"), precision: t("精确型握持", "Precision grip") }
const HAND_NAME: Record<HandSize, string> = { f5: t("女性 P5", "Woman P5"), m50: t("男性 P50", "Man P50"), m95: t("男性 P95", "Man P95") }
const SECTION_NAME: Record<Section, string> = { round: t("圆形", "Round"), oval: t("椭圆", "Oval"), tri: t("圆角三角", "Rounded triangle") }

function Switch<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{label}</span>
      <Segmented size="sm" aria-label={label} value={value} onValueChange={onChange} options={options} />
    </div>
  )
}

const handOptions = (["f5", "m50", "m95"] as HandSize[]).map((v) => ({ value: v, label: HAND_NAME[v] }))

function overlapText(s: GripState) {
  const o = wrapOf(s.section, s.diameter, s.hand).overlap
  if (o > 1) return t(`拇指压住手指约 ${o.toFixed(0)} mm`, `Thumb over fingers by about ${o.toFixed(0)} mm`)
  if (o >= -1) return t("拇指和手指刚好碰上", "Thumb and fingers just meet")
  return t(`拇指和手指之间差约 ${(-o).toFixed(0)} mm`, `A gap of about ${(-o).toFixed(0)} mm between thumb and fingers`)
}

const justMeets = (s: GripState) => {
  const o = wrapOf(s.section, s.diameter, s.hand).overlap
  return o >= -4 && o <= 10
}

// ------------------------------------------------------------------ the overlay: a diameter scale

const W = 270
const MAX = 70
const px = (mm: number) => 10 + (mm / MAX) * (W - 20)

function Scale({ s }: { s: GripState }) {
  const comfort = comfortDiameter(s.hand)
  return (
    <svg width={W} height={70} viewBox={`0 0 ${W} 70`} className="block text-foreground" aria-label={t("直径刻度", "Diameter scale")}>
      {(
        [
          [PRECISION_RANGE, t("精确型", "Precision")],
          [POWER_RANGE, t("力量型", "Power")],
        ] as const
      ).map(([[a, b], name]) => (
        <g key={name} className="text-success">
          <rect x={px(a)} y={18} width={px(b) - px(a)} height={14} rx={2} fill="currentColor" fillOpacity={0.16} stroke="currentColor" strokeOpacity={0.5} />
          <text x={(px(a) + px(b)) / 2} y={13} textAnchor="middle" fill="currentColor" className="text-caption">
            {name}
          </text>
        </g>
      ))}
      <line x1={10} x2={W - 10} y1={32} y2={32} stroke="currentColor" strokeOpacity={0.4} />
      {[0, 10, 20, 30, 40, 50, 60, 70].map((x) => (
        <g key={x} className="text-muted-foreground">
          <line x1={px(x)} x2={px(x)} y1={32} y2={36} stroke="currentColor" />
          <text x={px(x)} y={48} textAnchor="middle" fill="currentColor" className="text-caption tabular">
            {x}
          </text>
        </g>
      ))}
      {s.grip === "power" && s.step >= 2 && (
        <g className="text-primary">
          <path d={`M${px(comfort)},34 l-4,7 h8 z`} fill="currentColor" />
          <text x={px(comfort)} y={64} textAnchor="middle" fill="currentColor" className="text-caption">
            {t("这只手最舒服", "Most comfortable")}
          </text>
        </g>
      )}
      <line x1={px(s.diameter)} x2={px(s.diameter)} y1={14} y2={34} className="text-foreground" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  )
}

function Panel({ s }: { s: GripState }) {
  return (
    <div className="w-[17.5rem] rounded-lg border bg-popover p-3 shadow-popover">
      <div className="mb-1 flex items-baseline justify-between text-small">
        <span className="font-medium">{t("把手直径", "Handle diameter")}</span>
        <span className="font-mono text-caption tabular text-muted-foreground">Ø{s.diameter} mm</span>
      </div>
      <Scale s={s} />
      <div className="mt-1 text-caption text-muted-foreground">{t("色带：NIOSH 手工具选择指南", "Bands: NIOSH guide to selecting hand tools")}</div>
      {s.grip === "power" && <div className="mt-2 text-small">{overlapText(s)}</div>}
      {s.contact && (
        <div className="mt-1 text-small text-muted-foreground">
          {t(`接触面积约 ${contactArea(s).toFixed(0)} cm²（模型估算）`, `Contact area about ${contactArea(s).toFixed(0)} cm² (model estimate)`)}
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<GripState, GripScene> = {
  id: "grip",
  codes: ["6.2.2"],
  title: t("握持与把手", "Grip and handles"),
  create: (v, emit) => new GripScene(v, emit),
  steps: [
    {
      title: t("两种握法", "Two kinds of grip"),
      body: byLocale(
        <>
          <p>握东西大致有两种方式。力量型握持：四指和拇指包住把手，手掌也贴上去，用来使劲，比如锤子、锯、锅柄。精确型握持：只用拇指和手指的指腹捏住，用来控制，比如笔、镊子、调细节的小螺丝刀。</p>
          <p>两种握法要的粗细完全不同。美国 NIOSH 的手工具选择指南建议：力量型单柄工具的直径 1¼–2 英寸（约 32–51 mm），精确型 ¼–½ 英寸（约 6–13 mm）。</p>
        </>,
        <>
          <p>
            There are roughly two ways to hold something. In a power grip the four fingers and the thumb wrap the handle and the palm presses on it too: it's for force, as with a hammer, a saw or a
            pan handle. In a precision grip only the pads of the thumb and fingers pinch it: it's for control, as with a pen, tweezers or a small screwdriver for fine adjustments.
          </p>
          <p>The two need very different sizes. NIOSH's guide to selecting hand tools recommends a diameter of 1¼–2 in (about 32–51 mm) for single-handle power tools, and ¼–½ in (about 6–13 mm) for precision.</p>
        </>,
      ),
      task: { label: t("两种握法都看一遍，打开接触面比较", "Look at both grips, and turn on the contact view to compare"), done: (s) => s.sawPower && s.sawPrecision && s.contact },
      extra: ({ s, c }) => (
        <>
          <Switch label={t("握法", "Grip")} value={s.grip} onChange={(g: GripKind) => c.setGrip(g)} options={(["power", "precision"] as GripKind[]).map((v) => ({ value: v, label: GRIP_NAME[v] }))} />
          <Switch
            label={t("显示", "Show")}
            value={s.contact ? "contact" : "hand"}
            onChange={(v) => c.setContact(v === "contact")}
            options={[
              { value: "hand", label: t("手", "Hand") },
              { value: "contact", label: t("接触面", "Contact") },
            ]}
          />
          {s.contact && (
            <Hint>
              {s.grip === "power"
                ? t("手掌、四指和拇指都贴在把手上，力分散在一大片皮肤上，能用大力，也不容易压疼。", "Palm, fingers and thumb all bear on the handle. The load spreads over a large area of skin: you can push hard without it hurting.")
                : t("只有三个指腹碰到细杆。接触小、力气小，可指尖最灵敏，控制最细。", "Only three finger pads touch the thin rod. Small contact, little force, but the fingertips are the most sensitive part of the hand, so control is finest.")}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("直径：包得住多少", "Diameter: how far the hand wraps"),
      body: byLocale(
        <>
          <p>力量型握持，直径太细，手指缩成拳头，力量用不上；太粗，手指包不住，只能靠指尖扒着。</p>
          <p>拖动直径，看拇指和手指什么时候刚好碰上。</p>
        </>,
        <>
          <p>In a power grip, too thin a handle and the fingers close into a fist and can't apply their strength; too thick and they can't wrap round it, so the fingertips just cling on.</p>
          <p>Drag the diameter and watch when the thumb and fingers just meet.</p>
        </>,
      ),
      task: {
        label: t("把直径调到拇指和手指刚好碰上，且在 32–51 mm 之间", "Set the diameter so thumb and fingers just meet, within 32–51 mm"),
        done: (s) => justMeets(s) && s.diameter >= POWER_RANGE[0] && s.diameter <= POWER_RANGE[1],
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("同一只手，把手越粗，握力越大吗？", "For the same hand, does a thicker handle always give a stronger grip?")}
            options={byLocale(["越粗越大", "中间某个直径最大，太粗太细都下降", "越细越大"], ["The thicker, the stronger", "It peaks at some middle diameter and falls off either side", "The thinner, the stronger"])}
            answer={1}
            explain={t(
              "Edgren 等（2004）在 25–76 mm 的圆柱上测握力，大多数人在 38 mm 左右最大，再粗就一路下降。Kong 和 Lowe（2005）的实验里，30–40 mm 被评为最舒服。",
              "Edgren et al. (2004) measured grip force on cylinders from 25 to 76 mm: most people were strongest at about 38 mm, and force fell steadily on larger handles. In Kong and Lowe (2005), 30–40 mm handles were rated the most comfortable.",
            )}
            onReveal={() => c.setDiameter(38)}
          />
          <ParamSlider className="mt-3 px-0" label={t("把手直径", "Handle diameter")} value={s.diameter} min={15} max={70} onChange={(v) => c.setDiameter(v)} />
        </>
      ),
      note: t(
        "视图里的手是简化模型：手指沿着把手表面贴过去，拇指和手指重叠多少只是示意，不是测量值。",
        "The hand in the view is a simplified model: the fingers follow the handle's surface, and how much thumb and fingers overlap is only illustrative, not measured.",
      ),
      noteTitle: t("关于模型", "About the model"),
    },
    {
      title: t("手大手小", "Big hands, small hands"),
      body: byLocale(
        <>
          <p>最合适的直径跟手的大小有关。Kong 和 Lowe（2005）的实验里，最舒服的直径约为手长的 19.7%。按 ANSUR II 的手长算，女性 P5 约 32 mm，男性 P95 约 41 mm。</p>
          <p>这只是 24 个人的实验，给的是趋势，不是标准值。同一根 38 mm 的把手，对 P5 女性的手偏粗，手指包不住；对 P95 男性又略细。所以指南给的是范围，工具也常做大小两种，或者用套筒加粗。</p>
        </>,
        <>
          <p>
            The best diameter depends on the size of the hand. In Kong and Lowe (2005), the most comfortable diameter was about 19.7% of hand length. With ANSUR II hand lengths, that's about 32 mm
            for a P5 woman and about 41 mm for a P95 man.
          </p>
          <p>
            That was an experiment with 24 people: it shows a trend, not a standard value. The same 38 mm handle is too thick for a P5 woman's hand to wrap, and a little thin for a P95 man's. That is
            why guides give a range, and why tools often come in two sizes or take a sleeve to thicken them.
          </p>
        </>,
      ),
      task: { label: t("三种手都试一下", "Try all three hands"), done: (s) => s.hands.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <Switch label={t("手", "Hand")} value={s.hand} onChange={(h: HandSize) => c.setHand(h)} options={handOptions} />
          <ParamSlider className="mt-3 px-0" label={t("把手直径", "Handle diameter")} value={s.diameter} min={15} max={70} onChange={(v) => c.setDiameter(v)} />
          <div className="mt-2">
            <Readout label={t("手长", "Hand length")} value={handLength(s.hand).toFixed(0)} unit="mm" />
            <Readout label={t("最舒服约", "Most comfortable ≈")} value={comfortDiameter(s.hand).toFixed(0)} unit="mm" tone="primary" />
          </div>
        </>
      ),
    },
    {
      title: t("截面：拧得动，摸得出方向", "Section: torque and orientation"),
      body: byLocale(
        <>
          <p>圆截面转起来只能靠摩擦：手一滑，把手就在手里打转。三角形、六角形或扁的截面有棱，拧的时候手指顶住棱，靠形状传力。研究里，三角形截面的把手比圆形的能拧出更大的扭矩（Cochran 和 Riley，1986）。</p>
          <p>扁的截面还有一个好处：不用看，手一握就知道朝向。刀和锤子的把手常做成椭圆，让手感跟刃口、锤头的方向对上。</p>
        </>,
        <>
          <p>
            A round handle can only resist turning by friction: if the hand slips, the handle spins in it. Triangular, hexagonal or flattened sections have corners, and when you twist, the fingers push
            against them, so the shape carries the load. In studies, triangular handles produced more torque than round ones (Cochran and Riley, 1986).
          </p>
          <p>A flattened section has another benefit: you know which way it faces without looking. Knife and hammer handles are often oval so that the feel lines up with the blade or the head.</p>
        </>,
      ),
      task: { label: t("圆的和不圆的都拧一下", "Twist a round one and one that isn't"), done: (s) => s.twisted.includes("round") && (s.twisted.includes("oval") || s.twisted.includes("tri")) },
      extra: ({ s, c }) => (
        <>
          <Switch label={t("截面", "Section")} value={s.section} onChange={(v: Section) => c.setSection(v)} options={(["round", "oval", "tri"] as Section[]).map((v) => ({ value: v, label: SECTION_NAME[v] }))} />
          <Button size="sm" variant="secondary" className="mt-3" disabled={s.twisting} onClick={() => c.twistOnce()}>
            <RotateCw />
            {t("拧一下", "Twist it")}
          </Button>
          {s.twisted.length > 0 && !s.twisting && (
            <Hint>
              {s.section === "round"
                ? t("圆把手转过去了，手没跟着动：扭矩全靠握紧产生的摩擦。", "The round handle turned and the hand didn't: all the torque has to come from friction, from squeezing hard.")
                : t("棱角卡住了手，手和把手一起转：同样握力下能传更大的扭矩。", "The corners caught the hand and both turned together: the same grip passes on more torque.")}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("别做指槽", "Skip the finger grooves"),
      body: byLocale(
        <>
          <p>把手上做一排贴合手指的指槽，看上去很贴心。可指槽的间距只能按某一只手来定。这根把手按男性 P50 的手宽做，换一只小手，手指就压在凸棱上。</p>
          <p>NIOSH 的指南明确建议选没有指槽、没有锐边的把手。想防滑，用软胶包覆或者表面纹理。</p>
        </>,
        <>
          <p>A row of grooves shaped to the fingers looks thoughtful. But their spacing can only suit one hand. This handle is spaced for a P50 man's hand breadth; with a smaller hand, the fingers press on the ridges.</p>
          <p>NIOSH's guide says plainly to choose handles without finger grooves or sharp edges. For grip, use a soft overmould or a surface texture instead.</p>
        </>,
      ),
      task: { label: t("开着指槽换一只小手看看", "With the grooves on, try a smaller hand"), done: (s) => s.grooveMismatch },
      extra: ({ s, c }) => (
        <>
          <Switch
            label={t("把手", "Handle")}
            value={s.grooves ? "grooves" : "plain"}
            onChange={(v) => c.setGrooves(v === "grooves")}
            options={[
              { value: "plain", label: t("光面", "Plain") },
              { value: "grooves", label: t("指槽", "Finger grooves") },
            ]}
          />
          <Switch label={t("手", "Hand")} value={s.hand} onChange={(h: HandSize) => c.setHand(h)} options={handOptions} />
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("锤子要用力握，把手直径大约多少合适？", "A hammer is gripped hard. Roughly what handle diameter suits it?"),
      options: byLocale(["6–13 mm", "32–51 mm", "越粗越好，60 mm 以上"], ["6–13 mm", "32–51 mm", "The thicker the better: over 60 mm"]),
      answer: 1,
      explain: t(
        "这是力量型握持，NIOSH 建议 32–51 mm。6–13 mm 是精确型握持的范围；太粗手指包不住，握力反而下降。",
        "It's a power grip, for which NIOSH recommends 32–51 mm. 6–13 mm is the range for precision grips; too thick and the fingers can't wrap it, so grip force drops.",
      ),
    },
    {
      q: t("很多螺丝刀的把手做成三角形或六角形截面，主要为什么？", "Why are many screwdriver handles triangular or hexagonal in section?"),
      options: byLocale(
        ["好看，跟别的牌子区分开", "拧的时候手指顶住棱，靠形状传力，不全靠摩擦，能拧得更紧", "省材料"],
        ["They look good and stand out from other brands", "When you twist, the fingers push on the corners, so the shape carries the torque instead of friction alone", "They use less material"],
      ),
      answer: 1,
      explain: t(
        "圆截面只能靠摩擦传扭矩；有棱的截面让手指顶住棱，同样的握力能拧出更大的扭矩。扁或有棱的截面还能让手感出方向。",
        "A round section passes torque only by friction. Corners let the fingers push against them, so the same grip gives more torque. Flat or cornered sections also tell the hand which way the tool faces.",
      ),
    },
    {
      q: t("把手上做了一排贴合手指的指槽，问题在哪？", "A handle has a row of grooves shaped to the fingers. What's the problem?"),
      options: byLocale(
        ["没有问题，越贴合越好", "指槽间距只合一种手，手大手小的人手指会压在凸棱上", "指槽会让把手太粗"],
        ["None: the closer the fit the better", "The groove spacing suits only one hand size; smaller or larger hands press on the ridges", "The grooves make the handle too thick"],
      ),
      answer: 1,
      explain: t(
        "手指间距随手的大小变，指槽只能按一种手定。不合的人，手指压在凸棱上，压力集中。NIOSH 建议选没有指槽的把手。",
        "Finger spacing changes with hand size, and grooves can only be spaced for one hand. For everyone else the fingers press on the ridges, concentrating the pressure. NIOSH recommends handles without finger grooves.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先分清握法：力量型包住把手，约 32–51 mm；精确型用指腹捏，约 6–13 mm",
      "最合适的直径随手的大小变，约为手长的 20%；一根把手要照顾一群手，所以给的是范围",
      "非圆截面帮你拧得动、摸得出方向；别做只合一种手的指槽",
    ],
    [
      "Know the grip first: a power grip wraps the handle, about 32–51 mm; a precision grip pinches with the pads, about 6–13 mm",
      "The best diameter changes with hand size, about 20% of hand length; one handle serves many hands, so aim for a range",
      "Non-round sections help with torque and orientation; avoid finger grooves that fit only one hand",
    ],
  ),
  next: {
    to: "/lesson/button-feel",
    label: t("按键手感：力–行程曲线", "Button feel: the force–travel curve"),
    text: t("从握住一个东西，到按下一个按键。", "From holding something to pressing a button."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{GRIP_NAME[s.grip]}</SceneChip>
        <SceneChip>{HAND_NAME[s.hand]}</SceneChip>
        {s.grip === "power" && <SceneChip>{SECTION_NAME[s.section]}</SceneChip>}
      </div>
      <Panel s={s} />
    </div>
  ),
}

export default lesson
