import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 6.0.1 设计流程：发散与收敛. Figure: two diamonds meeting at x = 160, waists at x = 85 and 235. */

const diamond = (x0: number, x1: number) => {
  const mid = (x0 + x1) / 2
  return (
    <g>
      <path d={`M ${x0} 84 L ${mid} 34 L ${mid} 134 Z`} className="fill-muted" stroke="none" />
      <path d={`M ${x0} 84 L ${mid} 34 L ${x1} 84 L ${mid} 134 Z`} className="text-primary" strokeWidth={1.75} />
      <path d={`M ${mid} 34 V 134`} strokeDasharray="3 3" className="text-faint-foreground" />
    </g>
  )
}

const card: CardDef = {
  code: "6.0.1",
  title: t("设计流程：发散与收敛", "The design process: diverge, then converge"),
  minutes: 4,
  sections: [
    {
      heading: t("两个菱形，四个阶段", "Two diamonds, four stages"),
      body: byLocale(
        <>
          <p>英国设计委员会（Design Council）在 2004 年推出「双钻」模型，把设计过程画成两个菱形。每个菱形先张开、再合拢。张开是发散：多看、多想，先不下结论。合拢是收敛：比较、取舍，做出选择。</p>
          <p>第一个菱形找对问题，第二个菱形找对解法。四个阶段依次是发现、定义、开发、交付。</p>
        </>,
        <>
          <p>
            The UK Design Council introduced the Double Diamond in 2004. It draws the design process as two diamonds. Each one opens and then closes. Opening is divergent thinking: look widely, think widely, hold off on
            conclusions. Closing is convergent thinking: compare, trade off, choose.
          </p>
          <p>The first diamond finds the right problem; the second finds the right solution. The four stages are Discover, Define, Develop and Deliver.</p>
        </>,
      ),
    },
    {
      heading: t("每个阶段交出什么", "What each stage hands over"),
      body: byLocale(
        <ul>
          <li>发现：走进用户的生活，观察、访谈，弄清问题到底是什么，而不是先假定一个。交出观察记录、用户的原话和机会点。</li>
          <li>定义：把发现归纳成要解决的那一个问题，换个角度把挑战说清楚。交出一句问题陈述和一份设计任务书。</li>
          <li>开发：针对这个问题想很多种解法，从别的领域找灵感，和不同的人一起做。交出草图、概念方案和粗糙的原型。</li>
          <li>交付：小范围测试，淘汰行不通的，改进行得通的。交出验证过的方案和交给工程的资料。</li>
        </ul>,
        <ul>
          <li>Discover: spend time with the people affected, watch and listen, and find out what the problem really is instead of assuming it. Hand over: field notes, users' own words, opportunities.</li>
          <li>Define: distil what you found into the one problem to solve, framing the challenge in a new way. Hand over: a problem statement and a design brief.</li>
          <li>Develop: generate many answers to that problem, borrow ideas from elsewhere, and co-design with different people. Hand over: sketches, concepts, rough prototypes.</li>
          <li>Deliver: test at small scale, drop what doesn't work and improve what does. Hand over: a validated design and the material engineering needs.</li>
        </ul>,
      ),
    },
    {
      heading: t("什么时候收敛", "When to converge"),
      body: byLocale(
        <>
          <p>收敛的信号：新的观察和访谈不再带来新东西；团队能用一句话说清问题，而且大家都认同；方案之间的差别已经能用任务书里的标准来比较。</p>
          <ul>
            <li>收敛太早：拿到需求当天就画方案，力气全花在一个没弄清的问题上。</li>
            <li>迟迟不收敛：一直调研、一直出方案，没有东西进入测试。</li>
          </ul>
          <p>每次收敛都要有依据。定义阶段靠研究里的证据，交付阶段靠测试结果，而不是靠谁的嗓门大。</p>
        </>,
        <>
          <p>Signs that it's time to converge: new observations and interviews stop turning up anything new; the team can state the problem in one sentence and everyone agrees; the differences between concepts can be judged against the brief.</p>
          <ul>
            <li>Converging too early: sketching solutions the day the request arrives, so all the effort goes into a problem nobody has understood.</li>
            <li>Never converging: researching and generating forever, with nothing ever reaching a test.</li>
          </ul>
          <p>Every convergence needs grounds: evidence from research in Define, test results in Deliver, not whoever argues loudest.</p>
        </>,
      ),
    },
    {
      heading: t("来回走是常态", "Going back is normal"),
      body: byLocale(
        <>
          <p>设计委员会后来把双钻放进它的「创新框架」，图上画了往回走的箭头：做着做着发现对问题的理解不对，就回到开头。它列出的原则之一就是「反复迭代」。早期做原型、拿去试，本身也可以是发现的一部分。</p>
          <p>双钻画的是思考的节奏，不是工期表。一个项目里会套着很多个小双钻：定一个按键的位置，也要先摆出几种，再挑一种。</p>
        </>,
        <>
          <p>
            The Design Council later placed the Double Diamond inside its Framework for Innovation, whose diagram has arrows going back: when you learn that your understanding of the problem was wrong, you return to the start. One of its listed
            principles is “iterate, iterate, iterate”. Making and testing early ideas can itself be part of discovery.
          </p>
          <p>The Double Diamond shows a rhythm of thinking, not a schedule. A project holds many small diamonds: even placing one button means laying out a few options first, then picking one.</p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={214}
        label={t(
          "双钻图：两个菱形左右相接。第一个菱形是发现和定义，第二个是开发和交付；每个菱形左半张开、右半合拢；下方一条虚线箭头从右端回到左端",
          "The Double Diamond: two diamonds side by side. The first holds Discover and Define, the second Develop and Deliver; each opens on its left half and closes on its right; a dashed arrow below runs from the right end back to the left",
        )}
      >
        {diamond(10, 160)}
        {diamond(160, 310)}
        {[10, 160, 310].map((x) => (
          <g key={x}>
            <path d={`M ${x} 24 V 78`} strokeDasharray="2 3" className="text-faint-foreground" />
            <circle cx={x} cy={84} r={3.5} className="fill-current text-primary" stroke="none" />
          </g>
        ))}
        <T x={4} y={18}>
          {t("挑战", "Challenge")}
        </T>
        <T x={160} y={18} anchor="middle">
          {t("任务书", "Brief")}
        </T>
        <T x={316} y={18} anchor="end">
          {t("方案", "Solution")}
        </T>
        <T x={52} y={89} anchor="middle" className="font-medium">
          {t("发现", "Discover")}
        </T>
        <T x={119} y={89} anchor="middle" className="font-medium">
          {t("定义", "Define")}
        </T>
        <T x={202} y={89} anchor="middle" className="font-medium">
          {t("开发", "Develop")}
        </T>
        <T x={269} y={89} anchor="middle" className="font-medium">
          {t("交付", "Deliver")}
        </T>
        {[
          [49, t("发散", "diverge")],
          [121, t("收敛", "converge")],
          [199, t("发散", "diverge")],
          [271, t("收敛", "converge")],
        ].map(([x, s]) => (
          <T key={x} x={x as number} y={154} anchor="middle" tone="muted">
            {s}
          </T>
        ))}
        <g className="text-faint-foreground">
          <path d="M 300 164 C 290 196, 30 196, 20 166" strokeDasharray="4 3" />
          <path d="M 14 172 L 20 164 L 26 172" />
        </g>
        <T x={160} y={208} anchor="middle" tone="faint">
          {t("测试暴露新问题时，回到前面", "When a test reveals a new problem, go back")}
        </T>
      </Svg>
    ),
    caption: t(
      "每个菱形左半张开（发散，灰色），右半合拢（收敛）。第一个菱形收敛成一份任务书，第二个收敛成一个方案。虚线表示随时可以回头。",
      "Each diamond opens on its left half (diverging, shaded) and closes on its right (converging). The first converges on a brief, the second on a solution. The dashed line means you can go back at any point.",
    ),
    after: 0,
  },
  terms: {},
  quiz: [
    {
      q: t("第一个菱形结束时，最重要的产出是什么？", "What is the most important output when the first diamond closes?"),
      options: byLocale(
        ["一个选定的外观方案", "一句说清要解决什么问题的定义，比如问题陈述或任务书", "一套完整的工程图纸"],
        ["A chosen appearance concept", "A clear statement of the problem to solve, such as a problem statement or a brief", "A complete set of engineering drawings"],
      ),
      answer: 1,
      explain: t(
        "第一个菱形是为了找对问题：发现阶段张开，定义阶段收敛成一句清楚的问题。外观方案是第二个菱形里的事；工程图纸还要更晚。",
        "The first diamond is about finding the right problem: Discover opens it up, Define closes it down to one clear problem. Appearance concepts belong to the second diamond, and engineering drawings come even later.",
      ),
    },
    {
      q: t(
        "客户的需求是「做一个更好用的电钻」。设计师当天就画了 20 个外观方案。按双钻的思路，问题在哪？",
        "The client asks for “a drill that's easier to use”. The designer sketches 20 appearance concepts that same day. By the Double Diamond, what's wrong?",
      ),
      options: byLocale(
        ["没问题，方案越多越好", "跳过了第一个菱形：还没弄清「更好用」指什么，就开始发散解法", "方案太多了，应该只画一个"],
        ["Nothing, the more concepts the better", "It skips the first diamond: they started generating solutions before finding out what “easier to use” means", "Too many concepts; they should draw just one"],
      ),
      answer: 1,
      explain: t(
        "多出方案本身没错，那是第二个菱形的发散。但「更好用」可能是更轻、更安静，也可能是换钻头更快。先观察和访谈用电钻的人，才知道该往哪个方向发散。",
        "Generating many concepts is fine in itself: that is the divergence of the second diamond. But “easier to use” might mean lighter, quieter or faster bit changes. Only by watching and talking to people who use drills do you learn which direction to diverge in.",
      ),
    },
    {
      q: t("测试原型时发现，用户真正的麻烦不是你定义的那个问题。双钻怎么看这件事？", "Testing a prototype shows that users' real trouble isn't the problem you defined. How does the Double Diamond treat this?"),
      options: byLocale(
        ["流程已经走到交付，只能按原计划做完", "这很正常：回到发现或定义，重新理解问题", "说明前面的调研全错了，项目应该取消"],
        ["The process has reached Deliver, so finish as planned", "This is normal: go back to Discover or Define and rethink the problem", "It proves all the earlier research was wrong, so the project should be cancelled"],
      ),
      answer: 1,
      explain: t(
        "设计委员会的框架图专门画了往回走的箭头，原则里也写着反复迭代。早期原型本来就是发现问题的手段之一。越早回头，代价越小。",
        "The Design Council's framework diagram has arrows going back, and its principles include iterating again and again. Early prototypes are one of the ways you discover the problem. The earlier you go back, the less it costs.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "双钻是两次「先发散、再收敛」：第一次找对问题，第二次找对解法",
      "四个阶段各有产出：发现交出洞察，定义交出任务书，开发交出概念和原型，交付交出验证过的方案",
      "收敛要有依据；测试暴露新问题时回到前面，是流程的一部分",
    ],
    [
      "The Double Diamond is diverge-then-converge, twice: first to find the right problem, then to find the right solution",
      "Each stage hands something over: Discover gives insights, Define a brief, Develop concepts and prototypes, Deliver a validated design",
      "Converge on evidence; going back when a test reveals a new problem is part of the process",
    ],
  ),
  sources: [
    { title: "The Double Diamond", publisher: "Design Council", url: "https://www.designcouncil.org.uk/our-resources/the-double-diamond/" },
    { title: "Framework for Innovation", publisher: "Design Council", url: "https://www.designcouncil.org.uk/resources/framework-for-innovation/" },
    { title: "History of the Double Diamond", publisher: "Design Council", url: "https://www.designcouncil.org.uk/resources/the-double-diamond/history-of-the-double-diamond/" },
  ],
  related: { cards: ["6.0.2", "6.0.3", "6.6.1"] },
}

export default card
