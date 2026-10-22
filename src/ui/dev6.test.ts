import { describe, it, expect } from "vitest"
import { COMUNI_VICENZA_114 } from "../data/comuni114"
import { formatSegno } from "./PannelloComune"
import { etichetteDotazioni } from "./ClassificaComunale"
import { META_CLASSI } from "./DashboardCasa"
import { CASA_DEMO_DEFAULT, salvaCasaConTryCatch } from "./SezioneCasa"
import { store } from "../app/useApp"

describe("Dev 6 — UI Casa, Classifica, Pannello Comune e Simulazione", () => {
  it("espone l'elenco completo dei 114 comuni della provincia di Vicenza", () => {
    expect(COMUNI_VICENZA_114).toHaveLength(114)
    expect(COMUNI_VICENZA_114.some((c) => c.nome === "Vicenza")).toBe(true)
    expect(COMUNI_VICENZA_114.some((c) => c.nome === "Arzignano")).toBe(true)
  })

  it("formatta i delta con segno + o − per il pannello comune", () => {
    expect(formatSegno(5)).toBe("+5")
    expect(formatSegno(-12)).toBe("−12")
    expect(formatSegno(0)).toBe("+0")
  })

  it("genera le etichette dotazioni per la classifica comunale", () => {
    const chips = etichetteDotazioni(CASA_DEMO_DEFAULT.dotazioni)
    expect(chips.length).toBeGreaterThan(0)
    expect(chips.some((x) => x.includes("Caldaia condensazione"))).toBe(true)
  })

  it("definisce tutte le classi energetiche A–G per la dashboard", () => {
    expect(Object.keys(META_CLASSI)).toEqual(["A", "B", "C", "D", "E", "F", "G"])
  })

  it("salva la casa utente con try/catch aggiornando lo store Zustand", () => {
    salvaCasaConTryCatch(CASA_DEMO_DEFAULT)
    expect(store.getState().casaUtente?.nickname).toBe(CASA_DEMO_DEFAULT.nickname)
  })
})
