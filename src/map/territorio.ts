import proj4 from "proj4"
import type { FeatureCollection, MultiPolygon } from "geojson"
import type { Comune, StatoComune } from "../types"
import { colorePunteggio } from "./fasce"

const utm32 = "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs"

export function aCoordinateGeografiche(punto: [number, number]): [number, number] {
  return proj4(utm32, "EPSG:4326", punto) as [number, number]
}

export function aCoordinateMetriche(punto: [number, number]): [number, number] {
  return proj4("EPSG:4326", utm32, punto) as [number, number]
}

export function confiniGeografici(comuni: Comune[]): FeatureCollection<MultiPolygon> {
  return {
    type: "FeatureCollection",
    features: comuni.map((c) => ({
      type: "Feature", id: c.istat,
      properties: { istat: c.istat, nome: c.nome },
      geometry: {
        type: "MultiPolygon",
        coordinates: c.geometria.map((anello) => {
          const punti = anello.map(aCoordinateGeografiche)
          const primo = punti[0], ultimo = punti.at(-1)
          if (primo && ultimo && (primo[0] !== ultimo[0] || primo[1] !== ultimo[1]))
            punti.push(primo)
          return [punti]
        }),
      },
    })),
  }
}

export function estensioneGeografica(confini: FeatureCollection<MultiPolygon>): [[number, number], [number, number]] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of confini.features)
    for (const poligono of f.geometry.coordinates)
      for (const anello of poligono)
        for (const punto of anello) {
          const x = punto[0], y = punto[1]
          if (x === undefined || y === undefined) continue
          minX = Math.min(minX, x); maxX = Math.max(maxX, x)
          minY = Math.min(minY, y); maxY = Math.max(maxY, y)
        }
  if (!Number.isFinite(minX)) return [[11.05, 45.15], [11.95, 46.2]]
  return [[minX, minY], [maxX, maxY]]
}

export function coloreIndice(stato: StatoComune | undefined): string {
  return stato ? colorePunteggio(stato.totale) : "#94a3b8"
}

// Gerarchia editoriale dei centri di riferimento; le posizioni arrivano dai place OSM.
export const CENTRI_PRINCIPALI = [
  "Vicenza", "Bassano del Grappa", "Schio", "Thiene", "Arzignano", "Valdagno",
  "Montecchio Maggiore", "Lonigo", "Marostica", "Asiago", "Noventa Vicentina",
]
