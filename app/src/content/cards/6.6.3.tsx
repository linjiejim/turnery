import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 6.6.3 包装与开箱. Figure: a section through a carton, all paper: quick-start card on top, product held at both ends by molded pulp, accessory tray below. */

const leader = (x1: number, y1: number, x2: number, y2: number) => <path d={`M ${x1} ${y1} L ${x2} ${y2}`} strokeWidth={0.75} className="text-faint-foreground" />

const card: CardDef = {
  code: "6.6.3",
  title: t("包装与开箱", "Packaging and unboxing"),
  minutes: 4,
  sections: [
    {
      heading: t("先把产品保护好", "First, protect the product"),
      body: byLocale(
        <>
          <p>从工厂到用户手里，包装要经历搬运时的跌落、车上的振动、仓库里一层层堆码的压力，还有高温高湿。</p>
          <ul>
            <li>跌落：缓冲件在撞击时变形，让产品慢一点停下来，冲击就小了。产品最弱的地方，比如屏幕、凸出的旋钮和角，不能直接顶着箱壁，四周要留出缓冲件变形的空间。</li>
            <li>压力：纸箱要撑得住上面堆的箱子。缓冲件也要托住产品，不能让重量压在易碎的部位。</li>
          </ul>
          <p>
            包装要按标准测过才算数。中国有 GB/T 4857 系列，比如 GB/T 4857.5 跌落、GB/T 4857.4 抗压和堆码。国际安全运输协会（ISTA）的程序分系列：1 系列是基础的强度测试；3 系列模拟真实的运输过程，包括不同高度的跌落、随机振动和温湿度预处理；6 系列是大型零售商和承运商的专用测试，比如亚马逊。
          </p>
        </>,
        <>
          <p>On its way from the factory to the user, a package is dropped while being handled, shaken on trucks, squeezed under the stacks of boxes in warehouses, and exposed to heat and humidity.</p>
          <ul>
            <li>
              Drops: the cushioning deforms on impact so the product stops more slowly, which reduces the shock. The product's weakest points, such as a screen, a protruding knob or a corner, mustn't press directly against the box wall:
              leave room around them for the cushioning to deform.
            </li>
            <li>Compression: the carton has to hold up the boxes stacked on top of it, and the cushions have to carry the product without loading its fragile parts.</li>
          </ul>
          <p>
            A package only counts once it has been tested to a standard. China has the GB/T 4857 series, such as GB/T 4857.5 for drops and GB/T 4857.4 for compression and stacking. The International Safe Transit Association (ISTA)
            organizes its procedures in series: the 1 series are basic integrity tests; the 3 series simulate real shipping, with drops from different heights, random vibration and temperature and humidity conditioning; the 6 series are
            tests for specific large retailers and carriers, such as Amazon.
          </p>
        </>,
      ),
    },
    {
      heading: t("开箱的顺序就是使用的顺序", "Unboxing follows the order of use"),
      body: byLocale(
        <>
          <p>开箱是用户第一次真正接触产品。从看到盒子、打开、取出、安装，到第一次用起来，合称开箱体验。第一次用就出问题，叫开箱故障，对品牌伤害很大。</p>
          <ul>
            <li>打开先看到产品本身，或者一张快速上手卡。第一步要做的事，比如撕保护膜、装电池、充电、配对，放在最显眼的地方，用图示，少用长文字。</li>
            <li>配件按用到的先后分层放，盒子里每样东西都有固定的位置。</li>
            <li>不用工具就能打开；取出产品时手有地方抓，比如拉带或指槽，不用把盒子倒过来摇。</li>
            <li>运输固定件和绝缘片要一眼就能看到，并写明怎么拆。忘了拆，就是开箱故障。</li>
          </ul>
        </>,
        <>
          <p>
            Unboxing is the user's first real contact with the product. Seeing the box, opening it, taking things out, setting up and using it for the first time together make up the out-of-box experience. A failure at first use is an
            out-of-box failure, and it does real damage to a brand.
          </p>
          <ul>
            <li>Opening the box should reveal the product itself, or a quick-start card. Put the first thing to do, such as peeling a film, fitting batteries, charging or pairing, where it can't be missed, shown in pictures rather than long text.</li>
            <li>Layer the accessories in the order they're needed, with a fixed place for everything in the box.</li>
            <li>It should open without tools, and the product should have something to grab, such as a pull tab or finger recess, so nobody has to turn the box upside down and shake it.</li>
            <li>Transit locks and insulating tabs must be visible at a glance, with instructions for removing them. Forget to remove one, and you have an out-of-box failure.</li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("少用塑料，一种材料", "Less plastic, one material"),
      body: byLocale(
        <>
          <p>能回收的前提是能分开。覆了塑料膜的纸盒、粘在纸托上的泡沫，回收时很难把材料分开。所以一个包装尽量只用一种材料；非用不可时，让用户能徒手把不同材料拆开。塑料包装回收的设计指南 RecyClass 也把优先单一材料、少用颜色和印刷列为基本原则。</p>
          <p>
            这已经能做到。苹果公司 2026 年 4 月宣布，它的包装已在 2025 年全部改为纤维材料（油墨、涂层和胶不计），用纸做的屏幕保护片和托盘代替了塑料。法规也在推：欧盟包装法规 (EU)&nbsp;2025/40 从 2026 年 8 月起普遍适用，目标是 2030 年前市场上的包装都能以经济可行的方式回收。
          </p>
        </>,
        <>
          <p>
            Recycling starts with separating. A carton laminated with plastic film, or foam glued to a paper tray, is hard to pull apart into its materials. So keep each package to a single material where you can, and where you can't, let
            the user separate the materials by hand. RecyClass, a design guide for recyclable plastic packaging, likewise lists favoring mono-material and using less color and print among its basic principles.
          </p>
          <p>
            It can be done. In April 2026 Apple announced that its packaging had become 100% fiber-based during 2025 (excluding inks, coatings and adhesives), with paper screen protectors and trays replacing plastic. Regulation is pushing
            too: the EU's Packaging and Packaging Waste Regulation, (EU)&nbsp;2025/40, has applied generally since August 2026 and aims for all packaging on the market to be recyclable in an economically viable way by 2030.
          </p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={186}
        label={t(
          "包装剖面：纸箱最上面是快速上手卡，中间是产品，两端由纸浆模塑缓冲件托住，最下面是配件盒；数字 1、2、3 是打开后看到的顺序",
          "Section through a package: a quick-start card on top, the product in the middle held at both ends by molded pulp cushions, and an accessory tray at the bottom; numbers 1, 2 and 3 give the order things are seen on opening",
        )}
      >
        <defs>
          <pattern id="card-663-pulp" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
        </defs>
        {/* 外箱：瓦楞纸，壁厚 5 */}
        <path fillRule="evenodd" className="fill-muted" stroke="none" d="M 10 24 H 170 V 174 H 10 Z M 15 29 H 165 V 169 H 15 Z" />
        <rect x={10} y={24} width={160} height={150} strokeWidth={1.75} />
        <rect x={15} y={29} width={150} height={140} strokeWidth={0.75} />
        {/* 1 快速上手卡 */}
        <rect x={19} y={34} width={142} height={6} rx={1} className="fill-background text-primary" strokeWidth={1.25} />
        {/* 纸浆模塑缓冲件，托住产品两端 */}
        <rect x={19} y={48} width={38} height={72} rx={4} fill="url(#card-663-pulp)" />
        <rect x={123} y={48} width={38} height={72} rx={4} fill="url(#card-663-pulp)" />
        {/* 2 产品 */}
        <rect x={45} y={58} width={90} height={52} rx={9} className="fill-background text-primary" strokeWidth={1.75} />
        <path d="M 58 84 H 122" strokeWidth={0.75} className="text-muted-foreground" />
        {/* 3 配件盒 */}
        <rect x={19} y={128} width={142} height={37} rx={2} />
        <path d="M 90 128 V 165" />
        <circle cx={54} cy={146.5} r={10} />
        <circle cx={54} cy={146.5} r={5} />
        <rect x={113} y={137} width={24} height={19} rx={3} />
        {/* 标注 */}
        {leader(180, 37, 163, 37)}
        <T x={184} y={41}>
          {t("① 快速上手卡", "① Quick-start card")}
        </T>
        {leader(180, 72, 131, 72)}
        <T x={184} y={76}>
          {t("② 产品", "② Product")}
        </T>
        {leader(180, 108, 152, 108)}
        <T x={184} y={112}>
          {t("纸浆模塑缓冲件", "Molded pulp cushion")}
        </T>
        {leader(180, 146, 140, 146)}
        <T x={184} y={150}>
          {t("③ 配件", "③ Accessories")}
        </T>
        {leader(180, 172, 168, 172)}
        <T x={184} y={176}>
          {t("瓦楞纸外箱", "Corrugated carton")}
        </T>
        <T x={10} y={16} tone="muted">
          {t("剖面", "Section")}
        </T>
      </Svg>
    ),
    caption: t(
      "打开盒盖，先看到快速上手卡，再看到产品，配件在最下层。产品只在两端被缓冲件托住，四周留出空间。整个包装都是纸，用户不用分拣就能一起回收。",
      "Open the lid and the quick-start card comes first, then the product, with the accessories underneath. The product is held only at its ends, with space all round. The whole package is paper, so it can all go into recycling together without sorting.",
    ),
    after: 1,
  },
  terms: {},
  quiz: [
    {
      q: t("一个包装方案：纸盒外面覆了塑料膜，里面是粘在纸托上的泡沫。从回收的角度看，主要问题是？", "A packaging design: a carton laminated with plastic film, and foam glued to a paper tray inside. From a recycling point of view, what's the main problem?"),
      options: byLocale(
        ["纸用得太多了", "不同材料粘在一起，很难分开，会影响回收", "没有问题，纸和塑料都能回收"],
        ["It uses too much paper", "Different materials are stuck together and hard to separate, which gets in the way of recycling", "No problem: paper and plastic are both recyclable"],
      ),
      answer: 1,
      explain: t(
        "回收是按材料分开处理的。纸和塑料粘在一起，就很难各自回收。改成单一材料，或者让不同材料能徒手拆开。",
        "Recycling processes each material separately. Paper and plastic bonded together are hard to recycle as either. Switch to a single material, or make the materials separable by hand.",
      ),
    },
    {
      q: t("包装件做完跌落测试，产品没坏。还需要关心什么？", "The packaged product passes a drop test undamaged. What else should you care about?"),
      options: byLocale(
        ["不需要了，跌落是运输中唯一的风险", "还有振动、堆码压力和温湿度；运输测试程序通常把它们组合起来，比如 ISTA 3 系列", "再把泡沫加厚一倍就够了"],
        ["Nothing: drops are the only risk in shipping", "Vibration, stacking loads and temperature and humidity too; transit test procedures usually combine them, as the ISTA 3 series does", "Doubling the foam thickness is enough"],
      ),
      answer: 1,
      explain: t(
        "运输中不只有跌落。ISTA 3 系列把不同高度的跌落、随机振动和温湿度预处理组合起来；GB/T 4857 也分别规定了跌落、振动、抗压和堆码的试验方法。盲目加厚缓冲件只会增加材料和体积。",
        "Shipping isn't only drops. The ISTA 3 series combines drops from different heights, random vibration and temperature and humidity conditioning; GB/T 4857 likewise has separate methods for drops, vibration, compression and stacking. Thickening the cushioning blindly only adds material and volume.",
      ),
    },
    {
      q: t(
        "新买的设备第一次开机就报错，原因是运输固定螺钉没拆，拆卸说明在说明书第 12 页。怎么改最好？",
        "A new appliance throws an error the first time it's switched on, because the transit screw wasn't removed; the instructions are on page 12 of the manual. What's the best fix?",
      ),
      options: byLocale(
        ["这是用户自己的问题，不用改", "让固定件醒目、开箱第一眼就能看到，并把拆它写成快速上手卡的第一步", "把说明书写得更详细"],
        ["It's the user's fault; nothing to change", "Make the lock conspicuous and the first thing seen on opening, and make removing it step one on the quick-start card", "Make the manual more detailed"],
      ),
      answer: 1,
      explain: t(
        "第一次使用就出问题，是开箱故障，对品牌伤害很大。用户很少读完说明书。开箱的顺序就是使用的顺序：第一步要做的事，放在第一眼能看到的地方。",
        "A problem at first use is an out-of-box failure, and it does real damage to a brand. Few users read the whole manual. Unboxing follows the order of use: the first thing to do goes where it's seen first.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "包装要扛住跌落、振动、堆码和温湿度变化，按 GB/T 4857 或 ISTA 的程序验证",
      "开箱顺序按使用顺序排：先看到产品和第一步提示，运输固定件一眼能找到",
      "少用塑料，一个包装尽量一种材料；不同材料要能徒手分开",
    ],
    [
      "Packaging must survive drops, vibration, stacking and heat and humidity; verify it with GB/T 4857 or ISTA procedures",
      "Arrange unboxing in the order of use: the product and the first step come first, and transit locks are obvious",
      "Use less plastic and, where you can, one material per package; different materials must come apart by hand",
    ],
  ),
  sources: [
    { title: "Test Procedures", publisher: "ISTA", url: "https://ista.org/test_procedures.php" },
    {
      title: "GB/T 4857.5-1992 包装 运输包装件 跌落试验方法",
      publisher: t("国家标准全文公开系统", "SAMR national standards portal"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=66377410B6B8E86D7D41BB4CE7D36D5D",
    },
    {
      title: "GB/T 4857.4-2008 包装 运输包装件基本试验 第4部分：采用压力试验机进行的抗压和堆码试验方法",
      publisher: t("国家标准全文公开系统", "SAMR national standards portal"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=FEC62B5F9A0E7B1848E7D809452C7AC1",
    },
    { title: "Out-of-box experience", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Out-of-box_experience" },
    { title: "RecyClass Design Book (March 2026)", publisher: "RecyClass", url: "https://recyclass.eu/wp-content/uploads/2026/03/RecyClass-Design-Book-March-2026-fv.pdf" },
    {
      title: "Apple accelerates progress with highest-ever recycled material in its products",
      publisher: "Apple Newsroom",
      url: "https://www.apple.com/newsroom/2026/04/apple-accelerates-progress-with-highest-ever-recycled-material-in-its-products/",
    },
    { title: "Packaging waste", publisher: t("欧盟委员会", "European Commission"), url: "https://environment.ec.europa.eu/topics/waste-and-recycling/packaging-waste_en" },
  ],
  related: { cards: ["6.6.1", "6.6.2"] },
}

export default card
