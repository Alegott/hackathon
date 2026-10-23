import * as THREE from "three"
import { expect, it, vi } from "vitest"
import { AlberiGltf } from "./AlberiGltf"

vi.mock("../diorama/modelli3d", () => ({
  caricaGLTF: async (url: string) => {
    const materiale = new THREE.MeshBasicMaterial()
    materiale.name = url
    return { scene: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), materiale) }
  },
}))

it("lo stesso albero conserva modello, rotazione e scala quando cambia l'ordine dopo lo zoom", async () => {
  const alberi = new AlberiGltf()
  await new Promise<void>((resolve) => alberi.avvia(resolve))
  const snapshot = (punti: [number, number][]) => {
    alberi.iniziaFrame()
    punti.forEach((p, i) => alberi.inserisci(p, 14, i, 1))
    alberi.fineFrame()
    const risultato: Record<string, unknown> = {}
    for (const obj of alberi.gruppo.children) {
      if (!(obj instanceof THREE.InstancedMesh)) continue
      for (let i = 0; i < obj.count; i++) {
        const m = new THREE.Matrix4()
        obj.getMatrixAt(i, m)
        risultato[`${m.elements[12]},${m.elements[13]}`] = { modello: (obj.material as THREE.Material).name, matrice: m.elements }
      }
    }
    return risultato
  }
  const prima = snapshot([[100, 200], [300, 400]])
  expect(snapshot([[300, 400], [100, 200]])).toEqual(prima)
  alberi.libera()
})
