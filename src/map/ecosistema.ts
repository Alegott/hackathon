import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson"
import { difference, intersection, type MultiPolygon as ClipMultiPolygon } from "polygon-clipping"
import type { Comune, StatoComune } from "../types"
import { posizioniAlberi } from "../diorama/posizioniAlberi"
import { puntoInPoligono } from "../diorama/geometria"
import { presetFascia } from "../diorama/preset"
import { sostenibilitaStato } from "./sostenibilita"
import { composizioneFauna, type Fauna } from "./vitaTerritorio"
import { aCoordinateGeografiche, aCoordinateMetriche } from "./territorio"
import provincia from "../data/provincia.geojson.json"

export const confineProvincia = provincia as Feature<Polygon | MultiPolygon>
const poligoniProvincia = (confineProvincia.geometry.type === "Polygon"
  ? [confineProvincia.geometry.coordinates] : confineProvincia.geometry.coordinates)
  .map((rings) => rings.map((ring) => ring.map((p): [number, number] => [p[0]!, p[1]!])) )

// Maschera geografica nativa: evita il ridisegno di clip-path CSS e backdrop-filter a ogni frame.
export const esternoProvincia: Feature<MultiPolygon> = {
  type: "Feature", properties: {},
  geometry: { type: "MultiPolygon", coordinates: difference(
    [[[[8, 43], [16, 43], [16, 50], [8, 50], [8, 43]]]], poligoniProvincia,
  ) },
}

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
  fauna: Fauna
  raggioComune: number // raggio del cerchio di pari area, in metri
}

const raggioEquivalente = (anello: [number, number][]) => {
  let a = 0
  for (let i = 0; i < anello.length; i++) {
    const [x1, y1] = anello[i]!, [x2, y2] = anello[(i + 1) % anello.length]!
    a += x1 * y2 - x2 * y1
  }
  return Math.sqrt(Math.abs(a) / 2 / Math.PI)
}

// Elementi illustrativi dell'indice, vincolati ai poligoni reali. Non sono censimenti faunistici.
export function preparaHabitat(comuni: Comune[], indici: Record<string, StatoComune>,
  selezionato: string | null, centroVista?: [number, number], verdi: [number, number][] = [],
  raggioVista = 1500, libero: [number, number][] = []): Habitat[] {
  return comuni.filter((c) => !selezionato || c.istat === selezionato).flatMap((c) => {
    const stato = indici[c.istat]
    if (!stato) return []
    const preset = sostenibilitaStato(stato)
    const anello = [...c.geometria].sort((a, b) => b.length - a.length)[0]
    if (!anello) return []
    const seme = Number(c.istat)
    const punti = posizioniAlberi({ poligono: anello, max: selezionato ? 100 : 12, densita: 1, seme, ostacoli: [] })
      .filter((p) => dentroProvincia(aCoordinateGeografiche(p)))
    const centroMetrico = centroVista && puntoInPoligono(aCoordinateMetriche(centroVista), anello)
      ? aCoordinateMetriche(centroVista) : c.centroide
    // In città, privilegia verde OSM caricato nella vista per gli alberi.
    const verdiLocali = verdi.map(aCoordinateMetriche).filter((p) => puntoInPoligono(p, anello)
      && dentroProvincia(aCoordinateGeografiche(p)))
    // Griglia metrica stabile: lo zoom ritaglia gli alberi, non li comprime nello schermo.
    const R = Math.max(20, Math.min(raggioVista, 2500))
    const liberoLocale = libero.map(aCoordinateMetriche).filter((p) => puntoInPoligono(p, anello)
      && dentroProvincia(aCoordinateGeografiche(p)))
    const vicini: [number, number][] = []
    if (selezionato) {
      const passo = 70
      for (let ix = Math.floor((centroMetrico[0] - R) / passo); ix <= Math.ceil((centroMetrico[0] + R) / passo); ix++) {
        for (let iy = Math.floor((centroMetrico[1] - R) / passo); iy <= Math.ceil((centroMetrico[1] + R) / passo); iy++) {
          const hash = Math.sin(ix * 127.1 + iy * 311.7 + seme) * 43758.5453
          const jitter = hash - Math.floor(hash)
          const p: [number, number] = [(ix + .25 + jitter * .5) * passo, (iy + .75 - jitter * .5) * passo]
          if (Math.hypot(p[0] - centroMetrico[0], p[1] - centroMetrico[1]) <= R
            && puntoInPoligono(p, anello) && dentroProvincia(aCoordinateGeografiche(p))) vicini.push(p)
        }
      }
      vicini.sort((a, b) => Math.hypot(a[0] - centroMetrico[0], a[1] - centroMetrico[1])
        - Math.hypot(b[0] - centroMetrico[0], b[1] - centroMetrico[1]))
    }
    const alberi: [number, number][] = []
    const limite = selezionato ? Math.min(56, Math.max(1, Math.floor(Math.PI * R * R / 5000))) : 7
    for (const p of selezionato ? [...verdiLocali, ...liberoLocale, ...vicini] : punti) {
      if (selezionato && Math.hypot(p[0] - centroMetrico[0], p[1] - centroMetrico[1]) > R) continue
      if (alberi.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 45)) alberi.push(p)
      if (alberi.length >= limite) break
    }
    return [{ istat: c.istat, centro: aCoordinateGeografiche(c.centroide), raggio: selezionato ? 350 : 1000,
      fauna: composizioneFauna(stato), raggioComune: raggioEquivalente(anello),
      // In vista comune: prima il verde reale caricato, poi alberi decorativi fino a riempire la vista.
      alberi: alberi.map(aCoordinateGeografiche),
      preset }]
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
