import * as THREE from "three"
import { caricaGLTF } from "../diorama/modelli3d"

type Variante = "CommonTree_1" | "Pine_1" | "DeadTree_1"
type Pool = { mesh: THREE.InstancedMesh; count: number }
const VARIANTI: Variante[] = ["CommonTree_1", "Pine_1", "DeadTree_1"]

// Modelli statici Quaternius CC0: tronco, rami e foglie testurizzate, istanziati sulla mappa.
export class AlberiGltf {
  readonly gruppo = new THREE.Group()
  private pools = new Map<Variante, Pool[]>()
  private dummy = new THREE.Object3D()
  private avviato = false
  private rimosso = false

  avvia(aggiorna: () => void) {
    if (this.avviato) return
    this.avviato = true
    Promise.all(VARIANTI.map(async (nome) => {
      const gltf = await caricaGLTF(`/models/nature/${nome}.glb`)
      if (!gltf || this.rimosso) return
      gltf.scene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(gltf.scene)
      const centro = box.getCenter(new THREE.Vector3())
      const altezza = Math.max(.001, box.max.y - box.min.y)
      const normalizza = new THREE.Matrix4().makeRotationX(Math.PI / 2)
        .multiply(new THREE.Matrix4().makeScale(1 / altezza, 1 / altezza, 1 / altezza))
        .multiply(new THREE.Matrix4().makeTranslation(-centro.x, -box.min.y, -centro.z))
      const pools: Pool[] = []
      gltf.scene.traverse((nodo) => {
        if (!(nodo instanceof THREE.Mesh)) return
        const geometria = nodo.geometry.clone().applyMatrix4(new THREE.Matrix4().copy(normalizza).multiply(nodo.matrixWorld))
        const copia = (m: THREE.Material) => {
          const materiale = m.clone()
          // Foglie ritagliate nella texture, senza ordinamento trasparente instabile.
          if (materiale.transparent) { materiale.transparent = false; materiale.alphaTest = .45 }
          return materiale
        }
        const materiale = Array.isArray(nodo.material) ? nodo.material.map(copia) : copia(nodo.material)
        const mesh = new THREE.InstancedMesh(geometria, materiale, 1000)
        mesh.frustumCulled = false
        mesh.count = 0
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        this.gruppo.add(mesh)
        pools.push({ mesh, count: 0 })
      })
      this.pools.set(nome, pools)
    })).then(() => { if (!this.rimosso) aggiorna() })
  }

  iniziaFrame() { this.pools.forEach((pools) => pools.forEach((p) => { p.count = 0 })) }
  inserisci(punto: [number, number], altezza: number, i: number, fogliame: number) {
    const variante: Variante = fogliame < .4 ? "DeadTree_1" : i % 3 === 0 ? "Pine_1" : "CommonTree_1"
    this.dummy.position.set(...punto, 0)
    this.dummy.rotation.set(0, 0, i * 2.39996)
    this.dummy.scale.setScalar(altezza * (.85 + (i % 7) * .05))
    this.dummy.updateMatrix()
    for (const p of this.pools.get(variante) ?? []) {
      if (p.count < 1000) p.mesh.setMatrixAt(p.count++, this.dummy.matrix)
    }
  }
  fineFrame() {
    this.pools.forEach((pools) => pools.forEach((p) => {
      p.mesh.count = p.count
      p.mesh.instanceMatrix.needsUpdate = true
    }))
  }
  libera() {
    this.rimosso = true
    this.pools.forEach((pools) => pools.forEach(({ mesh }) => {
      mesh.geometry.dispose()
      const materiali = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materiali.forEach((m) => m.dispose())
    }))
    this.gruppo.clear()
    this.pools.clear()
  }
}
