import type { Feature, Position } from "geojson"
import { puntoInPoligono } from "../diorama/geometria"
import { aCoordinateMetriche } from "./territorio"

type Punto = [number, number]
export type TerrenoLibero = (punto: Punto, raggio: number) => boolean
type Ostacolo = { rings: Punto[][]; poligono: boolean; raggio: number; bbox: [number, number, number, number] }

const distanzaSegmento = (p: Punto, a: Punto, b: Punto) => {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

// Impronte complete degli edifici, specchi d'acqua e fiumi/canali lineari, in metri UTM.
export function creaVincoliHabitat(edifici: Feature[], acqua: Feature[], corsi: Feature[]): TerrenoLibero {
  const ostacoli: Ostacolo[] = []
  const aggiungi = (rings: Position[][], poligono: boolean, raggio = 0) => {
    const metrici = rings.map((ring) => ring.map((p) => aCoordinateMetriche([p[0]!, p[1]!]))).filter((r) => r.length >= 2)
    if (!metrici.length) return
    const punti = metrici.flat()
    ostacoli.push({ rings: metrici, poligono, raggio, bbox: [
      Math.min(...punti.map((p) => p[0])), Math.min(...punti.map((p) => p[1])),
      Math.max(...punti.map((p) => p[0])), Math.max(...punti.map((p) => p[1])),
    ] })
  }
  for (const f of [...edifici, ...acqua]) {
    if (f.geometry.type === "Polygon") aggiungi(f.geometry.coordinates, true)
    if (f.geometry.type === "MultiPolygon") f.geometry.coordinates.forEach((rings) => aggiungi(rings, true))
  }
  for (const f of corsi) {
    const tipo = String(f.properties?.class ?? f.properties?.subclass ?? "")
    const larghezza = Number.parseFloat(String(f.properties?.width ?? ""))
    const raggio = Number.isFinite(larghezza) && larghezza > 0 ? larghezza / 2 : /river/.test(tipo) ? 12 : /canal/.test(tipo) ? 8 : 4
    if (f.geometry.type === "LineString") aggiungi([f.geometry.coordinates], false, raggio)
    if (f.geometry.type === "MultiLineString") f.geometry.coordinates.forEach((linea) => aggiungi([linea], false, raggio))
  }
  return (lonlat, margine) => {
    const p = aCoordinateMetriche(lonlat)
    for (const o of ostacoli) {
      const r = margine + o.raggio
      if (p[0] < o.bbox[0] - r || p[0] > o.bbox[2] + r || p[1] < o.bbox[1] - r || p[1] > o.bbox[3] + r) continue
      if (o.poligono && puntoInPoligono(p, o.rings[0]!) && !o.rings.slice(1).some((ring) => puntoInPoligono(p, ring))) return false
      for (const ring of o.rings) {
        for (let i = 0; i < ring.length - 1; i++) if (distanzaSegmento(p, ring[i]!, ring[i + 1]!) <= r) return false
        if (o.poligono && distanzaSegmento(p, ring.at(-1)!, ring[0]!) <= r) return false
      }
    }
    return true
  }
}

// Identità stabile al centimetro, indipendente da ordinamento, vista e livello di zoom.
export function semePosizione([x, y]: Punto): number {
  let n = Math.imul(Math.round(x * 100), 73856093) ^ Math.imul(Math.round(y * 100), 19349663)
  n = Math.imul(n ^ (n >>> 16), 2246822507)
  return (n ^ (n >>> 13)) >>> 0
}
