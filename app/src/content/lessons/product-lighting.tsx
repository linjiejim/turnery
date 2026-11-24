import { Aperture, Check, Circle, LocateFixed } from "lucide-react"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { LightingScene, fillOk, fillRatio, flat, keyOk, rel, rimOk, shotDistance, type LightName, type LightingState } from "./product-lighting.scene"
import type { LessonDef } from "./types"

/** 6.4.2 「产品摄影的灯光」. */

const NAME: Record<LightName, string> = { key: t("主光", "Key"), fill: t("辅光", "Fill"), rim: t("轮廓光", "Rim") }

function where(s: LightingState, name: LightName) {
  const r = rel(s[name])
  const side = Math.abs(r) < 3 ? t("正面", "front") : r > 0 ? t("右", "right") : t("左", "left")
  return t(`${side} ${Math.round(Math.abs(r))}° · 高 ${s[name].el}°`, `${side} ${Math.round(Math.abs(r))}° · up ${s[name].el}°`)
}

function Lamp({ s, c, name, ok }: { s: LightingState; c: LightingScene; name: LightName; ok?: boolean }) {
  return (
    <div className="mt-3">
      <ParamSlider
        className="px-0"
        label={NAME[name]}
        unit="%"
        value={s[name].i}
        min={0}
        max={100}
        step={5}
        onChange={(v) => c.setIntensity(name, v)}
        hint={
          <span className={ok ? "text-success" : undefined}>
            {where(s, name)}
            {ok ? t(" · 位置合适", " · well placed") : ""}
          </span>
        }
      />
    </div>
  )
}

function Ratio({ s }: { s: LightingState }) {
  const r = fillRatio(s)
  return (
    <div className="mt-2">
      <Readout label={t("光比 主 : 辅", "Ratio key : fill")} value={Number.isFinite(r) ? `${r.toFixed(1)} : 1` : t("无辅光", "no fill")} tone={r >= 2 && r <= 4.01 ? "success" : "warning"} />
    </div>
  )
}

function Focal({ s, c }: { s: LightingState; c: LightingScene }) {
  return (
    <>
      <ParamSlider
        className="mt-3 px-0"
        label={t("焦距（全画幅等效）", "Focal length (full-frame equiv.)")}
        value={s.focal}
        min={18}
        max={200}
        step={1}
        onChange={(v) => c.setFocal(v)}
      />
      <div className="mt-1">
        <Readout label={t("相机到产品", "Camera to product")} value={(shotDistance(s.focal, s.frame) / 1000).toFixed(2)} unit="m" />
      </div>
    </>
  )
}

function Check3({ s }: { s: LightingState }) {
  const rows: [string, boolean][] = [
    [t("主光在侧上方", "Key above and to one side"), keyOk(s)],
    [t("辅光在另一侧，光比 2:1–4:1", "Fill on the other side, 2:1–4:1"), fillOk(s)],
    [t("轮廓光在后上方", "Rim behind and above"), rimOk(s)],
    [t("焦距 70 mm 以上", "Focal length 70 mm or more"), s.focal >= 70],
  ]
  return (
    <ul className="mt-4 space-y-1.5 text-small">
      {rows.map(([k, ok]) => (
        <li key={k} className="flex items-center gap-2">
          {ok ? <Check className="size-4 text-success" /> : <Circle className="size-4 text-faint-foreground" />}
          <span className={ok ? "text-foreground" : "text-muted-foreground"}>{k}</span>
        </li>
      ))}
    </ul>
  )
}

const lesson: LessonDef<LightingState, LightingScene> = {
  id: "product-lighting",
  codes: ["6.4.2"],
  title: t("产品摄影的灯光", "Lighting a product shot"),
  create: (v, emit) => new LightingScene(v, emit),
  steps: [
    {
      title: t("平光：灯就在相机旁边", "Flat light: the lamp sits by the camera"),
      body: byLocale(
        <>
          <p>现在只有一盏灯，在相机旁边正着打。每个面都差不多亮，影子躲在产品背后：看不出圆柱是圆的，像一张剪纸。</p>
          <p>主光挪到侧上方，一边亮、一边暗，明暗过渡就把形体告诉了看的人。灯的手柄可以拖，它沿着产品周围的一个球面走。</p>
        </>,
        <>
          <p>There is just one light, shining straight on from beside the camera. Every face is about equally bright and the shadow hides behind the product: you can't tell the cylinder is round. It looks like a paper cut-out.</p>
          <p>Move the key light above and to one side, so one side is lit and the other falls off: that gradient tells the viewer the form. Drag a light's handle; it slides over a sphere around the product.</p>
        </>,
      ),
      task: { label: t("把主光拖进虚线框：侧上方", "Drag the key light into a dashed zone, above and to one side"), done: keyOk },
      extra: ({ s, c }) => (
        <>
          <Lamp s={s} c={c} name="key" ok={keyOk(s)} />
          {flat(s) && <Hint>{t("主光离相机太近，画面是平的。", "The key is too close to the camera, so the picture is flat.")}</Hint>}
        </>
      ),
    },
    {
      title: t("辅光：把暗面提起来", "Fill: lift the shadow side"),
      body: byLocale(
        <>
          <p>主光一侧亮，另一侧可能黑得看不清细节。辅光放在另一边，低一点、弱一点，只把暗面提起来。</p>
          <p>主光和辅光的亮度比叫光比，常用 2:1 到 4:1：比值大更有戏剧感，比值小更平。</p>
        </>,
        <>
          <p>The key lights one side; the other may go too dark to show detail. Put the fill on the other side, a bit lower and weaker, just to lift the shadows.</p>
          <p>The brightness of the key against the fill is the lighting ratio, typically 2:1 to 4:1: a higher ratio is more dramatic, a lower one flatter.</p>
        </>,
      ),
      task: { label: t("调出 2:1 到 4:1 的光比，辅光在主光的另一侧", "Set a 2:1 to 4:1 ratio with the fill on the side opposite the key"), done: fillOk },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="fill"
            question={t("把辅光调到和主光一样亮，会怎样？", "What happens if the fill is as bright as the key?")}
            options={byLocale(["更立体", "又变平了：两边一样亮，明暗没了", "产品会过曝发白"], ["More three-dimensional", "Flat again: both sides equally bright, no light and shade", "The product blows out to white"])}
            answer={1}
            explain={t(
              "形体靠明暗差表现。两边一样亮，明暗差就没了，和正面平光差不多。辅光只用来把暗面提到看得见细节。",
              "Form is shown by the difference between light and shade. Equal on both sides, the difference is gone, much like flat front light. The fill only lifts the shadows enough to show detail.",
            )}
            onReveal={() => c.matchFill()}
          />
          <Lamp s={s} c={c} name="fill" ok={fillOk(s)} />
          <Lamp s={s} c={c} name="key" ok={keyOk(s)} />
          <Ratio s={s} />
        </>
      ),
    },
    {
      title: t("轮廓光：和背景分开", "Rim light: part from the background"),
      body: byLocale(
        <>
          <p>深色产品在深色背景前，暗面的边缘和背景混在一起，轮廓丢了。</p>
          <p>从产品后上方斜着打一盏灯，只照亮边缘一圈，产品就从背景里跳出来。轮廓光要在产品背后，高一点，别直接照进镜头。</p>
        </>,
        <>
          <p>A dark product in front of a dark background: the edges on the shadow side melt into the background and the outline is lost.</p>
          <p>Aim a light from behind and above so it catches only a thin line around the edge, and the product jumps out from the background. Keep the rim light behind the product and a little high, not shining into the lens.</p>
        </>,
      ),
      task: { label: t("把轮廓光拖到产品后上方，亮度 50 % 以上", "Drag the rim light behind and above the product, at 50 % or more"), done: rimOk },
      extra: ({ s, c }) => (
        <>
          <Lamp s={s} c={c} name="rim" ok={rimOk(s)} />
          {s.rim.i > 0 && Math.abs(rel(s.rim)) < 120 && (
            <Hint tone="warning">{t("它还在产品前面，照亮的是正面。再往后拖。", "It's still in front of the product, lighting the front. Drag it further back.")}</Hint>
          )}
        </>
      ),
    },
    {
      title: t("反光就是灯的样子", "A reflection is the shape of a light"),
      body: byLocale(
        <>
          <p>光滑的顶盖和金属圈像镜子，映出的是周围的灯箱和墙。转动整个影棚，看高光怎么移动、变形。</p>
          <p>好的产品图里，高光是摆出来的：一条干净的长高光顺着形体走；不要的反光用黑卡挡掉。</p>
        </>,
        <>
          <p>The glossy cap and the metal ring work like mirrors and show the softboxes and walls around them. Turn the whole studio and watch the highlights move and change shape.</p>
          <p>In a good product shot, highlights are placed: one clean, long highlight follows the form, and unwanted reflections are blocked with black cards.</p>
        </>,
      ),
      task: { label: t("把影棚转 60° 以上，看顶盖上的高光", "Turn the studio by 60° or more and watch the highlight on the cap"), done: (s) => s.envTurned >= 60 },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label={t("转动影棚", "Turn the studio")} unit="°" value={s.envRot} min={0} max={360} step={5} onChange={(v) => c.setEnvRot(v)} />
      ),
    },
    {
      title: t("焦距：产品照为什么用长焦", "Focal length: why product shots use long lenses"),
      body: byLocale(
        <>
          <p>拖动焦距，相机会同时前后移动，让产品在画面里一样大（推拉变焦）。</p>
          <p>广角要贴得很近：近处的部分显得大，顶面被拉开，背景一下变宽。长焦站得远，透视平缓，比例接近人对产品的印象。所以产品照常用中长焦，全画幅 85 mm 以上很常见。变形其实来自距离，不是镜头本身。</p>
        </>,
        <>
          <p>Drag the focal length. The camera moves back and forth at the same time so the product stays the same size in frame (a dolly zoom).</p>
          <p>
            A wide lens has to get very close: nearer parts look bigger, the top opens up, and the background suddenly widens. A long lens stands back, the perspective is gentle, and
            the proportions match how people think of the product. That's why product shots favor medium-long lenses; 85 mm and up on full frame is common. The distortion really
            comes from the distance, not from the lens itself.
          </p>
        </>,
      ),
      task: { label: t("试一次 28 mm 以下，再试一次 85 mm 以上", "Try 28 mm or wider, then 85 mm or longer"), done: (s) => s.triedWide && s.triedLong },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="lens"
            question={t("从 24 mm 换到 135 mm，产品保持一样大，会怎样？", "Going from 24 mm to 135 mm with the product kept the same size. What changes?")}
            options={byLocale(["看起来完全一样", "透视变平：顶面变扁，背景收窄", "产品更扭曲"], ["Nothing at all", "The perspective flattens: the top looks shallower and less background shows", "The product looks more distorted"])}
            answer={1}
            explain={t(
              "产品一样大，但相机从十几厘米退到一米多。离得远，前后部分到相机的距离差得少，近大远小就弱了；视角窄，背景也只剩一小块。",
              "The product stays the same size, but the camera backs off from a few inches to over a meter. From far away the front and back are at nearly the same distance, so near-large-far-small fades; the narrow view also leaves only a small patch of background.",
            )}
            onReveal={() => c.dollyZoom(24, 135)}
          />
          <Focal s={s} c={c} />
        </>
      ),
    },
    {
      title: t("自己布一次光", "Light it yourself"),
      body: byLocale(
        <>
          <p>灯光回到了起点。按顺序来：先定主光，再补辅光，然后加轮廓光，最后换一个长一点的焦距。</p>
          <p>每加一盏灯，都先想清楚它要解决什么：形体、暗面、还是轮廓。</p>
        </>,
        <>
          <p>The lights are back where they started. Work in order: place the key, add the fill, then the rim, and finally switch to a longer lens.</p>
          <p>Before adding each light, be clear what it is for: the form, the shadow side, or the outline.</p>
        </>,
      ),
      task: { label: t("四项都打勾", "Tick all four"), done: (s) => keyOk(s) && fillOk(s) && rimOk(s) && s.focal >= 70 },
      extra: ({ s, c }) => (
        <>
          <Check3 s={s} />
          <Lamp s={s} c={c} name="key" ok={keyOk(s)} />
          <Lamp s={s} c={c} name="fill" ok={fillOk(s)} />
          <Ratio s={s} />
          <Lamp s={s} c={c} name="rim" ok={rimOk(s)} />
          <Focal s={s} c={c} />
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("深色耳机放在深色背景前，边缘和背景糊在一起。先加哪盏灯？", "Dark headphones in front of a dark background: the edges blur into it. Which light do you add first?"),
      options: byLocale(
        ["再加一盏正面灯", "从后上方打一盏轮廓光", "把辅光调到和主光一样亮"],
        ["Another light from the front", "A rim light from behind and above", "Raise the fill to match the key"],
      ),
      answer: 1,
      explain: t(
        "轮廓光从背后照亮边缘一圈，把产品和背景分开。正面再加灯只会更平；辅光太亮也一样。",
        "A rim light from behind outlines the edge and separates the product from the background. More front light only flattens it, and so does a fill as bright as the key.",
      ),
    },
    {
      q: t("产品照为什么常用中长焦站远拍，而不是广角贴近拍？", "Why are product shots usually taken from further back with a medium-long lens instead of close up with a wide one?"),
      options: byLocale(
        ["长焦镜头画质更好", "站得远，透视平缓，产品比例不被夸张", "广角对不上焦"],
        ["Long lenses are sharper", "From further back the perspective is gentle and the proportions aren't exaggerated", "Wide lenses can't focus"],
      ),
      answer: 1,
      explain: t(
        "透视变形由相机到产品的距离决定。广角要贴近才能拍到同样大，近大远小就被放大了；长焦让你站远。",
        "Perspective distortion depends on the distance from the camera to the product. A wide lens has to get close to fill the frame, which exaggerates near-large-far-small; a long lens lets you stand back.",
      ),
    },
    {
      q: t("主光放在相机旁边正对产品，结果通常是？", "With the key light right beside the camera, facing the product, what do you usually get?"),
      options: byLocale(["形体最清楚", "画面平，看不出体积", "轮廓最清楚"], ["The clearest form", "A flat picture with no sense of volume", "The clearest outline"]),
      answer: 1,
      explain: t(
        "正面光让看得见的面都差不多亮，影子落在产品背后，没有明暗过渡，体积就出不来。主光要偏到侧上方。",
        "Front light makes every visible face about equally bright and drops the shadow behind the product. With no gradient from light to shade, there is no volume. Move the key above and to the side.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "主光放在侧上方定形体，辅光在另一侧把暗面提起来，光比常用 2:1 到 4:1",
      "轮廓光从后上方把产品和背景分开；光滑面上的高光是灯的倒影，要摆",
      "产品照用中长焦站远拍：透视变形来自距离，不是焦距本身",
    ],
    [
      "The key goes above and to one side to show the form; the fill lifts the shadow side from the other side, typically at 2:1 to 4:1",
      "A rim light from behind and above separates the product from the background; highlights on glossy faces are reflections of lights and need placing",
      "Shoot products from further back with a medium-long lens: perspective distortion comes from distance, not from the focal length itself",
    ],
  ),
  next: {
    to: "/lesson/materials-finishes",
    label: t("材质与表面处理", "Materials and finishes"),
    text: t("同一盏灯，在高光、哑光、拉丝和咬花上各是什么样。", "The same light on gloss, matte, brushed metal and texture."),
  },
  overlay: ({ s, c }) => (
    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>
        <Aperture />
        {s.focal} mm · {(shotDistance(s.focal, s.frame) / 1000).toFixed(2)} m
      </SceneChip>
      {(["key", "fill", "rim"] as LightName[]).map((n) => {
        const ok = n === "key" ? keyOk(s) : n === "fill" ? fillOk(s) : rimOk(s)
        return (
          <SceneChip key={n} tone={ok ? "primary" : undefined}>
            {ok ? <Check /> : <Circle />}
            {NAME[n]} {s[n].i}%
          </SceneChip>
        )
      })}
      <button type="button" className="pointer-events-auto" onClick={() => c.shot(true)} title={t("回到机位", "Back to the camera position")}>
        <SceneChip>
          <LocateFixed />
        </SceneChip>
      </button>
    </div>
  ),
}

export default lesson
