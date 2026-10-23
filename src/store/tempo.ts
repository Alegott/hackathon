import { createStore } from "zustand/vanilla"
import { fotogrammi, PIANI, type Fotogramma, type PianoTemporale } from "../engine/tempo"
import type { Casa, Dataset, Scenario } from "../types"

// Stato della macchina del tempo. Separato dallo store principale: quando è attiva gli indici
// mostrati vengono dai fotogrammi precalcolati e non da statoTerritorio sullo scenario corrente.
export type StatoTempo = {
  attivo: boolean
  anno: number
  inRiproduzione: boolean
  piano: PianoTemporale
  fotogrammi: Fotogramma[]
  // Diventa vero quando la riproduzione arriva all'ultimo anno: mostra la scheda finale.
  concluso: boolean
}

export type AzioniTempo = {
  apri(ds: Dataset, base: Scenario, casaUtente?: Casa): void
  scegliPiano(ds: Dataset, piano: PianoTemporale, base: Scenario, casaUtente?: Casa): void
  chiudi(): void
  setAnno(anno: number): void
  concludi(): void
  play(): void
  pausa(): void
}

const PIANO_INIZIALE = PIANI.find((p) => p.id === "piano-clima") ?? PIANI[0]!

export function creaStoreTempo() {
  return createStore<StatoTempo & AzioniTempo>()((set, get) => ({
    attivo: false,
    anno: PIANO_INIZIALE.annoInizio,
    inRiproduzione: false,
    piano: PIANO_INIZIALE,
    fotogrammi: [],
    concluso: false,
    apri: (ds, base, casaUtente) => {
      const piano = get().piano
      set({ attivo: true, anno: piano.annoInizio, inRiproduzione: false, concluso: false, fotogrammi: fotogrammi(ds, piano, base, casaUtente) })
    },
    scegliPiano: (ds, piano, base, casaUtente) =>
      set({ piano, anno: piano.annoInizio, inRiproduzione: false, concluso: false, fotogrammi: fotogrammi(ds, piano, base, casaUtente) }),
    chiudi: () => set({ attivo: false, inRiproduzione: false, concluso: false, fotogrammi: [] }),
    setAnno: (anno) => {
      const { piano } = get()
      set({ anno: Math.min(piano.annoFine, Math.max(piano.annoInizio, anno)), concluso: false })
    },
    concludi: () => set({ anno: get().piano.annoFine, inRiproduzione: false, concluso: true }),
    play: () => {
      const { anno, piano } = get()
      set({ inRiproduzione: true, concluso: false, anno: anno >= piano.annoFine ? piano.annoInizio : anno })
    },
    pausa: () => set({ inRiproduzione: false }),
  }))
}
