import { createStore } from "zustand/vanilla"
import { scenarioVuoto } from "../engine"
import { caricaCasa, salvaCasa } from "./persistenza"
import type { Aggiunta, Casa, Scenario, TipoIndustria, TipoInfra, TipoStrada } from "../types"

export type Sezione = "mappa" | "casa" | "simulazione" | "amici"

export type Stato = {
  vista: "provincia" | "comune"
  comuneSelezionato: string | null
  modalita: "realta" | "scenario"
  strumento: TipoInfra | "rimuovi" | null
  scenario: Scenario
  // Tracciato in corso (strada, pista ciclabile o contorno del parco, in metri) e varianti scelte.
  tipoStrada: TipoStrada
  tipoIndustria: TipoIndustria
  bozzaStrada: [number, number][]
  casaUtente: Casa | null
  sezione: Sezione
}

export type Azioni = {
  selezionaComune(istat: string): void
  tornaAllaProvincia(): void
  setSezione(sezione: Sezione): void
  setModalita(modalita: Stato["modalita"]): void
  setStrumento(strumento: Stato["strumento"]): void
  aggiungiInfrastruttura(
    comune: string,
    tipo: TipoInfra,
    posizione: [number, number],
    extra?: Pick<Aggiunta, "strada" | "ciclabile" | "parco" | "industria">,
  ): void
  spostaInfrastruttura(id: string, comune: string, posizione: [number, number]): void
  setTipoStrada(tipo: TipoStrada): void
  setTipoIndustria(tipo: TipoIndustria): void
  aggiungiPuntoStrada(punto: [number, number]): void
  annullaUltimoPuntoStrada(): void
  annullaBozzaStrada(): void
  setBozzaStrada(punti: [number, number][]): void
  confermaTracciato(comune: string): void
  rimuoviInfrastruttura(id: string): void
  setMacro(macro: Scenario["macro"]): void
  resetScenario(): void
  setCasaUtente(casa: Casa | null): void
}

export type Opzioni = { storage: Storage | null }


export function creaStore({ storage }: Opzioni) {
  let prossimoId = 1
  return createStore<Stato & Azioni>()((set, get) => ({
    vista: "provincia",
    comuneSelezionato: null,
    modalita: "realta",
    strumento: null,
    scenario: scenarioVuoto(),
    tipoStrada: "provinciale",
    tipoIndustria: "meccanica",
    bozzaStrada: [],
    casaUtente: caricaCasa(storage),
    sezione: "mappa",
    selezionaComune: (istat) => set({ vista: "comune", comuneSelezionato: istat }),
    tornaAllaProvincia: () => set({ vista: "provincia", comuneSelezionato: null }),
    setSezione: (sezione) => set({ sezione }),
    setModalita: (modalita) =>
      set(modalita === "realta" ? { modalita, strumento: null, bozzaStrada: [] } : { modalita }),
    setStrumento: (strumento) => {
      if (get().modalita === "scenario") set({ strumento, bozzaStrada: [] })
    },
    aggiungiInfrastruttura: (comune, tipo, posizione, extra) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      const id = `scn-${prossimoId++}`
      set({
        scenario: { ...scenario, aggiunte: [...scenario.aggiunte, { id, comune, tipo, posizione, ...(extra ?? (tipo === "industria" ? { industria: get().tipoIndustria } : {})) }] },
      })
    },
    spostaInfrastruttura: (id, comune, posizione) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      set({
        scenario: {
          ...scenario,
          aggiunte: scenario.aggiunte.map((a) => (a.id === id && !a.strada && !a.ciclabile && !a.parco ? { ...a, comune, posizione } : a)),
        },
      })
    },
    setTipoStrada: (tipoStrada) => set({ tipoStrada }),
    setTipoIndustria: (tipoIndustria) => set({ tipoIndustria }),
    aggiungiPuntoStrada: (punto) => {
      if (get().modalita === "scenario") set({ bozzaStrada: [...get().bozzaStrada, punto] })
    },
    annullaUltimoPuntoStrada: () => set({ bozzaStrada: get().bozzaStrada.slice(0, -1) }),
    annullaBozzaStrada: () => set({ bozzaStrada: [] }),
    setBozzaStrada: (bozzaStrada) => {
      if (get().modalita === "scenario") set({ bozzaStrada })
    },
    confermaTracciato: (comune) => {
      const { bozzaStrada: p, tipoStrada, strumento } = get()
      const [primo] = p
      if (!primo) return
      const aggiungi = get().aggiungiInfrastruttura
      if (strumento === "strada" && p.length >= 2) aggiungi(comune, "strada", primo, { strada: { tipo: tipoStrada, tracciato: p } })
      else if (strumento === "ciclabile" && p.length >= 2) aggiungi(comune, "ciclabile", primo, { ciclabile: { tracciato: p } })
      else if (strumento === "parco" && p.length >= 3) aggiungi(comune, "parco", primo, { parco: { contorno: p } })
      else return
      set({ bozzaStrada: [] })
    },
    rimuoviInfrastruttura: (id) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      if (scenario.aggiunte.some((a) => a.id === id)) {
        set({ scenario: { ...scenario, aggiunte: scenario.aggiunte.filter((a) => a.id !== id) } })
      } else if (!scenario.rimozioni.includes(id)) {
        set({ scenario: { ...scenario, rimozioni: [...scenario.rimozioni, id] } })
      }
    },
    setMacro: (macro) => set((st) => ({ scenario: { ...st.scenario, macro } })),
    setCasaUtente: (casa) => {
      set({ casaUtente: casa })
      salvaCasa(storage, casa)
    },
    resetScenario: () => set({ scenario: scenarioVuoto(), strumento: null, bozzaStrada: [] }),
  }))
}
