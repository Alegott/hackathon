import { describe, expect, it } from "vitest"
import { avanzaPreset, presetFascia } from "./preset"
import type { Fascia } from "../types"

const ORDINE: Fascia[] = ["ottima", "buona", "media", "scarsa", "pessima"]
const p = (f: Fascia) => presetFascia(f)

describe("presetFascia", () => {
  it("la densità degli alberi segue la SPEC: 100% → 75% → 50% → 25%", () => {
    expect([p("ottima"), p("buona"), p("media"), p("scarsa")].map((x) => x.densitaAlberi)).toEqual([1, 0.75, 0.5, 0.25])
  })
  it("in fascia pessima gli alberi sono spogli (senza fogliame), nelle altre sono rigogliosi", () => {
    expect(p("pessima").fogliame).toBe(0)
    for (const f of ORDINE.slice(0, 4)) expect(p(f).fogliame).toBe(1)
  })
  it("ottima: cielo azzurro e nuvole bianche, senza foschia, con fauna abbondante", () => {
    const o = p("ottima")
    const [r, g, b] = o.cielo
    expect(b).toBeGreaterThan(r) // dominante azzurra
    expect(o.nebbia).toBe(0)
    expect(o.nuvole.grigio).toBe(0)
    expect(o.uccelli).toBeGreaterThan(p("media").uccelli)
    expect(o.animali).toBeGreaterThan(0)
    expect(g).toBeGreaterThan(r)
  })
  it("pessima: foschia scura e nessuna fauna", () => {
    const x = p("pessima")
    expect(x.uccelli).toBe(0)
    expect(x.animali).toBe(0)
    expect(x.nebbia).toBeGreaterThan(p("scarsa").nebbia)
    expect(Math.max(...x.cielo)).toBeLessThan(0.45) // scuro
    expect(x.nuvole.grigio).toBe(1)
  })
  it("media: velato, con pochi uccelli; scarsa: fauna rara", () => {
    expect(p("media").uccelli).toBeGreaterThan(0)
    expect(p("media").uccelli).toBeLessThan(p("buona").uccelli)
    expect(p("scarsa").uccelli).toBeLessThanOrEqual(1)
  })
  it("peggiorando la fascia: meno alberi e fauna, più nebbia e nuvole grigie, mai il contrario", () => {
    for (let i = 1; i < ORDINE.length; i++) {
      const meglio = p(ORDINE[i - 1]!), peggio = p(ORDINE[i]!)
      expect(peggio.densitaAlberi).toBeLessThanOrEqual(meglio.densitaAlberi)
      expect(peggio.uccelli).toBeLessThanOrEqual(meglio.uccelli)
      expect(peggio.animali).toBeLessThanOrEqual(meglio.animali)
      expect(peggio.fogliame).toBeLessThanOrEqual(meglio.fogliame)
      expect(peggio.nebbia).toBeGreaterThan(meglio.nebbia)
      expect(peggio.nuvole.grigio).toBeGreaterThanOrEqual(meglio.nuvole.grigio)
      expect(Math.max(...peggio.cielo)).toBeLessThan(Math.max(...meglio.cielo))
    }
  })
})

describe("avanzaPreset", () => {
  const da = presetFascia("ottima")
  const a = presetFascia("pessima")

  it("con dt = 0 non si muove", () => {
    expect(avanzaPreset(da, a, 0)).toEqual(da)
  })
  it("si avvicina all'obiettivo senza raggiungerlo in un passo breve", () => {
    const r = avanzaPreset(da, a, 0.1)
    expect(r.densitaAlberi).toBeLessThan(da.densitaAlberi)
    expect(r.densitaAlberi).toBeGreaterThan(a.densitaAlberi)
    expect(r.nebbia).toBeGreaterThan(da.nebbia)
    expect(r.nebbia).toBeLessThan(a.nebbia)
    expect(r.cielo[2]).toBeLessThan(da.cielo[2])
    expect(r.cielo[2]).toBeGreaterThan(a.cielo[2])
  })
  it("non supera mai l'obiettivo, nemmeno con un passo enorme", () => {
    const r = avanzaPreset(da, a, 1000)
    expect(r).toEqual(a)
  })
  it("raggiunge esattamente l'obiettivo dopo abbastanza passi", () => {
    let c = da
    for (let i = 0; i < 600; i++) c = avanzaPreset(c, a, 1 / 60)
    expect(c).toEqual(a)
  })
  it("verso un obiettivo già raggiunto resta fermo", () => {
    expect(avanzaPreset(a, a, 0.016)).toEqual(a)
  })
  it("è monotona: ogni passo si avvicina un po' di più", () => {
    let c = da
    let prec = Math.abs(c.densitaAlberi - a.densitaAlberi)
    for (let i = 0; i < 30; i++) {
      c = avanzaPreset(c, a, 1 / 30)
      const d = Math.abs(c.densitaAlberi - a.densitaAlberi)
      expect(d).toBeLessThanOrEqual(prec)
      prec = d
    }
  })
  it("funziona anche in senso inverso (miglioramento della fascia)", () => {
    const r = avanzaPreset(a, da, 0.1)
    expect(r.densitaAlberi).toBeGreaterThan(a.densitaAlberi)
    expect(r.densitaAlberi).toBeLessThan(da.densitaAlberi)
  })
})
