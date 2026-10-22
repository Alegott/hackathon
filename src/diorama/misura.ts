import type { Proiezione } from "../map/scena"
import type { Comune } from "../types"
import { estensione, type Punto } from "./geometria"

export type MisuraComune = {
  anello: Punto[] // contorno principale in coordinate di scena (x, z)
  centro: Punto
  dimensione: number // lato più lungo dell'estensione, in unità di scena
}

// Il contorno principale è l'anello con l'estensione più grande (le isole sono ignorate).
export function misuraComune(c: Comune, p: Proiezione): MisuraComune {
  let migliore: Punto[] = []
  let areaMax = -1
  for (const anello of c.geometria) {
    const sc = anello.map((pt) => p.aScena(pt))
    const { minX, maxX, minY, maxY } = estensione(sc)
    const area = (maxX - minX) * (maxY - minY)
    if (area > areaMax) { areaMax = area; migliore = sc }
  }
  if (migliore.length === 0) return { anello: [], centro: p.aScena(c.centroide), dimensione: 1 }
  const { minX, maxX, minY, maxY } = estensione(migliore)
  return {
    anello: migliore,
    centro: [(minX + maxX) / 2, (minY + maxY) / 2],
    dimensione: Math.max(maxX - minX, maxY - minY, 0.01),
  }
}
