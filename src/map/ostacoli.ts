// Collisioni tra una strada e gli edifici, in un piano locale in metri attorno a un'origine.
type P = [number, number]
export type Edificio = { minX: number; minY: number; maxX: number; maxY: number; anelli: P[][] }

export type Origine = { lon: number; lat: number }

export const aPiano = ([lon, lat]: P, o: Origine): P => [
  (lon - o.lon) * 111320 * Math.cos((o.lat * Math.PI) / 180),
  (lat - o.lat) * 110540,
]

type Geometria = { type: string; coordinates?: unknown }

// Anelli esterni degli edifici (Polygon e MultiPolygon, coordinate lon/lat) nel piano locale.
export function edificiDaGeometrie(geometrie: Geometria[], o: Origine): Edificio[] {
  const out: Edificio[] = []
  for (const g of geometrie) {
    const poligoni = g.type === "Polygon" ? [g.coordinates as P[][]]
      : g.type === "MultiPolygon" ? (g.coordinates as P[][][]) : []
    for (const poligono of poligoni) {
      const anello = poligono[0]?.map((p) => aPiano(p, o))
      if (!anello || anello.length < 3) continue
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of anello) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
      out.push({ minX, minY, maxX, maxY, anelli: [anello] })
    }
  }
  return out
}

const dentro = ([x, y]: P, anello: P[]) => {
  let in_ = false
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i]!, [xj, yj] = anello[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) in_ = !in_
  }
  return in_
}

function distPuntoSegmento(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

const orient = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
const siIncrociano = (a: P, b: P, c: P, d: P) =>
  orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0

function distSegmenti(a: P, b: P, c: P, d: P): number {
  if (siIncrociano(a, b, c, d)) return 0
  return Math.min(distPuntoSegmento(a, c, d), distPuntoSegmento(b, c, d), distPuntoSegmento(c, a, b), distPuntoSegmento(d, a, b))
}

// Vero se il tratto a→b, largo 2·semiLarghezza, tocca un edificio.
export function trattoLibero(a: P, b: P, edifici: Edificio[], semiLarghezza: number): boolean {
  const minX = Math.min(a[0], b[0]) - semiLarghezza, maxX = Math.max(a[0], b[0]) + semiLarghezza
  const minY = Math.min(a[1], b[1]) - semiLarghezza, maxY = Math.max(a[1], b[1]) + semiLarghezza
  for (const e of edifici) {
    if (e.maxX < minX || e.minX > maxX || e.maxY < minY || e.minY > maxY) continue
    for (const anello of e.anelli) {
      if (dentro(a, anello) || dentro(b, anello)) return false
      for (let i = 0; i < anello.length; i++)
        if (distSegmenti(a, b, anello[i]!, anello[(i + 1) % anello.length]!) < semiLarghezza) return false
    }
  }
  return true
}

export function percorsoLibero(punti: P[], edifici: Edificio[], semiLarghezza: number): boolean {
  if (punti.length === 1) return trattoLibero(punti[0]!, punti[0]!, edifici, semiLarghezza)
  for (let i = 1; i < punti.length; i++)
    if (!trattoLibero(punti[i - 1]!, punti[i]!, edifici, semiLarghezza)) return false
  return true
}
