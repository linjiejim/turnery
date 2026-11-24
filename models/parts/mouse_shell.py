"""无线鼠标外壳: plan-view spline → side-view spine → extrude with draft →
lofted crown that trims the block → shell (open bottom) → concentric
shoulder fillets → split slots between the buttons and the palm → drafted
screw bosses → button plungers and ribs.

The teaching points are the industrial-design ones: get the big primary
surfaces right first (plan outline, side spine, crown), fillet afterwards,
keep the wall even, put the split line where the hand and the mould want
it, and give every face the core pulls past some draft.
"""

from math import radians, tan

from build123d import (
    Align,
    Axis,
    Box,
    Cone,
    Cylinder,
    Line,
    Plane,
    Pos,
    Spline,
    ThreePointArc,
    Vector,
    Wire,
    extrude,
    fillet,
    loft,
    make_face,
    offset,
)

from turnerybake import Dim, Feature, Param, PartModel

# 俯视轮廓的控制点（长 112、宽 62 时的位置，前端在 -Y）：前窄后宽，左右对称
PLAN = [(0, -56), (17, -53), (25.5, -40), (28, -18), (30.5, 8), (30, 30), (22, 49), (0, 56)]
HB = 46  # 拉伸毛坯的高度：比最高点高，等顶面来修剪
SPAN = 40  # 顶面截面弧的半宽，比鼠标宽，修剪后只留中间
CROWN_DROP = 26  # 截面弧从中线到 ±40 处下降的高度，决定左右方向的鼓起
SECTIONS = [-64, -44, -24, -4, 16, 36, 50, 64]  # 放样截面所在的 y
SPLIT_Y, SPLIT_BOW = -6, 6  # 分割线在中线处的位置，以及两端往前弯的量
BOSSES = [(-13, 31), (13, 31)]  # 手托上的两个螺丝柱
PLUNGERS = [(-12, -30), (12, -30)]  # 按键压柱，正对下面的微动开关
BOSS_Z0, PLUNGER_Z0 = 3, 10  # 螺丝柱和压柱的下端高度
UP = (Align.CENTER, Align.CENTER, Align.MIN)

MODEL = PartModel(
    id="mouse_shell",
    title="无线鼠标外壳",
    subtitle="样条 · 放样曲面 · 抽壳 · 分割线 · 拔模",
    level="高级",
    teaches=["先做大面，圆角在后", "内外圆角同心，壁厚均匀", "分割线放在手指和手掌的交界", "壳体内外都要拔模"],
    params=[
        Param("L", "长", "mm", 112, feature="sk1"),
        Param("W", "宽", "mm", 62, feature="sk1"),
        Param("H", "最高点", "mm", 36, feature="sk2"),
        Param("a", "拔模角", "°", 1, [1, 3], feature="ext1"),
        Param("t", "壁厚", "mm", 1.8, [1.4, 1.8], feature="shell1"),
        Param("R", "肩部圆角", "mm", 8, feature="fil1"),
        Param("g", "分割缝宽", "mm", 0.6, feature="cut1"),
        Param("D", "螺丝柱外径", "mm", 5.6, feature="ext2"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "俯视轮廓",
            why="鼠标先从俯视图定型：前端窄，手指在这里分开按左右键；后段宽，托住手掌。轮廓是一条闭合样条，左右对称，左右手都能用。样条比圆弧拼接更顺：曲率连续变化，侧面的高光不会断。",
            summary="上视基准面 · {L} × {W} · 闭合样条",
            pitfall="样条控制点少而匀。点越多越容易出现小波纹，侧面一打光就能看出来。",
            view=(0, 0, 1),
        ),
        Feature(
            "sk2", "sketch", "草图2", "侧视脊线",
            why="侧视图上画一条脊线：前端低，在手掌心的位置隆起到最高，后端再落下去。最高点放在中间偏后，手掌的凹处正好扣在上面。这条线决定了整只鼠标的姿态，比任何圆角都重要。",
            summary="右视基准面 · 最高 {H} · 偏后 12",
            view=(1, 0, 0),
        ),
        Feature(
            "ext1", "extrude", "拉伸1", "侧面（拉伸带拔模）",
            why="把轮廓向上拉成毛坯，同时给侧面加拔模：越往上越往里收。外壳在模具里是从型腔中往上取出的，侧面只要有一点往里收，开模时就不会刮花。分模线因此放在最底下那圈边上，那里是整个外形最宽的地方。",
            summary="拔模 {a}° · 高 46 · 向上收",
            pitfall="侧面中间鼓出来比底边还宽，就成了倒扣：零件卡在型腔里取不出来，只能改分模线或者加滑块。",
        ),
        Feature(
            "loft1", "loft", "放样1", "顶面主曲面",
            why="在脊线上取 8 个位置，各画一段左右方向的圆弧，弧顶的高度跟着脊线走，再把这些弧放样成一张顶面，用它把毛坯的上部切掉。整个顶面是一张连续的曲面，从按键一直延伸到手托，后面拆成几个零件时，接缝两边的曲面还是对得上。",
            summary="8 个截面 · 顶面一张曲面",
            pitfall="截面之间的距离差太多，或者弧的弯曲忽大忽小，放样出来的曲面会起伏。截面越少越顺，够用就好。",
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空外壳",
            why="移除底面抽壳，顶面和侧面都向内偏移同一个壁厚。注塑件壁厚要均匀：厚的地方冷却慢，表面会缩出凹坑；鼠标顶面是光面，手一摸、灯一照，缩痕最明显。拔模在抽壳之前做，内壁也跟着带上同样的拔模，型芯才能往下脱出。",
            summary="壁厚 {t} · 移除底面",
            view=(0.6, -0.8, -1.4),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "肩部圆角（内外同心）",
            why="顶面和侧面的交线是一圈尖棱，现在才倒圆角：大面已经定好，圆角只负责过渡。外侧 R8，内侧 R8 − 壁厚，两段圆弧同心，转角处的壁和别处一样厚。",
            summary="外 R{R} · 内 R8 − {t}",
            pitfall="先倒外圆角再抽壳，在这张曲面上内核偏移不出来，抽壳会失败；改成抽壳后内外各倒一次，半径差一个壁厚，结果一样均匀。只倒外侧，转角会变薄。",
            view=(1, -1.1, 0.6),
        ),
        Feature(
            "cut1", "cut", "切除1", "分割线：按键与手托",
            why="在俯视图上画分割线，再竖直向下切开：中间一条缝把左右键分开，横着一条缝把按键和手托分开，整个外壳变成三个零件。横缝放在最高点前面，手指在前，手掌在后，缝落在两者的交界上，摸不到也不硌手；两端往前弯，顺着手指张开的方向。缝竖直切，缝壁和开模方向一致，三个零件各自都能脱模。",
            summary="缝宽 {g} · 横缝在 y = −6 · 3 个零件",
            pitfall="分割缝要处处一样宽。缝宽不匀，或者两边曲面错开一点点，都会一眼看出来。",
            view=(0.4, -0.6, 1.6),
        ),
        Feature(
            "ext2", "extrude", "拉伸2", "螺丝柱（带拔模）",
            why="手托下面两个螺丝柱，从顶壳内表面一直长到离分模面 3 mm，底壳的自攻螺丝从下面拧进来。柱子做成锥形：根部粗、端部细，每边约 0.5° 的拔模，型芯才能从柱子里拔出来。柱子拉到外表面为止，和顶壳长成一体。",
            summary="Ø{D} · 拔模 0.5° · 底孔 Ø2",
            pitfall="柱子贴着侧壁，那里的壁就成了一大块实心，外面会缩出凹坑；离开侧壁，用筋连过去。",
            view=(0.6, -0.8, -1.4),
            focus=lambda p: ((-24, 14, 0), (24, 48, 36)),
        ),
        Feature(
            "rib1", "rib", "筋1", "按键压柱与加强筋",
            why="每个按键下面一根压柱，正对着主板上的微动开关，按键一按就压下开关。按键背面再沿长度方向加一条筋，让按键整体往下动而不是自己弯；手托上一条横筋把两个螺丝柱连起来。筋厚取壁厚的 60%，背面不会缩痕。",
            summary="压柱 × 2 · 筋厚 0.6 × {t}",
            pitfall="压柱的下端要离开关留一点空行程，否则按键一装上就把开关压住了。",
            view=(0.6, -0.8, -1.4),
        ),
    ],
    failures={
        "loft1": "顶面放样失败：截面弧的高度变化太急，曲面自交。",
        "shell1": "抽壳失败：壁厚相对曲率太大，内表面偏移时自交。",
        "fil1": "肩部圆角失败：内侧圆角半径减掉壁厚后太小，或者曲面太陡，圆角滚不过去。",
        "cut1": "分割线没有把外壳切成三个零件。",
        "ext2": "螺丝柱没能和顶壳连成一体。",
    },
)


def plan_spline(sx: float, sy: float, inset: float = 0.0, z: float = 0.0):
    """The closed plan outline, scaled to the size; ``inset`` moves it inwards along its normal."""
    half = [(x * sx, y * sy) for x, y in PLAN]
    pts = half + [(-x, y) for x, y in reversed(half[1:-1])]  # 左右对称
    base = Spline(*[(x, y, 0) for x, y in pts], periodic=True)
    if not inset:
        return Pos(0, 0, z) * base
    moved = []
    for i in range(64):
        u = i / 64
        p, tangent = base @ u, base % u
        inward = Vector(-tangent.Y, tangent.X, 0).normalized()  # 轮廓逆时针走，左手边就是里面
        moved.append(p + inward * inset + Vector(0, 0, z))
    return Spline(*moved, periodic=True)


def drafted_rib(x0: float, y0: float, x1: float, y1: float, thick: float, z0: float, a: float):
    """A rib from (x0, y0) to (x1, y1), hanging down to z0, thinner at its free edge by the draft a."""
    top = 60
    grow = (top - z0) * tan(radians(a))
    length = Vector(x1 - x0, y1 - y0, 0).length
    along = Vector(x1 - x0, y1 - y0, 0).normalized()
    plane = Plane(origin=((x0 + x1) / 2, (y0 + y1) / 2, 0), x_dir=(-along.Y, along.X, 0), z_dir=along)
    section = plane * make_face(
        Wire.make_polygon([(-thick / 2, z0), (thick / 2, z0), (thick / 2 + grow, top), (-thick / 2 - grow, top)])
    )  # 截面是梯形：根部宽，自由端窄
    return extrude(section, amount=length / 2, both=True)


def build(p, r):
    sx, sy, t, R, a = p["W"] / 62, p["L"] / 112, p["t"], p["R"], p["a"]

    # @step sk1
    outline = plan_spline(sx, sy)
    r.sketch(
        "sk1", outline, Plane.XY, size=p["L"] * 1.4, plane_name="上视基准面",
        dims=[
            Dim((-p["W"] / 2, 0, 0), (p["W"] / 2, 0, 0), (0, -1, 0), p["L"] / 2 + 8, f"{p['W']:g}"),
            Dim((0, -p["L"] / 2, 0), (0, p["L"] / 2, 0), (1, 0, 0), p["W"] / 2 + 10, f"{p['L']:g}"),
        ],
    )

    # @step sk2
    s = p["H"] / 36
    spine = Spline((0, -64, 17 * s), (0, -40, 26.5 * s), (0, -12, 33.5 * s), (0, 12, 36 * s), (0, 36, 31 * s), (0, 64, 15 * s))
    r.sketch(
        "sk2", spine, Plane.YZ, size=p["L"] * 1.5, plane_name="右视基准面", center=(0, 0, p["H"] / 2), construction=[outline],
        dims=[Dim((0, 12, 0), (0, 12, p["H"]), (0, 1, 0), 52, f"{p['H']:g}")],
    )

    # @step ext1
    # 拉伸带拔模 = 底面轮廓和向内偏移 HB·tan(a) 的顶面轮廓之间的直纹面
    top_outline = plan_spline(sx, sy, inset=HB * tan(radians(a)), z=HB)
    body = loft([make_face(outline), make_face(top_outline)], ruled=True)
    r.solid("ext1", body)

    # @step loft1
    arcs = []
    for y in SECTIONS:
        zc = spine.intersect(Plane.XZ.offset(-y)).vertices()[0].Z  # 这个截面上脊线的高度
        zs = zc - CROWN_DROP
        arcs.append(make_face(Wire([
            Line((-SPAN, y, -40), (SPAN, y, -40)),
            Line((SPAN, y, -40), (SPAN, y, zs)),
            ThreePointArc((SPAN, y, zs), (0, y, zc), (-SPAN, y, zs)),
            Line((-SPAN, y, zs), (-SPAN, y, -40)),
        ])))
    crown = loft(arcs)  # 顶面 = 放样体的上表面
    body = body & crown
    r.check("loft1", len(body.solids()) == 1, "顶面没有把毛坯切成一个实体")
    r.solid("loft1", body)

    # @step shell1
    outer = body  # hide
    bottom = body.faces().sort_by(Axis.Z)[0]
    body = offset(body, amount=-t, openings=bottom)
    r.check("shell1", body.volume < 0.2 * outer.volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", body)

    # @step fil1
    outer_top = body.faces().sort_by(Axis.Z)[-1]  # 外侧顶面
    inner_mid = sorted(body.faces(), key=lambda f: -f.center().Z)[1].center()  # 内侧顶面（低一个壁厚）的中心
    body = fillet(outer_top.edges(), radius=R)  # 外圆角 R
    inner_top = min(body.faces(), key=lambda f: (f.center() - inner_mid).length)  # 倒完外圆角，重新找到内侧顶面
    body = fillet(inner_top.edges(), radius=R - t)  # 内圆角 R − t，和外圆角同心
    outer = fillet(outer.faces().sort_by(Axis.Z)[-1].edges(), radius=R)  # hide
    r.solid("fil1", body)

    # @step cut1
    bow = Spline((-40, SPLIT_Y - SPLIT_BOW, -1), (0, SPLIT_Y, -1), (40, SPLIT_Y - SPLIT_BOW, -1))
    cross = extrude(make_face(offset(bow, amount=p["g"] / 2)), amount=HB, dir=(0, 0, 1))  # 横缝：分开按键和手托
    middle = Pos(0, (SPLIT_Y - 70) / 2, -1) * Box(p["g"], 70 + SPLIT_Y, HB, align=UP)  # 中缝：分开左右键
    body -= cross + middle
    r.check("cut1", len(body.solids()) == 3, "分割线没有把外壳切成三个零件")
    r.solid("cut1", body)

    # @step ext2
    # outer：没抽壳的实心外形（也倒了肩部圆角），柱子和筋都拉到它为止，相当于「成形到下一面」
    grow = (HB - BOSS_Z0) * tan(radians(0.5))  # 每边 0.5° 拔模：越往上越粗
    bosses = [Pos(x, y, BOSS_Z0) * Cone(p["D"] / 2, p["D"] / 2 + grow, HB - BOSS_Z0, align=UP) for x, y in BOSSES]
    body += [boss & outer for boss in bosses]  # 拉到外表面为止
    body -= [Pos(x, y, BOSS_Z0 - 1) * Cylinder(1.0, 9, align=UP) for x, y in BOSSES]  # 自攻螺丝底孔
    r.check("ext2", len(body.solids()) == 3, "螺丝柱没有和顶壳连成一体")
    r.solid("ext2", body)

    # @step rib1
    rib_t = 0.6 * t  # 筋厚取壁厚的 60%
    ribs = [Pos(x, y, PLUNGER_Z0) * Box(3, 3, HB, align=UP) for x, y in PLUNGERS]  # 压柱
    ribs += [drafted_rib(x, -50, x, SPLIT_Y - 6, rib_t, 26, 0.5) for x, _ in PLUNGERS]  # 按键背面的纵筋
    ribs += [drafted_rib(BOSSES[0][0], 31, BOSSES[1][0], 31, rib_t, 24, 0.5)]  # 手托横筋
    body += [rib & outer for rib in ribs]
    r.check("rib1", len(body.solids()) == 3, "筋没有和所在的零件连成一体")
    r.solid("rib1", body)
    return body
