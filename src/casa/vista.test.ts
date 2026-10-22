import { describe, expect, it } from "vitest"
import { descriviCasa, elementiCambiati } from "./vista"
import type { Dotazioni } from "../types"

const nulla: Dotazioni = {
  fotovoltaico: false, solareTermico: false, riscaldamento: "tradizionale",
  cottura: "gas", isolamento: "scarso", infissi: false, colonninaEV: false,
}
const perfetta: Dotazioni = {
  fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore",
  cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true,
}

describe("descriviCasa", () => {
  it("una casa senza dotazioni mostra mattoni, vetri semplici, caldaia tradizionale e nessun accessorio", () => {
    expect(descriviCasa(nulla)).toEqual({
      pannelliFV: false, collettoreSolare: false, impiantoTermico: "caldaia_tradizionale",
      cottura: "gas", rivestimento: "mattone", vetri: "semplici", colonnina: false,
    })
  })
  it("una casa con tutto mostra pannelli, pompa di calore, cappotto, doppi vetri e colonnina", () => {
    expect(descriviCasa(perfetta)).toEqual({
      pannelliFV: true, collettoreSolare: true, impiantoTermico: "pompa_calore",
      cottura: "induzione", rivestimento: "cappotto", vetri: "doppi", colonnina: true,
    })
  })
  it("riscaldamento e isolamento hanno una rappresentazione per ciascun valore", () => {
    expect(descriviCasa({ ...nulla, riscaldamento: "condensazione" }).impiantoTermico).toBe("caldaia_condensazione")
    expect(descriviCasa({ ...nulla, isolamento: "medio" }).rivestimento).toBe("intonaco")
  })
  it("ogni singola dotazione cambiata si vede sul modello (nessuna è invisibile)", () => {
    const alternative: { [K in keyof Dotazioni]: Dotazioni[K][] } = {
      fotovoltaico: [true], solareTermico: [true], riscaldamento: ["condensazione", "pompa_calore"],
      cottura: ["induzione"], isolamento: ["medio", "buono"], infissi: [true], colonninaEV: [true],
    }
    for (const chiave of Object.keys(alternative) as (keyof Dotazioni)[]) {
      for (const valore of alternative[chiave]) {
        expect(descriviCasa({ ...nulla, [chiave]: valore })).not.toEqual(descriviCasa(nulla))
      }
    }
  })
  it("valori diversi della stessa dotazione hanno viste diverse tra loro", () => {
    const viste = (["tradizionale", "condensazione", "pompa_calore"] as const).map((r) => JSON.stringify(descriviCasa({ ...nulla, riscaldamento: r })))
    expect(new Set(viste).size).toBe(3)
    const iso = (["scarso", "medio", "buono"] as const).map((r) => JSON.stringify(descriviCasa({ ...nulla, isolamento: r })))
    expect(new Set(iso).size).toBe(3)
  })
})

describe("elementiCambiati (per animare solo ciò che cambia)", () => {
  it("elenca solo gli elementi della vista che sono cambiati", () => {
    expect(elementiCambiati(nulla, { ...nulla, fotovoltaico: true })).toEqual(["pannelliFV"])
    expect(elementiCambiati(nulla, { ...nulla, riscaldamento: "pompa_calore", infissi: true }).sort()).toEqual(["impiantoTermico", "vetri"])
  })
  it("senza modifiche non cambia nulla", () => {
    expect(elementiCambiati(perfetta, perfetta)).toEqual([])
  })
  it("funziona anche in rimozione", () => {
    expect(elementiCambiati(perfetta, { ...perfetta, colonninaEV: false })).toEqual(["colonnina"])
  })
})
