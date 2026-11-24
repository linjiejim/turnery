import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 6.0.2 用户研究方法. Figure: methods placed on two axes, after NN/g's research-methods landscape (say vs do, why vs how many). */

const dot = (x: number, y: number, label: string, faint?: boolean) => (
  <g>
    <circle cx={x} cy={y} r={3.5} className={faint ? "fill-current text-faint-foreground" : "fill-current text-primary"} stroke="none" />
    <T x={x + 9} y={y + 4.5} tone={faint ? "faint" : undefined}>
      {label}
    </T>
  </g>
)

const card: CardDef = {
  code: "6.0.2",
  title: t("用户研究方法：按问题选方法", "User research methods"),
  minutes: 5,
  sections: [
    {
      heading: t("先写下要回答的问题", "Start with the question"),
      body: byLocale(
        <>
          <p>用户研究不是「去问问用户」。先把要回答的问题写下来：用户现在怎么做？哪一步最麻烦？这个原型用起来卡在哪？有多少人遇到这个问题？</p>
          <p>问题不同，方法就不同。尼尔森诺曼集团（NN/g）用两把尺子给方法定位：听人说（态度）还是看人做（行为）；回答「为什么、怎么改」（定性）还是「有多少」（定量）。</p>
        </>,
        <>
          <p>User research isn't “go and ask some users”. First write down the question you need answered: How do people do this today? Which step is the worst? Where does this prototype trip them up? How many people have this problem?</p>
          <p>
            Different questions need different methods. Nielsen Norman Group (NN/g) places methods on two scales: listening to what people say (attitudinal) or watching what they do (behavioral); answering “why, and how to fix it”
            (qualitative) or “how many” (quantitative).
          </p>
        </>,
      ),
    },
    {
      heading: t("人数为什么差这么多", "Why the numbers differ so much"),
      body: byLocale(
        <>
          <p>定性研究是找问题、找原因。同一个问题，第三、第四个人再遇到，新信息就少了。所以 NN/g 的经验是：一轮可用性测试 5 人左右就能暴露大部分问题，与其一次测 15 人，不如测 3 轮、每轮 5 人，每轮之间把问题改掉。访谈也是先做 5–6 个，边做边分析，听不到新东西就停。</p>
          <p>定量研究是估比例，要靠人数把误差压下去。100 个人里一半人完成了任务，真实的完成率可能在 40% 到 60% 之间；要把这个范围缩小，人数就得成倍增加。所以定量可用性研究常用 40 人左右，问卷往往要几百份。</p>
        </>,
        <>
          <p>
            Qualitative research looks for problems and their causes. Once the third or fourth person hits the same problem, you learn less and less that's new. So NN/g's rule of thumb is that one round of usability testing with about 5
            people uncovers most of the problems, and rather than testing 15 people at once, run 3 rounds of 5, fixing the problems between rounds. Interviews work the same way: start with 5–6, analyze as you go, and stop when you stop
            hearing anything new.
          </p>
          <p>
            Quantitative research estimates proportions, and only more people bring the error down. If half of 100 people complete a task, the true completion rate could be anywhere from 40% to 60%; narrowing that range takes many more
            people. That's why quantitative usability studies often use about 40 people, and surveys often need several hundred responses.
          </p>
        </>,
      ),
    },
    {
      heading: t("说的和做的不一样", "What people say isn't what they do"),
      body: byLocale(
        <>
          <p>人会顺着提问者的期待回答，记不清自己做过什么，还会事后给自己的行为找理由。问「你会用这个功能吗」，得到的回答几乎没有参考价值。</p>
          <ul>
            <li>想知道怎么做，就看他做：情境观察、可用性测试。</li>
            <li>访谈时问具体的某一次：「上次换滤芯是什么时候？当时怎么做的？」比问「你一般怎么换」可靠。</li>
            <li>问喜好，要等对方真的用过之后再问。</li>
          </ul>
        </>,
        <>
          <p>People tell you what they think you want to hear, misremember what they did, and explain their behavior after the fact. Ask “would you use this feature?” and the answer is close to worthless.</p>
          <ul>
            <li>To learn what people do, watch them do it: contextual inquiry, usability testing.</li>
            <li>In interviews, ask about one specific occasion: “When did you last change the filter? How did you go about it?” is more reliable than “How do you usually change it?”</li>
            <li>Ask about preferences only after people have actually used the thing.</li>
          </ul>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={236}
        label={t(
          "方法定位图：纵轴从听人说到看人做，横轴从定性到定量。左上是可用性测试和情境观察，左下是日记研究和访谈，右下是问卷，右上是埋点数据和 A/B 测试",
          "Method map: the vertical axis runs from what people say to what they do, the horizontal from qualitative to quantitative. Top left: usability tests and contextual inquiry; bottom left: diary studies and interviews; bottom right: surveys; top right: analytics and A/B tests",
        )}
      >
        <g className="text-faint-foreground">
          <path d="M 160 24 V 212 M 6 118 H 314" />
        </g>
        <T x={160} y={16} anchor="middle" className="font-medium">
          {t("看人做（行为）", "What they do (behavior)")}
        </T>
        <T x={160} y={230} anchor="middle" className="font-medium">
          {t("听人说（态度）", "What they say (attitude)")}
        </T>
        <T x={8} y={110} tone="muted">
          {t("定性：为什么", "Qualitative")}
        </T>
        <T x={312} y={110} anchor="end" tone="muted">
          {t("定量：有多少", "Quantitative")}
        </T>
        {dot(22, 46, t("可用性测试", "Usability tests"))}
        {dot(22, 78, t("情境观察", "Contextual inquiry"))}
        {dot(22, 150, t("日记研究", "Diary studies"))}
        {dot(22, 190, t("访谈", "Interviews"))}
        {dot(178, 190, t("问卷", "Surveys"))}
        {dot(178, 48, t("埋点数据、A/B 测试", "Analytics, A/B tests"), true)}
      </Svg>
    ),
    caption: t(
      "按两把尺子给方法定位。越往上越接近真实行为，越往右越能回答「有多少」。灰色的一类本卡不展开。",
      "Each method placed on two scales. The higher, the closer to real behavior; qualitative methods on the left answer “why”, quantitative ones on the right answer “how many”. The grey group isn't covered in this card.",
    ),
    after: 0,
  },
  table: {
    caption: t("五种常用方法", "Five common methods"),
    head: byLocale(["方法", "回答什么问题", "大概要多少人"], ["Method", "Question it answers", "Roughly how many people"]),
    rows: byLocale(
      [
        ["访谈", "用户是谁，目标、动机和痛点是什么，为什么这样做", "先做 5–6 个，听不到新东西就停；人群差别大时要 20 个以上"],
        ["情境观察", "在真实环境里实际怎么做：变通的做法、被打断、借助的其他工具", "少量挑选过的人，每次一两个小时到几天"],
        ["问卷", "有多少人持某种看法或习惯", "几百份；100 份时，比例的误差约为正负 10 个百分点"],
        ["可用性测试", "拿着原型做任务时卡在哪、为什么", "每轮 5 人左右，改完再测；估完成率要 40 人左右"],
        ["日记研究", "一段时间里的习惯和变化：多久用一次，感受怎么变", "人群相近时 5–12 人，持续几天到一个月"],
      ],
      [
        ["Interviews", "Who users are, their goals, motivations and pain points, and why they act as they do", "Start with 5–6 and stop when nothing new comes up; 20 or more for very varied groups"],
        ["Contextual inquiry", "What people really do in their own setting: workarounds, interruptions, other tools they lean on", "A few carefully chosen people, an hour or two up to several days each"],
        ["Surveys", "How many people hold a view or a habit", "Several hundred; with 100 responses a proportion is uncertain by about ±10 points"],
        ["Usability tests", "Where people get stuck doing tasks with a prototype, and why", "About 5 per round, fixing between rounds; about 40 to estimate a completion rate"],
        ["Diary studies", "Habits and changes over time: how often, and how feelings shift", "5–12 for a similar group, over a few days to a month"],
      ],
    ),
    after: 1,
    note: t(
      "人数是 NN/g 文章里的经验值，不是定律。用户群差别很大时，每类人分开算。",
      "The numbers are rules of thumb from NN/g articles, not laws. When user groups differ a lot, count each group separately.",
    ),
  },
  terms: {},
  quiz: [
    {
      q: t("你想知道用户第一次组装你们的书架时卡在哪一步。最合适的方法是？", "You want to know which step trips people up the first time they assemble your bookshelf. What's the best method?"),
      options: byLocale(
        ["发问卷，请买家给组装难度打分", "请 5 个没装过的人照说明书组装，在旁边观察记录", "访谈老用户，请他们回忆组装过程"],
        ["Send a survey asking buyers to rate how hard assembly was", "Have 5 people who've never built it assemble it from the instructions while you watch and take notes", "Interview existing customers and ask them to recall assembling it"],
      ),
      answer: 1,
      explain: t(
        "要知道卡在哪，就要看人做。可用性测试能直接看到卡住的地方和原因。问卷只给一个分数；回忆会漏掉细节，人也常把自己的失误说得轻一些。",
        "To find where people get stuck, watch them. A usability test shows the sticking points and why. A survey gives only a score; recollection drops details, and people tend to play down their own mistakes.",
      ),
    },
    {
      q: t(
        "访谈中八成的人说会经常用这个新功能，上线后却很少有人用。最可能的原因是？",
        "In interviews, 80% of people said they'd use a new feature often. After launch, hardly anyone uses it. What's the most likely reason?",
      ),
      options: byLocale(
        ["访谈人数太少，换成问卷问 500 人就准了", "人对自己将来会做什么的预测不可靠，说的和做的常常不一样", "用户故意说了谎"],
        ["Too few interviews; a 500-person survey would have been accurate", "People's predictions of their own future behavior are unreliable: what they say often differs from what they do", "Users lied on purpose"],
      ),
      answer: 1,
      explain: t(
        "问 500 人得到的仍然是「说」，只是把一个不可靠的东西测得更精确。人会顺着提问者的期待回答，也高估自己会做的事，这不是故意说谎。要验证，就做个原型让人真的用。",
        "Asking 500 people still collects what they say; it just measures something unreliable more precisely. People answer toward what they think the asker wants and overestimate what they'll do, without meaning to lie. To check, build a prototype and let people really use it.",
      ),
    },
    {
      q: t(
        "第一轮可用性测试请了 5 个人。同事说「5 个人没有统计意义」。怎么回应？",
        "Your first round of usability testing had 5 people. A colleague says “5 people isn't statistically significant”. How do you respond?",
      ),
      options: byLocale(
        ["同意，至少要 100 人", "这轮测试是找问题，不是估比例；5 人通常能暴露大部分问题，改完再测一轮", "人数无所谓，1 个人也够"],
        ["Agree: you need at least 100", "This round is for finding problems, not estimating proportions; 5 people usually reveal most of them, then you fix and test again", "Numbers don't matter; even 1 person is enough"],
      ),
      answer: 1,
      explain: t(
        "定性测试找的是问题和原因，第四、第五个人遇到的多半是前面见过的问题。要估「多少人完不成」这类比例，才需要几十人的定量研究。只测 1 个人又太少，会漏掉很多问题。",
        "Qualitative testing looks for problems and causes, and the fourth and fifth people mostly hit problems you've already seen. Only estimating a proportion, like how many people fail, needs a quantitative study with dozens of people. One person, though, is too few and misses many problems.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先写下要回答的问题，再选方法：听人说还是看人做，问为什么还是数有多少",
      "想知道人怎么做，就看他做；访谈问具体的某一次经历，不问「你会不会」",
      "找问题用小样本、多轮：可用性测试每轮约 5 人；估比例才要几十到几百人",
    ],
    [
      "Write down the question first, then pick the method: what people say or what they do, why or how many",
      "To learn what people do, watch them; in interviews, ask about one specific occasion, not “would you?”",
      "Find problems with small, repeated rounds of about 5 people; only estimating proportions needs dozens to hundreds",
    ],
  ),
  sources: [
    { title: "When to Use Which User-Experience Research Methods", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/which-ux-research-methods/" },
    { title: "Why You Only Need to Test with 5 Users", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/" },
    { title: "First Rule of Usability? Don't Listen to Users", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/first-rule-of-usability-dont-listen-to-users/" },
    { title: "User Interviews 101", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/user-interviews/" },
    { title: "How Many Participants for a UX Interview?", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/interview-sample-size/" },
    { title: "Contextual Inquiry", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/contextual-inquiry/" },
    { title: "Diary Studies", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/diary-studies/" },
    { title: "Confidence Intervals, Margins of Error, and Confidence Levels in UX", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/confidence-interval/" },
    { title: "How Many Participants for Quantitative Usability Studies", publisher: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/summary-quant-sample-sizes/" },
  ],
  related: { cards: ["6.0.1", "6.0.3", "6.6.1"] },
}

export default card
