import { expect, it } from "vitest"
import { colorePunteggio, SCALA_COLORI } from "./fasce"
import { atmosferaDaStato } from "./vitaTerritorio"

it("copre 0–100 con venti fasce distinte da viola ad azzurro", () => {
  expect(SCALA_COLORI).toHaveLength(20)
  expect(new Set(SCALA_COLORI.map((s) => s.colore)).size).toBe(20)
  for (const f of SCALA_COLORI) {
    expect(colorePunteggio(f.min)).toBe(f.colore)
    expect(colorePunteggio(f.max - .001)).toBe(f.colore)
  }
  expect(colorePunteggio(100)).toBe(SCALA_COLORI.at(-1)!.colore)
  expect(colorePunteggio(-1)).toBe(colorePunteggio(0))
  expect(colorePunteggio(101)).toBe(colorePunteggio(100))
})

it("bonus di sostenibilità non schiariscono le nuvole a parità di aria", () => {
  const s = { aria: 43, totale: 43, fascia: "media" as const, infrastrutture: 0, scenario: 0, indiceCaseMedio: 0 }
  expect(atmosferaDaStato({ ...s, totale: 90, fascia: "ottima" }).nuvole.grigio).toBeLessThan(atmosferaDaStato(s).nuvole.grigio)
  const nuvole = [90, 80, 70, 60, 50, 40, 30, 20, 10].map((totale) => atmosferaDaStato({ ...s, totale }).nuvole.grigio)
  for (let i = 1; i < nuvole.length; i++) expect(nuvole[i]).toBeGreaterThan(nuvole[i - 1]!)
})
