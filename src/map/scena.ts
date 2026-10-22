import type { Comune } from "../types"

export type Proiezione = {
  aScena(p: [number, number]): [number, number]
  daScena(p: [number, number]): [number, number]
  dimensione: number
}

// Le coordinate dei comuni sono in metri; la scena 3D lavora in unità piccole centrate
// sull'origine, con il nord verso il fondo dello schermo (z negativa).
export function creaProiezione(comuni: Comune[], dimensione: number): Proiezione {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const c of comuni)
    for (const anello of c.geometria)
      for (const [x, y] of anello) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x)
        minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
  if (!isFinite(minX)) return { aScena: () => [0, 0], daScena: () => [0, 0], dimensione }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const scala = dimensione / Math.max(maxX - minX, maxY - minY, 1)
  return {
    aScena: ([x, y]) => [(x - cx) * scala + 0, -(y - cy) * scala + 0],
    daScena: ([x, z]) => [x / scala + cx, -z / scala + cy],
    dimensione,
  }
}
