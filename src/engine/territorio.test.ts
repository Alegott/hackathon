import { describe, expect, it } from "vitest"
import { statoTerritorio } from "./index"
import { casaSeed, comune, dataset, infra, scenarioVuoto } from "./fixtures"

describe("statoTerritorio - aria e fasce", () => {
  it("senza infrastrutture né scenario il totale coincide con l'aria", () => {
    const s = statoTerritorio(dataset(), scenarioVuoto)
    expect(s.A).toMatchObject({ aria: 50, infrastrutture: 0, scenario: 0, totale: 50 })
  })
  it("restituisce un valore per ogni comune", () => {
    expect(Object.keys(statoTerritorio(dataset(), scenarioVuoto)).sort()).toEqual(["A", "B", "C", "D"])
  })
  it.each([
    [100, "ottima"], [80, "ottima"], [79, "buona"], [60, "buona"], [59, "media"],
    [40, "media"], [39, "scarsa"], [20, "scarsa"], [19, "pessima"], [0, "pessima"],
  ] as const)("indice %i → fascia %s", (aria, fascia) => {
    const ds = dataset({ comuni: [comune("A", aria, [])] })
    expect(statoTerritorio(ds, scenarioVuoto).A?.fascia).toBe(fascia)
  })
  it("la fascia guarda il valore non arrotondato (19,9 è ancora pessima)", () => {
    const ds = dataset({ comuni: [comune("A", 19.9, [])] })
    expect(statoTerritorio(ds, scenarioVuoto).A?.fascia).toBe("pessima")
  })
})

describe("statoTerritorio - infrastrutture esistenti", () => {
  const conInfra = (...i: ReturnType<typeof infra>[]) => dataset({ infrastrutture: i })

  it("sommano i delta dei vari tipi", () => {
    const s = statoTerritorio(conInfra(infra("1", "A", "parco"), infra("2", "A", "industria")), scenarioVuoto)
    expect(s.A).toMatchObject({ infrastrutture: -7, totale: 43 })
  })
  it("valgono per tipo: parco +5, ciclabile +3, colonnine +2, industria −12, strada −8", () => {
    const v = (tipo: Parameters<typeof infra>[2]) =>
      statoTerritorio(conInfra(infra("1", "A", tipo)), scenarioVuoto).A?.infrastrutture
    expect([v("parco"), v("ciclabile"), v("colonnine"), v("industria"), v("strada")]).toEqual([5, 3, 2, -12, -8])
  })
  it("contano al massimo 3 oggetti per tipo (i primi del dataset)", () => {
    const s = statoTerritorio(conInfra(...[1, 2, 3, 4, 5].map((n) => infra(`p${n}`, "A", "parco"))), scenarioVuoto)
    expect(s.A?.infrastrutture).toBe(15)
  })
  it("il contributo è limitato a +20", () => {
    const tutte = ["parco", "ciclabile", "colonnine"] as const
    const i = tutte.flatMap((t) => [1, 2, 3].map((n) => infra(`${t}${n}`, "A", t))) // 15+9+6 = 30
    expect(statoTerritorio(conInfra(...i), scenarioVuoto).A?.infrastrutture).toBe(20)
  })
  it("il contributo è limitato a −20", () => {
    const i = [1, 2, 3].map((n) => infra(`ind${n}`, "A", "industria")) // −36
    expect(statoTerritorio(conInfra(...i), scenarioVuoto).A).toMatchObject({ infrastrutture: -20, totale: 30 })
  })
  it("non c'è spillover sui confinanti per l'esistente", () => {
    const s = statoTerritorio(conInfra(infra("1", "A", "industria")), scenarioVuoto)
    expect(s.B?.infrastrutture).toBe(0)
    expect(s.B?.totale).toBe(50)
  })
  it("il totale non esce da 0–100", () => {
    const alto = dataset({ comuni: [comune("A", 95, [])], infrastrutture: [infra("1", "A", "parco"), infra("2", "A", "parco")] })
    expect(statoTerritorio(alto, scenarioVuoto).A?.totale).toBe(100)
    const basso = dataset({ comuni: [comune("A", 5, [])], infrastrutture: [infra("1", "A", "industria")] })
    expect(statoTerritorio(basso, scenarioVuoto).A?.totale).toBe(0)
  })
})

describe("statoTerritorio - scenario in build mode", () => {
  const aggiunta = (id: string, comune: string, tipo: Parameters<typeof infra>[2]) => ({
    id, comune, tipo, posizione: [0, 0] as [number, number],
  })
  const conScenario = (aggiunte: ReturnType<typeof aggiunta>[], rimozioni: string[] = []) => ({
    ...scenarioVuoto, aggiunte, rimozioni,
  })

  it("aggiungere un'industria abbassa il comune di 12 e i confinanti di 6", () => {
    const s = statoTerritorio(dataset(), conScenario([aggiunta("n1", "A", "industria")]))
    expect(s.A).toMatchObject({ scenario: -12, totale: 38 })
    expect(s.B).toMatchObject({ scenario: -6, totale: 44 })
  })
  it("chi non è confinante non risente dell'aggiunta", () => {
    const s = statoTerritorio(dataset(), conScenario([aggiunta("n1", "A", "industria")]))
    expect(s.C?.scenario).toBe(0)
    expect(s.D?.scenario).toBe(0)
  })
  it("aggiungere un parco al comune centrale alza lui di 5 e i due confinanti di 2,5", () => {
    const s = statoTerritorio(dataset(), conScenario([aggiunta("n1", "B", "parco")]))
    expect([s.A?.scenario, s.B?.scenario, s.C?.scenario]).toEqual([2.5, 5, 2.5])
  })
  it("l'aggiunta ignora il tetto ±20 delle infrastrutture esistenti (delta pieno)", () => {
    const tre = [1, 2, 3].map((n) => aggiunta(`n${n}`, "A", "industria"))
    const s = statoTerritorio(dataset(), conScenario(tre))
    expect(s.A).toMatchObject({ scenario: -36, totale: 14, infrastrutture: 0 })
  })
  it("rimuovere un'infrastruttura esistente annulla il suo delta: industria −12 → +12", () => {
    const ds = dataset({ infrastrutture: [infra("ind", "A", "industria")] })
    const s = statoTerritorio(ds, conScenario([], ["ind"]))
    expect(s.A).toMatchObject({ infrastrutture: -12, scenario: 12, totale: 50 })
    expect(s.B?.scenario).toBe(6)
  })
  it("rimuovere un parco esistente toglie 5", () => {
    const ds = dataset({ infrastrutture: [infra("p", "A", "parco")] })
    expect(statoTerritorio(ds, conScenario([], ["p"])).A).toMatchObject({ scenario: -5, totale: 50 })
  })
  it("rimuovere un'infrastruttura che non contava (oltre le prime 3) o inesistente non cambia nulla", () => {
    const ds = dataset({ infrastrutture: [1, 2, 3, 4].map((n) => infra(`p${n}`, "A", "parco")) })
    const s = statoTerritorio(ds, conScenario([], ["p4", "non-esiste"]))
    expect(s.A?.scenario).toBe(0)
    expect(s.B?.scenario).toBe(0)
  })
  it("rimuovere un elemento aggiunto nello scenario lo cancella", () => {
    const s = statoTerritorio(dataset(), conScenario([aggiunta("n1", "A", "industria")], ["n1"]))
    expect(s.A?.scenario).toBe(0)
    expect(s.B?.scenario).toBe(0)
  })
  it("sposta la fascia: una industria in più fa passare 40 → 28 (da media a scarsa)", () => {
    const ds = dataset({ comuni: [comune("A", 40, [])] })
    expect(statoTerritorio(ds, scenarioVuoto).A?.fascia).toBe("media")
    expect(statoTerritorio(ds, conScenario([aggiunta("n1", "A", "industria")])).A?.fascia).toBe("scarsa")
  })
  it("il totale resta tra 0 e 100 anche con le aggiunte", () => {
    const ds = dataset({ comuni: [comune("A", 95, []), comune("B", 3, [])] })
    const s = statoTerritorio(ds, conScenario([aggiunta("n1", "A", "parco"), aggiunta("n2", "B", "industria")]))
    expect(s.A?.totale).toBe(100)
    expect(s.B?.totale).toBe(0)
  })
})

describe("statoTerritorio - indice case medio", () => {
  const perfetta = {
    fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore" as const,
    cottura: "induzione" as const, isolamento: "buono" as const, infissi: true, colonninaEV: true,
  }
  const ds = dataset({ caseSeed: [casaSeed("c1", "A"), casaSeed("c2", "A", { fotovoltaico: true })] })

  it("è la media dei punteggi delle case del comune (0 e 22 → 11)", () => {
    expect(statoTerritorio(ds, scenarioVuoto).A?.indiceCaseMedio).toBe(11)
  })
  it("un comune senza case ha indice 0", () => {
    expect(statoTerritorio(ds, scenarioVuoto).B?.indiceCaseMedio).toBe(0)
  })
  it("include la casa dell'utente nel suo comune ((0+22+100)/3)", () => {
    const utente = casaSeed("io", "A", perfetta)
    const s = statoTerritorio(ds, scenarioVuoto, utente)
    expect(s.A?.indiceCaseMedio).toBeCloseTo(40.67, 2)
    expect(s.B?.indiceCaseMedio).toBe(0)
  })
  it("la casa dell'utente conta anche in un comune senza case seed", () => {
    expect(statoTerritorio(ds, scenarioVuoto, casaSeed("io", "B", perfetta)).B?.indiceCaseMedio).toBe(100)
  })
  it("l'indice case non cambia il totale ambientale", () => {
    expect(statoTerritorio(ds, scenarioVuoto, casaSeed("io", "A", perfetta)).A?.totale).toBe(50)
  })
})

describe("statoTerritorio - macro-scenari", () => {
  const quattro = (comune: string, d = {}) => [1, 2, 3, 4].map((n) => casaSeed(`${comune}${n}`, comune, d))
  const ds = dataset({ caseSeed: [...quattro("A"), ...quattro("B")] })
  const macro = (m: Partial<NonNullable<typeof scenarioVuoto.macro>>) => ({
    ...scenarioVuoto,
    macro: { ambito: "provincia", pctFV: 0, pctSenzaGas: 0, pctIsolamentoBuono: 0, ...m },
  })

  it("con tutti gli slider a zero non cambia nulla", () => {
    const s = statoTerritorio(ds, macro({}))
    expect(s.A).toMatchObject({ scenario: 0, indiceCaseMedio: 0, totale: 50 })
  })
  it("50% di case con fotovoltaico: metà delle case guadagna 22 punti → indice medio 11", () => {
    const s = statoTerritorio(ds, macro({ pctFV: 50 }))
    expect(s.A?.indiceCaseMedio).toBe(11)
  })
  it("l'indice ambientale sale di 0,2 punti per ogni punto di indice case medio (11 → +2,2)", () => {
    const s = statoTerritorio(ds, macro({ pctFV: 50 }))
    expect(s.A?.scenario).toBeCloseTo(2.2, 5)
    expect(s.A?.totale).toBeCloseTo(52.2, 5)
  })
  it("l'ambito provincia tocca tutti i comuni che hanno case, non gli altri", () => {
    const s = statoTerritorio(ds, macro({ pctFV: 100 }))
    expect(s.A?.indiceCaseMedio).toBe(22)
    expect(s.B?.indiceCaseMedio).toBe(22)
    expect(s.C?.scenario).toBe(0)
  })
  it("l'ambito comune tocca solo quel comune, senza spillover", () => {
    const s = statoTerritorio(ds, macro({ ambito: "A", pctFV: 100 }))
    expect(s.A?.indiceCaseMedio).toBe(22)
    expect(s.B).toMatchObject({ indiceCaseMedio: 0, scenario: 0 })
  })
  it("le case che hanno già la dotazione contano verso la percentuale", () => {
    const gia = dataset({ caseSeed: [casaSeed("1", "A", { fotovoltaico: true }), casaSeed("2", "A", { fotovoltaico: true }), casaSeed("3", "A"), casaSeed("4", "A")] })
    const base = statoTerritorio(gia, scenarioVuoto).A?.indiceCaseMedio
    expect(statoTerritorio(gia, macro({ pctFV: 50 })).A?.indiceCaseMedio).toBe(base) // 2 su 4 già c'è
    expect(statoTerritorio(gia, macro({ pctFV: 75 })).A?.indiceCaseMedio).toBeGreaterThan(base!)
  })
  it("gli slider non peggiorano mai le case (a 0% non si tolgono dotazioni)", () => {
    const gia = dataset({ caseSeed: quattro("A", { fotovoltaico: true }) })
    expect(statoTerritorio(gia, macro({ pctFV: 0 })).A?.indiceCaseMedio).toBe(22)
  })
  it("'senza gas' significa pompa di calore + induzione (28 punti su 92 → 30)", () => {
    const s = statoTerritorio(ds, macro({ pctSenzaGas: 100 }))
    expect(s.A?.indiceCaseMedio).toBe(30)
  })
  it("isolamento buono porta le case a 15 punti su 92 → 16", () => {
    const s = statoTerritorio(ds, macro({ pctIsolamentoBuono: 100 }))
    expect(s.A?.indiceCaseMedio).toBe(16)
  })
  it("il delta aria dei macro-scenari ha tetto +10", () => {
    const s = statoTerritorio(ds, macro({ pctFV: 100, pctSenzaGas: 100, pctIsolamentoBuono: 100 }))
    expect(s.A?.indiceCaseMedio).toBe(68) // 63/92
    expect(s.A?.scenario).toBe(10) // 68 × 0,2 = 13,6 → tetto
  })
  it("la casa dell'utente conta nella media ma non viene modificata dagli slider", () => {
    const utente = casaSeed("io", "A", { fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore", cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true })
    const s = statoTerritorio(ds, macro({ pctFV: 100 }), utente)
    expect(s.A?.indiceCaseMedio).toBeCloseTo((4 * 22 + 100) / 5, 5)
    expect(s.A?.scenario).toBeCloseTo(4.4, 5) // il delta aria guarda solo le case seed
  })
  it("si somma al delta delle aggiunte in build mode", () => {
    const sc = { ...macro({ pctFV: 50 }), aggiunte: [{ id: "n", comune: "A", tipo: "industria" as const, posizione: [0, 0] as [number, number] }] }
    expect(statoTerritorio(ds, sc).A?.scenario).toBeCloseTo(-12 + 2.2, 5)
  })
})
