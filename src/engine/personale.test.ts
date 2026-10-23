import { describe, expect, it } from "vitest"
import { casaSeed, dotNulle } from "./fixtures"
import { duePassi, pianoPersonale, trendDaDotazioni } from "./personale"
import type { Dotazioni } from "../types"

const virtuosa: Dotazioni = {
  ...dotNulle, fotovoltaico: true, riscaldamento: "pompa_calore", cottura: "induzione", isolamento: "buono", auto: null,
}
const inquinante: Dotazioni = { ...dotNulle, riscaldamento: "tradizionale", auto: { alimentazione: "diesel", euro: 3 } }

describe("il tuo 2040", () => {
  it("chi inquina porta il PM10 a salire, chi è virtuoso a scendere", () => {
    expect(trendDaDotazioni(inquinante)).toBeGreaterThan(0)
    expect(trendDaDotazioni(virtuosa)).toBeLessThan(0)
  })

  it("le quote obiettivo seguono le tue dotazioni", () => {
    const { piano } = pianoPersonale(casaSeed("u", "A", virtuosa), "come-te")
    expect(piano.obiettivi.pctFV).toBeGreaterThan(50)
    expect(pianoPersonale(casaSeed("u", "A", inquinante), "come-te").piano.obiettivi.pctFV).toBe(0)
  })

  it("i due passi applicano i primi due interventi della lista e migliorano il futuro", () => {
    const { dotazioni, passi } = duePassi(inquinante)
    expect(passi).toHaveLength(2)
    expect(trendDaDotazioni(dotazioni)).toBeLessThan(trendDaDotazioni(inquinante))
    const { piano } = pianoPersonale(casaSeed("u", "A", inquinante), "due-passi")
    expect(piano.id).toBe("due-passi")
    expect(piano.descrizione).toContain(passi[0]!)
  })
})
