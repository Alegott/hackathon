import { useMemo } from "react"
import { useStore } from "zustand"
import { dataset } from "../data/dataset"
import { derivaIndici } from "../store/indici"
import { creaStore } from "../store/store"
import type { Azioni, Stato } from "../store/store"

const archivio = (() => {
  try {
    return window.localStorage
  } catch {
    return null
  }
})()

export const store = creaStore({ storage: archivio })

// Solo in sviluppo: permette di pilotare lo store dalla console e dagli script di verifica.
if (import.meta.env.DEV && typeof window !== "undefined")
  (window as unknown as { __store: typeof store }).__store = store

export const useApp = <T,>(selettore: (s: Stato & Azioni) => T): T => useStore(store, selettore)

// Gli indici si ricalcolano dallo stato a ogni cambio rilevante, non vengono mai salvati.
export function useIndici() {
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const casaUtente = useApp((s) => s.casaUtente)
  return useMemo(() => derivaIndici(dataset, { modalita, scenario, casaUtente }), [modalita, scenario, casaUtente])
}
