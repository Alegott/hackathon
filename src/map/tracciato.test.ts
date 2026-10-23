import { describe, expect, it } from "vitest"
import { pulisciTracciato, semplifica, smussa } from "./tracciato"

describe("tracciato a mano libera", () => {
  it("semplifica una retta rumorosa in due soli punti", () => {
    const rumore: [number, number][] = Array.from({ length: 20 }, (_, i) => [i * 10, i % 2])
    expect(semplifica(rumore, 3)).toEqual([[0, 0], [190, 1]])
  })
  it("mantiene la curva dove la forma cambia davvero", () => {
    expect(semplifica([[0, 0], [100, 0], [100, 100]], 5)).toHaveLength(3)
  })
  it("lo smussamento conserva gli estremi e aggiunge punti", () => {
    const r = smussa([[0, 0], [100, 0], [100, 100]])
    expect(r[0]).toEqual([0, 0])
    expect(r.at(-1)).toEqual([100, 100])
    expect(r.length).toBeGreaterThan(3)
  })
  it("pulisciTracciato non perde l'inizio e la fine del gesto", () => {
    const r = pulisciTracciato([[0, 0], [50, 3], [100, 0], [150, 60], [200, 120]])
    expect(r[0]).toEqual([0, 0])
    expect(r.at(-1)).toEqual([200, 120])
  })
})
