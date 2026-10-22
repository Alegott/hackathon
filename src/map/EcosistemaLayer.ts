import * as THREE from "three"
import { MercatorCoordinate, type Map, type CustomLayerInterface, type CustomRenderMethodInput } from "maplibre-gl"
import { dentroProvincia, type Habitat } from "./ecosistema"

type Pool = { mesh: THREE.InstancedMesh; count: number }
const CAPACITA = 1800

// Un solo contesto WebGL con la mappa: alberi, fauna e nuvole condividono prospettiva e profondità.
export class EcosistemaLayer implements CustomLayerInterface {
  id = "ecosistema-vicenza"
  type = "custom" as const
  renderingMode = "3d" as const
  private map?: Map
  private renderer?: THREE.WebGLRenderer
  private camera = new THREE.Camera()
  private scene = new THREE.Scene()
  private pools: Record<string, Pool> = {}
  private habitat: Habitat[] = []
  private selezionato = false
  private attivo = true
  private origin = MercatorCoordinate.fromLngLat([11.54, 45.55])
  private unit = this.origin.meterInMercatorCoordinateUnits()
  private matrix = new THREE.Matrix4()
  private dummy = new THREE.Object3D()
  private color = new THREE.Color()
  private riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
    this.renderer.autoClear = false
    this.scene.add(new THREE.AmbientLight(0xffffff, 2))
    const luce = new THREE.DirectionalLight(0xfff4dd, 2)
    luce.position.set(500, -600, 1500)
    this.scene.add(luce)
    const pool = (name: string, geometry: THREE.BufferGeometry, colore: string, opacity = 1) => {
      const material = new THREE.MeshLambertMaterial({ color: colore, flatShading: true,
        transparent: opacity < 1, opacity, depthWrite: opacity === 1 })
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITA)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.count = 0
      this.scene.add(mesh)
      this.pools[name] = { mesh, count: 0 }
    }
    // Le geometrie hanno z verticale per coincidere con la quota in metri di MapLibre.
    pool("tronchi", new THREE.CylinderGeometry(.6, .85, 5, 5).rotateX(Math.PI / 2), "#956b4b")
    pool("chiome", new THREE.IcosahedronGeometry(3.8, 0), "#ffffff")
    pool("uccelli", new THREE.SphereGeometry(1, 5, 3), "#ffffff")
    pool("alaSx", new THREE.BoxGeometry(1, 1, .15), "#66766e")
    pool("alaDx", new THREE.BoxGeometry(1, 1, .15), "#66766e")
    pool("animali", new THREE.SphereGeometry(1, 6, 4), "#b68f67")
    pool("orecchie", new THREE.ConeGeometry(.45, 2.5, 4).rotateX(Math.PI / 2), "#b68f67")
    pool("nuvole", new THREE.IcosahedronGeometry(1, 1), "#ffffff", .28)
  }

  aggiorna(habitat: Habitat[], selezionato: boolean) {
    this.habitat = habitat
    this.selezionato = selezionato
    this.map?.triggerRepaint()
  }

  setAttivo(attivo: boolean) {
    this.attivo = attivo
    this.map?.triggerRepaint()
  }

  private posizione(lon: number, lat: number): [number, number] {
    const m = MercatorCoordinate.fromLngLat([lon, lat])
    return [(m.x - this.origin.x) / this.unit, -(m.y - this.origin.y) / this.unit]
  }

  private inserisci(name: string, p: [number, number, number], scala: [number, number, number],
    rotazione = 0, colore?: string, battito = 0) {
    const pool = this.pools[name]
    if (!pool || pool.count >= CAPACITA) return
    this.dummy.position.set(...p)
    this.dummy.scale.set(...scala)
    this.dummy.rotation.set(battito, 0, rotazione)
    this.dummy.updateMatrix()
    pool.mesh.setMatrixAt(pool.count, this.dummy.matrix)
    if (colore) pool.mesh.setColorAt(pool.count, this.color.set(colore))
    pool.count++
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.map || !this.renderer || !this.attivo) return
    const t = this.riduciMovimento ? 0 : performance.now() / 1000
    const zoom = this.map.getZoom()
    const s = this.selezionato ? Math.max(2, 20 - zoom) : Math.min(28, Math.max(1.5, 3 * 2 ** (12 - zoom)))
    Object.values(this.pools).forEach((p) => { p.count = 0 })
    for (const h of this.habitat) {
      const [cx, cy] = this.posizione(...h.centro)
      const p = h.preset
      h.alberi.forEach((point, i) => {
        if (i >= Math.ceil(h.alberi.length * p.densitaAlberi)) return
        const [x, y] = this.posizione(...point)
        const k = this.selezionato ? 2 : Math.max(1.5, s * .8)
        this.inserisci("tronchi", [x, y, 2.5 * k], [k, k, k])
        this.inserisci("chiome", [x, y, 6 * k], [k, k, k * Math.max(p.fogliame, .12)],
          i, p.fogliame ? "#5b9d59" : "#967c5c")
      })
      for (let i = 0; i < (this.selezionato ? p.uccelli : Math.ceil(p.uccelli / 3)); i++) {
        const a = t * (.17 + (i % 3) * .03) + i * 2.4
        const r = h.raggio * (.25 + (i % 4) * .13)
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
        const geo = new MercatorCoordinate(this.origin.x + x * this.unit, this.origin.y - y * this.unit).toLngLat()
        if (!dentroProvincia([geo.lng, geo.lat])) continue
        const z = (this.selezionato ? 55 : 600) + (i % 3) * s * 3
        const size = s * 1.5
        const flap = Math.sin(t * 8 + i) * .65
        this.inserisci("uccelli", [x, y, z], [size * .45, size * 1.2, size * .4], -a, "#4e6263")
        this.inserisci("alaSx", [x - Math.cos(a) * size, y + Math.sin(a) * size, z], [size * 2, size * .65, size], -a, undefined, flap)
        this.inserisci("alaDx", [x + Math.cos(a) * size, y - Math.sin(a) * size, z], [size * 2, size * .65, size], -a, undefined, -flap)
      }
      if (this.selezionato) h.alberi.slice(0, p.animali).forEach((point, i) => {
        const [x, y] = this.posizione(...point)
        const k = s * .65, offset = Math.sin(t * .7 + i) * 2 * k
        this.inserisci("animali", [x + offset + 7, y, 1.8 * k], [3 * k, 1.7 * k, 1.7 * k], t * .1 + i)
        this.inserisci("orecchie", [x + offset + 9, y, 4 * k], [k, k, k])
      })
      // Foschia e nuvole restano nella provincia; i cieli peggiori sono più grigi.
      const clouds = Math.round(p.nuvole.quantita * (this.selezionato ? 4 : 2))
      for (let i = 0; i < clouds; i++) {
        const a = i * 2.5 + t * .015
        const x = cx + Math.cos(a) * h.raggio * .5, y = cy + Math.sin(a) * h.raggio * .5
        const geo = new MercatorCoordinate(this.origin.x + x * this.unit, this.origin.y - y * this.unit).toLngLat()
        if (!dentroProvincia([geo.lng, geo.lat])) continue
        const k = this.selezionato ? 20 : 8 * s
        this.inserisci("nuvole", [x, y, this.selezionato ? 160 : 1100], [k * 2.2, k, k * .45], 0,
          p.nuvole.grigio > .5 ? "#768078" : "#ffffff")
      }
    }
    Object.values(this.pools).forEach(({ mesh, count }) => {
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    const locale = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, 0)
      .scale(new THREE.Vector3(this.unit, -this.unit, this.unit))
    this.camera.projectionMatrix = this.matrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(locale)
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.renderer.resetState()
    if (!this.riduciMovimento && !document.hidden) this.map.triggerRepaint()
  }

  onRemove() {
    for (const { mesh } of Object.values(this.pools)) {
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((m) => m.dispose())
    }
    this.renderer?.dispose()
    this.scene.clear()
    this.map = undefined
  }
}
