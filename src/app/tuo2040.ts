import { dataset } from "../data/dataset"
import { scenarioVuoto } from "../engine"
import { pianoPersonale, type VariantePersonale } from "../engine/personale"
import type { Casa } from "../types"
import { store, storeTempo } from "./useApp"

// Apre la mappa sulla provincia e avvia la macchina del tempo con il piano costruito dalla casa
// della sezione Casa: "e se tutti vivessero come te?".
export function avviaTuo2040(casa: Casa, variante: VariantePersonale = "come-te") {
  const st = store.getState()
  st.tornaAllaProvincia()
  st.setSezione("mappa")
  const base = st.modalita === "scenario" ? st.scenario : scenarioVuoto()
  const { piano } = pianoPersonale(casa, variante)
  const t = storeTempo.getState()
  t.scegliPiano(dataset, piano, base, casa)
  if (!t.attivo) storeTempo.setState({ attivo: true })
  // Il tempo di inquadrare la provincia, poi parte.
  window.setTimeout(() => storeTempo.getState().play(), 1300)
}
