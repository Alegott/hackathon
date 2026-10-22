import { describe, expect, it } from "vitest"
import { dentroProvincia, preparaHabitat, percorsoProvincia, ritagliaEdifici } from "./ecosistema"
import type { Feature, Polygon } from "geojson"
import { aCoordinateGeografiche, aCoordinateMetriche } from "./territorio"
import type { Comune, StatoComune } from "../types"

const centro = aCoordinateMetriche([11.546, 45.547])
const comune: Comune = {
  istat: "024116", nome: "Vicenza", centroide: centro, confinanti: [], ariaNorm: 90, pm10: 20, nCentraline: 5,
  geometria: [[[-800, -800], [800, -800], [800, 800], [-800, 800], [-800, -800]]
    .map(([x, y]) => [centro[0] + x!, centro[1] + y!])],
}
const stato = (fascia: StatoComune["fascia"]): StatoComune => ({
  aria: 80, totale: 80, infrastrutture: 0, scenario: 0, fascia, indiceCaseMedio: 50,
})

describe("provincia ed ecosistema della mappa reale", () => {
  it("elimina gli edifici esterni e taglia quelli che attraversano un confine", () => {
    const area: Polygon = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] }
    const building = (x: number): Feature<Polygon> => ({ type: "Feature", properties: { render_height: 12 },
      geometry: { type: "Polygon", coordinates: [[[x, 2], [x + 2, 2], [x + 2, 4], [x, 4], [x, 2]]] } })
    const result = ritagliaEdifici([building(2), building(9), building(12)], area)
    expect(result.features).toHaveLength(2)
    expect(result.features.every((f) => f.geometry.coordinates.flat(2).every(([x]) => x! <= 10))).toBe(true)
    expect(result.features[1]?.properties?.render_height).toBe(12)
    const tile = building(2)
    tile.properties = Object.assign(Object.create(null), { render_height: 10 })
    expect(ritagliaEdifici([tile], area).features[0]?.properties?.constructor).toBe(Object)
  })
  it("include i centri vicentini ed esclude Verona, Padova e Trento", () => {
    expect(dentroProvincia([11.546, 45.547])).toBe(true)
    expect(dentroProvincia([11.736, 45.767])).toBe(true)
    expect(dentroProvincia([10.99, 45.44])).toBe(false)
    expect(dentroProvincia([11.88, 45.41])).toBe(false)
    expect(dentroProvincia([11.12, 46.07])).toBe(false)
  })
  it("fa sparire la fauna e riduce il verde quando lo scenario peggiora la fascia", () => {
    const buono = preparaHabitat([comune], { "024116": stato("ottima") }, "024116")[0]!
    const pessimo = preparaHabitat([comune], { "024116": stato("pessima") }, "024116")[0]!
    expect(buono.preset.uccelli).toBeGreaterThan(0)
    expect(buono.preset.animali).toBeGreaterThan(0)
    expect(pessimo.preset.uccelli).toBe(0)
    expect(pessimo.preset.animali).toBe(0)
    expect(pessimo.preset.densitaAlberi).toBeLessThan(buono.preset.densitaAlberi)
    expect(pessimo.preset.nebbia).toBeGreaterThan(buono.preset.nebbia)
    expect(buono.alberi.every(dentroProvincia)).toBe(true)
  })
  it("lega il verde alle aree caricate e mantiene la posizione al cambiare dell'indice", () => {
    const verde = aCoordinateGeografiche([centro[0] + 10, centro[1] + 10])
    const h = preparaHabitat([comune], { "024116": stato("buona") }, "024116", [11.546, 45.547], [verde])
    expect(h[0]?.alberi[0]?.[0]).toBeCloseTo(verde[0], 6)
    expect(h[0]?.alberi[0]?.[1]).toBeCloseTo(verde[1], 6)
    expect(preparaHabitat([comune], {}, "024116")).toEqual([])
  })
  it("costruisce una maschera chiusa che segue la proiezione della camera", () => {
    const path = percorsoProvincia(([x, y]) => ({ x: x * 10, y: y * 10 }))
    expect(path.startsWith("M")).toBe(true)
    expect(path.endsWith("Z")).toBe(true)
    expect(path).not.toContain("NaN")
    expect(path).not.toContain("Infinity")
  })
  it("alberi e animali: prima il verde reale, poi il suolo libero (senza edifici), mai fuori dal comune", () => {
    const verde = aCoordinateGeografiche([centro[0] + 10, centro[1] + 10])
    const libero = aCoordinateGeografiche([centro[0] - 20, centro[1] + 30])
    const fuori = aCoordinateGeografiche([centro[0] + 5000, centro[1]])
    const h = preparaHabitat([comune], { "024116": stato("buona") }, "024116", [11.546, 45.547], [verde], 800, [libero, fuori])[0]!
    expect(h.alberi[0]![0]).toBeCloseTo(verde[0], 6)
    expect(h.alberi[1]![0]).toBeCloseTo(libero[0], 6)
    expect(h.alberi[1]![1]).toBeCloseTo(libero[1], 6)
    expect(h.alberi.some((p) => Math.abs(p[0] - fuori[0]) < 1e-6 && Math.abs(p[1] - fuori[1]) < 1e-6)).toBe(false)
  })
  it("espone la fauna del comune e il suo raggio reale", () => {
    const h = preparaHabitat([comune], { "024116": stato("ottima") }, "024116")[0]!
    expect(h.fauna.terra.length).toBeGreaterThan(0)
    expect(h.raggioComune).toBeCloseTo(Math.sqrt((1600 * 1600) / Math.PI), 0) // quadrato 1600 m di lato
    const pessimo = preparaHabitat([comune], { "024116": stato("pessima") }, "024116")[0]!
    expect(pessimo.fauna.terra).toEqual([])
  })
})
