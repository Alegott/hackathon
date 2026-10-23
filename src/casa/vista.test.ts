import { describe, expect, it } from "vitest"
import { alberiDaPiantare, descriviCasa, elementiCambiati, MAX_ALBERI_VISIBILI } from "./vista"
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
      cottura: "gas", rivestimento: "mattone", vetri: "semplici", colonnina: false, auto: null,
      giardino: ["latifoglia", "conifera", "latifoglia", "conifera"],
    })
  })
  it("una casa con tutto mostra pannelli, pompa di calore, cappotto, doppi vetri e colonnina", () => {
    expect(descriviCasa(perfetta)).toEqual({
      pannelliFV: true, collettoreSolare: true, impiantoTermico: "pompa_calore",
      cottura: "induzione", rivestimento: "cappotto", vetri: "doppi", colonnina: true, auto: null,
      giardino: ["latifoglia", "conifera", "latifoglia", "conifera"],
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
      auto: [{ alimentazione: "diesel", euro: 3 }, { alimentazione: "elettrico", euro: 6 }],
    }
    for (const chiave of Object.keys(alternative) as (keyof Dotazioni)[]) {
      for (const valore of alternative[chiave] ?? []) {
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

describe("auto nella vista", () => {
  it("senza auto non c'è nessuna macchina sul modello", () => {
    expect(descriviCasa({ ...nulla, auto: null }).auto).toBeNull()
  })
  it("l'aspetto segue la classe dell'auto: elettrica in A, vecchio diesel in G", () => {
    expect(descriviCasa({ ...nulla, auto: { alimentazione: "elettrico", euro: 6 } }).auto).toEqual({ classe: "A", alimentazione: "elettrico" })
    expect(descriviCasa({ ...nulla, auto: { alimentazione: "diesel", euro: 0 } }).auto).toEqual({ classe: "G", alimentazione: "diesel" })
  })
  it("cambiare categoria Euro cambia l'auto anche se resta lo stesso oggetto per forma", () => {
    expect(elementiCambiati({ ...nulla, auto: { alimentazione: "benzina", euro: 1 } }, { ...nulla, auto: { alimentazione: "benzina", euro: 6 } })).toEqual(["auto"])
    expect(elementiCambiati({ ...nulla, auto: { alimentazione: "benzina", euro: 6 } }, { ...nulla, auto: { alimentazione: "benzina", euro: 6 } })).toEqual([])
  })
})

describe("giardino nella vista", () => {
  it("se non è indicato si vede il giardino standard; con null niente giardino", () => {
    expect(descriviCasa(nulla).giardino).toEqual(["latifoglia", "conifera", "latifoglia", "conifera"])
    expect(descriviCasa({ ...nulla, giardino: null }).giardino).toBeNull()
  })
  it("un giardino senza alberi è un prato vuoto, non l'assenza di giardino", () => {
    expect(descriviCasa({ ...nulla, giardino: { alberi: {} } }).giardino).toEqual([])
  })
  it("pianta il numero indicato di alberi per tipo, alternando i tipi", () => {
    expect(alberiDaPiantare({ alberi: { latifoglia: 2, ulivo: 1, frutto: 1 } })).toEqual(["latifoglia", "frutto", "ulivo", "latifoglia"])
  })
  it("oltre i posti disponibili si ferma, ma ogni tipo resta visibile", () => {
    const a = alberiDaPiantare({ alberi: { latifoglia: 8, conifera: 8, frutto: 8, ulivo: 1 } })
    expect(a).toHaveLength(MAX_ALBERI_VISIBILI)
    expect(new Set(a)).toEqual(new Set(["latifoglia", "conifera", "frutto", "ulivo"]))
  })
})
