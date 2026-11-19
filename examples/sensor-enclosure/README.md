# Sensor enclosure

English · [简体中文](README.zh-CN.md)

![Two-piece enclosure](../../docs/media/enclosure.png)

A two-piece, 3D-printable enclosure built by a coding agent through Turnery's MCP tools: 15 tool calls from an empty file to a checked part. Everything in this folder was written by the agent; nothing was edited by hand.

## The request

The request was written in Chinese, so the feature names, the intents and the wording of the checks in the file are Chinese too. They are translated below.

> Build a sensor enclosure with turnery: 80×50×28, 2 mm walls, R6 corners. Split it into a base and a lid, held by four M3 countersunk screws into heat-set inserts in the base. USB-C opening in the front wall, five vent slots in the lid and "TURNERY" engraved on it. Check the dimensions and take a look when you are done.

## What the agent produced

`enclosure.turnery.json` is the whole part: 11 named parameters, 17 features, 5 requirement checks.

| # | Feature | Tool | Why (the `intent` the agent wrote) |
| --- | --- | --- | --- |
| 1 | Solid block (实心外形) | `sketch` + `extrude` | One solid block first, so the two halves line up by construction |
| 2 | Top fillet (顶面圆角) | `fillet` | Round the lid's outer edge |
| 3 | Cavity (挖内腔) | `sketch` + `extrude` (cut) | Leave one wall thickness top and bottom |
| 4 | Screw posts (螺丝柱) | `sketch` + `extrude` (`until: "next"`) | Posts grow until they hit the ceiling, so they follow the height |
| 5 | Base and lid (分成底壳和上盖) | `split` | One cut at `zs`; posts and outline stay aligned |
| 6 | Insert holes (热熔螺母孔) | `hole` (`M3`, `fit: "insert"`) | Standard insert pocket, no table lookup |
| 7 | Countersunk screw holes (沉头螺钉孔) | `hole` (`M3`, `head: "csink"`) | Screw heads sit flush |
| 8 | USB-C opening (USB-C 开口) | `sketch` + `extrude` (cut) | Slot through the front wall |
| 9 | Vent slots ×5 (散热槽) | `extrude` (cut) + `linear_pattern` | Count and spacing stay editable |
| 10 | Label (刻字) | `sketch` (text) + `extrude` (cut) | 0.4 mm deep label |

![The feature tree, step by step](../../docs/media/feature-tree-steps.png)

The checks are stored in the file and re-measured by the kernel on every rebuild:

```
✓ size     80×50×28 overall                     expected 80 × 50 × 28, measured 80 × 50 × 28
✓ wall     2 mm walls                           expected 2 mm, measured 2 mm
✓ inserts  M3 heat-set inserts in the corners   expected 4 × ⌀4, measured 4 × ⌀4
✓ screws   4 M3 countersunk holes in the lid    expected 4 × ⌀3.4, measured 4 × ⌀3.4
✓ seat     lid sits on the base, no gap         expected touching, measured contact (0 mm)
```

![Section through two screw posts](../../docs/media/enclosure-section.png)

## Try it

Open the file in Turnery (“File → Open…” (文件 → 打开…), or `turnery open examples/sensor-enclosure/enclosure.turnery.json`), then:

- Drag `t` from 2 to 3 in the parameter panel. The cavity, posts and holes follow; the `wall` check turns red because the request said 2.
- Change `H` to 40. The posts were built "until next", so they grow with the box.
- Click the front wall, leave a note such as "make the USB-C opening a Micro-USB one, 8 wide and 3 high", and tell your agent to read the notes.
- Re-check without a window: `turnery check examples/sensor-enclosure/enclosure.turnery.json --no-app`
- Export: `turnery export examples/sensor-enclosure/enclosure.turnery.json out/enclosure.step` (or `.stl`, which gives one file per part in a zip).
