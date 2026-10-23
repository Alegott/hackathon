import { useMemo } from "react"
import { useStore } from "zustand"
import { dataset } from "../data/dataset"
import { derivaIndici } from "../store/indici"
import { creaStore } from "../store/store"
import { creaStoreTempo, type AzioniTempo, type StatoTempo } from "../store/tempo"
import { interpola } from "../engine/tempo"
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

export const storeTempo = creaStoreTempo()
export const useTempo = <T,>(selettore: (s: StatoTempo & AzioniTempo) => T): T => useStore(storeTempo, selettore)

// Anno mostrato e riepilogo quando la macchina del tempo è attiva, altrimenti null.
export function useMomento() {
  const attivo = useTempo((s) => s.attivo)
  const anno = useTempo((s) => s.anno)
  const fot = useTempo((s) => s.fotogrammi)
  return useMemo(() => (attivo && fot.length ? { anno, ...interpola(fot, anno) } : null), [attivo, anno, fot])
}

// Gli indici si ricalcolano dallo stato a ogni cambio rilevante, non vengono mai salvati.
export function useIndici() {
  const modalita = useApp((s) => s.modalita)
  const scenario = useApp((s) => s.scenario)
  const casaUtente = useApp((s) => s.casaUtente)
  const momento = useMomento()
  const oggi = useMemo(() => derivaIndici(dataset, { modalita, scenario, casaUtente }), [modalita, scenario, casaUtente])
  return momento?.indici ?? oggi
}
