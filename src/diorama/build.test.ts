import { describe, expect, it } from "vitest"
import { azioneDaClic } from "./build"
import type { Comune } from "../types"

// Comune a L in metri: [0,1000]² senza l'angolo [500,1000]×[500,1000]
const comune: Comune = {
  istat: "X", nome: "X", centroide: [0, 0], confinanti: [], ariaNorm: 50, pm10: 0, nCentraline: 1,
  geometria: [[[0, 0], [1000, 0], [1000, 500], [500, 500], [500, 1000], [0, 1000]]],
}
const base = { modalita: "scenario" as const, strumento: "parco" as const, comune, punto: [200, 200] as [number, number] }

describe("azioneDaClic", () => {
  it("con uno strumento di aggiunta, un clic dentro il comune aggiunge in quel punto", () => {
    expect(azioneDaClic(base)).toEqual({ tipo: "aggiungi", comune: "X", tipologia: "parco", posizione: [200, 200] })
  })
  it("funziona con ogni tipo di infrastruttura", () => {
    for (const t of ["parco", "ciclabile", "colonnine", "industria", "strada"] as const)
      expect(azioneDaClic({ ...base, strumento: t })).toMatchObject({ tipo: "aggiungi", tipologia: t })
  })
  it("un clic fuori dal comune non fa nulla, nemmeno nell'angolo concavo escluso", () => {
    expect(azioneDaClic({ ...base, punto: [1500, 200] })).toBeNull()
    expect(azioneDaClic({ ...base, punto: [800, 800] })).toBeNull()
  })
  it("in modalità realtà non fa nulla", () => {
    expect(azioneDaClic({ ...base, modalita: "realta" })).toBeNull()
    expect(azioneDaClic({ ...base, modalita: "realta", strumento: "rimuovi", infraColpitaId: "i1" })).toBeNull()
  })
  it("senza strumento attivo non fa nulla", () => {
    expect(azioneDaClic({ ...base, strumento: null })).toBeNull()
    expect(azioneDaClic({ ...base, strumento: null, infraColpitaId: "i1" })).toBeNull()
  })
  it("senza comune selezionato non aggiunge", () => {
    expect(azioneDaClic({ ...base, comune: null })).toBeNull()
  })
  it("con 'rimuovi', cliccare un'infrastruttura la rimuove", () => {
    expect(azioneDaClic({ ...base, strumento: "rimuovi", infraColpitaId: "i1" })).toEqual({ tipo: "rimuovi", id: "i1" })
  })
  it("con 'rimuovi', cliccare il terreno vuoto non fa nulla", () => {
    expect(azioneDaClic({ ...base, strumento: "rimuovi" })).toBeNull()
  })
  it("con uno strumento di aggiunta, cliccare un'infrastruttura non la rimuove", () => {
    expect(azioneDaClic({ ...base, infraColpitaId: "i1" })).toBeNull()
  })
})
