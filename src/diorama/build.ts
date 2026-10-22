import type { Comune, TipoInfra } from "../types"
import { puntoInPoligono, type Punto } from "./geometria"

export type AzioneBuild =
  | { tipo: "aggiungi"; comune: string; tipologia: TipoInfra; posizione: Punto }
  | { tipo: "rimuovi"; id: string }

// Decide cosa fa un clic in build mode. `punto` è in metri (coordinate del dataset).
export function azioneDaClic(c: {
  modalita: "realta" | "scenario"
  strumento: TipoInfra | "rimuovi" | null
  comune: Comune | null
  punto: Punto
  infraColpitaId?: string
}): AzioneBuild | null {
  if (c.modalita !== "scenario" || c.strumento === null) return null
  if (c.strumento === "rimuovi") return c.infraColpitaId ? { tipo: "rimuovi", id: c.infraColpitaId } : null
  if (c.infraColpitaId || !c.comune) return null
  if (!c.comune.geometria.some((anello) => puntoInPoligono(c.punto, anello))) return null
  return { tipo: "aggiungi", comune: c.comune.istat, tipologia: c.strumento, posizione: c.punto }
}
