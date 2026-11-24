import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/**
 * 6.6.2 安全与认证. Standard numbers and status checked on the IEC webstore and openstd.samr.gov.cn (Nov 2026):
 * IEC 60068-2-31:2008 (absorbed 60068-2-32, withdrawn 2008), GB/T 2423.7-2018, IEC 60529 (ed. 2.2), GB/T 4208-2017,
 * GB 6675.2-2025 (in force from 2026-11-01, replacing GB 6675.2-2014). EN 71-1 is cited without a year: a 2026
 * edition supersedes 2014+A1:2018.
 */

const card: CardDef = {
  code: "6.6.2",
  title: t("安全与认证：要求从哪来", "Safety and certification: where requirements come from"),
  minutes: 5,
  sections: [
    {
      heading: t("先查清适用哪些要求", "First find out which requirements apply"),
      body: byLocale(
        <>
          <p>产品卖到哪里、属于哪一类，决定了它要满足哪些法规和标准。法规规定「必须安全」，标准规定「怎样算安全、怎么测」。</p>
          <p>标准又分两种。方法标准只规定怎么测：怎么摔、怎么喷水。测到什么程度算合格，比如从多高摔几次，由产品标准或客户的规格来定。所以设计师要先确认产品类别和目标市场，再列出适用的法规和标准，写进任务书的约束里。</p>
          <p>这些要求最好在设计初期就知道：它们决定壁厚、密封、零件大小和标签位置。等样机做好才去查，改起来就贵了。标准会修订，用之前查一下是否现行。</p>
        </>,
        <>
          <p>Where a product is sold and what category it falls in decide which laws and standards it must meet. Laws say it “must be safe”; standards say what counts as safe and how to test it.</p>
          <p>
            Standards come in two kinds. A method standard only says how to test: how to drop it, how to spray it. How much it must withstand to pass, such as how many drops from what height, comes from a product standard or the
            customer's specification. So a designer first confirms the product category and the target markets, then lists the laws and standards that apply and writes them into the brief as constraints.
          </p>
          <p>
            Learn these requirements early in the design: they decide wall thickness, sealing, part sizes and where labels go. Look them up only once the prototype exists, and changes get expensive. Standards are revised, so check that the
            one you're using is current.
          </p>
        </>,
      ),
    },
    {
      heading: t("跌落、防水防尘、小零件", "Drops, water and dust, small parts"),
      body: byLocale(
        <ul>
          <li>
            跌落：IEC 60068-2-31:2008 规定「粗率操作冲击」的试验方法，包括跌落与翻倒、自由跌落、反复自由跌落；中国对应 GB/T 2423.7-2018。原来单独的自由跌落标准 IEC 60068-2-32 已经被它取代。它模拟的是使用和维修中的磕碰、掉落，不包括运输时散装货物的颠簸。
          </li>
          <li>
            防水防尘：IEC 60529 用「IP」加两位数字表示外壳的防护等级，中国对应 GB/T 4208-2017。第一位 0–6 防固体异物，6 是尘密；第二位 0–9 防水，7 是短时浸水（1 米、30 分钟），8 是厂家规定的更严的浸水条件。不测的一位写 X。浸水和喷水是不同的试验，两种都满足要写成 IPX5/IPX7 这样。
          </li>
          <li>
            小零件：给 3 岁以下儿童的玩具，任何能不经压缩、以任意方向完全放进「小零件试验器」的零件都不允许，包括在模拟使用和滥用的测试中掉下来的零件。试验器是一个内径约 31.7&nbsp;mm 的圆筒，大小模拟幼儿完全张开的喉咙。美国 16 CFR 1501、欧盟 EN 71-1、中国 GB 6675.2 都有这项要求。
          </li>
        </ul>,
        <ul>
          <li>
            Drops: IEC 60068-2-31:2008 sets out the test methods for rough handling shocks: drop and topple, free fall, and repeated free fall. China's equivalent is GB/T 2423.7-2018. The separate free-fall standard, IEC 60068-2-32, has been
            replaced by it. It simulates knocks and falls during use and repair, not loose cargo bouncing around in transport.
          </li>
          <li>
            Water and dust: IEC 60529 rates an enclosure with “IP” and two digits; China's equivalent is GB/T 4208-2017. The first digit, 0–6, covers solid objects, 6 being dust-tight; the second, 0–9, covers water, 7 being temporary
            immersion (1 m for 30 minutes) and 8 immersion under stricter conditions set by the manufacturer. A digit that wasn't tested is written X. Immersion and water jets are different tests, so a product meeting both is marked like
            IPX5/IPX7.
          </li>
          <li>
            Small parts: a toy for children under 3 must have no part that fits entirely, uncompressed and in any orientation, into the small parts cylinder, including parts that come off in tests simulating use and abuse. The cylinder has
            an inside diameter of about 31.7&nbsp;mm, the size of a young child's fully expanded throat. The US (16 CFR 1501), the EU (EN 71-1) and China (GB 6675.2) all have this requirement.
          </li>
        </ul>,
      ),
    },
    {
      heading: t("CCC 和 CE", "CCC and CE"),
      body: byLocale(
        <>
          <p>CCC 是中国强制性产品认证。列入目录的产品，要由国家认监委指定的认证机构认证，加施认证标志，才能出厂、销售、进口。目录按产品类别列，比如家用电器、电子产品、儿童用品。</p>
          <p>
            CE 是欧盟市场的标志，只有欧盟法规要求的产品类别才需要，比如玩具、电气设备、机械。制造商负责：按适用的法规评估产品，编写技术文件，签署欧盟符合性声明。很多情况下可以自己评估；法规要求第三方时，要找公告机构，并把它的四位编号印在 CE 旁边。CE 不是质量标志，也没有一个统一的机构发「CE 证书」。
          </p>
        </>,
        <>
          <p>
            CCC is China Compulsory Certification. A product on the catalogue must be certified by a certification body designated by CNCA, China's certification authority, and carry the mark before it can leave the factory, be sold or be
            imported. The catalogue is organized by product category, such as household appliances, electronics and children's products.
          </p>
          <p>
            CE is the EU market's marking, required only for product categories whose EU laws call for it, such as toys, electrical equipment and machinery. The manufacturer is responsible: assess the product against the applicable laws,
            compile the technical documentation, and sign an EU declaration of conformity. Often the manufacturer can assess it alone; where the law requires a third party, a notified body takes part and its four-digit number goes next to
            the CE mark. CE isn't a quality mark, and there's no single body that issues “CE certificates”.
          </p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={118}
        label={t(
          "IP67 的读法：第一位 6 表示防固体异物的等级，0 到 6，6 是尘密；第二位 7 表示防水等级，0 到 9，7 是浸水 1 米 30 分钟",
          "Reading IP67: the first digit, 6, is protection against solid objects on a 0–6 scale, 6 being dust-tight; the second, 7, is protection against water on a 0–9 scale, 7 being immersion at 1 m for 30 minutes",
        )}
      >
        <T x={153} y={44} anchor="end" className="text-display font-semibold">
          IP
        </T>
        <T x={164} y={44} anchor="middle" className="text-display font-semibold" tone="primary">
          6
        </T>
        <T x={186} y={44} anchor="middle" className="text-display font-semibold" tone="primary">
          7
        </T>
        <g className="text-muted-foreground">
          <path d="M 156 54 H 172 M 178 54 H 194" strokeWidth={1.5} />
          <path d="M 164 56 V 64 H 80 V 72 M 186 56 V 64 H 240 V 72" strokeWidth={0.9} />
        </g>
        <T x={80} y={90} anchor="middle" className="font-medium">
          {t("第一位：防固体", "1st digit: solids")}
        </T>
        <T x={80} y={108} anchor="middle" tone="muted">
          {t("0–6，6 = 尘密", "0–6; 6 = dust-tight")}
        </T>
        <T x={240} y={90} anchor="middle" className="font-medium">
          {t("第二位：防水", "2nd digit: water")}
        </T>
        <T x={240} y={108} anchor="middle" tone="muted">
          {t("0–9，7 = 浸水 1 m 30 min", "0–9; 7 = 1 m for 30 min")}
        </T>
      </Svg>
    ),
    caption: t(
      "IP 代码按 IEC 60529（GB/T 4208-2017）读。没测的一位写 X：IPX7 只说明防水，没说明防尘。",
      "Read IP codes by IEC 60529 (GB/T 4208-2017). A digit that wasn't tested is written X: IPX7 says nothing about dust, only about water.",
    ),
    after: 1,
  },
  table: {
    caption: t("常见要求和对应的标准", "Common requirements and their standards"),
    head: byLocale(["要求", "标准", "管什么", "影响设计的地方"], ["Requirement", "Standards", "What it covers", "What it shapes in the design"]),
    nowrap: [1],
    rows: byLocale(
      [
        [
          "跌落",
          <>
            IEC 60068-2-31:2008
            <br />
            GB/T 2423.7-2018
          </>,
          "跌落与翻倒、自由跌落、反复自由跌落的试验方法",
          "壁厚、圆角、内部固定、电池仓",
        ],
        [
          "防水防尘",
          <>
            IEC 60529
            <br />
            GB/T 4208-2017
          </>,
          "外壳防固体异物和防水的等级（IP 代码）",
          "密封圈、缝隙、开孔、按键",
        ],
        [
          "小零件",
          <>
            16 CFR 1501
            <br />
            EN 71-1
            <br />
            GB 6675.2-2025
          </>,
          "3 岁以下儿童的玩具不能有放得进试验器的零件",
          "零件尺寸、连接强度、粘接和卡扣",
        ],
        [
          "准入标志",
          <>
            CCC
            <br />
            CE
          </>,
          "列入目录或法规范围的产品才需要",
          "铭牌、标签位置、说明书",
        ],
      ],
      [
        [
          "Drops",
          <>
            IEC 60068-2-31:2008
            <br />
            GB/T 2423.7-2018
          </>,
          "Test methods for drop and topple, free fall and repeated free fall",
          "Wall thickness, fillets, internal mounting, battery compartment",
        ],
        [
          "Water and dust",
          <>
            IEC 60529
            <br />
            GB/T 4208-2017
          </>,
          "Degrees of protection of enclosures against solids and water (IP code)",
          "Seals, gaps, openings, buttons",
        ],
        [
          "Small parts",
          <>
            16 CFR 1501
            <br />
            EN 71-1
            <br />
            GB 6675.2-2025
          </>,
          "Toys for children under 3 may have no part that fits in the test cylinder",
          "Part sizes, joint strength, bonding and snap fits",
        ],
        [
          "Market marks",
          <>
            CCC
            <br />
            CE
          </>,
          "Needed only for products in the catalogue or in scope of the laws",
          "Rating plate, label position, manual",
        ],
      ],
    ),
    after: 2,
    note: t(
      "表里是常见的出发点，不是完整清单。每个产品类别和市场还有自己的产品标准，以认证机构和标准原文为准。",
      "This table is a starting point, not a complete list. Each product category and market has its own product standards; the certification body and the standard's own text are the authority.",
    ),
  },
  terms: {},
  quiz: [
    {
      q: t("一款蓝牙音箱标着 IPX7。下面哪个说法对？", "A Bluetooth speaker is marked IPX7. Which statement is right?"),
      options: byLocale(
        ["它的防尘等级最高", "它经过了短时浸水试验（1 米、30 分钟）；防尘没有测，所以写 X", "它一定也扛得住高压水枪冲"],
        ["Its dust protection is the highest level", "It passed temporary immersion (1 m, 30 minutes); dust wasn't tested, hence the X", "It's bound to survive a pressure washer too"],
      ),
      answer: 1,
      explain: t(
        "X 表示这一位没测，不是 0，也不是最高。7 是浸水试验，不包含喷水；同时满足喷水要求的产品会标成 IPX5/IPX7 这样。",
        "X means that digit wasn't tested: not 0, and not the top level. 7 is an immersion test and doesn't cover water jets; a product that also meets a jet requirement is marked like IPX5/IPX7.",
      ),
    },
    {
      q: t(
        "给 2 岁儿童的积木，有一块小装饰件在拉力测试后掉了下来，能完全放进小零件试验器。结论是？",
        "In a building set for 2-year-olds, a small decoration comes off in the tension test and fits entirely into the small parts cylinder. What's the verdict?",
      ),
      options: byLocale(
        ["装饰件本来连在大零件上，玩具整体合格", "不合格：测试中掉下来的零件也算小零件", "包装上印一句「小心误吞」就行"],
        ["The decoration started out attached to a large part, so the toy passes", "It fails: parts that come off during testing count as small parts too", "Printing “choking hazard” on the box is enough"],
      ),
      answer: 1,
      explain: t(
        "16 CFR 1501 和 EN 71-1 都要求：模拟使用和滥用的测试之后，把脱落的零件逐个放进试验器检查。给 3 岁以下儿童的玩具，警示语不能让它变成合格。",
        "Both 16 CFR 1501 and EN 71-1 require each part that comes off in the use-and-abuse tests to be checked in the cylinder. For a toy meant for children under 3, a warning label doesn't make it pass.",
      ),
    },
    {
      q: t("产品要卖到欧盟，需要加 CE 标志。下面哪个理解对？", "A product sold in the EU needs CE marking. Which understanding is right?"),
      options: byLocale(
        ["要先找欧盟的某个机构领一张 CE 证书", "制造商按适用的欧盟法规评估、准备技术文件、签署符合性声明；法规要求时才找公告机构", "CE 表示产品在欧洲制造"],
        [
          "You first collect a CE certificate from an EU body",
          "The manufacturer assesses the product against the applicable EU laws, compiles the technical file and signs the declaration of conformity, involving a notified body only where the law requires",
          "CE means the product was made in Europe",
        ],
      ),
      answer: 1,
      explain: t(
        "CE 是制造商对符合欧盟法规的声明。没有统一发证的机构，有些机构卖的「自愿证书」不能代替 CE 的程序。CE 也不表示产地或质量等级。",
        "CE is the manufacturer's statement that the product meets EU law. No central body issues it, and the “voluntary certificates” some organizations sell can't replace the CE procedure. CE doesn't indicate origin or a quality level either.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先确认产品类别和目标市场，再列适用的法规和标准；方法标准管怎么测，产品标准管测到什么程度",
      "跌落看 IEC 60068-2-31，防水防尘看 IEC 60529 的 IP 代码，儿童产品看小零件要求；它们决定壁厚、密封和零件大小",
      "CCC 是中国对目录内产品的强制认证；CE 是制造商对符合欧盟法规的声明；标准会修订，用前查是否现行",
    ],
    [
      "Confirm the product category and target markets first, then list the laws and standards that apply; method standards say how to test, product standards how much to withstand",
      "Drops: IEC 60068-2-31; water and dust: the IP code of IEC 60529; children's products: the small-parts rule. They decide wall thickness, sealing and part sizes",
      "CCC is China's compulsory certification for catalogued products; CE is the manufacturer's statement of EU conformity; standards change, so check they're current",
    ],
  ),
  sources: [
    { title: "IEC 60068-2-31:2008 Test Ec: Rough handling shocks", publisher: "IEC Webstore", url: "https://webstore.iec.ch/en/publication/516" },
    { title: t("IEC 60068-2-32:1975 Test Ed: Free fall（已被替代）", "IEC 60068-2-32:1975 Test Ed: Free fall (replaced)"), publisher: "IEC Webstore", url: "https://webstore.iec.ch/en/publication/12730" },
    {
      title: "GB/T 2423.7-2018 环境试验 第2部分：试验方法 试验Ec：粗率操作造成的冲击（主要用于设备型样品）",
      publisher: t("国家标准全文公开系统", "SAMR national standards portal"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=62B5B93E6DA50682C0F23382A30AC4CF",
    },
    { title: "IEC 60529:1989+AMD1:1999+AMD2:2013 CSV Degrees of protection provided by enclosures (IP Code)", publisher: "IEC Webstore", url: "https://webstore.iec.ch/en/publication/2452" },
    {
      title: "GB/T 4208-2017 外壳防护等级（IP代码）",
      publisher: t("国家标准全文公开系统", "SAMR national standards portal"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=09CCED55688D4116ED89659C1E7526F8",
    },
    { title: t("IP code（各位数字的含义）", "IP code (what each digit means)"), publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/IP_code" },
    { title: "16 CFR 1501.4 Size requirements and test procedure", publisher: "Cornell Law School LII", url: "https://www.law.cornell.edu/cfr/text/16/1501.4" },
    { title: "Small Parts for Toys and Children's Products", publisher: "U.S. CPSC", url: "https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Small-Parts-for-Toys-and-Childrens-Products" },
    {
      title: t("Summary Information for Small Parts（试验器尺寸）", "Summary Information for Small Parts (cylinder size)"),
      publisher: "U.S. CPSC",
      url: "https://www.cpsc.gov/s3fs-public/Small-Parts-16-C-F-R-Part-1501-English.pdf",
    },
    { title: "Small parts cylinder according to EN 71-1 §8.2", publisher: "Centexbel", url: "https://www.centexbel.be/en/problem-solving/testing/small-parts-cylinder-according-en71-1-ss82" },
    {
      title: "GB 6675.2-2025 玩具安全 第2部分：机械与物理性能",
      publisher: t("国家标准全文公开系统", "SAMR national standards portal"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=D58D37320C452464E2FBEABC7DA709BB",
    },
    { title: "CE marking", publisher: t("欧盟 Your Europe", "Your Europe (EU)"), url: "https://europa.eu/youreurope/business/product-requirements/labels-markings/ce-marking/index_en.htm" },
    {
      title: "强制性产品认证相关问题解答",
      publisher: t("国家认证认可监督管理委员会", "CNCA"),
      url: "https://www.cnca.gov.cn/hlwfw/ywzl/qzxcprz/cjwt/art/2023/art_189a918d2b59422e8feea10a6a1604ab.html",
    },
  ],
  related: { cards: ["6.0.3", "6.6.1", "6.6.3"] },
}

export default card
