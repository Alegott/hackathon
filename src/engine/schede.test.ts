import { describe, expect, it } from "vitest"
import { schedaImpatto } from "./schede"
import type { Aggiunta } from "../types"

const base = { id: "x", comune: "A", posizione: [0, 0] as [number, number] }

describe("schedaImpatto", () => {
  it("ogni tipo ha pro, contro ed effetti", () => {
    const tipi: Aggiunta[] = [
      { ...base, tipo: "parco", parco: { contorno: [[0, 0], [100, 0], [100, 100]] } },
      { ...base, tipo: "ciclabile", ciclabile: { tracciato: [[0, 0], [1000, 0]] } },
      { ...base, tipo: "colonnine" }, { ...base, tipo: "nucleare" },
      { ...base, tipo: "industria", industria: "conciaria" },
      { ...base, tipo: "strada", strada: { tipo: "autostrada", tracciato: [[0, 0], [2000, 0]] } },
    ]
    for (const a of tipi) {
      const s = schedaImpatto(a)
      expect(s.pro.length).toBeGreaterThan(0)
      expect(s.contro.length).toBeGreaterThan(0)
      expect(s.effetti.length).toBeGreaterThan(2)
    }
  })
  it("l'impatto mostrato coincide con quello del motore", () => {
    expect(schedaImpatto({ ...base, tipo: "industria", industria: "artigianale" }).impatto).toBe(-4)
    expect(schedaImpatto({ ...base, tipo: "nucleare" }).impatto).toBe(10)
  })
  it("una infrastruttura reale ha una scheda coi valori base", () => {
    expect(schedaImpatto({ id: "r", comune: "A", tipo: "parco", posizione: [0, 0] }).impatto).toBe(5)
  })
})
