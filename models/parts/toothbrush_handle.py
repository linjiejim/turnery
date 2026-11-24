"""电动牙刷手柄: six oval sections → loft → bottom fillet → flat for the
button → shell (open top) → TPE overmould pockets → button hole under the
TPE → sealed charging recess in the bottom.

The teaching points: the cross-section changes along the length (round at
the bottom, an oval grip, a thumb pad where the button is), so the hand
knows which way the bristles face without looking; an overmould pocket
needs a crisp shut-off step at its edge; and the button and the charging
recess keep the handle sealed.
"""

from build123d import (
    Align,
    Axis,
    Box,
    Cylinder,
    Ellipse,
    GeomType,
    Plane,
    Pos,
    Rot,
    SlotCenterToCenter,
    extrude,
    fillet,
    loft,
    offset,
)

from turnerybake import Dim, Feature, Param, PartModel

# 截面：(高度 z, 左右半宽 a, 前后半厚 b)。底部接近圆，握持段扁，拇指处前面鼓起一点，顶部收圆
SECTIONS = [(0, 14.6, 13.4), (38, 15.0, 13.2), (80, 12.8, 10.4), (122, 12.4, 11.6), (160, 11.4, 10.4), (190, 10.0, 9.2)]
FLAT_Y, FLAT_Z0 = 10.8, 80  # 按键平面离中心线的距离，平切只在 z ≥ 80 的范围里
BUTTON_Z = 126  # 按键中心的高度
FRONT_PAD = (BUTTON_Z, 9, 26)  # 前面按键包胶区：中心高度、宽、长
BACK_PAD = (65, 14, 70)  # 背面防滑包胶区
UP = (Align.CENTER, Align.CENTER, Align.MIN)

MODEL = PartModel(
    id="toothbrush_handle",
    title="电动牙刷手柄",
    subtitle="变截面放样 · 按键平面 · 包胶槽 · 密封",
    level="进阶",
    teaches=["截面沿长度变化：握得稳，也摸得出方向", "按键放在平面上", "包胶槽边缘要有封胶台阶", "按键和充电口都不开通孔到外面"],
    params=[
        Param("L", "长度", "mm", 190, feature="sk1"),
        Param("rb", "底边圆角", "mm", 4, feature="fil1"),
        Param("t", "壁厚", "mm", 2, [2, 2.5], feature="shell1"),
        Param("g", "包胶厚", "mm", 1.2, [0.8, 1.2], feature="cut2"),
        Param("dh", "按键孔径", "mm", 5, feature="hole1"),
        Param("dc", "充电凹槽直径", "mm", 9, feature="cut3"),
        Param("hc", "充电凹槽深", "mm", 12, feature="cut3"),
    ],
    features=[
        Feature(
            "sk1", "sketch", "草图1", "六个截面",
            why="手柄沿长度方向画六个椭圆截面：底部接近圆，放在充电座上不挑方向；握持段左右宽、前后扁，手一握就知道刷头朝哪边；拇指的位置前面再鼓起一点，留给按键。截面一变，手感就变，这比在外形上加花纹管用。",
            summary="6 个截面 · 高 0 → {L}",
            pitfall="截面的间距要大致均匀。间距忽大忽小，放样会在截面之间鼓出没画过的包。",
            view=(1.2, -0.8, 0.5),
        ),
        Feature(
            "loft1", "loft", "放样1", "手柄主体",
            why="把六个截面放样成一个光顺的实体。侧面是一张连续的曲面，从底部一直到顶部，没有接缝，握在手里摸不到棱。",
            summary="6 个截面 · 光顺",
            view=(1.2, -0.8, 0.5),
        ),
        Feature(
            "fil1", "fillet", "圆角1", "底边圆角",
            why="底边倒 R4。圆角放在抽壳之前，抽壳会把它偏移成同心的内圆角，底部转角的壁厚和侧壁一样。",
            summary="R{rb}",
            pitfall="圆角小于壁厚，抽壳后内侧就成了尖角，跌落时这里最先裂。",
            view=(1, -1, -0.6),
        ),
        Feature(
            "cut1", "cut", "切除1", "按键平面",
            why="在拇指鼓起的地方平切一刀，切出一块平面放按键。平面让按键好找、好按，也让包胶的边是一条平面上的曲线，模具好做。只在 z ≥ 80 的范围切：下面的握持段更胖，不能一起削掉；切的位置正好让平面的上下两头自然收在曲面上，没有台阶。",
            summary="离中心线 10.8 · 高于 z = 80",
            pitfall="平面切得太深，会在上下两头切出台阶；太浅，平面只剩一条细缝，按键放不下。",
            view=(0.6, -1.4, 0.2),
            focus=lambda p: ((-16, -16, 80), (16, 16, 175)),
        ),
        Feature(
            "shell1", "shell", "抽壳1", "掏空手柄",
            why="从顶面打开抽壳，电机、电池和电路板做成一个机芯，从顶部整个插进去，顶部再用密封圈和顶盖封住。手柄本身是一个只在顶上开口的杯子，底部和侧面都没有缝。",
            summary="壁厚 {t} · 移除顶面",
            view=(0.8, -1, 1.4),
        ),
        Feature(
            "cut2", "cut", "切除2", "软胶包胶槽",
            why="前面按键处和背面握持处各切一个和外表面平行的浅槽，第二次注塑时 TPE 软胶填进来，表面和硬胶齐平。槽的边是一圈垂直的台阶：模具在台阶外面压住硬胶，软胶流不出去，边缘也有足够的厚度，不会翘起来。",
            summary="槽深 = 包胶厚 {g} · 前后 2 处",
            pitfall="包胶的边削成斜坡、越来越薄，模具压不住，软胶会溢出一层毛边，薄边也容易被指甲抠起来。",
            view=(1.1, 1.2, 0.35),  # 从背后看握持区的包胶槽，前面的按键区在下一步看
            focus=lambda p: ((-16, -16, 25), (16, 16, 105)),
        ),
        Feature(
            "hole1", "hole", "孔1", "按键孔",
            why="在按键包胶区中间打一个孔，穿过剩下的硬胶壁。软胶包上来以后把孔整个盖住，按键就是一块软胶膜，手指隔着它按下面的开关。外面看不到孔，水也进不去。孔边离包胶槽边留 2 mm，作为软胶和硬胶粘合的密封面。",
            summary="Ø{dh} · 只穿前壁",
            pitfall="按键做成单独的硬件、四周留一圈缝，水和牙膏沫就会从缝里渗进去。",
            view=(0.6, -1.4, 0.2),
            focus=lambda p: ((-16, -16, 100), (16, 16, 150)),
        ),
        Feature(
            "cut3", "cut", "切除3", "充电凹槽",
            why="底部切一个凹槽，坐在充电座的立柱上；线圈绕在凹槽四周，隔着塑料感应充电，手柄上不用开任何金属触点。凹槽伸进了手柄里面，所以先在内腔里长一个杯子，再在杯子里切槽：杯壁和杯底也是一个壁厚，手柄仍然是密封的。",
            summary="Ø{dc} × {hc} · 杯壁 = 壁厚",
            pitfall="直接在底板上切 12 mm 深的槽，会把底板切穿，手柄里外就通了。",
            view=(0.7, -0.9, -1.4),
        ),
    ],
    failures={
        "shell1": "抽壳失败：壁厚相对拇指处的曲率太大。",
        "cut2": "包胶槽太深，切穿了硬胶壁。",
        "cut3": "充电凹槽把底部切穿了：杯子不够高，或者壁厚不够。",
    },
)


def build(p, r):
    t, g = p["t"], p["g"]
    s = p["L"] / 190

    # @step sk1
    ovals = [Pos(0, 0, z * s) * Ellipse(a, b) for z, a, b in SECTIONS]
    zw, aw, bw = SECTIONS[2]  # 腰部截面
    r.sketch(
        "sk1", ovals, Plane.XY, size=60, plane_name="上视基准面", center=(0, 0, 0),
        dims=[
            Dim((16, 0, 0), (16, 0, p["L"]), (1, 0, 0), 10, f"{p['L']:g}"),
            Dim((-aw, 0, zw * s), (aw, 0, zw * s), (0, -1, 0), 16, f"{2 * aw:g}"),
            Dim((0, -bw, zw * s), (0, bw, zw * s), (1, 0, 0), 18, f"{2 * bw:g}"),
        ],
    )

    # @step loft1
    handle = loft(ovals)
    r.solid("loft1", handle)

    # @step fil1
    bottom_edge = handle.faces().sort_by(Axis.Z)[0].edges()
    handle = fillet(bottom_edge, radius=p["rb"])
    r.solid("fil1", handle)

    # @step cut1
    knife = Pos(0, -FLAT_Y, FLAT_Z0 * s) * Box(60, 30, 200, align=(Align.CENTER, Align.MAX, Align.MIN))  # 平面以外、z ≥ 80 的一块
    handle -= knife
    r.check("cut1", len(handle.faces().filter_by(GeomType.PLANE)) == 3, "按键平面没有切出来")
    r.solid("cut1", handle)

    # @step shell1
    outer = handle  # hide
    top = handle.faces().sort_by(Axis.Z)[-1]
    handle = offset(handle, amount=-t, openings=top)
    r.check("shell1", handle.volume < 0.5 * outer.volume, "抽壳后体积几乎没变：内核静默出错")
    r.solid("shell1", handle)

    # @step cut2
    skin = outer - offset(outer, amount=-g)  # outer 是抽壳前的实心手柄：取它外表面往里一层包胶厚的皮
    z0, w0, h0 = FRONT_PAD
    z1, w1, h1 = BACK_PAD
    front = extrude(Plane.XZ * Pos(0, z0 * s) * SlotCenterToCenter(h0 - w0, w0, rotation=90), amount=30)  # 朝前
    back = extrude(Plane.XZ * Pos(0, z1 * s) * SlotCenterToCenter(h1 - w1, w1, rotation=90), amount=-30)  # 朝后
    handle -= skin & (front + back)
    r.check("cut2", len(handle.solids()) == 1 and g < t, "包胶槽切穿了硬胶壁")
    r.solid("cut2", handle)

    # @step hole1
    handle -= Pos(0, -FLAT_Y, BUTTON_Z * s) * Rot(90, 0, 0) * Cylinder(p["dh"] / 2, 8)  # 只穿前壁
    r.solid("hole1", handle)

    # @step cut3
    dc, hc = p["dc"], p["hc"]
    cup = Pos(0, 0, t / 2) * Cylinder(dc / 2 + t, hc + t / 2, align=UP)  # 先在内腔里长一个杯子
    handle = handle + cup - Pos(0, 0, -1) * Cylinder(dc / 2, hc + 1, align=UP)  # 再在杯子里切槽
    r.check("cut3", handle.is_inside((0, 0, hc + t / 2)), "充电凹槽切穿了杯底")
    r.solid("cut3", handle)
    return handle
