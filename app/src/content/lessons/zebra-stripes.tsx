import { Check, Eye, LocateFixed } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { ZebraScene, type Blend, type ZebraState } from "./zebra-stripes.scene"
import type { LessonDef } from "./types"

/** 5.3.1 · 5.3.3 「斑马纹：用反光看曲面质量」. */

const BLEND_LABEL: Record<Blend, string> = {
  G0: t("G0 尖边", "G0 sharp edge"),
  G1: t("G1 圆角", "G1 fillet"),
  G2: t("G2 混接", "G2 blend"),
}

function BlendSwitch({ s, c, only }: { s: ZebraState; c: ZebraScene; only?: Blend[] }) {
  const all: Blend[] = only ?? ["G0", "G1", "G2"]
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("接法", "Joint")}</span>
      <Segmented
        size="sm"
        aria-label={t("接法", "Joint")}
        value={s.blend}
        onValueChange={(b: Blend) => c.setBlend(b)}
        options={all.map((b) => ({ value: b, label: BLEND_LABEL[b] }))}
      />
    </div>
  )
}

function ZebraToggle({ s, c }: { s: ZebraState; c: ZebraScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("显示", "Display")}</span>
      <Segmented
        size="sm"
        aria-label={t("显示", "Display")}
        value={s.zebra ? "zebra" : "shaded"}
        onValueChange={(v) => c.setZebra(v === "zebra")}
        options={[
          { value: "shaded", label: t("着色", "Shaded") },
          { value: "zebra", label: t("斑马纹", "Zebra stripes") },
        ]}
      />
    </div>
  )
}

function BlindTest({ s, c }: { s: ZebraState; c: ZebraScene }) {
  const picked = s.guess !== null ? s.order[s.guess] : null
  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-small font-medium">{t("样件", "Sample")}</span>
        <Segmented
          size="sm"
          aria-label={t("样件", "Sample")}
          value={String(s.sample)}
          onValueChange={(v) => c.setSample(Number(v))}
          options={[0, 1, 2].map((i) => ({ value: String(i), label: t(`样件 ${i + 1}`, `Sample ${i + 1}`) }))}
        />
      </div>
      <Button size="sm" variant="primary" className="mt-3" onClick={() => c.guess()}>
        <Check />
        {t("这个是 G2", "This one is G2")}
      </Button>
      {picked === "G2" && (
        <Hint>
          {t(
            "答对了。条纹从一个面流到另一个面，宽度渐变，没有折点：这是 G2。",
            "Correct. The stripes flow from one face to the other, changing width gradually, with no kinks: this is G2.",
          )}
        </Hint>
      )}
      {picked === "G1" && (
        <Hint tone="warning">
          {t(
            "这是 G1 圆角：条纹接上了，但在圆角的两条边界上拐了个折。再看看另外两个。",
            "This is the G1 fillet: the stripes connect, but they kink at both edges of the fillet. Look at the other two.",
          )}
        </Hint>
      )}
      {picked === "G0" && (
        <Hint tone="warning">
          {t("这是 G0 尖边：条纹在边上错开、断了。再看看另外两个。", "This is the G0 sharp edge: the stripes are offset and broken at the edge. Look at the other two.")}
        </Hint>
      )}
    </>
  )
}

const lesson: LessonDef<ZebraState, ZebraScene> = {
  id: "zebra-stripes",
  codes: ["5.3.1", "5.3.3"],
  title: t("斑马纹：用反光看曲面质量", "Zebra stripes: judging surfaces by their reflections"),
  create: (v, emit) => new ZebraScene(v, emit),
  steps: [
    {
      title: t("反光比形状更挑剔", "Reflections are pickier than shape"),
      body: byLocale(
        <>
          <p>这是一个外壳的肩部：顶面和侧面，中间用圆角过渡。着色看上去很顺。</p>
          <p>斑马纹假装零件放在一排平行的灯管下面，把灯管的倒影画成黑白条纹。反光对曲率的变化极其敏感，着色里看不出的问题，条纹一眼就暴露。</p>
        </>,
        <>
          <p>This is the shoulder of a housing: a top face and a side face, with a fillet between them. Shaded, it looks smooth.</p>
          <p>
            Zebra stripes pretend the part sits under a row of parallel light tubes and draw their reflections as black and white stripes. Reflections are extremely sensitive to changes
            in curvature: problems you can't see in the shaded view jump out at you in the stripes.
          </p>
        </>,
      ),
      task: { label: t("打开斑马纹", "Turn on zebra stripes"), done: (s) => s.zebra },
      extra: ({ s, c }) => <ZebraToggle s={s} c={c} />,
      note: t(
        "Rhino 用 Zebra，SOLIDWORKS 叫「斑马条纹」，Fusion 用 Zebra Analysis，Alias 还有 Light Tunnel 和 Iso-Angle。",
        "Rhino has Zebra, SOLIDWORKS calls it “Zebra Stripes”, Fusion has Zebra Analysis, and Alias also offers Light Tunnel and Iso-Angle.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("三种接法，三种条纹", "Three joints, three kinds of stripes"),
      body: byLocale(
        <>
          <p>G0：两个面只是在边上碰到，法向在边上突变，条纹在边上错开、断开。</p>
          <p>G1：法向连续，条纹接上了；但曲率在圆角边界上从 0 跳到 1/R，条纹在那里拐出一个折。</p>
          <p>G2：曲率也连续，条纹从一个面顺滑地流到另一个面，宽度渐变。</p>
        </>,
        <>
          <p>G0: the two faces only meet at an edge. The normal changes abruptly at the edge, and the stripes are offset and broken there.</p>
          <p>G1: the normal is continuous, so the stripes connect; but the curvature jumps from 0 to 1/R at the edges of the fillet, and the stripes kink there.</p>
          <p>G2: the curvature is continuous too, so the stripes flow smoothly from one face to the other, changing width gradually.</p>
        </>,
      ),
      task: { label: t("三种接法都看一遍", "Look at all three joints"), done: (s) => s.seenG0 && s.seenG1 && s.seenG2 },
      extra: ({ s, c }) => <BlendSwitch s={s} c={c} />,
    },
    {
      title: t("盲测：哪个是 G2", "Blind test: which one is G2?"),
      body: byLocale(
        <p>三个样件，顺序打乱了，也不告诉你是哪种接法。只看条纹，挑出 G2。</p>,
        <p>Three samples, shuffled, and you aren't told which joint each one has. Pick out the G2 one from the stripes alone.</p>,
      ),
      task: { label: t("找出 G2 的样件", "Find the G2 sample"), done: (s) => s.guessedRight },
      extra: ({ s, c }) => <BlindTest s={s} c={c} />,
    },
    {
      title: t("圆角为什么不够", "Why a fillet isn't enough"),
      body: byLocale(
        <>
          <p>普通的等半径圆角（滚球圆角）截面是一段圆弧，只有 G1。半径改大改小，折点都还在，只是位置变了。</p>
          <p>G2 混接要占更长的过渡距离（这里约 1.5 倍），换来的是没有断点的高光。SOLIDWORKS 圆角有「曲率连续」选项，Plasticity 的圆角有 G2 剖面，Rhino 用 BlendSrf。</p>
        </>,
        <>
          <p>
            An ordinary constant-radius fillet (a rolling-ball fillet) has a circular arc as its cross-section, so it is only G1. Make the radius bigger or smaller and the kinks are still
            there; they just move.
          </p>
          <p>
            A G2 blend takes a longer transition (about 1.5 times as long here), and in return the highlight has no breaks. SOLIDWORKS fillets have a “Curvature continuous” option,
            Plasticity's fillets have a G2 profile, and in Rhino you use BlendSrf.
          </p>
        </>,
      ),
      task: { label: t("改一改圆角大小，比较 G1 和 G2", "Change the fillet size and compare G1 with G2"), done: (s) => s.radiusChanged && s.seenG1 && s.seenG2 },
      extra: ({ s, c }) => (
        <>
          <BlendSwitch s={s} c={c} only={["G1", "G2"]} />
          <ParamSlider className="mt-3 px-0" label={t("圆角大小", "Fillet size")} value={s.radius} min={6} max={26} onChange={(v) => c.setRadius(v)} />
        </>
      ),
      terms: ["fillet"],
    },
    {
      title: t("汽车和家电上的高光", "Highlights on cars and appliances"),
      body: byLocale(
        <>
          <p>车身、手机、家电外壳在展厅灯光下，人看到的就是这些高光线。高光一折，看上去就是「面没做好」。</p>
          <p>一般产品以 G2 为光顺的基本要求。汽车外观的 Class-A 曲面追求近乎完美的高光，接缝处常做到 G3。</p>
          <p>条纹会随视角移动：检查时要多转几个角度，让条纹扫过每一条接缝。</p>
        </>,
        <>
          <p>Under showroom lights, these highlight lines are exactly what people see on a car body, a phone or an appliance housing. A kinked highlight reads as “a badly made surface”.</p>
          <p>For general products, G2 is the basic requirement for smoothness. Class-A surfaces on car exteriors aim for near-perfect highlights and are often G3 at the seams.</p>
          <p>The stripes move as the view changes: when you check, turn the model through several angles so the stripes sweep across every seam.</p>
        </>,
      ),
      task: { label: t("转动视图，看条纹怎么流动", "Orbit the view and watch how the stripes flow"), done: (s) => s.orbited },
      extra: ({ s, c }) => (
        <>
          <BlendSwitch s={s} c={c} />
          <ParamSlider className="mt-3 px-0" label={t("条纹密度", "Stripe density")} unit="" value={s.freq} min={4} max={20} onChange={(v) => c.setFreq(v)} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.resetView()}>
            <LocateFixed />
            {t("回到原视角", "Back to the original view")}
          </Button>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("斑马纹在两个面的交界处错开、断开，说明交界是几阶连续？", "Zebra stripes are offset and broken where two faces meet. What continuity does the seam have?"),
      options: ["G0", "G1", "G2"],
      answer: 0,
      explain: t(
        "条纹断开说明法向突变：只有位置连续（G0），交界处有折边。",
        "Broken stripes mean the normal changes abruptly: only position is continuous (G0), and there is a sharp edge at the seam.",
      ),
    },
    {
      q: t("条纹在交界处接上了，但拐出一个尖角，这是？", "The stripes connect at the seam but turn a sharp corner there. What is this?"),
      options: ["G0", "G1", "G2"],
      answer: 1,
      explain: t(
        "接上说明法向连续（G1）；拐折说明曲率跳变，到不了 G2。等半径圆角的典型样子。",
        "Connected stripes mean the normal is continuous (G1); the kink means the curvature jumps, so it falls short of G2. This is how a constant-radius fillet typically looks.",
      ),
    },
    {
      q: t("把 G1 圆角的半径加大一倍，条纹的拐折会怎样？", "You double the radius of a G1 fillet. What happens to the kinks in the stripes?"),
      options: byLocale(
        ["消失，大半径就是 G2", "还在，只是换了位置；要去掉得改用曲率连续的混接", "变成断开"],
        ["They disappear; a large radius is G2", "They're still there, just in a different place; to get rid of them, switch to a curvature-continuous blend", "They turn into breaks"],
      ),
      answer: 1,
      explain: t(
        "圆弧截面的圆角无论多大都只有 G1：曲率在边界上从 0 跳到 1/R。要光顺得换 G2 混接。",
        "A fillet with a circular cross-section is only G1, however large it is: the curvature jumps from 0 to 1/R at its edges. For smoothness, switch to a G2 blend.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "斑马纹是平行灯管的反光：断开 = G0，拐折 = G1，顺滑流过 = G2",
      "等半径圆角只有 G1，改半径去不掉高光折点；要光顺用曲率连续的混接",
      "一般产品以 G2 为光顺底线，汽车 Class-A 常做到 G3；检查时多转几个角度",
    ],
    [
      "Zebra stripes are reflections of parallel light tubes: broken = G0, kinked = G1, flowing smoothly across = G2",
      "A constant-radius fillet is only G1, and changing the radius won't remove the kink in the highlight; for smoothness, use a curvature-continuous blend",
      "For general products, G2 is the minimum for smoothness, and automotive Class-A is often G3. Check from several angles",
    ],
  ),
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {s.zebra ? t("斑马纹", "Zebra stripes") : t("着色", "Shaded")}
      </SceneChip>
      {s.step !== 2 && s.step !== 0 && <SceneChip tone="primary">{BLEND_LABEL[s.blend]}</SceneChip>}
      {s.step === 2 && (
        <SceneChip tone="primary">
          {t("样件", "Sample")} {s.sample + 1}
        </SceneChip>
      )}
    </div>
  ),
}

export default lesson
