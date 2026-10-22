export type Punto = [number, number]

// Ray casting: conta gli incroci di un raggio orizzontale con i lati.
export function puntoInPoligono([x, y]: Punto, anello: Punto[]): boolean {
  let dentro = false
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i]!
    const [xj, yj] = anello[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

export function estensione(anello: Punto[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of anello) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  return { minX, maxX, minY, maxY }
}
