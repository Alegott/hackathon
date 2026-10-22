import { describe, expect, it } from "vitest"
import { applicaOggetto, èOggetto, togliOggetto } from "./oggetti"
import type { Dotazioni } from "../types"

const nulla: Dotazioni = {
  fotovoltaico: false, solareTermico: false, riscaldamento: "tradizionale",
  cottura: "gas", isolamento: "scarso", infissi: false, colonninaEV: false,
}
const perfetta: Dotazioni = {
  fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore",
  cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true,
}

describe("applicaOggetto (clic o drop sulla casa)", () => {
  it("le dotazioni sì/no si attivano", () => {
    expect(applicaOggetto(nulla, "fotovoltaico").fotovoltaico).toBe(true)
    expect(applicaOggetto(nulla, "solareTermico").solareTermico).toBe(true)
    expect(applicaOggetto(nulla, "infissi").infissi).toBe(true)
    expect(applicaOggetto(nulla, "colonninaEV").colonninaEV).toBe(true)
  })
  it("le scelte multiple impostano il valore trascinato", () => {
    expect(applicaOggetto(nulla, "pompa_calore").riscaldamento).toBe("pompa_calore")
    expect(applicaOggetto(nulla, "condensazione").riscaldamento).toBe("condensazione")
    expect(applicaOggetto(perfetta, "tradizionale").riscaldamento).toBe("tradizionale")
    expect(applicaOggetto(nulla, "induzione").cottura).toBe("induzione")
    expect(applicaOggetto(perfetta, "gas").cottura).toBe("gas")
    expect(applicaOggetto(nulla, "isolamento_buono").isolamento).toBe("buono")
    expect(applicaOggetto(nulla, "isolamento_medio").isolamento).toBe("medio")
    expect(applicaOggetto(perfetta, "isolamento_scarso").isolamento).toBe("scarso")
  })
  it("cambia solo la dotazione interessata e non modifica l'originale", () => {
    const copia = structuredClone(nulla)
    const r = applicaOggetto(nulla, "fotovoltaico")
    expect(nulla).toEqual(copia)
    expect(r).toEqual({ ...nulla, fotovoltaico: true })
  })
  it("applicare ciò che c'è già non cambia nulla", () => {
    expect(applicaOggetto(perfetta, "fotovoltaico")).toEqual(perfetta)
    expect(applicaOggetto(perfetta, "pompa_calore")).toEqual(perfetta)
  })
})

describe("togliOggetto (rimozione dalla casa)", () => {
  it("le dotazioni sì/no si disattivano", () => {
    expect(togliOggetto(perfetta, "fotovoltaico").fotovoltaico).toBe(false)
    expect(togliOggetto(perfetta, "colonninaEV").colonninaEV).toBe(false)
  })
  it("una scelta multiple torna alla peggiore, ma solo se era quella installata", () => {
    expect(togliOggetto(perfetta, "pompa_calore").riscaldamento).toBe("tradizionale")
    expect(togliOggetto(perfetta, "induzione").cottura).toBe("gas")
    expect(togliOggetto(perfetta, "isolamento_buono").isolamento).toBe("scarso")
    // la pompa di calore non c'è: togliere "pompa" non tocca la condensazione installata
    const conCondensazione = { ...nulla, riscaldamento: "condensazione" as const }
    expect(togliOggetto(conCondensazione, "pompa_calore")).toEqual(conCondensazione)
  })
  it("togliere la scelta peggiore non fa nulla", () => {
    expect(togliOggetto(nulla, "tradizionale")).toEqual(nulla)
    expect(togliOggetto(nulla, "gas")).toEqual(nulla)
    expect(togliOggetto(nulla, "isolamento_scarso")).toEqual(nulla)
  })
})

describe("èOggetto (controllo di ciò che arriva dal drag and drop)", () => {
  it("accetta solo gli oggetti noti", () => {
    expect(èOggetto("fotovoltaico")).toBe(true)
    expect(èOggetto("isolamento_medio")).toBe(true)
    expect(èOggetto("lavatrice")).toBe(false)
    expect(èOggetto("")).toBe(false)
    expect(èOggetto(null)).toBe(false)
    expect(èOggetto(42)).toBe(false)
    expect(èOggetto("__proto__")).toBe(false)
  })
})
