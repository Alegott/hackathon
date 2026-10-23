import { expect, it } from "vitest"
import { creaGeometriaNuvola } from "./nuvole"

it("genera una superficie organica finita e compatta per le nuvole", () => {
  const g = creaGeometriaNuvola()
  const p = g.getAttribute("position")
  expect(p.count).toBeGreaterThan(300)
  expect(p.count).toBeLessThan(24000)
  expect([...p.array].every(Number.isFinite)).toBe(true)
  g.computeBoundingBox()
  expect(g.boundingBox!.min.x).toBeCloseTo(-1)
  expect(g.boundingBox!.max.z).toBeCloseTo(1)
  g.dispose()
})
