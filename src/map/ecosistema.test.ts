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
  aria: 80, totale: ({ ottima: 90, buona: 70, media: 50, scarsa: 30, pessima: 10 })[fascia], infrastrutture: 0, scenario: 0, fascia, indiceCaseMedio: 50,
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
    // Tutti gli effetti illustrativi rispondono al totale di sostenibilità.
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
    const libero = aCoordinateGeografiche([centro[0] - 80, centro[1] + 100])
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
  it("mantiene il centro geografico delle orbite quando la vista si sposta", () => {
    const indici = { "024116": stato("ottima") }
    const a = preparaHabitat([comune], indici, "024116", aCoordinateGeografiche(centro))[0]!
    const b = preparaHabitat([comune], indici, "024116", aCoordinateGeografiche([centro[0] + 500, centro[1] + 400]))[0]!
    expect(b.centro).toEqual(a.centro)
  })
  it("non ammassa gli alberi nel primo piano e scarta posizioni duplicate", () => {
    const p = aCoordinateGeografiche(centro)
    const h = preparaHabitat([comune], { "024116": stato("ottima") }, "024116", p, [p, p, p], 70, [p, p])[0]!
    const punti = h.alberi.map(aCoordinateMetriche)
    expect(punti.length).toBeLessThanOrEqual(5)
    for (let i = 0; i < punti.length; i++) for (let j = i + 1; j < punti.length; j++)
      expect(Math.hypot(punti[i]![0] - punti[j]![0], punti[i]![1] - punti[j]![1])).toBeGreaterThanOrEqual(44.99)
  })
  it("non crea alberi né ancore di fauna quando il terreno è tutto occupato", () => {
    const h = preparaHabitat([comune], { "024116": stato("ottima") }, "024116", undefined, [], 800, [], () => false)[0]!
    expect(h.alberi).toEqual([])
    expect(h.ancoreFauna).toEqual([])
  })
  it("la sostenibilità del singolo comune regola davvero il numero di alberi creati", () => {
    const h = (f: StatoComune["fascia"]) => preparaHabitat([comune], { "024116": stato(f) }, "024116")[0]!
    expect(h("ottima").alberi.length).toBeGreaterThan(h("media").alberi.length)
    expect(h("media").alberi.length).toBeGreaterThan(h("pessima").alberi.length)
    const alti = new Set(h("ottima").alberi.map(String))
    expect(h("media").alberi.every((p) => alti.has(String(p)))).toBe(true)
  })
  it("usa gli indici locali dei comuni, senza applicare una media provinciale", () => {
    const vicino: Comune = { ...comune, istat: "024117", centroide: [centro[0] + 1600, centro[1]],
      geometria: comune.geometria.map((r) => r.map(([x, y]) => [x + 1600, y])),
    }
    const [alto, basso] = preparaHabitat([comune, vicino], { "024116": stato("ottima"), "024117": stato("pessima") }, null)
    expect(alto!.alberi.length).toBeGreaterThan(basso!.alberi.length)
    expect(alto!.fauna.terra.length).toBeGreaterThan(basso!.fauna.terra.length)
    expect(basso!.fauna.terra).toEqual([])
  })
})
