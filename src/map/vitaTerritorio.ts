import type { FeatureCollection, MultiPolygon, Polygon } from "geojson"
import { calcolaSpawnSpecieRare } from "../diorama/specie"
import { puntoInPoligono } from "../diorama/geometria"
import { PRESET_PROVINCIA, presetFascia, type PresetVisivo } from "../diorama/preset"
import { fasciaDa } from "../engine/territorio"
import type { Comune, StatoComune } from "../types"
import { aCoordinateMetriche, coloreIndice } from "./territorio"

export type SpecieTerra = "capriolo" | "volpe" | "cervo" | "lupo"

// Stesso ordine del diorama: capriolo, volpe, cervo reale, lupo, e di nuovo da capo.
const ORDINE: SpecieTerra[] = ["capriolo", "volpe", "cervo", "lupo"]

export type Fauna = {
  terra: SpecieTerra[] // un elemento per animale a terra
  uccelli: number // cicogne e simili in volo
  aquila: boolean // aquila reale: spawn rate ≥ 0,45
  lince: boolean // lince alpina: spawn rate ≥ 0,65
  spawnRate: number
}

// Quanta e quale fauna mostrare in un comune. Dipende solo dallo stato calcolato dal motore:
// il numero segue il preset della fascia, le specie rare le regole di spawn della SPEC di Dev 5.
export function composizioneFauna(stato: StatoComune): Fauna {
  const preset = presetFascia(stato.fascia)
  const nTerra = Math.round(preset.animali)
  const uccelli = Math.round(preset.uccelli)
  const { spawnRate } = calcolaSpawnSpecieRare(stato)
  return {
    terra: Array.from({ length: nTerra }, (_, i) => ORDINE[i % ORDINE.length]!),
    uccelli,
    aquila: spawnRate >= 0.45 && uccelli > 0,
    lince: spawnRate >= 0.65 && nTerra > 0,
    spawnRate,
  }
}

// ───────────────────────── atmosfera ─────────────────────────

export type Cielo = {
  "sky-color": string
  "horizon-color": string
  "fog-color": string
  "fog-ground-blend": number
  "horizon-fog-blend": number
  "sky-horizon-blend": number
  "atmosphere-blend": number
}
export type Atmosfera = { sky: Cielo; foschia: number; nuvole: { quantita: number; grigio: number } }

const hex = (c: [number, number, number]) =>
  "#" + c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")
const mescola = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] =>
  [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

// Cielo e foschia per MapLibre (`setSky`) a partire dal preset della fascia: la stessa fonte del
// diorama, quindi cielo, nebbia e nuvole peggiorano insieme all'indice.
export function atmosferaDaStato(stato: StatoComune | null): Atmosfera {
  const p: PresetVisivo = stato ? presetFascia(stato.fascia) : { ...PRESET_PROVINCIA, cielo: presetFascia("ottima").cielo, nebbia: 0.08 }
  const foschiaDensa = Math.min(1, Math.max(0, p.nebbia))
  const orizzonte = mescola(p.cielo, [0.96, 0.97, 0.98], 0.55 * (1 - foschiaDensa))
  return {
    sky: {
      "sky-color": hex(p.cielo),
      "horizon-color": hex(orizzonte),
      "fog-color": hex(mescola(p.cielo, [0.78, 0.8, 0.8], 0.4)),
      "fog-ground-blend": Math.min(1, foschiaDensa * 0.85),
      "horizon-fog-blend": Math.min(1, 0.3 + foschiaDensa * 0.6),
      "sky-horizon-blend": 0.5,
      "atmosphere-blend": 0,
    },
    foschia: foschiaDensa,
    nuvole: { quantita: p.nuvole.quantita, grigio: p.nuvole.grigio },
  }
}

// Stato medio dei comuni: guida cielo e foschia quando si guarda tutta la provincia.
export function statoMedio(indici: Record<string, StatoComune>): StatoComune | null {
  const v = Object.values(indici)
  if (!v.length) return null
  const media = (k: "aria" | "infrastrutture" | "scenario" | "totale" | "indiceCaseMedio") => v.reduce((n, s) => n + s[k], 0) / v.length
  const totale = media("totale")
  return {
    aria: media("aria"), infrastrutture: media("infrastrutture"), scenario: media("scenario"),
    totale, fascia: fasciaDa(totale), indiceCaseMedio: media("indiceCaseMedio"),
  }
}

// ───────────────────────── edifici colorati per comune ─────────────────────────

// Restituisce una funzione [lon, lat] → codice ISTAT del comune che contiene il punto (o null).
// Prefiltro per bounding box: gli edifici sono migliaia, i comuni centoquattordici.
export function creaTrovaComune(comuni: Comune[]): (lonlat: [number, number]) => string | null {
  const voci = comuni.map((c) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const anello of c.geometria) for (const [x, y] of anello) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }
    return { istat: c.istat, anelli: c.geometria, minX, minY, maxX, maxY }
  })
  return (lonlat) => {
    const p = aCoordinateMetriche(lonlat)
    for (const v of voci)
      if (p[0] >= v.minX && p[0] <= v.maxX && p[1] >= v.minY && p[1] <= v.maxY && v.anelli.some((a) => puntoInPoligono(p, a)))
        return v.istat
    return null
  }
}

export const comuneDelPunto = (lonlat: [number, number], comuni: Comune[]) => creaTrovaComune(comuni)(lonlat)

// Colore di ogni edificio = fascia del suo comune. I comuni con la stessa fascia condividono
// una sola regola: pochi colori, non centoquattordici.
export function coloriEdifici(indici: Record<string, StatoComune>, riserva: string) {
  const perColore = new Map<string, string[]>()
  for (const [istat, stato] of Object.entries(indici)) {
    const c = coloreIndice(stato)
    perColore.set(c, [...(perColore.get(c) ?? []), istat])
  }
  if (!perColore.size) return riserva
  return ["match", ["get", "istat"], ...[...perColore].flatMap(([colore, comuni]) => [comuni, colore]), riserva]
}

// ───────────────────────── scala e tagging ─────────────────────────
// Metri coperti da un pixel nella mappa (tile da 512 px, proiezione Web Mercator).
export function metriPerPixel(zoom: number, latitudine: number): number {
  return (40075016.686 * Math.cos((latitudine * Math.PI) / 180)) / (512 * 2 ** zoom)
}

// Aggiunge a ogni edificio il codice ISTAT del comune che lo contiene (null se fuori), usando
// il primo vertice. Restituisce una copia: l'originale non cambia.
export function assegnaComuni<T extends FeatureCollection<MultiPolygon | Polygon>>(
  fc: T, trova: (lonlat: [number, number]) => string | null,
): T {
  return {
    ...fc,
    features: fc.features.map((f) => {
      const primo = (f.geometry.type === "Polygon" ? f.geometry.coordinates[0]?.[0] : f.geometry.coordinates[0]?.[0]?.[0]) as [number, number] | undefined
      return { ...f, properties: { ...f.properties, istat: primo ? trova([primo[0], primo[1]]) : null } }
    }),
  }
}
