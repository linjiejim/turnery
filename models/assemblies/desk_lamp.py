"""桌面台灯: a weighted base, an aluminium arm, a friction hinge and a lamp
head that tilts about it, with the cable routed through all of them.

The base is a zinc die-casting with a steel plate underneath, so most of the
mass sits low and a little behind the lamp head; the hinge is a bought-in
torque hinge whose disc springs press friction washers against the head's
lug, so the head keeps one rotational degree of freedom and stays where it
is put; the LED board is screwed flat against the aluminium head, which is
its heat sink; the cable runs out of the base, up the arm, through one cheek
of the hinge and along the hollow axle, so it only twists on the axis when
the head tilts.

The site moves one part per joint, so the head's housing, LED board and
diffuser are one rigid sub-assembly here (they move together anyway).
"""

from math import atan, degrees

from build123d import (
    Align,
    Axis,
    Box,
    Circle,
    Compound,
    Cylinder,
    FilletPolyline,
    Plane,
    Polygon,
    Pos,
    Rectangle,
    RectangleRounded,
    Rot,
    extrude,
    fillet,
    offset,
    revolve,
    sweep,
)

from turnerybake import AssemblyModel, Part

R_BASE, H_BASE, T_BASE = 80.0, 20.0, 3.0  # 底座半径、高度、压铸壁厚
XP = -45.0  # 灯杆的位置：在底座中心后面 45
TUBE_R, TUBE_T = 10.0, 1.6  # 灯杆：Ø20 铝管，壁厚 1.6
Z_LEDGE, Z_COLLAR = 14.0, 34.0  # 灯杆插到 z = 14 的台阶上，底座上的套筒顶面
Z_TOP = 388.0  # 灯杆顶面
ZH = 412.0  # 铰链轴线高度
LUG_HALF, WASHER = 7.0, 0.5  # 灯头关节半宽、摩擦垫片厚
CHEEK = 7.0  # 铰链座两侧耳板厚
HEAD_W, HEAD_H, HEAD_L = 44.0, 18.0, 300.0  # 灯头铝型材截面和长度
X0 = XP + 20  # 灯头型材的起点：离轴线 20，转到限位也碰不到铰链座
CABLE_R = 1.8  # 电线 Ø3.6
TILT = (-25, 60)  # 灯头俯仰的限位
NOTE_NUMBERS = (278, 1.9, 7, 94, 38, 0.37)  # 设计说明里的数：灯头伸出、整灯重、重心 x / z、倾倒角、灯头力矩
UP = (Align.CENTER, Align.CENTER, Align.MIN)

# 密度 g/mm³：算重心用
DENSITY = {"base": 6.6e-3, "weight": 7.85e-3, "pad": 1.1e-3, "arm": 2.7e-3, "hinge": 7.85e-3, "cable": 2.5e-3}
HEAD_DENSITY = {"housing": 2.7e-3, "board": 2.7e-3, "diffuser": 1.2e-3}

MODEL = AssemblyModel(
    id="desk_lamp",
    title="桌面台灯",
    subtitle="配重 · 阻尼铰链 · 散热 · 走线",
    level="进阶",
    teaches=["重心落在底座里面，台灯才不会倒", "阻尼铰链只留一个转动自由度", "LED 的热量导进铝灯头", "电线从铰链的空心轴里穿过去"],
    parts=[
        Part(
            "base", "底座", 1, "锌合金", "压铸 + 喷粉", "model", (0, 0, 0), 1,
            "整灯最重的零件。锌合金密度 6.6，接近钢，又能压铸出套筒、螺丝柱和走线槽。壁厚 3 处处一致，套筒插灯杆的深度 20，等于灯杆的直径。",
        ),
        Part(
            "arm", "灯杆 Ø20", 1, "铝 6063", "挤出 + 阳极氧化", "metal", (0, 0, 40), 2,
            "一根挤出的铝管，长度按需切断就行，不用开模。管子中空，电线从里面走。下端插进底座套筒，从底下用螺丝锁住。",
        ),
        Part(
            "cable", "电源线", 1, "PVC", "外购", "modelDark", (0, -70, 0), 3,
            "从底座后面出线，护线套卡在出线孔里，拉电线时力不会传到里面的焊点。电线在灯杆里一路向上，从铰链的一侧耳板里拐进空心轴，停在轴线上。",
        ),
        Part(
            "hinge", "阻尼铰链", 1, "钢", "外购", "modelDark", (0, 0, 90), 4,
            "外购的阻尼转轴模组：座子插进灯杆顶端，两片耳板夹住灯头关节，碟簧和螺母把摩擦垫片压紧。螺母拧得越紧，转起来越沉。轴是空心的，电线从里面穿过。",
        ),
        Part(
            "head", "灯头组件", 1, "铝 6063 + PC", "挤出 + 注塑", "metal", (60, 0, 140), 5,
            "铝型材外壳兼散热器，顶上 5 片散热筋；LED 铝基板贴着型材的内顶面装，中间夹导热垫；底下卡一片 PC 扩散板，把一颗颗 LED 的亮点匀开。三者装成一个组件，一起绕铰链转。",
            motion={"type": "revolute", "origin": [XP, 0, ZH], "axis": [0, -1, 0], "min": TILT[0], "max": TILT[1], "label": "灯头俯仰"},
        ),
        Part(
            "weight", "配重板", 1, "钢", "冲压", "metal", (0, 0, -45), 6,
            "一块 6 mm 厚的钢板，用三颗螺丝锁在底座里面的螺丝柱上。钢比锌便宜，又放在最低处，把整灯的重心往下拉。",
        ),
        Part(
            "pad", "防滑垫", 1, "硅胶", "模压", "modelDark", (0, 0, -75), 7,
            "整张贴在底面，盖住配重板的三颗螺丝，同时防滑、防刮桌面。",
        ),
    ],
    notes=[],  # filled in below from the computed numbers
)


def base():
    """Die-cast base: a revolved dome, shelled from below, with the arm socket, screw bosses and cable channel."""
    profile = Polygon((0, 0), (R_BASE - 1, 0), (R_BASE, 1), (R_BASE, H_BASE), (0, H_BASE), align=None)
    shell = revolve(Plane.XZ * profile, Axis.Z)
    shell = fillet(shell.edges().group_by(Axis.Z)[-1], radius=10)
    shell = offset(shell, amount=-T_BASE, openings=shell.faces().sort_by(Axis.Z)[0])
    collar = Pos(XP, 0, 8) * Cylinder(16, Z_COLLAR - 8, align=UP)
    collar = fillet(collar.edges().group_by(Axis.Z)[-1], radius=2)
    bosses = [Pos(x, y, 6) * Cylinder(4, H_BASE - T_BASE - 6 + 0.5, align=UP) for x, y in SCREWS]
    part = shell + collar + bosses
    part -= Pos(XP, 0, Z_LEDGE) * Cylinder(TUBE_R + 0.15, 40, align=UP)  # 套筒孔，灯杆插到台阶上
    part -= Pos(XP, 0, 0) * Cylinder(7.5, 20, align=UP)  # 台阶下面让电线通过
    part -= [Pos(x, y, 5) * Cylinder(1.25, 10, align=UP) for x, y in SCREWS]  # 配重板螺丝底孔
    part -= Pos(-R_BASE, 0, 12) * Rot(0, 90, 0) * Cylinder(3.5, 12)  # 出线孔，护线套卡在这里
    return part - sweep(Plane(cable_path() @ 0, z_dir=cable_path() % 0) * Circle(CABLE_R + 0.5), cable_path())


SCREWS = [(55, 0), (-27.5, 47.6), (-27.5, -47.6)]  # 配重板的三颗螺丝


def weight():
    plate = Cylinder(74, 6, align=UP)
    return plate - [Pos(x, y, 0) * Cylinder(1.8, 6, align=UP) for x, y in SCREWS]


def pad():
    disc = Pos(0, 0, -1.5) * Cylinder(R_BASE - 2, 1.5, align=UP)
    return fillet(disc.edges().group_by(Axis.Z)[0], radius=0.6)


def arm():
    tube = Pos(XP, 0, Z_LEDGE) * Cylinder(TUBE_R, Z_TOP - Z_LEDGE, align=UP)
    return tube - Pos(XP, 0, Z_LEDGE) * Cylinder(TUBE_R - TUBE_T, Z_TOP - Z_LEDGE, align=UP)


def cable_path():
    """From the table, into the back of the base, up the arm, through the hinge cheek, along the axle."""
    return FilletPolyline(
        (-170, 0, CABLE_R), (-105, 0, CABLE_R), (-92, 0, 12), (XP, 0, 12),  # 桌面 → 底座后面
        (XP, 0, 393),  # 灯杆里一路向上
        (XP, -11, 393), (XP, -11, ZH), (XP, 0, ZH),  # 拐进耳板，再沿空心轴到轴线上
        radius=5,
    )


def cable():
    path = cable_path()
    wire = sweep(Plane(path @ 0, z_dir=path % 0) * Circle(CABLE_R), path)
    grommet = Pos(-R_BASE - 2, 0, 12) * Rot(0, 90, 0) * Cylinder(3.5, 14)  # 护线套
    return Compound([wire, grommet - wire])


def hinge():
    """Bought-in torque hinge: a plug into the arm, a block, two cheeks, a hollow axle, friction washers, disc springs, a nut."""
    plug = Pos(XP, 0, Z_TOP - 15) * Cylinder(TUBE_R - TUBE_T - 0.05, 15, align=UP)
    block = Pos(XP, 0, Z_TOP) * extrude(RectangleRounded(22, 2 * (LUG_HALF + WASHER + CHEEK), 4), amount=10)
    cheek_profile = Pos(0, ZH - 7) * (Rectangle(18, 14) + Pos(0, 7) * Circle(9))
    cheeks = [
        extrude(Plane.XZ.offset(-y) * Pos(XP, 0) * cheek_profile, amount=CHEEK / 2, both=True)
        for y in (LUG_HALF + WASHER + CHEEK / 2, -(LUG_HALF + WASHER + CHEEK / 2))
    ]
    seat = plug + block + cheeks
    axle_len = 2 * (LUG_HALF + WASHER + CHEEK) + 8
    axle = Pos(XP, -2, ZH) * Rot(90, 0, 0) * (Cylinder(4, axle_len) - Cylinder(2.5, axle_len))
    head_y = LUG_HALF + WASHER + CHEEK
    axle_head = Pos(XP, head_y + 1, ZH) * Rot(90, 0, 0) * (Cylinder(6.5, 2) - Cylinder(2.5, 2))
    washers = [Pos(XP, s * (LUG_HALF + WASHER / 2), ZH) * Rot(90, 0, 0) * (Cylinder(8, WASHER) - Cylinder(4.1, WASHER)) for s in (1, -1)]
    springs = [Pos(XP, -head_y - 0.6 - 1.2 * i, ZH) * Rot(90, 0, 0) * (Cylinder(6.5, 1.0) - Cylinder(4.1, 1.0)) for i in range(3)]
    nut = Pos(XP, -head_y - 3.6 - 2.5, ZH) * Rot(90, 0, 0) * (Cylinder(6.5, 5) - Cylinder(4, 5))
    path = cable_path()
    channel = sweep(Plane(path @ 0, z_dir=path % 0) * Circle(CABLE_R + 0.5), path)
    return Compound([seat - channel, axle - channel, axle_head, *washers, *springs, nut])


def head_pieces():
    """The head sub-assembly: aluminium extrusion with fins, end caps and lug, LED board, PC diffuser."""
    plane = Plane(origin=(X0, 0, ZH), x_dir=(0, 1, 0), z_dir=(1, 0, 0))  # 型材截面画在 YZ 面上，沿 X 挤出
    outer = RectangleRounded(HEAD_W, HEAD_H, 5)
    cavity = Rectangle(HEAD_W - 4, HEAD_H - 4)  # 壁厚 2 的内腔
    opening = Pos(0, -HEAD_H / 2 + 1) * Rectangle(HEAD_W - 8, 2.2)  # 底部开口，两侧留 2 mm 唇边托住扩散板
    fins = [Pos(y, HEAD_H / 2 + 2.4) * Rectangle(1.6, 5) for y in (-16, -8, 0, 8, 16)]  # 散热筋
    profile = outer - cavity - opening + fins
    housing = extrude(plane * profile, amount=HEAD_L)
    caps = [extrude(Plane(origin=(x, 0, ZH), x_dir=(0, 1, 0), z_dir=(1, 0, 0)) * outer, amount=3) for x in (X0 - 3, X0 + HEAD_L)]
    lug = Pos(XP, 0, ZH) * Rot(90, 0, 0) * Cylinder(9, 2 * LUG_HALF)
    tongue = Pos((XP + X0 - 3) / 2, 0, ZH) * Box(X0 - 3 - XP, 2 * LUG_HALF, 16)
    knuckle = (lug + tongue) - Pos(XP, 0, ZH) * Rot(90, 0, 0) * Cylinder(4.1, 2 * LUG_HALF)
    board_top = ZH + HEAD_H / 2 - 2  # 型材内顶面：铝基板就贴在这里
    board = Pos(X0 + HEAD_L / 2, 0, board_top - 1.6) * Box(HEAD_L - 10, 34, 1.6, align=UP)
    leds = [Pos(X0 + 12 + 14 * i, y, board_top - 2.4) * Box(3, 3, 0.8, align=UP) for i in range(20) for y in (-7, 7)]
    diffuser = Pos(X0 + HEAD_L / 2, 0, ZH - HEAD_H / 2 + 2) * Box(HEAD_L - 2, HEAD_W - 5, 1.5, align=UP)  # 搭在唇边上
    return {
        "housing": Compound([housing, *caps, knuckle]),
        "board": Compound([board, *leds]),
        "diffuser": diffuser,
    }


def head():
    return Compound(list(head_pieces().values()))


def mass_props(shapes: dict) -> tuple[float, tuple[float, float, float]]:
    """Total mass (g) and centre of mass of the lamp, from the parts' volumes and densities."""
    items = [(shapes[k], d) for k, d in DENSITY.items()] + [(s, HEAD_DENSITY[k]) for k, s in head_pieces().items()]
    total, mx, my, mz = 0.0, 0.0, 0.0, 0.0
    for shape, d in items:
        for solid in shape.solids():
            m = solid.volume * d
            c = solid.center()
            total += m
            mx, my, mz = mx + m * c.X, my + m * c.Y, mz + m * c.Z
    return total, (mx / total, my / total, mz / total)


def head_torque() -> float:
    """Gravity torque of the head about the hinge axis when it is level (N·m)."""
    m, mx = 0.0, 0.0
    for k, s in head_pieces().items():
        for solid in s.solids():
            m += solid.volume * HEAD_DENSITY[k]
            mx += solid.volume * HEAD_DENSITY[k] * (solid.center().X - XP)
    return m / 1000 * 9.81 * (mx / m) / 1000


def build():
    shapes = {"base": base(), "arm": arm(), "cable": cable(), "hinge": hinge(), "head": head(), "weight": weight(), "pad": pad()}
    fixed = Compound([shapes[k] for k in ("base", "arm", "hinge", "weight", "pad")])
    for angle in TILT:  # 灯头转到两头的限位，都不能撞上别的零件
        tilted = Pos(XP, 0, ZH) * Rot(0, -angle, 0) * Pos(-XP, 0, -ZH) * shapes["head"]
        clash = sum(s.volume for s in (tilted & fixed).solids())
        assert clash < 1, f"head at {angle}° hits the lamp: {clash:.1f} mm³"
    MODEL.notes = notes(shapes)
    return shapes


def notes(shapes: dict) -> list[str]:
    """The design notes, with the numbers measured on the parts (en/teardown-text.ts repeats them)."""
    total, (cx, _, cz) = mass_props(shapes)
    tip = degrees(atan((R_BASE - cx) / cz))
    print(f"  desk_lamp: {total:.0f} g, centre of mass x {cx:.1f} z {cz:.1f}, tips at {tip:.1f}°, head torque {head_torque():.3f} N·m")
    measured = (round(X0 + HEAD_L + 3), round(total / 1000, 1), round(cx), round(cz), round(tip), round(head_torque(), 2))
    # en/teardown-text.ts writes these numbers out: change them there too when the lamp changes.
    assert measured == NOTE_NUMBERS, f"desk_lamp notes changed: {measured}, update NOTE_NUMBERS and the English notes"
    return [
        f"灯头一直伸到底座中心前面 {X0 + HEAD_L + 3:.0f} mm，可整灯 {total / 1000:.1f} kg 的重心只在中心前面 {cx:.0f} mm、离桌面 {cz:.0f} mm。重心的投影落在底座里面，台灯就不会倒；要往前倾到 {tip:.0f}°，重心才越过底座边缘。",
        "要让重心又低又靠后：最重的零件放在最下面（压铸底座加钢配重板），灯杆放在底座中心偏后的位置，给往前伸的灯头留出平衡的余地。",
        f"灯头只能绕铰链轴线转：轴穿过灯头关节，挡住了垂直于轴线的两个移动和另外两个方向的转动；两片耳板夹住关节两端，挡住了沿轴线的移动。6 个自由度只剩绕轴线转这 1 个。限位从 {TILT[0]}° 到 {TILT[1]}°，转到两头都不会撞到灯杆和铰链座。",
        f"阻尼铰链靠摩擦力矩把灯头停在任意角度：灯头水平时自重产生约 {head_torque():.2f} N·m 的力矩，碟簧压紧后的摩擦力矩要比它大一些，灯头不会自己往下掉，手一推又能转。",
        "LED 发的热先进铝基板，再隔着导热垫进铝型材，最后从顶上的散热筋散到空气里。铝的导热系数约 200 W/(m·K)，塑料只有 0.2 左右，差了约一千倍，所以灯头外壳用铝而不用塑料。",
        "电线从铰链一侧的耳板拐进空心轴，停在轴线上。灯头转动时，电线只在轴心处扭一点，不会被来回弯折，也不会被关节夹住。",
    ]

