import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 6.6.1 原型的保真度. */

const card: CardDef = {
  code: "6.6.1",
  title: t("原型的保真度：按问题选原型", "Prototype fidelity"),
  minutes: 4,
  sections: [
    {
      heading: t("原型是用来回答问题的", "A prototype answers a question"),
      body: byLocale(
        <>
          <p>做原型之前，先写下它要回答哪个问题。苹果公司的 Houde 和 Hill 在 1997 年把原型要回答的问题分成三类：这东西在用户生活里起什么作用；看起来、摸起来怎样；里面怎么实现。同时回答三类问题的，叫整合原型。</p>
          <p>硬件团队的叫法和它对得上：外观样机（looks-like）回答好不好看，功能样机（works-like）回答能不能实现，手感模型（feels-like）回答大小、重量、握感。另外还有结构样机，专门验证卡扣、壁厚、装配和跌落。</p>
        </>,
        <>
          <p>
            Before you build a prototype, write down the question it has to answer. In 1997 Houde and Hill, at Apple, sorted the questions prototypes answer into three kinds: what role the thing plays in the user's life; how it looks and feels;
            and how it works inside. A prototype that answers all three at once they called an integration prototype.
          </p>
          <p>
            Hardware teams' terms map onto this: a looks-like prototype answers whether it looks right, a works-like prototype whether it can be made to work, and a feels-like model questions of size, weight and grip. There are also
            structural prototypes, built to check snap fits, wall thickness, assembly and drops.
          </p>
        </>,
      ),
    },
    {
      heading: t("保真度不是一个旋钮", "Fidelity isn't a single dial"),
      body: byLocale(
        <>
          <p>保真度指原型和最终产品有多接近。它分维度：外观可以很真，里面却是空的；电路可以全部能用，外壳却是一个纸盒。Houde 和 Hill 还提醒：原型看起来多完整，不代表设计有多成熟。</p>
          <p>越真越贵、越慢。粗糙的原型改起来快，做的人不心疼扔，看的人也更敢提意见。精致的样机容易让大家只评颜色和表面，而且一旦做出来，谁都不舍得推翻。所以保真度够回答眼前的问题就停，不必更高。</p>
        </>,
        <>
          <p>
            Fidelity is how close a prototype is to the final product, and it has dimensions: the outside can be very real while the inside is empty; the circuit can work completely inside a cardboard box. Houde and Hill also warn that how
            finished a prototype looks says nothing about how settled the design is.
          </p>
          <p>
            More real means more cost and more time. A rough prototype is quick to change, painless to throw away, and people feel freer to criticize it. A polished model tends to get comments only on color and surface, and once it exists,
            nobody wants to overturn it. So stop at the fidelity that answers the question in front of you.
          </p>
        </>,
      ),
    },
    {
      heading: t("常见的坑", "Common traps"),
      body: byLocale(
        <ul>
          <li>拿外观样机问「好不好用」：它不能工作，用户只能想象，答案不可靠。</li>
          <li>用 3D 打印件的结果代替量产件：打印件的材料和内部结构（层纹、填充）都和注塑件不同，强度和跌落结果只能作参考。</li>
          <li>太早把外观和功能合到一起：先分开验证，各自定下来再合，合的时候常会发现电路板装不进那个薄外壳，这正是工程样机要解决的。</li>
          <li>给人看原型不说清目的：先告诉对方这个原型要回答什么、不回答什么。</li>
        </ul>,
        <ul>
          <li>Asking “is it easy to use?” of a looks-like model: it doesn't work, so users can only imagine, and the answers are unreliable.</li>
          <li>Treating 3D-printed results as production results: the material and internal structure (layer lines, infill) differ from a molded part, so strength and drop results are only indicative.</li>
          <li>
            Merging looks-like and works-like too early: prove each separately, settle them, then combine. Combining is often when you find the board won't fit the slim shell, which is exactly what the engineering prototype is for.
          </li>
          <li>Showing a prototype without saying what it's for: tell people first which questions it answers and which it doesn't.</li>
        </ul>,
      ),
    },
  ],
  table: {
    caption: t("按问题选原型", "Pick the prototype by the question"),
    head: byLocale(["要回答的问题", "原型", "常见做法"], ["Question", "Prototype", "Typical build"]),
    rows: byLocale(
      [
        ["拿在手里大小、重量、握感合不合适", "手感模型", "泡沫或 3D 打印的实心块，加配重到目标重量和重心"],
        ["比例、颜色、表面好不好看", "外观样机", "3D 打印或 CNC 后打磨、喷漆，不能工作"],
        ["电路、传感器、电机能不能实现功能", "功能样机", "开发板加面包板，装在任何放得下的盒子里"],
        ["卡扣扣不扣得上，壁厚够不够，摔了会不会裂", "结构样机", "3D 打印或 CNC，尽量用接近量产的材料和壁厚"],
        ["外观和功能能不能装进同一个壳，能不能量产", "工程样机", "按量产意图选材料和工艺，做一小批"],
      ],
      [
        ["Is the size, weight and grip right in the hand?", "Feels-like model", "Foam or a solid 3D print, weighted to the target mass and center of gravity"],
        ["Do the proportions, colors and surfaces look right?", "Looks-like model", "3D printed or CNC machined, then sanded and painted; doesn't work"],
        ["Can the circuit, sensors and motors do the job?", "Works-like prototype", "Dev boards and breadboards in whatever box they fit"],
        ["Do the snaps engage, is the wall thick enough, does it crack when dropped?", "Structural prototype", "3D printed or CNC machined, in materials and wall thicknesses as close to production as possible"],
        ["Do looks and function fit in one housing, and can it be mass-produced?", "Engineering prototype", "Production-intent materials and processes, a small batch"],
      ],
    ),
    after: 0,
    note: t(
      "越往下越接近最终产品，也越贵、越慢。工程样机之后，量产前还有设计验证和生产验证几轮。",
      "Further down the table means closer to the final product, and more cost and time. After the engineering prototype come further rounds of design and production validation before mass production.",
    ),
  },
  terms: {},
  quiz: [
    {
      q: t("你想知道一款手持吸尘器握久了累不累。最先做哪种原型？", "You want to know whether a handheld vacuum gets tiring to hold. Which prototype do you build first?"),
      options: byLocale(
        ["CNC 加工、喷了漆的外观样机", "配重到目标重量、重心位置对的手感模型", "电机和电池都能工作的功能样机"],
        ["A CNC-machined, painted looks-like model", "A feels-like model weighted to the target mass with the center of gravity in the right place", "A works-like prototype with a working motor and battery"],
      ),
      answer: 1,
      explain: t(
        "累不累取决于重量、重心和握把形状。泡沫或 3D 打印件加配重块就能试，几天里能做好几个版本。外观样机的钱花在表面上；功能样机的零件布置还没定，重心往往和最终产品不同。",
        "Tiredness depends on weight, center of gravity and handle shape. Foam or a 3D print with added weights lets you test that, and you can make several versions in a few days. A looks-like model spends its money on the surface; a works-like prototype's layout isn't settled, so its center of gravity often differs from the final product.",
      ),
    },
    {
      q: t("评审一个很精致的外观样机时，大家只说了「颜色再亮一点」。这说明什么？", "At a review of a very polished looks-like model, the only comment is “make the color brighter”. What does that suggest?"),
      options: byLocale(
        ["设计已经没有大问题了", "样机太精致，把大家引向了表面；想问结构或用法，应该用更粗糙的原型，或者先说清要评什么", "应该换一批评审的人"],
        [
          "The design has no big problems left",
          "The model is so polished it steered everyone to the surface; to ask about structure or use, show something rougher, or say first what you want judged",
          "You need different reviewers",
        ],
      ),
      answer: 1,
      explain: t(
        "越完整的原型，人越倾向于评论表面，也越不好意思提大的意见。Houde 和 Hill 建议：给人看原型之前，先说清它要回答什么、不回答什么。",
        "The more finished a prototype looks, the more people comment on the surface, and the less comfortable they are raising big objections. Houde and Hill advise saying, before you show a prototype, which questions it answers and which it doesn't.",
      ),
    },
    {
      q: t("用 3D 打印的外壳做跌落测试，没有裂。能说量产的注塑件也不会裂吗？", "A 3D-printed housing survives a drop test without cracking. Can you say the molded production part won't crack either?"),
      options: byLocale(
        ["能，形状一样结果就一样", "不能直接下结论：材料和内部结构都不同，只能作参考，要用接近量产的样机再验证", "能，打印件一定比注塑件弱"],
        [
          "Yes: same shape, same result",
          "Not directly: the material and internal structure differ, so it's only indicative and needs confirming on a production-like prototype",
          "Yes: printed parts are always weaker than molded ones",
        ],
      ),
      answer: 1,
      explain: t(
        "打印件有层纹和填充，材料也常和量产料不同，有的地方比注塑件弱，有的地方不一定。结构结论最终要用接近量产的材料和工艺来验证，比如工程样机。",
        "Printed parts have layer lines and infill, and often a different material from production; they're weaker than molded parts in some ways but not necessarily in all. Structural conclusions have to be confirmed with production-like materials and processes, such as an engineering prototype.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先写下原型要回答的问题，再决定做什么原型",
      "外观、功能、手感、结构可以分开验证；保真度够回答问题就停",
      "越粗糙越快、越便宜，人也越敢提意见；各自定下来后，再合成工程样机",
    ],
    [
      "Write down the question first, then decide what prototype to build",
      "Looks, function, feel and structure can be tested separately; stop at the fidelity that answers the question",
      "Rougher is faster, cheaper and invites more honest criticism; once each part is settled, combine them in an engineering prototype",
    ],
  ),
  sources: [
    {
      title: "What do Prototypes Prototype? (Handbook of Human-Computer Interaction, 1997)",
      publisher: "Stephanie Houde, Charles Hill",
      url: "https://survivinghci.com/content/readings/what-do-prototypes-prototype/source.pdf",
    },
    { title: "UX Prototypes: Low Fidelity vs. High Fidelity", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/ux-prototype-hi-lo-fidelity/" },
    { title: "Prototype Stage", publisher: "ClimateTech Hardware Manufacturing Guide", url: "https://learn.forclimatetech.org/prototype-stage/" },
  ],
  related: { lessons: ["print-overhang"], cards: ["6.0.1", "6.0.2", "6.6.2"] },
}

export default card
