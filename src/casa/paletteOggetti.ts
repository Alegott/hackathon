import { punteggioCasa } from "../engine"
import type { Dotazioni } from "../types"
import { applicaOggetto, type Oggetto } from "./oggetti"

export type Opzione = { oggetto: Oggetto; etichetta: string; attiva: boolean; punti: number }
export type Gruppo = { id: keyof Dotazioni; titolo: string; opzioni: Opzione[] }

const DEFINIZIONE: { id: keyof Dotazioni; titolo: string; opzioni: [Oggetto, string][] }[] = [
  { id: "fotovoltaico", titolo: "Fotovoltaico", opzioni: [["fotovoltaico", "Fotovoltaico"]] },
  { id: "solareTermico", titolo: "Solare termico", opzioni: [["solareTermico", "Solare termico"]] },
  {
    id: "riscaldamento", titolo: "Riscaldamento",
    opzioni: [["pompa_calore", "Pompa di calore"], ["condensazione", "Condensazione"], ["tradizionale", "Tradizionale"]],
  },
  { id: "cottura", titolo: "Cottura", opzioni: [["induzione", "Induzione"], ["gas", "Gas"]] },
  {
    id: "isolamento", titolo: "Isolamento",
    opzioni: [["isolamento_buono", "Buono"], ["isolamento_medio", "Medio"], ["isolamento_scarso", "Scarso"]],
  },
  { id: "infissi", titolo: "Infissi", opzioni: [["infissi", "Doppio vetro"]] },
  { id: "colonninaEV", titolo: "Colonnina EV", opzioni: [["colonninaEV", "Colonnina EV"]] },
]

const èAttiva = (d: Dotazioni, o: Oggetto) => {
  const dopo = applicaOggetto(d, o)
  return (Object.keys(d) as (keyof Dotazioni)[]).every((k) => dopo[k] === d[k])
}

// Per ogni oggetto: se è installato e quanti punti farebbe guadagnare (o perdere) applicarlo.
// Le opzioni sì/no, quando non sono installate, hanno come alternativa l'assenza.
export function paletteOggetti(d: Dotazioni): Gruppo[] {
  const base = punteggioCasa(d).punteggio
  return DEFINIZIONE.map((g) => ({
    id: g.id,
    titolo: g.titolo,
    opzioni: g.opzioni.map(([oggetto, etichetta]) => ({
      oggetto,
      etichetta,
      attiva: èAttiva(d, oggetto),
      punti: punteggioCasa(applicaOggetto(d, oggetto)).punteggio - base,
    })),
  }))
}
