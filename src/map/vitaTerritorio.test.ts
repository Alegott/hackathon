import { describe, expect, it } from "vitest"
import { assegnaComuni, atmosferaDaStato, comuneDelPunto, coloriEdifici, composizioneFauna, creaTrovaComune, metriPerPixel, statoMedio } from "./vitaTerritorio"
import { aCoordinateGeografiche, coloreIndice } from "./territorio"
import type { Comune, Fascia, StatoComune } from "../types"

const stato = (totale: number, fascia: Fascia, extra: Partial<StatoComune> = {}): StatoComune => ({
  aria: totale, infrastrutture: 0, scenario: 0, totale, fascia, indiceCaseMedio: 0, ...extra,
})

describe("composizioneFauna", () => {
  it("fascia ottima: sei animali a terra nell'ordine capriolo, volpe, cervo, lupo, e dieci uccelli", () => {
    const f = composizioneFauna(stato(90, "ottima"))
    expect(f.terra).toEqual(["capriolo", "volpe", "cervo", "lupo", "capriolo", "volpe"])
    expect(f.uccelli).toBe(10)
  })
  it("fascia media: pochi animali (capriolo, volpe) e tre uccelli", () => {
    const f = composizioneFauna(stato(50, "media"))
    expect(f.terra).toEqual(["capriolo", "volpe"])
    expect(f.uccelli).toBe(3)
  })
  it("fascia pessima: nessun animale e nessun uccello, nemmeno le specie rare", () => {
    expect(composizioneFauna(stato(10, "pessima"))).toEqual({ terra: [], uccelli: 0, aquila: false, lince: false, spawnRate: 0 })
  })
  it("le specie rare compaiono solo con aria e indice alti: aquila da 0,45, lince da 0,65", () => {
    const alta = composizioneFauna(stato(92, "ottima"))
    expect(alta.spawnRate).toBeGreaterThanOrEqual(0.65)
    expect(alta.aquila).toBe(true)
    expect(alta.lince).toBe(true)
    const discreta = composizioneFauna(stato(70, "buona")) // spawn ≈ 0,30: nessuna delle due
    expect(discreta.spawnRate).toBeLessThan(0.45)
    expect(discreta.aquila).toBe(false)
    expect(discreta.lince).toBe(false)
  })
  it("l'inquinamento da infrastrutture o scenario azzera le specie rare ma non la fauna comune", () => {
    const f = composizioneFauna(stato(85, "ottima", { infrastrutture: -4, scenario: -8 }))
    expect(f.spawnRate).toBe(0)
    expect(f.aquila).toBe(false)
    expect(f.lince).toBe(false)
    expect(f.terra).toHaveLength(6)
  })
})

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
// Luminosità del colore (canale massimo): il cielo si scurisce peggiorando l'aria.
const luce = (hex: string) => Math.max(...rgb(hex))
const FASCE: [Fascia, number][] = [["ottima", 90], ["buona", 70], ["media", 50], ["scarsa", 30], ["pessima", 10]]

describe("atmosferaDaStato", () => {
  it("aria ottima: cielo azzurro, nessuna foschia e nuvole bianche", () => {
    const a = atmosferaDaStato(stato(90, "ottima"))
    const [r, , b] = rgb(a.sky["sky-color"])
    expect(b!).toBeGreaterThan(r!)
    expect(a.foschia).toBe(0)
    expect(a.sky["fog-ground-blend"]).toBeLessThan(0.1)
    expect(a.nuvole.grigio).toBe(0)
  })
  it("aria pessima: foschia fitta a terra, cielo scuro e nuvole scure", () => {
    const a = atmosferaDaStato(stato(10, "pessima"))
    expect(a.foschia).toBeGreaterThanOrEqual(0.8)
    expect(a.sky["fog-ground-blend"]).toBeGreaterThanOrEqual(0.5)
    expect(luce(a.sky["sky-color"])).toBeLessThan(0.45 * 255)
    expect(a.nuvole.grigio).toBe(1)
  })
  it("peggiorando la fascia la foschia aumenta e il cielo si scurisce, senza inversioni", () => {
    const viste = FASCE.map(([f, t]) => atmosferaDaStato(stato(t, f)))
    for (let i = 1; i < viste.length; i++) {
      expect(viste[i]!.foschia).toBeGreaterThan(viste[i - 1]!.foschia)
      expect(viste[i]!.sky["fog-ground-blend"]).toBeGreaterThanOrEqual(viste[i - 1]!.sky["fog-ground-blend"])
      expect(luce(viste[i]!.sky["sky-color"])).toBeLessThan(luce(viste[i - 1]!.sky["sky-color"]))
      expect(viste[i]!.nuvole.quantita).toBeGreaterThanOrEqual(viste[i - 1]!.nuvole.quantita)
    }
  })
  it("tutti i colori sono esadecimali validi e i valori di fusione stanno tra 0 e 1", () => {
    for (const [f, t] of FASCE) {
      const { sky } = atmosferaDaStato(stato(t, f))
      for (const c of [sky["sky-color"], sky["horizon-color"], sky["fog-color"]]) expect(c).toMatch(/^#[0-9a-f]{6}$/)
      for (const k of ["fog-ground-blend", "horizon-fog-blend", "sky-horizon-blend", "atmosphere-blend"] as const) {
        expect(sky[k]).toBeGreaterThanOrEqual(0)
        expect(sky[k]).toBeLessThanOrEqual(1)
      }
    }
  })
  it("senza dati (nessun comune) usa un cielo quasi sereno con una leggera foschia", () => {
    const a = atmosferaDaStato(null)
    expect(a.foschia).toBeGreaterThan(0)
    expect(a.foschia).toBeLessThan(0.2)
  })
})

describe("statoMedio (qualità dell'aria della provincia)", () => {
  it("nessun comune: nessuno stato", () => { expect(statoMedio({})).toBeNull() })
  it("media dei totali, con la fascia che ne deriva", () => {
    const m = statoMedio({ a: stato(90, "ottima"), b: stato(50, "media"), c: stato(40, "media") })!
    expect(m.totale).toBeCloseTo(60, 5)
    expect(m.fascia).toBe("buona") // 60 → buona
  })
  it("media anche di aria, infrastrutture e scenario", () => {
    const m = statoMedio({ a: stato(80, "ottima", { aria: 80, infrastrutture: -10, scenario: 0 }), b: stato(60, "buona", { aria: 70, infrastrutture: 0, scenario: -4 }) })!
    expect([m.aria, m.infrastrutture, m.scenario]).toEqual([75, -5, -2])
  })
})

// Due comuni quadrati affiancati (metri UTM 32N), il secondo con un buco al centro.
const quadrato = (x: number, y: number, l: number): [number, number][] => [[x, y], [x + l, y], [x + l, y + l], [x, y + l]]
const comune = (istat: string, x: number, y: number): Comune => ({
  istat, nome: istat, geometria: [quadrato(x, y, 1000)], centroide: [x + 500, y + 500],
  confinanti: [], ariaNorm: 50, pm10: 0, nCentraline: 1,
})
const A = comune("A", 690000, 5030000), B = comune("B", 691000, 5030000)
const geo = (x: number, y: number) => aCoordinateGeografiche([x, y])

describe("assegnazione degli edifici al comune", () => {
  const trova = creaTrovaComune([A, B])
  it("un punto dentro un comune restituisce il suo codice", () => {
    expect(trova(geo(690500, 5030500))).toBe("A")
    expect(trova(geo(691500, 5030500))).toBe("B")
  })
  it("un punto fuori da tutti i comuni non appartiene a nessuno", () => {
    expect(trova(geo(692500, 5030500))).toBeNull()
    expect(trova(geo(690500, 5032000))).toBeNull()
  })
  it("comuneDelPunto è la stessa cosa in un colpo solo", () => {
    expect(comuneDelPunto(geo(691500, 5030500), [A, B])).toBe("B")
  })
  it("con molti comuni sceglie quello giusto anche vicino al confine", () => {
    expect(trova(geo(690999, 5030500))).toBe("A")
    expect(trova(geo(691001, 5030500))).toBe("B")
  })
})

describe("coloriEdifici (espressione MapLibre)", () => {
  const indici = { A: stato(90, "ottima"), B: stato(10, "pessima"), C: stato(88, "ottima") }
  const e = coloriEdifici(indici, "#cccccc") as unknown[]

  it("è un match sul codice del comune con il colore di riserva in fondo", () => {
    expect(e[0]).toBe("match")
    expect(e[1]).toEqual(["get", "istat"])
    expect(e[e.length - 1]).toBe("#cccccc")
  })
  it("ogni comune ha il colore della sua fascia", () => {
    const gruppi = new Map<string, string[]>()
    for (let i = 2; i < e.length - 1; i += 2) gruppi.set(e[i + 1] as string, e[i] as string[])
    expect(gruppi.get(coloreIndice(indici.A))).toEqual(expect.arrayContaining(["A", "C"]))
    expect(gruppi.get(coloreIndice(indici.B))).toEqual(["B"])
  })
  it("i comuni della stessa fascia sono raggruppati: tante regole quanti sono i colori", () => {
    expect((e.length - 3) / 2).toBe(2)
  })
  it("senza indici resta solo il colore di riserva", () => {
    expect(coloriEdifici({}, "#cccccc")).toBe("#cccccc")
  })
})

describe("metriPerPixel (scala della mappa)", () => {
  it("allo zoom 0 all'equatore un pixel è la circonferenza terrestre divisa per 512", () => {
    expect(metriPerPixel(0, 0)).toBeCloseTo(78271.517, 2)
  })
  it("dimezza a ogni livello di zoom", () => {
    expect(metriPerPixel(10, 0)).toBeCloseTo(metriPerPixel(9, 0) / 2, 6)
  })
  it("a 45° di latitudine i pixel coprono meno strada (coseno)", () => {
    expect(metriPerPixel(12, 45)).toBeCloseTo(metriPerPixel(12, 0) * Math.cos(Math.PI / 4), 6)
  })
  it("su Vicenza allo zoom 15,5 è circa 1,2 m per pixel", () => {
    expect(metriPerPixel(15.5, 45.55)).toBeGreaterThan(1.1)
    expect(metriPerPixel(15.5, 45.55)).toBeLessThan(1.3)
  })
})

describe("assegnaComuni (edifici → comune)", () => {
  const edificio = (x: number, y: number) => ({
    type: "Feature" as const, properties: { render_height: 9 } as Record<string, unknown>,
    geometry: { type: "MultiPolygon" as const, coordinates: [[[geo(x, y), geo(x + 10, y), geo(x + 10, y + 10), geo(x, y)]]] },
  })
  const trova = creaTrovaComune([A, B])

  it("aggiunge a ogni edificio il codice del comune dove si trova, mantenendo le altre proprietà", () => {
    const fc = assegnaComuni({ type: "FeatureCollection", features: [edificio(690500, 5030500), edificio(691500, 5030500)] }, trova)
    expect(fc.features.map((f) => f.properties?.istat)).toEqual(["A", "B"])
    expect(fc.features[0]!.properties?.render_height).toBe(9)
  })
  it("un edificio fuori da ogni comune resta senza codice (colore di riserva)", () => {
    const fc = assegnaComuni({ type: "FeatureCollection", features: [edificio(695000, 5030500)] }, trova)
    expect(fc.features[0]!.properties?.istat).toBeNull()
  })
  it("non modifica l'originale", () => {
    const originale = { type: "FeatureCollection" as const, features: [edificio(690500, 5030500)] }
    assegnaComuni(originale, trova)
    expect(originale.features[0]!.properties).toEqual({ render_height: 9 })
  })
})
