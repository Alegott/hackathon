import { describe, expect, it } from "vitest"
import { classifica, statoTerritorio } from "./index"
import type { Dataset } from "../types"
import mock from "../data/dataset.mock.json"

const ds = mock as Dataset
const vuoto = { aggiunte: [], rimozioni: [], macro: null }

describe("dataset.mock.json", () => {
  it("attraversa il motore e dà un valore valido per ogni comune", () => {
    const s = statoTerritorio(ds, vuoto)
    expect(Object.keys(s)).toHaveLength(ds.comuni.length)
    for (const v of Object.values(s)) expect(v.totale).toBeGreaterThanOrEqual(0)
  })
  it("la classifica del comune con una casa privata non espone punteggio né nome", () => {
    expect(classifica(ds.caseSeed, "024004")).toEqual([{ dotazioni: ds.caseSeed[1]!.dotazioni }])
  })
})
