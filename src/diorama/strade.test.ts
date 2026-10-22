import { describe, expect, it } from "vitest"
import {
  avanzaAnimaleEvitandoOstacoli,
  calcolaOstacoliCompleti,
  calcolaPosizioniCase,
  costruisciReteStradale,
  scegliWaypointSicuro,
} from "./strade"
import { CATALOGO_MODELLI_3D } from "./modelli3d"
import { posizioniAlberi } from "./posizioniAlberi"
import { calcolaSpawnSpecieRare } from "./Fauna"
import type { Punto } from "./geometria"

const MODELLI_DISCO = Object.keys(import.meta.glob("/public/models/*.glb"))

const QUADRATO: Punto[] = [
  [-5, -5],
  [5, -5],
  [5, 5],
  [-5, 5],
]

describe("strade continue, case 3D, collision avoidance animali e modelli glTF", () => {
  it("costruisce una strada continua multi-segmento e impedisce agli alberi di crescere su strade e case", () => {
    const infra = [
      { id: "s1", tipo: "strada" as const, scena: [-2, 0] as Punto },
      { id: "s2", tipo: "strada" as const, scena: [2, 0] as Punto },
    ]
    const tratti = costruisciReteStradale({
      infra,
      anello: QUADRATO,
      centro: [0, 0],
      dimensione: 10,
      s: 0.5,
    })

    expect(tratti).toHaveLength(1)
    expect(tratti[0]!.punti.length).toBeGreaterThan(10)

    const caseDiorama = calcolaPosizioniCase({
      anello: QUADRATO,
      infra,
      trattiStradali: tratti,
      caseComune: [],
      seme: 42,
      s: 0.5,
      dimensione: 10,
    })
    expect(caseDiorama.length).toBeGreaterThan(0)

    const ostacoli = calcolaOstacoliCompleti(infra, tratti, 10, 0.5, caseDiorama)
    const alberi = posizioniAlberi({
      poligono: QUADRATO,
      max: 120,
      densita: 1,
      seme: 42,
      ostacoli,
    })

    // Nessun albero deve trovarsi sopra i punti del tracciato stradale continuo
    for (const pStrada of tratti[0]!.punti) {
      for (const alb of alberi) {
        expect(Math.hypot(alb[0] - pStrada[0], alb[1] - pStrada[1])).toBeGreaterThanOrEqual(
          tratti[0]!.larghezza * 1.3,
        )
      }
    }

    // Nessun albero deve trovarsi dentro il raggio delle case
    for (const casa of caseDiorama) {
      for (const alb of alberi) {
        expect(
          Math.hypot(alb[0] - casa.posizione[0], alb[1] - casa.posizione[1]),
        ).toBeGreaterThanOrEqual(casa.raggio * 1.2)
      }
    }
  })

  it("impedisce agli animali di passare all'interno delle case e delle altre strutture", () => {
    const casaAlCentro = { posizione: [0, 0] as Punto, raggio: 1.2 }
    const industria = { posizione: [2.2, 2.0] as Punto, raggio: 1.1 }
    const ostacoli = [casaAlCentro, industria]
    const raggioAnimale = 0.2

    // L'animale parte a sinistra [-3.5, 0] e punta dritto verso destra [3.5, 0],
    // dove nel mezzo c'è una casa in [0, 0].
    let x = -3.5
    let z = 0.05
    let angolo = Math.PI / 2

    for (let step = 0; step < 220; step++) {
      const res = avanzaAnimaleEvitandoOstacoli({
        x,
        z,
        targetX: 3.5,
        targetZ: 0,
        angolo,
        velocita: 1.5,
        dt: 0.05,
        ostacoli,
        anello: QUADRATO,
        raggioAnimale,
      })
      x = res.x
      z = res.z
      angolo = res.angolo

      // Verifica rigorosa ad ogni singolo frame: l'animale non entra MAI dentro la casa o l'industria
      for (const o of ostacoli) {
        const dist = Math.hypot(x - o.posizione[0], z - o.posizione[1])
        expect(dist).toBeGreaterThanOrEqual(o.raggio + raggioAnimale - 1e-4)
      }
    }

    // Alla fine del percorso l'animale ha aggirato la casa ed è arrivato a destra (x > 2.5)
    expect(x).toBeGreaterThan(2.5)

    // E la scelta del waypoint preferisce segmenti che non tagliano l'edificio
    const wpScelto = scegliWaypointSicuro(
      [-3, 0],
      [
        [3, 0], // taglia la casa in [0,0]
        [-3, 3.5], // percorso libero!
      ],
      ostacoli,
      0,
      raggioAnimale,
    )
    expect(wpScelto).toEqual([-3, 3.5])
  })

  it("dispone solo di modelli 3D glTF (.glb) autoctoni della zona (senza fenicotteri o pappagalli)", () => {
    const chiavi = Object.keys(CATALOGO_MODELLI_3D)
    expect(chiavi).not.toContain("flamingo")
    expect(chiavi).not.toContain("parrot")
    expect(chiavi).toEqual(
      expect.arrayContaining(["deer", "stag", "fox", "wolf", "stork", "tree", "flower"]),
    )
    for (const relUrl of Object.values(CATALOGO_MODELLI_3D)) {
      expect(MODELLI_DISCO).toContain(`/public${relUrl}`)
    }
  })

  it("attiva lo spawn di specie in via d'estinzione vicentine solo con aria alta e basso inquinamento", () => {
    const inquinato = calcolaSpawnSpecieRare({
      aria: 35,
      infrastrutture: -12,
      scenario: 0,
      totale: 23,
    })
    expect(inquinato.spawnRate).toBe(0)
    expect(inquinato.specieAttive).toHaveLength(0)

    const pulito = calcolaSpawnSpecieRare({
      aria: 92,
      infrastrutture: 8,
      scenario: 5,
      totale: 95,
    })
    expect(pulito.spawnRate).toBeGreaterThanOrEqual(0.85)
    expect(pulito.specieAttive.map((s) => s.id)).toContain("salamandra_aurora")
    expect(pulito.specieAttive.map((s) => s.id)).toContain("gallo_cedrone")
    expect(pulito.specieAttive.map((s) => s.id)).toContain("aquila_reale")
  })
})
