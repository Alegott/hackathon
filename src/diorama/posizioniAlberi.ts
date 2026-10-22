import { estensione, puntoInPoligono, type Punto } from "./geometria"

export type Ostacolo = { posizione: Punto; raggio: number }

// Generatore pseudo-casuale con seme (mulberry32): stessa sequenza a ogni render.
function casuale(seme: number) {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Alberi di un comune. La lista completa dipende solo da poligono, max e seme; la densità ne
// prende un prefisso (quindi calando la fascia gli alberi spariscono senza rimescolarsi) e gli
// ostacoli ne tolgono solo i punti coperti.
export function posizioniAlberi(opz: {
  poligono: Punto[]
  max: number
  densita: number
  seme: number
  ostacoli: Ostacolo[]
}): Punto[] {
  const { poligono, max, densita, seme, ostacoli } = opz
  if (poligono.length < 3 || max <= 0) return []
  const { minX, maxX, minY, maxY } = estensione(poligono)
  const rnd = casuale(seme)
  const tutti: Punto[] = []
  for (let tentativi = 0; tutti.length < max && tentativi < max * 100; tentativi++) {
    const p: Punto = [minX + rnd() * (maxX - minX), minY + rnd() * (maxY - minY)]
    if (puntoInPoligono(p, poligono)) tutti.push(p)
  }
  const n = Math.round(Math.min(1, Math.max(0, densita)) * tutti.length)
  return tutti
    .slice(0, n)
    .filter((p) => ostacoli.every((o) => Math.hypot(p[0] - o.posizione[0], p[1] - o.posizione[1]) >= o.raggio))
}
