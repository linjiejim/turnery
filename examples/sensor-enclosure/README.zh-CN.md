# 传感器外壳

[English](README.md) · 简体中文

![两件式外壳](../../docs/media/enclosure.png)

一个两件式、可 3D 打印的外壳，由 coding agent 通过 Turnery 的 MCP 工具建成：从空文件到核对通过，一共 15 次工具调用。这个文件夹里的内容都是 agent 写的，没有手工改过。

## 需求

> 用 turnery 建一个传感器外壳：外形 80×50×28，壁厚 2，四角 R6。分成底壳和上盖，四角用 M3 沉头螺钉拧进底壳的热熔螺母。前壁开一个 USB-C 口，上盖开 5 条散热槽，刻上 TURNERY。建完核对尺寸再看一眼。

## agent 交出来的

`enclosure.turnery.json` 就是整个零件：11 个有名字的参数、17 个特征、5 项需求核对。

| # | 特征 | 工具 | 为什么（agent 写的 `intent`） |
| --- | --- | --- | --- |
| 1 | 实心外形 | `sketch` + `extrude` | 先拉出一整块实心，两半的外形天然对齐 |
| 2 | 顶面圆角 | `fillet` | 上盖外缘倒圆 |
| 3 | 挖内腔 | `sketch` + `extrude`（切除） | 上下各留一个壁厚 |
| 4 | 螺丝柱 | `sketch` + `extrude`（`until: "next"`） | 柱子长到碰到内顶为止，所以跟着总高变 |
| 5 | 分成底壳和上盖 | `split` | 在 `zs` 高度一刀切开，螺丝柱和外形保持对齐 |
| 6 | 热熔螺母孔 | `hole`（`M3`、`fit: "insert"`） | 标准的热熔螺母孔，不用查表 |
| 7 | 沉头螺钉孔 | `hole`（`M3`、`head: "csink"`） | 螺钉头和顶面齐平 |
| 8 | USB-C 开口 | `sketch` + `extrude`（切除） | 切穿前壁 |
| 9 | 散热槽 ×5 | `extrude`（切除）+ `linear_pattern` | 个数和间距可以直接改 |
| 10 | 刻字 | `sketch`（文字）+ `extrude`（切除） | 浅刻 0.4 mm |

![特征树一步一步长出来](../../docs/media/feature-tree-steps.png)

核对项存在文件里，每次重建由内核重新量一遍：

```
✓ size     外形 80×50×28            要求 80 × 50 × 28，实际 80 × 50 × 28
✓ wall     壁厚 2                   要求 2 mm，实际 2 mm
✓ inserts  四角 M3 热熔螺母         要求 4 个 ⌀4，实际 4 个 ⌀4
✓ screws   上盖 4 个 M3 沉头过孔    要求 4 个 ⌀3.4，实际 4 个 ⌀3.4
✓ seat     上盖要落在底壳上,不能有缝  要求 贴在一起，实际 接触（距离 0）
```

![过两根螺丝柱的剖面](../../docs/media/enclosure-section.png)

## 试一下

在 Turnery 里打开这个文件（「文件 → 打开…」，或者 `turnery open examples/sensor-enclosure/enclosure.turnery.json`），然后：

- 在「参数」里把 `t` 从 2 拖到 3。内腔、螺丝柱和孔都跟着变；`wall` 这项核对变红，因为需求写的是 2。
- 把 `H` 改成 40。螺丝柱是按「长到下一个面为止」建的，会跟着盒子长高。
- 点前壁，留一条备注，例如「把 USB-C 口换成 Micro-USB，宽 8 高 3」，再让 agent 去读备注。
- 不开窗口重新核对：`turnery check examples/sensor-enclosure/enclosure.turnery.json --no-app`
- 导出：`turnery export examples/sensor-enclosure/enclosure.turnery.json out/enclosure.step`（或者 `.stl`：每个零件一个文件，打成一个 zip）。
