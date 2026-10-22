import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson"
import { intersection, type MultiPolygon as ClipMultiPolygon } from "polygon-clipping"
import type { Comune, StatoComune } from "../types"
import { posizioniAlberi } from "../diorama/alberi"
import { puntoInPoligono } from "../diorama/geometria"
import { presetFascia } from "../diorama/preset"
import { aCoordinateGeografiche, aCoordinateMetriche } from "./territorio"
import provincia from "../data/provincia.geojson.json"

export const confineProvincia = provincia as Feature<Polygon | MultiPolygon>
const poligoniProvincia = (confineProvincia.geometry.type === "Polygon"
  ? [confineProvincia.geometry.coordinates] : confineProvincia.geometry.coordinates)
  .map((rings) => rings.map((ring) => ring.map((p): [number, number] => [p[0]!, p[1]!])) )

export function dentroProvincia(p: [number, number]): boolean {
  return poligoniProvincia.some((rings) => {
    const outer = rings[0]
    return !!outer && puntoInPoligono(p, outer) && !rings.slice(1).some((ring) => puntoInPoligono(p, ring))
  })
}

// `within` di MapLibre supporta punti e linee, non edifici poligonali: serve un vero clipping.
export function ritagliaEdifici(features: Feature[], area: Polygon | MultiPolygon = confineProvincia.geometry): FeatureCollection<MultiPolygon> {
  const poligoni = (area.type === "Polygon" ? [area.coordinates] : area.coordinates) as ClipMultiPolygon
  const segmenti = poligoni.flatMap((rings) => rings.flatMap((ring) => ring.slice(1).map((p, i) => {
    const q = ring[i]!
    return [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])]
  })))
  const visti = new Set<string>()
  const result: FeatureCollection<MultiPolygon> = { type: "FeatureCollection", features: [] }
  for (const f of features) {
    if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue
    if (f.properties?.hide_3d === true) continue
    const coordinates = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as ClipMultiPolygon
    const punti = coordinates.flat(2)
    if (!punti.length) continue
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const [x, y] of punti) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y) }
    const key = `${f.id ?? ""}:${minX}:${minY}:${maxX}:${maxY}:${f.properties?.render_height}`
    if (visti.has(key)) continue
    visti.add(key)
    // Se nessun segmento del confine attraversa il bbox, basta un test di contenimento.
    const bordo = segmenti.some(([w, s, e, n]) => w! <= maxX && e! >= minX && s! <= maxY && n! >= minY)
    let clipped: ClipMultiPolygon
    if (!bordo) {
      const p = punti[0]!
      if (!poligoni.some((rings) => !!rings[0] && puntoInPoligono(p, rings[0]) && !rings.slice(1).some((ring) => puntoInPoligono(p, ring)))) continue
      clipped = coordinates
    } else clipped = intersection(coordinates, poligoni)
    // Le proprietà delle tile possono avere prototipo null: normalizzarle per il worker GeoJSON.
    if (clipped.length) result.features.push({ type: "Feature", properties: { ...f.properties },
      geometry: { type: "MultiPolygon", coordinates: clipped } })
  }
  return result
}

export type Habitat = {
  istat: string
  centro: [number, number]
  raggio: number
  alberi: [number, number][]
  preset: ReturnType<typeof presetFascia>
}

// Elementi illustrativi dell'indice, vincolati ai poligoni reali. Non sono censimenti faunistici.
export function preparaHabitat(comuni: Comune[], indici: Record<string, StatoComune>,
  selezionato: string | null, centroVista?: [number, number], verdi: [number, number][] = []): Habitat[] {
  return comuni.filter((c) => !selezionato || c.istat === selezionato).flatMap((c) => {
    const stato = indici[c.istat]
    if (!stato) return []
    const preset = presetFascia(stato.fascia)
    const anello = [...c.geometria].sort((a, b) => b.length - a.length)[0]
    if (!anello) return []
    const seme = Number(c.istat)
    const punti = posizioniAlberi({ poligono: anello, max: selezionato ? 100 : 12, densita: 1, seme, ostacoli: [] })
      .filter((p) => dentroProvincia(aCoordinateGeografiche(p)))
    const centroMetrico = centroVista && puntoInPoligono(aCoordinateMetriche(centroVista), anello)
      ? aCoordinateMetriche(centroVista) : c.centroide
    // In città, privilegia verde OSM caricato nella vista. Gli uccelli orbitano vicino al centro visibile.
    const verdiLocali = verdi.map(aCoordinateMetriche).filter((p) => puntoInPoligono(p, anello)
      && dentroProvincia(aCoordinateGeografiche(p)))
    const vicini = punti.filter((p) => !selezionato || Math.hypot(p[0] - centroMetrico[0], p[1] - centroMetrico[1]) < 1500)
    return [{ istat: c.istat, centro: aCoordinateGeografiche(centroMetrico), raggio: selezionato ? 350 : 1000,
      alberi: (selezionato ? verdiLocali : punti).slice(0, selezionato ? 80 : 7).map(aCoordinateGeografiche),
      preset, ...(selezionato && !verdiLocali.length ? { alberi: vicini.slice(0, 12).map(aCoordinateGeografiche) } : {}) }]
  })
}

// Path SVG in coordinate schermo: la stessa geometria ritaglia sfocatura e foschia durante pan/zoom.
export function percorsoProvincia(proietta: (p: [number, number]) => { x: number; y: number }): string {
  const g = confineProvincia.geometry
  const poligoni = g.type === "Polygon" ? [g.coordinates] : g.coordinates
  return poligoni.flatMap((rings) => rings.map((ring) => ring.map((p, i) => {
    const s = proietta([p[0]!, p[1]!])
    return `${i ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)}`
  }).join("") + "Z")).join("")
}
