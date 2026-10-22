import { describe, expect, it } from "vitest"
import { creaProiezione } from "./scena"
import type { Comune } from "../types"

const c = (istat: string, geometria: [number, number][][]): Comune => ({
  istat, nome: istat, geometria, centroide: [0, 0], confinanti: [], ariaNorm: 50, pm10: 0, nCentraline: 1,
})

describe("creaProiezione", () => {
  const comuni = [
    c("a", [[[1000, 5000], [3000, 5000], [3000, 6000], [1000, 6000]]]),
    c("b", [[[3000, 5000], [5000, 5000], [5000, 7000], [3000, 7000]]]),
  ]
  // estensione: x 1000–5000 (4000 m), y 5000–7000 (2000 m)

  it("porta il centro dell'estensione nell'origine della scena", () => {
    const { aScena } = creaProiezione(comuni, 20)
    expect(aScena([3000, 6000])).toEqual([0, 0])
  })
  it("scala il lato più lungo alla dimensione richiesta", () => {
    const p = creaProiezione(comuni, 20)
    expect(p.aScena([5000, 6000])[0]).toBeCloseTo(10)
    expect(p.aScena([1000, 6000])[0]).toBeCloseTo(-10)
    expect(p.dimensione).toBe(20)
  })
  it("il nord (y crescente) va verso il fondo dello schermo negativo: z = −y", () => {
    const { aScena } = creaProiezione(comuni, 20)
    expect(aScena([3000, 7000])[1]).toBeCloseTo(-5) // 1000 m a nord = 5 unità
    expect(aScena([3000, 5000])[1]).toBeCloseTo(5)
  })
  it("senza comuni non esplode", () => {
    expect(creaProiezione([], 20).aScena([10, 10])).toEqual([0, 0])
  })
  it("daScena è l'inversa di aScena", () => {
    const p = creaProiezione(comuni, 20)
    for (const punto of [[1000, 5000], [3000, 6000], [4321, 6789]] as [number, number][]) {
      const [x, y] = p.daScena(p.aScena(punto))
      expect(x).toBeCloseTo(punto[0], 6)
      expect(y).toBeCloseTo(punto[1], 6)
    }
  })
})
