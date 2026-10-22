import { describe, expect, it } from "vitest"
import { meteoDaClasse } from "./meteo"
import { oggettiAttivi } from "./oggetti"
import type { Classe, Dotazioni } from "../types"

describe("meteoDaClasse", () => {
  it("classi alte: sereno; medie: velato; basse: grigio", () => {
    const m = (c: Classe) => meteoDaClasse(c)
    expect(["A", "B"].map((c) => m(c as Classe))).toEqual(["sereno", "sereno"])
    expect(["C", "D"].map((c) => m(c as Classe))).toEqual(["velato", "velato"])
    expect(["E", "F", "G"].map((c) => m(c as Classe))).toEqual(["grigio", "grigio", "grigio"])
  })
})

describe("oggettiAttivi", () => {
  const nulla: Dotazioni = {
    fotovoltaico: false, solareTermico: false, riscaldamento: "tradizionale",
    cottura: "gas", isolamento: "scarso", infissi: false, colonninaEV: false,
  }
  it("una casa senza dotazioni non ha nulla da mostrare (le scelte peggiori non contano)", () => {
    expect(oggettiAttivi(nulla)).toEqual([])
  })
  it("elenca le dotazioni virtuose presenti, nell'ordine della palette", () => {
    const d: Dotazioni = { ...nulla, fotovoltaico: true, riscaldamento: "pompa_calore", isolamento: "medio", infissi: true }
    expect(oggettiAttivi(d)).toEqual(["fotovoltaico", "pompa_calore", "isolamento_medio", "infissi"])
  })
  it("la condensazione e l'induzione contano come dotazioni", () => {
    expect(oggettiAttivi({ ...nulla, riscaldamento: "condensazione", cottura: "induzione" })).toEqual(["condensazione", "induzione"])
  })
  it("una casa perfetta le ha tutte e otto", () => {
    const perfetta: Dotazioni = {
      fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore",
      cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true,
    }
    expect(oggettiAttivi(perfetta)).toHaveLength(7)
  })
})
