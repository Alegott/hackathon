import { scenarioVuoto, statoTerritorio } from "../engine"
import type { Dataset, StatoComune } from "../types"
import type { Stato } from "./store"

// Gli indici si derivano sempre dallo stato e non si salvano. In modalità realtà lo scenario
// resta nello store (così riappare al ritorno) ma non influenza i valori mostrati.
export function derivaIndici(
  ds: Dataset,
  { modalita, scenario, casaUtente }: Pick<Stato, "modalita" | "scenario" | "casaUtente">,
): Record<string, StatoComune> {
  return statoTerritorio(ds, modalita === "scenario" ? scenario : scenarioVuoto(), casaUtente ?? undefined)
}
