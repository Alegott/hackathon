import { describe, expect, it } from "vitest"
import { areaLibera, percorsoLibero, trattoLibero, type Edificio } from "./ostacoli"

const casa: Edificio = { minX: 40, minY: -10, maxX: 60, maxY: 10, anelli: [[[40, -10], [60, -10], [60, 10], [40, 10]]] }

describe("strade ed edifici", () => {
  it("una strada che attraversa un edificio non è libera", () => {
    expect(trattoLibero([0, 0], [100, 0], [casa], 4)).toBe(false)
  })
  it("una strada lontana è libera", () => {
    expect(trattoLibero([0, 50], [100, 50], [casa], 4)).toBe(true)
  })
  it("conta la larghezza: a 3 m dal muro una strada larga 8 m lo tocca", () => {
    expect(trattoLibero([0, 13], [100, 13], [casa], 4)).toBe(false)
    expect(trattoLibero([0, 15], [100, 15], [casa], 4)).toBe(true)
  })
  it("un punto dentro l'edificio non è libero", () => {
    expect(percorsoLibero([[50, 0]], [casa], 1)).toBe(false)
  })
  it("un percorso che aggira l'edificio è libero", () => {
    expect(percorsoLibero([[0, 0], [30, 30], [70, 30], [100, 0]], [casa], 4)).toBe(true)
  })
  it("un parco che racchiude un edificio non è libero", () => {
    expect(areaLibera([[0, -50], [100, -50], [100, 50], [0, 50]], [casa])).toBe(false)
  })
  it("un parco accanto all'edificio è libero", () => {
    expect(areaLibera([[0, 30], [100, 30], [100, 80], [0, 80]], [casa])).toBe(true)
  })
})
