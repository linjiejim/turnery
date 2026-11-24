import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 6.0.3 写设计任务书. The example brief is made up for teaching; its numbers are targets, not facts about a real product. */

const card: CardDef = {
  code: "6.0.3",
  title: t("写设计任务书：一页纸说清做什么", "Writing a design brief"),
  minutes: 4,
  sections: [
    {
      heading: t("任务书写要求，不写答案", "A brief states requirements, not answers"),
      body: byLocale(
        <>
          <p>设计任务书写在动手设计之前，说清四件事：为谁做，在什么场景下用，受哪些限制，怎样算成功。它是双钻第一个菱形收敛的结果，也是后面比较方案时用的尺子。</p>
          <p>任务书写要求，不写解法。写「湿着手也能单手拧开」，不写「盖子上加 6 条防滑纹」：后者提前替设计做了决定，还可能写错。要求也别定得过细，同样会把好的解法挡在门外。</p>
          <p>篇幅以一页为宜。写不进一页，往往说明问题还没想清楚。</p>
        </>,
        <>
          <p>
            A design brief is written before design starts and settles four things: who it's for, the situations it's used in, the constraints, and what counts as success. It's what the first diamond of the Double Diamond converges on, and
            the yardstick you later compare concepts against.
          </p>
          <p>
            A brief states requirements, not solutions. Write “opens with one wet hand”, not “six grip ribs on the lid”: the second makes a design decision in advance, and may make it wrongly. Don't over-specify requirements either; that
            shuts out good solutions just the same.
          </p>
          <p>Aim for one page. If it won't fit on one page, the problem often isn't clear yet.</p>
        </>,
      ),
    },
    {
      heading: t("四块内容", "The four parts"),
      body: byLocale(
        <ul>
          <li>目标用户：具体到一类人和他们的处境，不写「所有人」。还要写出其他相关的人：买的人、安装的人、清洁和维修的人，往往不是用的人。</li>
          <li>使用场景：谁，在哪里，手上拿着什么，前后在做什么。比如「厨房里，一只手湿着，另一只手端着锅」。</li>
          <li>约束：目标成本和年产量（产量决定模具费能不能摊开，也就决定了工艺）；工艺和材料；尺寸、重量、电源；要满足的标准和认证；交期。</li>
          <li>成功标准：能检验的数字或事实。「好用」不算，「第一次用的人不看说明书，1 分钟内换好电池」才算。设计委员会的任务书清单建议目标符合 SMART：具体、可衡量、可实现、现实、有时限。</li>
        </ul>,
        <ul>
          <li>Target users: a specific group of people and their circumstances, never “everyone”. Also name the other people involved: those who buy, install, clean or repair it are often not the ones who use it.</li>
          <li>Scenarios of use: who, where, what's in their hands, what they're doing just before and after. For example, “in the kitchen, one hand wet, the other holding a pan”.</li>
          <li>
            Constraints: target cost and annual volume (volume decides whether tooling costs can be spread out, and so which process to use); process and materials; size, weight, power; the standards and certifications to meet; the
            deadline.
          </li>
          <li>
            Success criteria: numbers or facts you can check. “Easy to use” doesn't count; “a first-time user changes the batteries in under a minute without the manual” does. The Design Council's brief checklist recommends SMART
            objectives: specific, measurable, achievable, realistic and time-based.
          </li>
        </ul>,
      ),
    },
    {
      heading: t("一个例子", "An example"),
      body: byLocale(
        <p>下表是一张桌面温湿度计的任务书，本站拆解页里有它的外壳模型。注意最后两行：约束之间会冲突，事先写好先保哪个；不做的事也写出来，免得范围越做越大。</p>,
        <p>
          The table below is a brief for a desktop thermo-hygrometer; this site's teardown pages have a model of its housing. Note the last two rows: constraints will conflict, so decide in advance which comes first; and write down what's
          out of scope, so the scope doesn't keep growing.
        </p>,
      ),
    },
    {
      heading: t("写完之后", "Once it's written"),
      body: byLocale(
        <ul>
          <li>请提需求的人、工程和采购一起看，确认签字。任务书会随项目更新：改需求就改任务书，写上日期。</li>
          <li>评审方案时逐条对照成功标准，而不是靠「感觉更好看」。</li>
          <li>做测试时直接用成功标准当测试项：2 米外能不能读清，1 分钟内能不能换好电池。</li>
        </ul>,
        <ul>
          <li>Have the requester, engineering and purchasing read it and sign it off. The brief evolves with the project: when a requirement changes, change the brief and date it.</li>
          <li>Review concepts point by point against the success criteria, not on “it feels nicer”.</li>
          <li>Use the success criteria directly as test items: can it be read from 2 m, can the batteries be changed in a minute.</li>
        </ul>,
      ),
    },
  ],
  table: {
    caption: t("示例：桌面温湿度计的任务书", "Example: a brief for a desktop thermo-hygrometer"),
    head: byLocale(["项目", "内容"], ["Item", "Content"]),
    nowrap: [0],
    rows: byLocale(
      [
        ["目标用户", "在家办公、关心室内空气的成年人；家里有老人或婴儿的家庭。相关的人：买来送礼的人，换电池的人。"],
        ["使用场景", "放在书桌或床头，离眼睛 0.5–2 米；夜里关灯后也要看；大约一年换一次电池。"],
        ["约束", "出厂成本不超过 25 元，年产 2 万台；ABS 注塑上下壳，不用胶水；2 节 AAA 电池；外形不超过 80 × 80 × 30\u00a0mm；满足目标市场适用的安全和电磁兼容要求。"],
        ["成功标准", "5 名测试者中至少 4 人在 2 米外读清温度；第一次用的人不看说明书，1 分钟内换好电池；从 75\u00a0cm 高跌落到木地板后功能正常。"],
        ["优先级", "读数清楚 > 成本 > 外形尺寸。"],
        ["不在范围内", "App 和联网功能。"],
      ],
      [
        ["Target users", "Adults working from home who care about indoor air; households with elderly people or babies. Also involved: people buying it as a gift, whoever changes the batteries."],
        ["Scenarios", "On a desk or bedside table, 0.5–2 m from the eyes; read at night with the lights off; batteries changed about once a year."],
        [
          "Constraints",
          "Ex-factory cost at most ¥25 at 20,000 units a year; injection-molded ABS top and bottom shells, no glue; 2 AAA batteries; no larger than 80 × 80 × 30\u00a0mm; meets the safety and EMC requirements of the target markets.",
        ],
        ["Success criteria", "At least 4 of 5 testers read the temperature from 2 m; a first-time user changes the batteries in under a minute without the manual; works after a 75\u00a0cm drop onto a wooden floor."],
        ["Priorities", "Legible reading > cost > size."],
        ["Out of scope", "App and connectivity."],
      ],
    ),
    after: 2,
  },
  terms: {},
  quiz: [
    {
      q: t("下面哪条最适合写进任务书的成功标准？", "Which of these belongs in a brief's success criteria?"),
      options: byLocale(
        ["产品要简洁好用", "第一次用的人不看说明书，1 分钟内能换好电池", "电池盖用卡扣，不用螺钉"],
        ["The product should be simple and easy to use", "A first-time user can change the batteries in under a minute without the manual", "The battery cover uses snap fits, not screws"],
      ),
      answer: 1,
      explain: t(
        "成功标准要能检验：谁、做什么、多快。「简洁好用」无法判断达没达到。「用卡扣」是一个具体解法，写进任务书会提前排除滑盖、磁吸等别的做法。",
        "Success criteria must be checkable: who, doing what, how fast. There's no way to tell whether “simple and easy to use” has been met. “Snap fits” is a specific solution; putting it in the brief rules out sliding covers, magnets and other options in advance.",
      ),
    },
    {
      q: t("为酒吧设计一款更安全的啤酒杯，任务书的目标用户该写谁？", "For a safer pint glass for pubs, who should the brief list as target users?"),
      options: byLocale(
        ["只写喝啤酒的顾客", "顾客，以及端杯、收杯、洗杯的店员，和买杯子的店主", "所有人"],
        ["Only the customers who drink from it", "The customers, plus the staff who serve, collect and wash the glasses, and the landlord who buys them", "Everyone"],
      ),
      answer: 1,
      explain: t(
        "用的人、维护的人、买的人往往不是同一个。设计委员会的示例任务书就提醒：啤酒杯还要被店员端、收、洗，由店主采购。只照顾喝酒的人，方案可能在店里推行不了。「所有人」等于没写。",
        "The people who use it, look after it and buy it are often different. The Design Council's example brief points out that pint glasses are also served, collected and washed by bar staff, and bought by landlords. Design only for the drinker and the idea may never make it into pubs. “Everyone” says nothing.",
      ),
    },
    {
      q: t("任务书写了「出厂成本不超过 25 元」，为什么还要写年产量？", "The brief says “ex-factory cost at most ¥25”. Why state the annual volume as well?"),
      options: byLocale(
        ["不用写，成本和产量无关", "模具费是一次性的：产量大才摊得开，产量决定了能用什么工艺", "方便采购部门排产"],
        ["No need: cost has nothing to do with volume", "Tooling is a one-off cost that only spreads out over large volumes, so volume decides which processes are possible", "So purchasing can plan production"],
      ),
      answer: 1,
      explain: t(
        "注塑要先开模具，这笔钱是一次性的。产量大，摊到每台就少；产量小，摊不开，就要换成不用模具或模具便宜的工艺。同一个成本目标，产量不同，设计方向就不同。",
        "Injection molding needs a mold first, a one-off cost. At high volume it adds little to each unit; at low volume it can't be spread out, so you switch to processes with no tooling or cheap tooling. The same cost target means a different design at a different volume.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "任务书写要求，不写答案：为谁、在哪用、受什么限制、怎样算成功，一页写完",
      "目标用户要具体，并写出买的人、装的人、维修的人；约束写清成本和产量、工艺、标准",
      "成功标准要能检验，最好带数字；约束冲突时按写好的优先级取舍",
    ],
    [
      "A brief states requirements, not answers: who, where, under what constraints, and what success means, on one page",
      "Make target users specific and name the buyers, installers and repairers too; constraints include cost with volume, process and standards",
      "Success criteria must be checkable, ideally with numbers; when constraints conflict, follow the priorities you wrote down",
    ],
  ),
  sources: [
    {
      title: t("Designing out crime: A designers' guide（附录：任务书清单与示例任务书）", "Designing out crime: A designers' guide (appendix: brief checklist and example briefs)"),
      publisher: "Design Council",
      url: "https://www.designcouncil.org.uk/fileadmin/uploads/dc/Documents/designersGuide_digital_0_0.pdf",
    },
    {
      title: t("Product Design Specification (PDS)（课程讲义）", "Product Design Specification (PDS) (course notes)"),
      publisher: "University of Illinois, ME170",
      url: "https://courses.physics.illinois.edu/me170/sp2020/PDS.pdf",
    },
    { title: "The Double Diamond", publisher: "Design Council", url: "https://www.designcouncil.org.uk/our-resources/the-double-diamond/" },
  ],
  related: { cards: ["6.0.1", "6.0.2", "6.6.2"], teardowns: ["enclosure"] },
}

export default card
