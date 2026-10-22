import { describe, expect, it } from "vitest"
import { aCoordinateGeografiche, confiniGeografici, estensioneGeografica } from "./territorio"
import type { Comune } from "../types"

describe("cartografia reale", () => {
  it("colloca Vicenza in WGS84 partendo dalle coordinate UTM32 del dataset", () => {
    // Punto di controllo indipendente calcolato con PROJ / pyproj.
    const [lon, lat] = aCoordinateGeografiche([698744.1115323443, 5046871.164273014])
    expect(lon).toBeCloseTo(11.546, 5)
    expect(lat).toBeCloseTo(45.547, 5)
  })

  it("conserva isole e codici comunali, chiudendo gli anelli GeoJSON", () => {
    const comune: Comune = {
      istat: "024116", nome: "Vicenza", centroide: [698744, 5046871], confinanti: [],
      ariaNorm: 65, pm10: 27, nCentraline: 5,
      geometria: [
        [[698744, 5046871], [698844, 5046871], [698844, 5046971]],
        [[699744, 5046871], [699844, 5046871], [699844, 5046971]],
      ],
    }
    const geo = confiniGeografici([comune])
    expect(geo.features[0]?.id).toBe(comune.istat)
    expect(geo.features[0]?.geometry.coordinates).toHaveLength(2)
    const ring = geo.features[0]!.geometry.coordinates[0]![0]!
    expect(ring[0]).toEqual(ring.at(-1))
    const [[west, south], [east, north]] = estensioneGeografica(geo)
    expect(west).toBeGreaterThan(11)
    expect(east).toBeLessThan(12)
    expect(south).toBeGreaterThan(45)
    expect(north).toBeLessThan(46)
    expect(east).toBeGreaterThan(west)
  })
})
