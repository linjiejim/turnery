import * as THREE from "three"
import { expect, it } from "vitest"
import { closestOnLine, moveLabel, moveStep } from "@/three/move-gizmo"

it("moves in round steps that suit the zoom", () => {
  // About three pixels a step: 1, 2 or 5 × 10ⁿ mm.
  expect(moveStep(0.25)).toBe(1)
  expect(moveStep(0.05)).toBeCloseTo(0.2)
  expect(moveStep(1)).toBe(5)
  expect(moveStep(3)).toBe(10)
  expect(moveStep(0.002)).toBeCloseTo(0.01)
})

it("finds how far along an axis the pointer's ray passes closest, in either projection", () => {
  const origin = new THREE.Vector3(1, 2, 3)
  // A ray across the Z axis at height 10 (as a perspective ray from the side).
  const across = new THREE.Ray(new THREE.Vector3(101, 2, 13), new THREE.Vector3(-1, 0, 0))
  expect(closestOnLine(origin, new THREE.Vector3(0, 0, 1), across)).toBeCloseTo(10)
  // Slanted rays meet it at the same place as a straight one through the same point.
  const slanted = new THREE.Ray(new THREE.Vector3(1, -98, 13 + 100), new THREE.Vector3(0, 1, -1).normalize())
  expect(closestOnLine(origin, new THREE.Vector3(0, 0, 1), slanted)).toBeCloseTo(10)
  // Looking straight along the axis: no one place is nearest.
  const along = new THREE.Ray(new THREE.Vector3(1, 2, 50), new THREE.Vector3(0, 0, -1))
  expect(closestOnLine(origin, new THREE.Vector3(0, 0, 1), along)).toBeNull()
})

it("says how far a part has moved, to the step's precision", () => {
  expect(moveLabel(2, 18, 1)).toBe("Z +18")
  expect(moveLabel(0, -0.5, 0.1)).toBe("X −0.5")
  expect(moveLabel(1, 0, 1)).toBe("Y 0")
  expect(moveLabel(1, 0.3, 1)).toBe("Y 0")
  expect(moveLabel(0, 1.25, 0.05)).toBe("X +1.25")
})
