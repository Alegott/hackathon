import { describe, expect, it } from "vitest"
import { paletteOggetti } from "./paletteOggetti"
import type { Dotazioni } from "../types"

const nulla: Dotazioni = {
  fotovoltaico: false, solareTermico: false, riscaldamento: "tradizionale",
  cottura: "gas", isolamento: "scarso", infissi: false, colonninaEV: false,
}
const tutte = (d: Dotazioni) => paletteOggetti(d).flatMap((g) => g.opzioni)
const voce = (d: Dotazioni, o: string) => tutte(d).find((x) => x.oggetto === o)!

describe("paletteOggetti", () => {
  it("ha sette gruppi, uno per dotazione", () => {
    expect(paletteOggetti(nulla).map((g) => g.id)).toEqual(
      ["fotovoltaico", "solareTermico", "riscaldamento", "cottura", "isolamento", "infissi", "colonninaEV"],
    )
  })
  it("nelle scelte multiple c'è esattamente un'opzione attiva; nei sì/no al più una", () => {
    for (const d of [nulla, { ...nulla, riscaldamento: "pompa_calore" as const, isolamento: "medio" as const }]) {
      for (const g of paletteOggetti(d)) {
        const attive = g.opzioni.filter((o) => o.attiva).length
        if (g.opzioni.length > 1) expect(attive).toBe(1)
        else expect(attive).toBeLessThanOrEqual(1)
      }
    }
  })
  it("riconosce quale opzione è installata", () => {
    const d = { ...nulla, fotovoltaico: true, riscaldamento: "condensazione" as const, isolamento: "medio" as const }
    expect(voce(d, "fotovoltaico").attiva).toBe(true)
    expect(voce(d, "condensazione").attiva).toBe(true)
    expect(voce(d, "tradizionale").attiva).toBe(false)
    expect(voce(d, "isolamento_medio").attiva).toBe(true)
    expect(voce(d, "solareTermico").attiva).toBe(false)
  })
  it("per una casa vuota indica i punti che ogni oggetto farebbe guadagnare (pesi su 92)", () => {
    const punti = Object.fromEntries(tutte(nulla).map((o) => [o.oggetto, o.punti]))
    expect(punti).toMatchObject({
      fotovoltaico: 22, solareTermico: 11, pompa_calore: 22, condensazione: 9,
      induzione: 9, isolamento_buono: 16, isolamento_medio: 8, infissi: 10, colonninaEV: 11,
    })
  })
  it("un'opzione già installata non fa guadagnare nulla", () => {
    expect(voce({ ...nulla, fotovoltaico: true }, "fotovoltaico").punti).toBe(0)
    expect(voce(nulla, "tradizionale").punti).toBe(0)
  })
  it("passare a una scelta peggiore mostra la perdita come punti negativi", () => {
    const d = { ...nulla, riscaldamento: "pompa_calore" as const }
    expect(voce(d, "condensazione").punti).toBe(-13)
    expect(voce(d, "tradizionale").punti).toBe(-22)
  })
  it("a casa perfetta nessun oggetto fa guadagnare punti", () => {
    const perfetta: Dotazioni = {
      fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore",
      cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true,
    }
    expect(tutte(perfetta).every((o) => o.punti <= 0)).toBe(true)
  })
})
