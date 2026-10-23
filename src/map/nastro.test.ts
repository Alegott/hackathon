import { describe, expect, it } from "vitest"
import { costruisciNastro } from "./nastro"

describe("costruisciNastro", () => {
  it("non produce nulla con meno di due punti", () => {
    expect(costruisciNastro([[0, 0]], 10, 1)).toEqual({ posizioni: [], indici: [] })
  })
  it("una retta orizzontale diventa una fascia larga come richiesto, alla quota data", () => {
    const { posizioni, indici } = costruisciNastro([[0, 0], [100, 0]], 8, 2)
    const ys = [posizioni[1], posizioni[4]]
    expect(Math.abs(ys[0]! - ys[1]!)).toBe(8)
    expect(posizioni.filter((_, i) => i % 3 === 2).every((z) => z === 2)).toBe(true)
    expect(indici).toHaveLength(6)
  })
  it("genera due triangoli per ogni tratto", () => {
    expect(costruisciNastro([[0, 0], [10, 0], [10, 10], [20, 10]], 4, 0).indici).toHaveLength(18)
  })
})
