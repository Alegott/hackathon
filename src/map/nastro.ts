// Nastro piatto lungo una polilinea (x, y in metri, z verticale): è la base di strade e piste 3D.
export type Nastro = { posizioni: number[]; indici: number[] }

export function costruisciNastro(punti: [number, number][], larghezza: number, quota: number): Nastro {
  const posizioni: number[] = []
  const indici: number[] = []
  if (punti.length < 2) return { posizioni, indici }
  const meta = larghezza / 2
  for (let i = 0; i < punti.length; i++) {
    const corrente = punti[i]!
    const prima = punti[Math.max(0, i - 1)]!
    const dopo = punti[Math.min(punti.length - 1, i + 1)]!
    const tx = dopo[0] - prima[0]
    const ty = dopo[1] - prima[1]
    const lunghezza = Math.hypot(tx, ty) || 1
    const nx = -ty / lunghezza
    const ny = tx / lunghezza
    posizioni.push(corrente[0] + nx * meta, corrente[1] + ny * meta, quota)
    posizioni.push(corrente[0] - nx * meta, corrente[1] - ny * meta, quota)
    if (i < punti.length - 1) {
      const base = i * 2
      indici.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
    }
  }
  return { posizioni, indici }
}
