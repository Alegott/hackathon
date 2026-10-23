import type { Stato, Azioni } from "../store/store"
import { aCoordinateGeografiche } from "./territorio"

export const TIPI_TRASCINABILI = ["parco", "ciclabile", "colonnine", "industria", "strada", "nucleare"] as const

// Chiude la strada in tracciamento nel comune del suo primo punto. Restituisce se è stata creata.
export function terminaStrada(
  st: Stato & Azioni,
  trovaComune: (lonlat: [number, number]) => string | null,
): boolean {
  const primo = st.bozzaStrada[0]
  const comune = primo && st.bozzaStrada.length >= 2 ? trovaComune(aCoordinateGeografiche(primo)) : null
  if (!comune) {
    st.annullaBozzaStrada()
    return false
  }
  st.confermaStrada(comune)
  return true
}

type P = [number, number]

// Douglas-Peucker: toglie i punti che non cambiano la forma oltre `tolleranza` (metri).
export function semplifica(punti: P[], tolleranza: number): P[] {
  if (punti.length < 3) return punti
  const [a, b] = [punti[0]!, punti.at(-1)!]
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy)
  let max = 0, idx = 0
  for (let i = 1; i < punti.length - 1; i++) {
    const p = punti[i]!
    const d = len === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len
    if (d > max) { max = d; idx = i }
  }
  if (max <= tolleranza) return [a, b]
  return [...semplifica(punti.slice(0, idx + 1), tolleranza).slice(0, -1), ...semplifica(punti.slice(idx), tolleranza)]
}

// Chaikin: arrotonda gli spigoli mantenendo gli estremi, per curve da strada vera.
export function smussa(punti: P[], giri = 2): P[] {
  let out = punti
  for (let g = 0; g < giri && out.length > 2; g++) {
    const nuovo: P[] = [out[0]!]
    for (let i = 0; i < out.length - 1; i++) {
      const [a, b] = [out[i]!, out[i + 1]!]
      nuovo.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    nuovo.push(out.at(-1)!)
    out = nuovo
  }
  return out
}

// Da un gesto a mano libera (campioni in metri) a un tracciato pulito.
export const pulisciTracciato = (campioni: P[], tolleranza = 8): P[] => smussa(semplifica(campioni, tolleranza))
