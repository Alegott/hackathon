import { createStore } from "zustand/vanilla"
import { scenarioVuoto } from "../engine"
import { caricaCasa, salvaCasa } from "./persistenza"
import type { Casa, Scenario, TipoInfra, TipoStrada } from "../types"

export type Sezione = "mappa" | "casa" | "simulazione"

export type Stato = {
  vista: "provincia" | "comune"
  comuneSelezionato: string | null
  modalita: "realta" | "scenario"
  strumento: TipoInfra | "rimuovi" | null
  scenario: Scenario
  // Strada in corso di tracciamento (metri) e tipologia scelta.
  tipoStrada: TipoStrada
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
    strada?: { tipo: TipoStrada; tracciato: [number, number][] },
  ): void
  spostaInfrastruttura(id: string, comune: string, posizione: [number, number]): void
  setTipoStrada(tipo: TipoStrada): void
  aggiungiPuntoStrada(punto: [number, number]): void
  annullaUltimoPuntoStrada(): void
  annullaBozzaStrada(): void
  setBozzaStrada(punti: [number, number][]): void
  confermaStrada(comune: string): void
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
    aggiungiInfrastruttura: (comune, tipo, posizione, strada) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      const id = `scn-${prossimoId++}`
      set({
        scenario: { ...scenario, aggiunte: [...scenario.aggiunte, { id, comune, tipo, posizione, ...(strada && { strada }) }] },
      })
    },
    spostaInfrastruttura: (id, comune, posizione) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      set({
        scenario: {
          ...scenario,
          aggiunte: scenario.aggiunte.map((a) => (a.id === id && !a.strada ? { ...a, comune, posizione } : a)),
        },
      })
    },
    setTipoStrada: (tipoStrada) => set({ tipoStrada }),
    aggiungiPuntoStrada: (punto) => {
      if (get().modalita === "scenario") set({ bozzaStrada: [...get().bozzaStrada, punto] })
    },
    annullaUltimoPuntoStrada: () => set({ bozzaStrada: get().bozzaStrada.slice(0, -1) }),
    annullaBozzaStrada: () => set({ bozzaStrada: [] }),
    setBozzaStrada: (bozzaStrada) => {
      if (get().modalita === "scenario") set({ bozzaStrada })
    },
    confermaStrada: (comune) => {
      const { bozzaStrada, tipoStrada } = get()
      if (bozzaStrada.length < 2) return
      get().aggiungiInfrastruttura(comune, "strada", bozzaStrada[0]!, { tipo: tipoStrada, tracciato: bozzaStrada })
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
