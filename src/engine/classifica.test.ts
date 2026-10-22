import { describe, expect, it } from "vitest"
import { classifica } from "./index"
import type { Casa, Dotazioni } from "../types"

const base: Dotazioni = {
  fotovoltaico: false,
  solareTermico: false,
  riscaldamento: "tradizionale",
  cottura: "gas",
  isolamento: "scarso",
  infissi: false,
  colonninaEV: false,
}
const casa = (id: string, comune: string, pubblico: boolean, nickname: string | undefined, d: Partial<Dotazioni>): Casa => ({
  id, comune, pubblico, nickname, dotazioni: { ...base, ...d },
})

describe("classifica", () => {
  const case_ = [
    casa("1", "A", true, "Bassa", {}),
    casa("2", "A", true, "Alta", { fotovoltaico: true, riscaldamento: "pompa_calore" }),
    casa("3", "A", false, "Segreta", { fotovoltaico: true }),
    casa("4", "B", true, "Altro comune", { fotovoltaico: true }),
  ]

  it("include solo le case del comune richiesto", () => {
    expect(classifica(case_, "B")).toHaveLength(1)
    expect(classifica(case_, "Z")).toEqual([])
  })
  it("i profili pubblici espongono nome, punteggio e dotazioni, dal punteggio più alto", () => {
    const righe = classifica(case_, "A").filter((r) => r.nome !== undefined)
    expect(righe.map((r) => [r.nome, r.punteggio])).toEqual([["Alta", 43], ["Bassa", 0]])
    expect(righe[0]?.dotazioni.fotovoltaico).toBe(true)
  })
  it("i profili privati compaiono con le sole dotazioni, senza nome né punteggio", () => {
    const privata = classifica(case_, "A").find((r) => r.nome === undefined)
    expect(privata).toBeDefined()
    expect(Object.keys(privata!)).toEqual(["dotazioni"])
    expect(privata!.dotazioni.fotovoltaico).toBe(true)
  })
  it("non lascia filtrare l'id né il comune della casa", () => {
    for (const r of classifica(case_, "A")) {
      expect(Object.keys(r).every((k) => ["nome", "punteggio", "dotazioni"].includes(k))).toBe(true)
    }
  })
})
