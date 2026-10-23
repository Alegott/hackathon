import type { Feature, Polygon, LineString, MultiPolygon } from "geojson"
import { expect, it } from "vitest"
import { aCoordinateGeografiche, aCoordinateMetriche } from "./territorio"
import { creaVincoliHabitat } from "./vincoliHabitat"

const centro = aCoordinateMetriche([11.546, 45.547])
const p = (x: number, y: number) => aCoordinateGeografiche([centro[0] + x, centro[1] + y])
const ring = (a: number, b: number, c: number, d: number) => [p(a, b), p(c, b), p(c, d), p(a, d), p(a, b)]
const casa: Feature<Polygon> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring(-20, -20, 20, 20)] } }

it("esclude l'impronta delle case e un margine per la chioma, anche sugli angoli", () => {
  const libero = creaVincoliHabitat([casa], [], [])
  expect(libero(p(0, 0), 8)).toBe(false)
  expect(libero(p(25, 0), 8)).toBe(false)
  expect(libero(p(24, 24), 8)).toBe(false)
  expect(libero(p(30, 30), 8)).toBe(true)
})

it("esclude acqua MultiPolygon e rive, preservando le isole abbastanza grandi", () => {
  const acqua: Feature<MultiPolygon> = { type: "Feature", properties: {}, geometry: {
    type: "MultiPolygon", coordinates: [[ring(-100, -100, 100, 100), ring(-25, -25, 25, 25)], [ring(200, 200, 250, 250)]],
  } }
  const libero = creaVincoliHabitat([], [acqua], [])
  expect(libero(p(50, 50), 8)).toBe(false)
  expect(libero(p(104, 0), 8)).toBe(false)
  expect(libero(p(220, 220), 8)).toBe(false)
  expect(libero(p(0, 0), 8)).toBe(true)
})

it("protegge anche fiumi e canali lineari con la loro larghezza e il margine dell'animale", () => {
  const corso: Feature<LineString> = { type: "Feature", properties: { class: "river", width: 20 }, geometry: {
    type: "LineString", coordinates: [p(-100, 0), p(100, 0)],
  } }
  const libero = creaVincoliHabitat([], [], [corso])
  expect(libero(p(0, 0), 12)).toBe(false)
  expect(libero(p(0, 20), 12)).toBe(false)
  expect(libero(p(0, 25), 12)).toBe(true)
})
