import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { isTight, SweepLoftScene, type SweepLoftState } from "./sweep-loft.scene"
import type { LessonDef } from "./types"

/** 1.2.8 「扫掠与放样」: profile + path; sections + start-point alignment + guide curves. */
const fmt = (n: number) => (n >= 100 ? "∞" : n.toFixed(n < 10 ? 1 : 0))

const lesson: LessonDef<SweepLoftState, SweepLoftScene> = {
  id: "sweep-loft",
  codes: ["1.2.8"],
  title: t("扫掠与放样", "Sweep and loft"),
  create: (v, emit) => new SweepLoftScene(v, emit),
  steps: [
    {
      title: t("扫掠：截面沿路径走", "Sweep: a profile follows a path"),
      body: byLocale(
        <>
          <p>扫掠要两样东西：一个闭合的截面，一条路径。截面沿路径走一遍，扫过的空间就是实体。把手、管子、线缆、弹簧都这样建。</p>
          <p>默认情况下，截面走到哪里都保持和路径垂直。</p>
        </>,
        <>
          <p>
            A sweep needs two things: a closed profile and a path. The profile travels along the path, and the space it passes through becomes the solid. Handles, pipes, cables
            and springs are all built this way.
          </p>
          <p>By default, the profile stays perpendicular to the path all the way along.</p>
        </>,
      ),
      task: { label: t("把扫掠过程拖到 100%", "Drag the sweep progress to 100%"), done: (s) => s.sweep >= 100 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label={t("扫掠过程", "Sweep progress")} unit="%" value={s.sweep} min={0} max={100} onChange={(v) => c.setSweep(v)} />
          <Button size="sm" variant="secondary" onClick={() => c.playSweep()}>
            <Play />
            {t("播放扫掠", "Play sweep")}
          </Button>
        </div>
      ),
      terms: ["sweep"],
    },
    {
      title: t("改路径，实体跟着走", "Change the path, and the solid follows"),
      body: byLocale(
        <>
          <p>路径就是一张普通草图，这里画在前视基准面上。路径一改，扫掠重新计算。</p>
          <p>截面画在路径起点，所在的平面和路径垂直。</p>
        </>,
        <>
          <p>The path is just an ordinary sketch, drawn here on the Front plane. Change the path, and the sweep recomputes.</p>
          <p>The profile is drawn at the start of the path, on a plane perpendicular to the path.</p>
        </>,
      ),
      task: { label: t("拖动路径上的蓝点，改出一个新形状", "Drag the blue points on the path into a new shape"), done: (s) => s.dragged },
      note: t(
        "截面要放在路径起点、并且垂直于路径。没放对，有的软件会报错，有的会扫出一个歪斜的结果。",
        "The profile has to sit at the start of the path and be perpendicular to it. If it isn't, some packages report an error, and others sweep a skewed result.",
      ),
    },
    {
      title: t("弯太急会自交", "A bend that's too tight self-intersects"),
      body: byLocale(
        <>
          <p>截面靠弯曲内侧的那部分，走过的路比路径本身短。弯得越急，内侧越挤。</p>
          <p>一旦路径的弯曲半径小于截面半径，内侧就会折到自己身上：自交，内核拒绝生成。</p>
        </>,
        <>
          <p>The part of the profile on the inside of a bend travels a shorter distance than the path itself. The tighter the bend, the more the inside gets squeezed.</p>
          <p>Once the path's bend radius is smaller than the profile radius, the inside folds back onto itself: it self-intersects, and the kernel refuses to build it.</p>
        </>,
      ),
      task: { label: t("让路径的最小弯曲半径小于截面半径", "Make the path's tightest bend radius smaller than the profile radius"), done: (s) => s.triedTight },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t(
              "截面半径 7 mm，把路径的弯拉急到弯曲半径只有 4 mm 左右，会怎样？",
              "The profile radius is 7 mm. You tighten the bend in the path until its bend radius is only about 4 mm. What happens?",
            )}
            options={byLocale(
              ["照样扫出来，只是弯处更扁一点", "弯的内侧截面互相穿插，自交失败", "软件自动把弯改大，正常生成"],
              [
                "It still sweeps, just a little flatter at the bend",
                "On the inside of the bend, the profiles pass through each other: it self-intersects and fails",
                "The software opens up the bend by itself and builds it normally",
              ],
            )}
            answer={1}
            explain={t(
              "内侧离弯曲中心只有 4 mm，可截面要往里伸 7 mm，伸过了中心，相邻的截面就互相穿插。CAD 内核不接受自交的实体，这一步会失败。",
              "The center of the bend is only 4 mm from the path, but the profile reaches 7 mm inward, past the center, so neighboring profiles pass through each other. A CAD kernel doesn't accept a self-intersecting solid, so this step fails.",
            )}
            onReveal={() => c.tighten()}
          />
          <div className="mt-4">
            <Readout label={t("最小弯曲半径", "Tightest bend radius")} value={`R${fmt(s.minBend)}`} tone={isTight(s) ? "warning" : undefined} />
            <Readout label={t("截面半径", "Profile radius")} value={`R${fmt(s.radius)}`} />
          </div>
          <ParamSlider className="mt-2 px-0" label={t("截面半径", "Profile radius")} value={s.radius} min={3} max={14} step={0.5} onChange={(v) => c.setRadius(v)} />
          {isTight(s) && (
            <>
              <Hint tone="warning">
                {t(
                  "最小弯曲半径小于截面半径。半透明的是会被拒绝的结果：内侧折叠。SOLIDWORKS、Fusion 在这里都会报自相交。修法：把弯改缓（拖开路径点，或给路径的拐角加大圆角），或者把截面改小。",
                  "The tightest bend radius is smaller than the profile radius. The translucent shape is the result that would be rejected: the inside folds over. SOLIDWORKS and Fusion both report a self-intersection here. To fix it, ease the bend (drag the path points apart, or give the path's corners larger fillets), or make the profile smaller.",
                )}
              </Hint>
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.resetPath()}>
                <RotateCcw />
                {t("恢复路径", "Reset path")}
              </Button>
            </>
          )}
        </>
      ),
      note: t(
        "虚线圆是最急那一处的「密切圆」，它的半径就是弯曲半径。经验上，路径弯曲半径至少取截面半径的 1.5 倍，留出余量。",
        "The dashed circle is the “osculating circle” at the tightest point, and its radius is the bend radius. As a rule of thumb, make the path's bend radius at least 1.5 times the profile radius, to leave a margin.",
      ),
      noteTitle: t("怎么看", "Reading the view"),
    },
    {
      title: t("放样：截面之间过渡", "Loft: blending between profiles"),
      body: byLocale(
        <>
          <p>放样不需要路径，只要两个或更多截面，软件在它们之间生成过渡面。</p>
          <p>这是一个方变圆：底部 40 × 40 的正方形，顶部直径 40 的圆，相距 60 mm。</p>
        </>,
        <>
          <p>A loft needs no path, only two or more profiles; the software creates the transition surfaces between them.</p>
          <p>This is a square-to-round transition: a 40 × 40 square at the bottom and a ⌀40 circle at the top, 60 mm apart.</p>
        </>,
      ),
      task: { label: t("把放样过程拖到 100%", "Drag the loft progress to 100%"), done: (s) => s.loft >= 100 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label={t("放样过程", "Loft progress")} unit="%" value={s.loft} min={0} max={100} onChange={(v) => c.setLoft(v)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.playLoft()}>
              <Play />
              {t("播放放样", "Play loft")}
            </Button>
            <Segmented
              size="sm"
              value={String(s.sections) as "2" | "3"}
              onValueChange={(v) => c.setSections(v === "3" ? 3 : 2)}
              options={[
                { value: "2", label: t("两个截面", "Two profiles") },
                { value: "3", label: t("加中间截面", "Add a middle profile") },
              ]}
              aria-label={t("截面数量", "Number of profiles")}
            />
          </div>
          {s.sections === 3 && (
            <Hint>
              {t(
                "中间加了一个直径 24 的圆：放样光顺地穿过每一个截面，收出一个腰。截面越多，形状越可控。",
                "A ⌀24 circle is added in the middle: the loft passes smoothly through every profile and pinches in at a waist. The more profiles you add, the more control you have over the shape.",
              )}
            </Hint>
          )}
        </div>
      ),
      note: t(
        "只有两个截面、不加起止约束时，侧面基本是直的。想让它鼓起来或收进去，就加中间截面、设起止相切，或者用下一步的引导线。",
        "With only two profiles and no start or end constraints, the sides are basically straight. To make them bulge out or pull in, add a middle profile, set start and end tangency, or use a guide curve, which comes later in this lesson.",
      ),
      noteTitle: t("说明", "Note"),
      terms: ["loft"],
    },
    {
      title: t("起点要对齐", "Line up the start points"),
      body: byLocale(
        <>
          <p>放样把每个截面上的点一一对应连起来，从各自的「起点」开始数。蓝点是起点，虚线是起点之间的连线。</p>
          <p>起点对齐，侧面是顺的；起点错开，连线就斜着绕上去。</p>
        </>,
        <>
          <p>A loft joins the points on each profile one to one, counting from each profile's own “start point”. The blue dots are the start points, and the dashed line joins them.</p>
          <p>With the start points lined up, the sides run straight; offset them, and the connecting lines wind up at a slant.</p>
        </>,
      ),
      task: { label: t("把顶部的起点转开 30° 以上", "Rotate the top start point by 30° or more"), done: (s) => s.triedTwist },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把顶部圆的起点转 90°，其他都不变，放样会怎样？", "You rotate the top circle's start point by 90° and change nothing else. What happens to the loft?")}
            options={byLocale(
              ["没变化：圆怎么转都还是那个圆", "侧面扭起来，像拧过的毛巾", "放样失败，直接报错"],
              ["Nothing: a circle is the same circle however you turn it", "The sides twist, like a wrung-out towel", "The loft fails with an error"],
            )}
            answer={1}
            explain={t(
              "圆的形状没变，但对应关系变了：底部角点要连到转开 90° 的那个点上，每条连线都斜着走，侧面就扭了。软件不会报错，它照做，只是做出来的不是你要的。",
              "The circle's shape hasn't changed, but the correspondence has: each corner at the bottom now connects to a point 90° further round, so every connecting line runs at a slant and the sides twist. The software doesn't report an error. It does what you told it; it's just not what you wanted.",
            )}
            onReveal={() => c.setTwist(90, true)}
          />
          <ParamSlider className="mt-3 px-0" label={t("顶部起点转角", "Top start point rotation")} unit="°" value={s.twist} min={0} max={180} step={5} onChange={(v) => c.setTwist(v)} />
          {s.twist >= 150 && (
            <Hint tone="warning">
              {t(
                "转到接近 180°，每条连线都穿过中轴，中间收成一个点：几何退化，实际软件会生成自交的面或直接失败。",
                "Close to 180°, every connecting line passes through the central axis and the middle shrinks to a point. The geometry degenerates: real software produces self-intersecting faces or simply fails.",
              )}
            </Hint>
          )}
          {s.twist > 0 && s.twist < 150 && (
            <Hint>
              {t(
                "把转角拉回 0，起点重新对齐，侧面就顺了。放样扭了，先检查起点。",
                "Bring the rotation back to 0: the start points line up again, and the sides straighten out. When a loft twists, check the start points first.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "SOLIDWORKS 用绿色的「接头」标出对应点，可以直接拖；其他软件也能指定对应点或起点。原理一样：放样前先看清每个截面的起点在哪。",
        "SOLIDWORKS marks the corresponding points with green “connectors” that you can drag; other packages also let you set corresponding points or start points. The principle is the same: before you loft, check where each profile's start point is.",
      ),
    },
    {
      title: t("引导线：管住中间", "Guide curves: controlling the middle"),
      body: byLocale(
        <>
          <p>截面只管两头，中间怎么走由软件插值。引导线是一条穿过各个截面的曲线，放样的侧面必须沿着它走。</p>
          <p>拖动滑杆，让引导线外凸或内收。这里四个角各有一条相同的引导线，图上只画出一条。</p>
        </>,
        <>
          <p>
            The profiles only control the ends; the software interpolates what happens in between. A guide curve is a curve that passes through every profile, and the sides of the
            loft have to follow it.
          </p>
          <p>Drag the slider to bow the guide curve outward or inward. Each of the four corners has an identical guide curve; only one is drawn.</p>
        </>,
      ),
      task: { label: t("改一次引导线的形状", "Change the shape of the guide curve"), done: (s) => s.triedBulge },
      extra: ({ s, c }) => (
        <ParamSlider
          className="mt-3 px-0"
          label={t("引导线外凸", "Guide curve bulge")}
          value={s.bulge}
          min={-10}
          max={15}
          onChange={(v) => c.setBulge(v)}
          hint={t("负值是内收。截面不变，变的是中间。", "Negative values pull it inward. The profiles stay the same; only the middle changes.")}
        />
      ),
      note: t(
        "引导线必须和每个截面相交，通常交在截面的顶点上，否则放样失败。扫掠也能加引导线，让截面边走边变大小。",
        "A guide curve must intersect every profile, usually at one of the profile's vertices; otherwise the loft fails. Sweeps can take guide curves too, so that the profile changes size as it travels.",
      ),
    },
  ],
  quiz: [
    {
      q: t(
        "扫掠一根半径 6 mm 的管子，路径上有一处弯曲半径只有 4 mm，会怎样？",
        "You sweep a tube with a 6 mm radius along a path that has one bend with a radius of only 4 mm. What happens?",
      ),
      options: byLocale(
        ["正常生成，只是弯处会变扁", "内侧自交，扫掠失败；要把弯改缓或把管子改细", "软件会自动把弯改成 6 mm"],
        [
          "It builds normally, just flattened at the bend",
          "The inside self-intersects and the sweep fails; ease the bend or make the tube thinner",
          "The software changes the bend to 6 mm by itself",
        ],
      ),
      answer: 1,
      explain: t(
        "弯曲半径小于截面半径，内侧截面伸过了弯曲中心，互相穿插。内核不接受自交实体，也不会替你改路径。",
        "The bend radius is smaller than the profile radius, so on the inside the profiles reach past the center of the bend and pass through each other. The kernel doesn't accept a self-intersecting solid, and it won't change the path for you.",
      ),
    },
    {
      q: t("方变圆的放样扭成了麻花，最可能的原因是？", "A square-to-round loft has twisted like a rope. What's the most likely cause?"),
      options: byLocale(
        ["截面数量太少", "两个截面的起点（对应点）没对齐", "两个截面不在平行的平面上"],
        ["Too few profiles", "The start points (corresponding points) of the two profiles don't line up", "The two profiles aren't on parallel planes"],
      ),
      answer: 1,
      explain: t(
        "放样按起点一一对应连线，起点错开，侧面就扭。截面少只会让形状不好控制；截面也不必互相平行。",
        "A loft joins points one to one, counting from the start points, so if the start points are offset, the sides twist. Too few profiles only makes the shape harder to control, and the profiles don't have to be parallel to each other.",
      ),
    },
    {
      q: t("下面哪个零件更适合用放样，而不是扫掠？", "Which of these parts is better built with a loft than with a sweep?"),
      options: byLocale(
        ["一根粗细不变、弯来弯去的线缆", "一个从方口过渡到圆口的通风接头", "一根直的圆轴"],
        ["A cable of constant thickness that winds back and forth", "A ventilation duct fitting that goes from a square opening to a round one", "A straight round shaft"],
      ),
      answer: 1,
      explain: t(
        "截面形状在变、而且没有明确路径，就用放样。粗细不变沿曲线走是扫掠；直的圆轴拉伸或旋转就够了。",
        "When the profile's shape changes and there's no clear path, use a loft. Constant thickness along a curve is a sweep; for a straight round shaft, an extrude or a revolve is enough.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "扫掠 = 截面 + 路径：截面放在路径起点并垂直于路径，路径的弯曲半径要大于截面半径",
      "放样 = 两个以上截面之间过渡：各截面的起点（对应点）不对齐就会扭",
      "截面只管两头，中间的走向用更多截面或引导线来控制",
    ],
    [
      "Sweep = profile + path: the profile sits at the start of the path, perpendicular to it, and the path's bend radius must be larger than the profile radius",
      "Loft = a transition between two or more profiles: if their start points (corresponding points) don't line up, it twists",
      "Profiles only control the ends; control the middle with more profiles or with guide curves",
    ],
  ),
  next: {
    to: "/teardown/mug",
    label: t("马克杯拆解", "Mug teardown"),
    text: t("杯把就是一次扫掠：看截面和路径在真实零件里怎么放。", "The handle is a single sweep: see how the profile and the path are placed in a real part."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      {s.step <= 2 ? (
        <>
          <SceneChip>{t("草图1 路径 · 前视基准面 XZ", "Sketch1 path · Front plane XZ")}</SceneChip>
          <SceneChip tone={isTight(s) ? undefined : "primary"} className={isTight(s) ? "text-destructive" : undefined}>
            {isTight(s) ? t("扫掠失败：自交", "Sweep failed: self-intersection") : t(`扫掠 ${s.sweep}%`, `Sweep ${s.sweep}%`)}
          </SceneChip>
        </>
      ) : (
        <>
          <SceneChip>
            {s.sections} {t("个截面", "profiles")}
          </SceneChip>
          <SceneChip tone="primary">
            {t("放样", "Loft")} {s.loft}%
          </SceneChip>
          {s.step >= 4 && s.twist !== 0 && (
            <SceneChip className="text-warning">
              {t("起点错开", "Start points offset")} {s.twist}°
            </SceneChip>
          )}
        </>
      )}
    </div>
  ),
}

export default lesson
