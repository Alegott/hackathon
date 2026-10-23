import * as THREE from "three"
import { MercatorCoordinate, type Map, type CustomLayerInterface, type CustomRenderMethodInput } from "maplibre-gl"
import { STRADE } from "../engine/costanti"
import type { TipoInfra, TipoStrada } from "../types"
import { costruisciNastro } from "./nastro"

export type OggettoScenario = {
  id: string
  tipo: TipoInfra
  lonlat: [number, number]
  // Percorso in lon/lat per le strade tracciate.
  strada?: { tipo: TipoStrada; punti: [number, number][] }
}
export type BozzaStrada = { tipo: TipoStrada; punti: [number, number][] }

type Fumo = { mesh: THREE.Mesh; base: [number, number, number]; fase: number; quota: number; colore: string }

const materiale = (colore: string, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color: colore, flatShading: true, ...extra })

// Hash deterministico: gli alberi di un parco restano nello stesso posto a ogni ridisegno.
function casuale(seme: string) {
  let h = 2166136261
  for (const c of seme) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

function scatola(w: number, h: number, d: number, colore: string, x: number, y: number, z: number, extra = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materiale(colore, extra))
  m.position.set(x, y + h / 2, z)
  return m
}

function cilindro(r: number, h: number, colore: string, x: number, y: number, z: number, rTop = r, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), materiale(colore))
  m.position.set(x, y + h / 2, z)
  return m
}

function nastroMesh(punti: [number, number][], larghezza: number, quota: number, colore: string, extra = {}) {
  const { posizioni, indici } = costruisciNastro(punti, larghezza, quota)
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(posizioni, 3))
  g.setIndex(indici)
  g.computeVertexNormals()
  const m = new THREE.Mesh(g, materiale(colore, { side: THREE.DoubleSide, ...extra }))
  m.frustumCulled = false
  return m
}

function alberoParco(rand: () => number, x: number, z: number) {
  const g = new THREE.Group()
  const k = 0.8 + rand() * 0.6
  g.add(cilindro(0.9 * k, 5 * k, "#8a5f3f", 0, 0, 0))
  if (rand() > 0.4) {
    const chioma = new THREE.Mesh(new THREE.IcosahedronGeometry(5.5 * k, 0), materiale(rand() > 0.5 ? "#3f9a4a" : "#56ad55"))
    chioma.position.y = 9 * k
    g.add(chioma)
  } else {
    const cono = new THREE.Mesh(new THREE.ConeGeometry(4.6 * k, 12 * k, 6), materiale("#2e7d3a"))
    cono.position.y = 11 * k
    g.add(cono)
  }
  g.position.set(x, 0, z)
  return g
}

function modello(tipo: TipoInfra, id: string, fumi: Fumo[]): { y: THREE.Group; piano: THREE.Object3D[] } {
  const y = new THREE.Group()
  const piano: THREE.Object3D[] = []
  const rand = casuale(id)
  if (tipo === "parco") {
    const prato = new THREE.Mesh(new THREE.CircleGeometry(40, 20).rotateX(-Math.PI / 2), materiale("#86c971"))
    prato.position.y = 0.3
    y.add(prato)
    const laghetto = new THREE.Mesh(new THREE.CircleGeometry(9, 14).rotateX(-Math.PI / 2), materiale("#7cc6e0"))
    laghetto.position.set(10, 0.5, 8)
    y.add(laghetto)
    for (let i = 0; i < 11; i++) {
      const a = rand() * Math.PI * 2, r = 8 + rand() * 28
      y.add(alberoParco(rand, Math.cos(a) * r - 6, Math.sin(a) * r - 4))
    }
  } else if (tipo === "ciclabile") {
    const anello: [number, number][] = []
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2
      anello.push([Math.cos(a) * 48, Math.sin(a) * 26])
    }
    piano.push(nastroMesh(anello, 7.5, 0.5, "#f4f0e4"), nastroMesh(anello, 5.5, 1, "#2f9d8c"),
      nastroMesh(anello, 0.5, 1.5, "#ffffff"))
    y.add(scatola(2, 7, 2, "#2b6f66", -26, 0, 30), scatola(7, 0.8, 1.2, "#e9e4d3", -26, 7, 30))
  } else if (tipo === "colonnine") {
    y.add(scatola(46, 0.6, 22, "#7c858b", 0, 0, 0))
    for (let i = 0; i < 4; i++) {
      const x = -15 + i * 10
      y.add(scatola(2.6, 8, 2.2, "#f2f5f4", x, 0.6, -5), scatola(2.6, 1.8, 2.3, "#27c28a", x, 6.8, -5,
        { emissive: new THREE.Color("#27c28a"), emissiveIntensity: 0.8 }))
      y.add(scatola(7, 2.4, 3.6, i % 2 ? "#3b6ea8" : "#d6d9dc", x, 0.8, 5))
      y.add(scatola(4, 1.6, 3.2, i % 2 ? "#3b6ea8" : "#d6d9dc", x, 3.2, 5))
    }
  } else if (tipo === "industria") {
    y.add(scatola(50, 14, 30, "#9aa1a6", 0, 0, 0))
    for (let i = 0; i < 3; i++) y.add(scatola(16, 5, 30, "#7e868b", -16 + i * 16, 14, 0))
    y.add(scatola(18, 9, 14, "#b7bcc0", 14, 0, 24))
    for (const x of [-18, -8]) {
      y.add(cilindro(3.4, 34, "#b86b4f", x, 14, -22, 2.6))
      fumi.push({ mesh: new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), materiale("#5d6064", { transparent: true })),
        base: [x, 48, -22], fase: rand(), quota: 34, colore: "#5d6064" })
    }
  } else if (tipo === "nucleare") {
    y.add(scatola(60, 0.8, 70, "#8d979c", 0, 0, 4))
    const profilo = [[15, 0], [12.5, 10], [10, 24], [10.8, 34], [12, 42]].map(([r, h]) => new THREE.Vector2(r, h))
    for (const x of [-22, 22]) {
      const torre = new THREE.Mesh(new THREE.LatheGeometry(profilo, 18), materiale("#eef1f0", { side: THREE.DoubleSide }))
      torre.position.set(x, 0.8, -20)
      y.add(torre)
      for (let i = 0; i < 3; i++)
        fumi.push({ mesh: new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), materiale("#ffffff", { transparent: true })),
          base: [x, 42, -20], fase: (i / 3 + (x > 0 ? 0.17 : 0)) % 1, quota: 40, colore: "#ffffff" })
    }
    y.add(cilindro(10, 24, "#dfe5e8", 0, 0.8, 18))
    const cupola = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), materiale("#c9d2d6"))
    cupola.position.set(0, 24.8, 18)
    y.add(cupola)
    y.add(scatola(26, 13, 16, "#aab3b8", -26, 0.8, 22), scatola(26, 1.6, 16.4, "#3fbf7f", -26, 11, 22,
      { emissive: new THREE.Color("#3fbf7f"), emissiveIntensity: 0.7 }))
    y.add(scatola(2, 14, 2, "#8d979c", 30, 0.8, 30), scatola(14, 1, 1, "#8d979c", 30, 14, 30))
  } else {
    y.add(cilindro(0.7, 14, "#8a8f93", 0, 0, 0), scatola(10, 6, 0.8, "#2f7fb5", 0, 11, 0))
  }
  return { y, piano }
}

// Un solo contesto WebGL con la mappa: gli oggetti dello scenario condividono prospettiva e profondità.
export class ScenarioLayer implements CustomLayerInterface {
  id = "scenario-vicenza"
  type = "custom" as const
  renderingMode = "3d" as const
  private map?: Map
  private renderer?: THREE.WebGLRenderer
  private camera = new THREE.Camera()
  private scene = new THREE.Scene()
  private oggetti = new THREE.Group()
  private strade = new THREE.Group()
  private bozzaGruppo = new THREE.Group()
  private origin = MercatorCoordinate.fromLngLat([11.54, 45.55])
  private unit = this.origin.meterInMercatorCoordinateUnits()
  private matrix = new THREE.Matrix4()
  private riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  private elenco: OggettoScenario[] = []
  private bozza: BozzaStrada | null = null
  private radici: THREE.Group[] = []
  private fumi: Fumo[] = []
  private kStrade = 0

  onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
    this.renderer.autoClear = false
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.2))
    const luce = new THREE.DirectionalLight(0xfff4dd, 2)
    luce.position.set(500, -600, 1500)
    this.scene.add(luce, this.oggetti, this.strade, this.bozzaGruppo)
    this.ricostruisci()
  }

  imposta(oggetti: OggettoScenario[], bozza: BozzaStrada | null) {
    this.elenco = oggetti
    this.bozza = bozza
    this.ricostruisci()
    this.kStrade = 0
    this.map?.triggerRepaint()
  }

  private locale(lon: number, lat: number): [number, number] {
    const m = MercatorCoordinate.fromLngLat([lon, lat])
    return [(m.x - this.origin.x) / this.unit, -(m.y - this.origin.y) / this.unit]
  }

  private svuota(gruppo: THREE.Group) {
    for (const figlio of [...gruppo.children]) {
      gruppo.remove(figlio)
      figlio.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return
        o.geometry.dispose()
        ;(Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose())
      })
    }
  }

  private ricostruisci() {
    this.svuota(this.oggetti)
    this.radici = []
    this.fumi = []
    for (const o of this.elenco) {
      if (o.strada) continue
      const radice = new THREE.Group()
      const [x, y] = this.locale(...o.lonlat)
      radice.position.set(x, y, 0)
      const { y: modelloY, piano } = modello(o.tipo, o.id, this.fumi)
      modelloY.rotation.x = Math.PI / 2
      radice.add(modelloY, ...piano)
      for (const f of this.fumi.filter((f) => !f.mesh.parent)) modelloY.add(f.mesh)
      this.oggetti.add(radice)
      this.radici.push(radice)
    }
  }

  private ricostruisciStrade(kr: number) {
    this.svuota(this.strade)
    this.svuota(this.bozzaGruppo)
    const disegna = (gruppo: THREE.Group, tipo: TipoStrada, punti: [number, number][], opaca: boolean) => {
      if (punti.length < 2) return
      const locali = punti.map((p) => this.locale(...p))
      const { larghezza, colore } = STRADE[tipo]
      const w = larghezza * kr
      const extra = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        transparent: !opaca, opacity: opaca ? 1 : 0.8 }
      gruppo.add(nastroMesh(locali, w * 1.18, 0.5 * kr, "#eceae0", extra),
        nastroMesh(locali, w, 1 * kr, colore, extra),
        nastroMesh(locali, Math.max(0.5, w * 0.05), 1.5 * kr, tipo === "urbana" ? "#d8d8d0" : "#f4d35e", extra))
    }
    for (const o of this.elenco) if (o.strada) disegna(this.strade, o.strada.tipo, o.strada.punti, true)
    if (this.bozza) {
      disegna(this.bozzaGruppo, this.bozza.tipo, this.bozza.punti, false)
      for (const p of this.bozza.punti) {
        const [x, y] = this.locale(...p)
        const punto = new THREE.Mesh(new THREE.SphereGeometry(5 * kr, 10, 8), materiale("#e7b64d"))
        punto.position.set(x, y, 5 * kr)
        this.bozzaGruppo.add(punto)
      }
    }
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.map || !this.renderer) return
    const zoom = this.map.getZoom()
    const t = this.riduciMovimento ? 0 : performance.now() / 1000
    // Gli oggetti restano leggibili anche allontanandosi: la scala cresce al calare dello zoom.
    const kr = Math.min(12, Math.max(1, 2 ** (15.5 - zoom)))
    const kOggetti = kr * 1.3
    for (const r of this.radici) r.scale.setScalar(kOggetti)
    if (Math.abs(kr - this.kStrade) > 0.05 * this.kStrade || !this.kStrade) {
      this.kStrade = kr
      this.ricostruisciStrade(kr)
    }
    for (const f of this.fumi) {
      const p = (t * 0.12 + f.fase) % 1
      f.mesh.position.set(f.base[0] + p * 6, f.base[1] + p * f.quota, f.base[2])
      f.mesh.scale.setScalar(4 + p * 9)
      ;(f.mesh.material as THREE.MeshLambertMaterial).opacity = 0.75 * (1 - p)
    }
    const locale = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, 0)
      .scale(new THREE.Vector3(this.unit, -this.unit, this.unit))
    this.camera.projectionMatrix = this.matrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(locale)
    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
    this.renderer.resetState()
    if (this.fumi.length && !this.riduciMovimento && !document.hidden) this.map.triggerRepaint()
  }

  onRemove() {
    this.svuota(this.oggetti)
    this.svuota(this.strade)
    this.svuota(this.bozzaGruppo)
    this.renderer?.dispose()
    this.scene.clear()
    this.map = undefined
  }
}
