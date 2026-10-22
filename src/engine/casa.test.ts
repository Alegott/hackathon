import { describe, expect, it } from "vitest"
import { punteggioCasa } from "./index"
import type { Dotazioni } from "../types"

const nulla: Dotazioni = {
  fotovoltaico: false,
  solareTermico: false,
  riscaldamento: "tradizionale",
  cottura: "gas",
  isolamento: "scarso",
  infissi: false,
  colonninaEV: false,
}
const perfetta: Dotazioni = {
  fotovoltaico: true,
  solareTermico: true,
  riscaldamento: "pompa_calore",
  cottura: "induzione",
  isolamento: "buono",
  infissi: true,
  colonninaEV: true,
}

describe("punteggioCasa - punteggio", () => {
  it("una casa senza dotazioni fa 0", () => {
    expect(punteggioCasa(nulla).punteggio).toBe(0)
  })
  it("una casa con tutte le dotazioni migliori fa 100", () => {
    expect(punteggioCasa(perfetta).punteggio).toBe(100)
  })
  it("il solo fotovoltaico (20 punti su 92 di checklist) vale 22", () => {
    expect(punteggioCasa({ ...nulla, fotovoltaico: true }).punteggio).toBe(22)
  })
})

describe("punteggioCasa - classe", () => {
  it("100 è classe A, 0 è classe G", () => {
    expect(punteggioCasa(perfetta).classe).toBe("A")
    expect(punteggioCasa(nulla).classe).toBe("G")
  })
  it("assegna le classi intermedie su fasce uniformi", () => {
    // FV + pompa di calore + isolamento buono = 55/92 → 60
    const c = punteggioCasa({ ...nulla, fotovoltaico: true, riscaldamento: "pompa_calore", isolamento: "buono" })
    expect(c.punteggio).toBe(60)
    expect(c.classe).toBe("C")
    // solo fotovoltaico = 22
    expect(punteggioCasa({ ...nulla, fotovoltaico: true }).classe).toBe("F")
    // tutto tranne colonnina e infissi = 73/92 → 79
    const b = punteggioCasa({ ...perfetta, colonninaEV: false, infissi: false })
    expect(b.punteggio).toBe(79)
    expect(b.classe).toBe("B")
  })
  it("ai bordi tra una classe e l'altra", () => {
    const pc = { ...nulla, riscaldamento: "pompa_calore" as const }
    // 28 → F, 29 → E
    expect(punteggioCasa({ ...nulla, riscaldamento: "condensazione", cottura: "induzione", colonninaEV: true })).toMatchObject({ punteggio: 28, classe: "F" })
    expect(punteggioCasa({ ...pc, isolamento: "medio" })).toMatchObject({ punteggio: 29, classe: "E" })
    // 42 → E, 43 → D
    expect(punteggioCasa({ ...pc, infissi: true, colonninaEV: true })).toMatchObject({ punteggio: 42, classe: "E" })
    expect(punteggioCasa({ ...nulla, riscaldamento: "condensazione", cottura: "induzione", isolamento: "buono", infissi: true })).toMatchObject({ punteggio: 43, classe: "D" })
    // 57 → D, 58 → C
    expect(punteggioCasa({ ...pc, cottura: "induzione", isolamento: "buono", infissi: true })).toMatchObject({ punteggio: 57, classe: "D" })
    expect(punteggioCasa({ ...pc, cottura: "induzione", isolamento: "buono", colonninaEV: true })).toMatchObject({ punteggio: 58, classe: "C" })
    // 71 → C, 72 → B
    expect(punteggioCasa({ ...pc, fotovoltaico: true, cottura: "induzione", isolamento: "medio", colonninaEV: true })).toMatchObject({ punteggio: 71, classe: "C" })
    expect(punteggioCasa({ ...pc, fotovoltaico: true, isolamento: "medio", infissi: true, colonninaEV: true })).toMatchObject({ punteggio: 72, classe: "B" })
  })
})

describe("punteggioCasa - mancanti", () => {
  it("una casa perfetta non ha nulla che manca", () => {
    expect(punteggioCasa(perfetta).mancanti).toEqual([])
  })
  it("per ogni scelta migliorabile indica i punti guadagnabili passando alla migliore", () => {
    const m = punteggioCasa({ ...perfetta, riscaldamento: "condensazione", isolamento: "medio" }).mancanti
    expect(m).toEqual([
      { dotazione: "riscaldamento", punti: 13 }, // 12/92
      { dotazione: "isolamento", punti: 9 }, // 8/92
    ])
  })
  it("elenca le voci dalla più alla meno redditizia", () => {
    const m = punteggioCasa(nulla).mancanti
    expect(m.map((x) => x.dotazione).sort()).toEqual(
      ["colonninaEV", "cottura", "fotovoltaico", "infissi", "isolamento", "riscaldamento", "solareTermico"],
    )
    const punti = m.map((x) => x.punti)
    expect(punti).toEqual([...punti].sort((a, b) => b - a))
    expect(m.find((x) => x.dotazione === "fotovoltaico")?.punti).toBe(22)
    expect(m.find((x) => x.dotazione === "cottura")?.punti).toBe(9)
  })
})
