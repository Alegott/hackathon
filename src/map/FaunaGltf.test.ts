import { expect, it, vi } from "vitest"
import * as THREE from "three"
import { FaunaGltf, type ContestoFrame } from "./FaunaGltf"

vi.mock("../diorama/modelli3d", () => ({
  CATALOGO_MODELLI_3D: { deer: "deer", fox: "fox", stag: "stag", wolf: "wolf", stork: "stork" },
  caricaGLTF: async () => ({ scene: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2)) }),
  creaIstanzaAnimata: () => ({ oggetto: new THREE.Group(), mixer: { update() {} }, impostaMovimento() {}, assicuraAttiva() {} }),
}))

async function prepara() {
  const fauna = new FaunaGltf()
  await new Promise<void>((resolve) => fauna.avvia(resolve))
  fauna.configura({ terra: ["capriolo"], uccelli: 1, aquila: true, lince: false, spawnRate: 1 }, [[100, 200]], [100, 200], "024116")
  return fauna
}
const contesto: ContestoFrame = { mpp: 2, dentro: () => true, centro: [100, 200], raggio: 350, vistaCentro: [100, 200], vistaRaggio: 800 }

it("pan e aggiornamento habitat non spostano uccelli e animali con la finestra", async () => {
  const f = await prepara()
  f.frame(0, 10, contesto)
  const prima = f.gruppo.children.filter((s) => s.visible).map((s) => s.position.clone())
  f.configura({ terra: ["capriolo"], uccelli: 1, aquila: true, lince: false, spawnRate: 1 }, [[5000, 6000]], [5000, 6000], "024116")
  f.frame(0, 10, { ...contesto, centro: [5000, 6000], vistaCentro: [5000, 6000] })
  expect(f.gruppo.children.filter((s) => s.visible).map((s) => s.position)).toEqual(prima)
})

it("dezoom riduce l'ingombro sullo schermo senza cambiare quota e scala geografica", async () => {
  const f = await prepara()
  f.frame(0, 10, contesto)
  const prima = f.gruppo.children.filter((s) => s.visible).map((s) => ({ scala: s.scale.x, z: s.position.z }))
  f.frame(0, 10, { ...contesto, mpp: 16, vistaRaggio: 6400 })
  f.gruppo.children.filter((s) => s.visible).forEach((s, i) => {
    expect(s.scale.x).toBe(prima[i]!.scala)
    expect(s.position.z).toBe(prima[i]!.z)
    expect(s.scale.x / 16).toBeLessThan(prima[i]!.scala / 2)
  })
})

it("limita l'ingombro allo zoom ravvicinato senza cambiare orbite o quota", async () => {
  const f = await prepara()
  f.frame(0, 10, contesto)
  const prima = f.gruppo.children.filter((s) => s.visible).map((s) => s.position.clone())
  f.frame(0, 10, { ...contesto, mpp: .2 })
  const attivi = f.gruppo.children.filter((s) => s.visible)
  expect(attivi.map((s) => s.position)).toEqual(prima)
  expect(attivi[0]!.scale.x * 1.3 / .2).toBeCloseTo(48, 8)
})

it("gli animali avanzano sulle strade senza cambiare modelli o quota", async () => {
  const f = await prepara()
  f.frame(0, 0, contesto)
  f.gruppo.updateMatrixWorld(true)
  const posizioni = f.gruppo.children.filter((s) => s.visible).map((s) => s.position.clone())
  f.setPercorsi([[[100, 200], [200, 200], [200, 300]]])
  for (let i = 0; i < 100; i++) f.frame(.1, i / 10, contesto)
  const animale = f.gruppo.children.find((s) => s.visible)!
  expect(animale.position.distanceTo(posizioni[0]!)).toBeGreaterThan(5)
  expect(animale.position.y).toBeCloseTo(200)
  expect(animale.position.z).toBe(0)
})

it("non usa il centroide come ripiego quando non esistono punti sicuri", async () => {
  const f = new FaunaGltf()
  await new Promise<void>((resolve) => f.avvia(resolve))
  f.configura({ terra: ["capriolo"], uccelli: 0, aquila: false, lince: false, spawnRate: 0 }, [], [0, 0], "024116")
  f.frame(0, 0, contesto)
  expect(f.gruppo.children.filter((s) => s.visible)).toHaveLength(0)
})

it("non sovrappone più animali sullo stesso punto e nasconde le ancore divenute occupate", async () => {
  const f = await prepara()
  f.configura({ terra: ["capriolo", "volpe", "cervo"], uccelli: 0, aquila: false, lince: false, spawnRate: 0 }, [[100, 200], [300, 400]], [0, 0], "024116")
  f.frame(0, 0, contesto)
  expect(f.gruppo.children.filter((s) => s.visible)).toHaveLength(2)
  f.frame(0, 0, { ...contesto, dentro: () => false })
  expect(f.gruppo.children.filter((s) => s.visible)).toHaveLength(0)
})


it("non attraversa edifici o acqua anche quando la strada prosegue oltre", async () => {
  const f = await prepara()
  f.setPercorsi([[[100, 200], [200, 200]]])
  const c = { ...contesto, dentro: (x: number) => x < 105 || x > 115 }
  for (let i = 0; i < 400; i++) {
    f.frame(.1, i / 10, c)
    const animale = f.gruppo.children.find((s) => s.visible)!
    expect(animale.position.x).toBeLessThan(105)
  }
})

it("esplora il verde senza uscire dai suoi confini", async () => {
  const f = await prepara()
  const casuale = vi.spyOn(Math, "random").mockReturnValue(.5)
  try {
    const verde = (x: number, y: number) => x >= 100 && x <= 200 && y >= 190 && y <= 210
    for (let i = 0; i < 100; i++) f.frame(.1, i / 10, { ...contesto, verde })
    const animale = f.gruppo.children.find((s) => s.visible)!
    expect(animale.position.x).toBeGreaterThan(120)
    expect(verde(animale.position.x, animale.position.y)).toBe(true)
  } finally { casuale.mockRestore() }
})
it("mantiene gli animali per dieci secondi quando le ancore spariscono durante lo zoom", async () => {
  vi.useFakeTimers()
  try {
    const f = await prepara()
    f.frame(0, 0, contesto)
    const animale = f.gruppo.children.find((s) => s.visible)!
    const posizione = animale.position.clone()
    const dati = { terra: ["capriolo" as const], uccelli: 0, aquila: false, lince: false, spawnRate: 1 }
    f.configura(dati, [], [100, 200], "024116")
    vi.advanceTimersByTime(9000)
    f.frame(0, 9, contesto)
    expect(animale.visible).toBe(true)
    f.configura(dati, [[500, 600]], [100, 200], "024116")
    f.frame(0, 9, contesto)
    expect(animale.position).toEqual(posizione)
    f.configura(dati, [], [100, 200], "024116")
    vi.advanceTimersByTime(10001)
    f.frame(0, 20, contesto)
    expect(animale.visible).toBe(false)
    f.configura(dati, [[500, 600]], [100, 200], "024116")
    f.frame(0, 20, contesto)
    expect(animale.visible).toBe(true)
  } finally { vi.useRealTimers() }
})
