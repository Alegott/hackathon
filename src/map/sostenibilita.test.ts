import { expect, it } from "vitest"
import { coloreNuvola, presetSostenibilita } from "./sostenibilita"

it("sostenibilità crescente aumenta fauna e verde e schiarisce le nuvole", () => {
  const valori = [0, 20, 40, 60, 80, 100].map(presetSostenibilita)
  for (let i = 1; i < valori.length; i++) {
    const a = valori[i - 1]!, b = valori[i]!
    expect(b.animali).toBeGreaterThanOrEqual(a.animali)
    expect(b.uccelli).toBeGreaterThanOrEqual(a.uccelli)
    expect(b.densitaAlberi).toBeGreaterThanOrEqual(a.densitaAlberi)
    expect(b.nuvole.grigio).toBeLessThan(a.nuvole.grigio)
  }
  expect(valori.at(-1)!.animali).toBe(24)
  expect(valori.at(-1)!.uccelli).toBe(36)
  expect(coloreNuvola(0)).toBe("#ffffff")
  expect(coloreNuvola(1)).toBe("#080808")
})
