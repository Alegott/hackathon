import * as THREE from "three"
import { MercatorCoordinate, type Map, type CustomLayerInterface, type CustomRenderMethodInput } from "maplibre-gl"
import { dentroProvincia, type Habitat } from "./ecosistema"
import { FaunaGltf } from "./FaunaGltf"
import { metriPerPixel } from "./vitaTerritorio"

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
  private habitatOriginale: Habitat[] = []
  // Strade dello scenario (lon/lat e semilarghezza in metri): dove passano gli alberi spariscono.
  private strade: { punti: [number, number][]; semi: number }[] = []
  private krApplicato = 1
  private selezionato = false
  private attivo = true
  private origin = MercatorCoordinate.fromLngLat([11.54, 45.55])
  private unit = this.origin.meterInMercatorCoordinateUnits()
  private matrix = new THREE.Matrix4()
  private dummy = new THREE.Object3D()
  private color = new THREE.Color()
  private riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  private fauna = new FaunaGltf()
  private ultimo = performance.now()

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
    pool("nuvole", new THREE.IcosahedronGeometry(1, 1), "#ffffff", .62)
    // Banchi di nebbia: ellissoidi schiacciati e traslucidi, più fitti dove l'aria è peggiore.
    pool("nebbiaLieve", new THREE.SphereGeometry(1, 18, 8), "#e7ece9", .16)
    pool("nebbiaFitta", new THREE.SphereGeometry(1, 18, 8), "#cfd4d0", .34)
    this.scene.add(this.fauna.gruppo)
  }

  setStrade(strade: { punti: [number, number][]; semi: number }[]) {
    this.strade = strade
    this.applicaStrade()
    this.map?.triggerRepaint()
  }

  // Toglie dagli habitat gli alberi che cadono sotto una strada (larghezza come disegnata a questo zoom).
  private applicaStrade() {
    const kr = this.map ? Math.min(12, Math.max(1, 2 ** (15.5 - this.map.getZoom()))) : 1
    this.krApplicato = kr
    if (!this.strade.length) this.habitat = this.habitatOriginale
    else {
      const locali = this.strade.map((r) => ({ semi: r.semi * kr * 1.18 + 3, p: r.punti.map((q) => this.posizione(...q)) }))
      const sotto = (lon: number, lat: number) => {
        const [x, y] = this.posizione(lon, lat)
        return locali.some(({ semi, p }) => p.some((a, i) => {
          const b = p[i + 1]
          if (!b) return false
          const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy
          const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2))
          return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < semi
        }))
      }
      this.habitat = this.habitatOriginale.map((h) => ({ ...h, alberi: h.alberi.filter(([lon, lat]) => !sotto(lon, lat)) }))
    }
    if (this.selezionato) this.configuraFauna()
  }

  aggiorna(habitat: Habitat[], selezionato: boolean) {
    this.habitatOriginale = habitat
    this.habitat = habitat
    this.selezionato = selezionato
    if (this.strade.length) this.applicaStrade()
    if (selezionato) {
      this.fauna.avvia(() => { this.configuraFauna(); this.map?.triggerRepaint() })
      this.configuraFauna()
    } else this.fauna.configura(null, [], [0, 0], null)
    this.map?.triggerRepaint()
  }

  private configuraFauna() {
    const h = this.habitat[0]
    if (!this.selezionato || !h) return
    this.fauna.configura(h.fauna, h.alberi.map((p) => this.posizione(...p)), this.posizione(...h.centro), h.istat)
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
    const ora = performance.now()
    const dt = this.riduciMovimento ? 0 : Math.min(0.1, (ora - this.ultimo) / 1000)
    this.ultimo = ora
    const mpp = metriPerPixel(zoom, this.map.getCenter().lat)
    const krOra = Math.min(12, Math.max(1, 2 ** (15.5 - zoom)))
    if (this.strade.length && Math.abs(krOra - this.krApplicato) > 0.08 * this.krApplicato) this.applicaStrade()
    const gltf = this.fauna.disponibile
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
      for (let i = 0; i < (this.selezionato ? (gltf ? 0 : p.uccelli) : Math.ceil(p.uccelli / 3)); i++) {
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
      if (this.selezionato && !gltf) h.alberi.slice(0, p.animali).forEach((point, i) => {
        const [x, y] = this.posizione(...point)
        const k = s * .65, offset = Math.sin(t * .7 + i) * 2 * k
        this.inserisci("animali", [x + offset + 7, y, 1.8 * k], [3 * k, 1.7 * k, 1.7 * k], t * .1 + i)
        this.inserisci("orecchie", [x + offset + 9, y, 4 * k], [k, k, k])
      })
      // Nuvole: gruppi di sbuffi, grigi e più numerosi dove l'aria è peggiore. Dimensionate sulla scala
      // della mappa (a zoom provinciale un comune è alto poche decine di pixel).
      // Vista provinciale: dove l'aria è buona le nuvole sono rade (un comune su tre), dove peggiora coprono ogni comune.
      const rada = !this.selezionato && p.nuvole.quantita < .7 && Number(h.istat) % 3 !== 0
      const nuvole = rada ? 0 : Math.round(p.nuvole.quantita * (this.selezionato ? 5 : 1.6))
      const larghezza = this.selezionato ? Math.min(900, Math.max(150, mpp * 110)) : Math.min(h.raggioComune * 1.1, mpp * 30)
      const quota = this.selezionato ? 170 + larghezza * 0.2 : mpp * 14
      const grigio = this.color.set("#ffffff").lerp(new THREE.Color("#7b827e"), p.nuvole.grigio).getStyle()
      for (let i = 0; i < nuvole; i++) {
        const a = i * 2.5 + t * (this.selezionato ? .012 : .004)
        const raggio = (this.selezionato ? h.raggio * 1.2 : h.raggioComune * .55) * (.45 + (i % 3) * .28)
        const x = cx + Math.cos(a) * raggio, y = cy + Math.sin(a) * raggio
        const geo = new MercatorCoordinate(this.origin.x + x * this.unit, this.origin.y - y * this.unit).toLngLat()
        if (!dentroProvincia([geo.lng, geo.lat])) continue
        for (const [dx, dy, dz, k] of [[-.55, 0, 0, .55], [0, .15, .12, .75], [.6, -.1, 0, .6], [.05, -.45, -.05, .45]] as const)
          this.inserisci("nuvole", [x + dx * larghezza, y + dy * larghezza, quota + dz * larghezza],
            [larghezza * k * .5, larghezza * k * .38, larghezza * k * .2], 0, grigio)
      }
      // Banchi di nebbia al suolo: opacità e numero crescono con la foschia della fascia.
      if (p.nebbia >= .15) {
        const fitta = p.nebbia >= .45
        const banchi = this.selezionato ? 3 + Math.round(p.nebbia * 5) : 1 + (p.nebbia >= .6 ? 1 : 0)
        const raggioNebbia = this.selezionato ? h.raggio * 1.4 : h.raggioComune * .8
        for (let i = 0; i < banchi; i++) {
          const a = i * 2.1 + 1, r = raggioNebbia * (i === 0 ? 0 : .55)
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
          const geo = new MercatorCoordinate(this.origin.x + x * this.unit, this.origin.y - y * this.unit).toLngLat()
          if (!dentroProvincia([geo.lng, geo.lat])) continue
          const alto = this.selezionato ? 70 + p.nebbia * 60 : Math.max(60, mpp * 6)
          this.inserisci(fitta ? "nebbiaFitta" : "nebbiaLieve", [x, y, alto * .35],
            [raggioNebbia * (i === 0 ? 1 : .7), raggioNebbia * (i === 0 ? .9 : .6), alto])
        }
      }
      if (this.selezionato) {
        const vista = this.map.getCenter()
        const { clientWidth: w, clientHeight: hh } = this.map.getContainer()
        this.fauna.frame(dt, t, {
          mpp, centro: [cx, cy], raggio: h.raggio,
          vistaCentro: this.posizione(vista.lng, vista.lat), vistaRaggio: 0.5 * Math.hypot(w, hh) * mpp * 0.55,
          dentro: (px, py) => {
            const g = new MercatorCoordinate(this.origin.x + px * this.unit, this.origin.y - py * this.unit).toLngLat()
            return dentroProvincia([g.lng, g.lat])
          },
        })
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
    this.fauna.libera()
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
