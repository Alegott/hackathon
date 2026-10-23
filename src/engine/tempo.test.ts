import { describe, expect, it } from "vitest"
import { casaSeed, dataset, scenarioVuoto } from "./fixtures"
import { statoTerritorio } from "./territorio"
import { avanzamento, datasetAnno, fotogrammi, interpola, PIANI, quoteAnno, quoteAttuali, type PianoTemporale } from "./tempo"

const ds = dataset({
  comuni: dataset().comuni.map((c) => ({ ...c, pm10: 30 })),
  caseSeed: [casaSeed("a1", "A"), casaSeed("a2", "A", { fotovoltaico: true }), casaSeed("b1", "B"), casaSeed("b2", "B")],
})
const piano: PianoTemporale = { ...PIANI.find((p) => p.id === "piano-clima")!, obiettivi: { pctFV: 100, pctSenzaGas: 50, pctIsolamentoBuono: 50 } }

describe("macchina del tempo", () => {
  it("il primo anno coincide con la realtà", () => {
    const [primo] = fotogrammi(ds, piano, scenarioVuoto)
    expect(primo!.anno).toBe(2025)
    expect(primo!.indici).toEqual(statoTerritorio(ds, scenarioVuoto))
  })

  it("produce un fotogramma per anno e migliora nel tempo", () => {
    const f = fotogrammi(ds, piano, scenarioVuoto)
    expect(f).toHaveLength(16)
    expect(f.at(-1)!.riepilogo.indiceMedio).toBeGreaterThan(f[0]!.riepilogo.indiceMedio)
    expect(f.at(-1)!.riepilogo.pctFV).toBe(100)
    expect(f.at(-1)!.riepilogo.pm10Medio).toBeLessThan(30)
  })

  it("le curve vanno da 0 a 1 in modo monotono", () => {
    for (const c of ["lineare", "s"] as const) {
      expect(avanzamento(c, 0)).toBeCloseTo(0)
      expect(avanzamento(c, 1)).toBeCloseTo(1)
      let prec = -1
      for (let t = 0; t <= 1; t += 0.05) {
        expect(avanzamento(c, t)).toBeGreaterThanOrEqual(prec)
        prec = avanzamento(c, t)
      }
    }
  })

  it("le quote non scendono mai sotto quelle attuali", () => {
    const attuali = quoteAttuali(ds, "provincia")
    expect(attuali.pctFV).toBe(25)
    const q = quoteAnno({ ...piano, obiettivi: { pctFV: 10, pctSenzaGas: 0, pctIsolamentoBuono: 0 } }, 2040, attuali)
    expect(q.pctFV).toBe(25)
    expect(quoteAnno(piano, 2040, attuali).pctFV).toBe(100)
  })

  it("il dataset non cambia all'anno zero o con trend nullo, l'aria migliora con trend negativo", () => {
    expect(datasetAnno(ds, 0, -3)).toBe(ds)
    expect(datasetAnno(ds, 5, 0)).toBe(ds)
    const dopo = datasetAnno(ds, 10, -3)
    expect(dopo.comuni[0]!.ariaNorm).toBeGreaterThan(ds.comuni[0]!.ariaNorm)
    expect(dopo.comuni[0]!.ariaNorm).toBeLessThanOrEqual(100)
  })

  it("interpola tra due anni", () => {
    const f = fotogrammi(ds, piano, scenarioVuoto)
    const meta = interpola(f, 2030.5)
    const a = f[5]!.indici.A!.totale, b = f[6]!.indici.A!.totale
    expect(meta.indici.A!.totale).toBeCloseTo((a + b) / 2)
    expect(interpola(f, 2025).indici).toBe(f[0]!.indici)
  })
})

describe("crescita del territorio", () => {
  const conGeometria = dataset({
    comuni: dataset().comuni.map((c, i) => ({ ...c, pm10: 30, geometria: [[[i * 1000, 0], [i * 1000 + 900, 0], [i * 1000 + 900, 900], [i * 1000, 900]]] as [number, number][][] })),
    caseSeed: Array.from({ length: 100 }, (_, i) => casaSeed(`c${i}`, "ABCD"[i % 4]!)),
  })
  const crescita = { casePctAnno: 2, industrieAnno: 1, stradeAnno: 1, parchiAnno: 0, ciclabiliAnno: 0 }
  const p: PianoTemporale = { ...piano, crescita }

  it("nel primo anno non c'è ancora nulla di nuovo, poi le opere si accumulano", () => {
    const f = fotogrammi(conGeometria, p, scenarioVuoto)
    expect(f[0]!.aggiunte).toHaveLength(0)
    expect(f[0]!.riepilogo.crescita.case).toBe(0)
    expect(f.at(-1)!.riepilogo.crescita.industrie).toBe(15)
    expect(f.at(-1)!.riepilogo.crescita.case).toBe(30)
    for (let i = 1; i < f.length; i++) expect(f[i]!.aggiunte.length).toBeGreaterThanOrEqual(f[i - 1]!.aggiunte.length)
  })

  it("è deterministica e le industrie nuove pesano sull'indice", () => {
    const a = fotogrammi(conGeometria, p, scenarioVuoto)
    const b = fotogrammi(conGeometria, p, scenarioVuoto)
    expect(a.at(-1)!.aggiunte).toEqual(b.at(-1)!.aggiunte)
    const senza = fotogrammi(conGeometria, { ...p, crescita: { ...crescita, industrieAnno: 0, stradeAnno: 0 } }, scenarioVuoto)
    expect(a.at(-1)!.riepilogo.indiceMedio).toBeLessThan(senza.at(-1)!.riepilogo.indiceMedio)
  })
})
