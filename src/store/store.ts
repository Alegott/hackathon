import { createStore } from "zustand/vanilla"
import { scenarioVuoto } from "../engine"
import { caricaCasa, salvaCasa } from "./persistenza"
import type { Casa, Scenario, TipoInfra } from "../types"

export type Sezione = "mappa" | "casa" | "simulazione" | "amici"

export type Stato = {
  vista: "provincia" | "comune"
  comuneSelezionato: string | null
  modalita: "realta" | "scenario"
  strumento: TipoInfra | "rimuovi" | null
  scenario: Scenario
  casaUtente: Casa | null
  sezione: Sezione
}

export type Azioni = {
  selezionaComune(istat: string): void
  tornaAllaProvincia(): void
  setSezione(sezione: Sezione): void
  setModalita(modalita: Stato["modalita"]): void
  setStrumento(strumento: Stato["strumento"]): void
  aggiungiInfrastruttura(comune: string, tipo: TipoInfra, posizione: [number, number]): void
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
    casaUtente: caricaCasa(storage),
    sezione: "mappa",
    selezionaComune: (istat) => set({ vista: "comune", comuneSelezionato: istat }),
    tornaAllaProvincia: () => set({ vista: "provincia", comuneSelezionato: null }),
    setSezione: (sezione) => set({ sezione }),
    setModalita: (modalita) => set(modalita === "realta" ? { modalita, strumento: null } : { modalita }),
    setStrumento: (strumento) => {
      if (get().modalita === "scenario") set({ strumento })
    },
    aggiungiInfrastruttura: (comune, tipo, posizione) => {
      const { modalita, scenario } = get()
      if (modalita !== "scenario") return
      const id = `scn-${prossimoId++}`
      set({ scenario: { ...scenario, aggiunte: [...scenario.aggiunte, { id, comune, tipo, posizione }] } })
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
    resetScenario: () => set({ scenario: scenarioVuoto(), strumento: null }),
  }))
}
