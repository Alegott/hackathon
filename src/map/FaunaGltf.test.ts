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

it("animali e uccelli restano statici con il trascorrere del tempo", async () => {
  const f = await prepara()
  f.frame(0, 0, contesto)
  f.gruppo.updateMatrixWorld(true)
  const posizioni = f.gruppo.children.filter((s) => s.visible).map((s) => s.position.clone())
  f.frame(.1, 120, contesto)
  expect(f.gruppo.children.filter((s) => s.visible).map((s) => s.position)).toEqual(posizioni)
})
