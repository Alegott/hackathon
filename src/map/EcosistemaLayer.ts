import * as THREE from "three"
import { MercatorCoordinate, type Map, type CustomLayerInterface, type CustomRenderMethodInput } from "maplibre-gl"
import { dentroProvincia, type Habitat } from "./ecosistema"
import { FaunaGltf } from "./FaunaGltf"
import { AlberiGltf } from "./AlberiGltf"
import { metriPerPixel } from "./vitaTerritorio"
import { coloreNuvola } from "./sostenibilita"
import { creaGeometriaNuvola, creaMaterialeNuvole } from "./nuvole"
import { renderCondiviso } from "./renderCondiviso"
import type { TerrenoLibero } from "./vincoliHabitat"

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
  private alberi = new AlberiGltf()
  private terrenoLibero: TerrenoLibero = () => true
  private ultimo = performance.now()

  onAdd(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    this.camera.matrixAutoUpdate = false
    this.camera.matrixWorldAutoUpdate = false
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
    this.renderer.autoClear = false
    this.scene.add(new THREE.AmbientLight(0xffffff, 2))
    const luce = new THREE.DirectionalLight(0xfff4dd, 2)
    luce.position.set(500, -600, 1500)
    this.scene.add(luce)
    const pool = (name: string, geometry: THREE.BufferGeometry, colore: string, opacity = 1) => {
      const parametri = { color: colore, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }
      const material = name === "nuvole"
        ? creaMaterialeNuvole()
        : new THREE.MeshLambertMaterial({ ...parametri, flatShading: true })
      const mesh = new THREE.InstancedMesh(geometry, material, CAPACITA)
      // Il primo frame può avere zero nuvole: l'attributo deve esistere già alla compilazione dello shader.
      if (name === "nuvole") mesh.setColorAt(0, new THREE.Color("#ffffff"))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.count = 0
      this.scene.add(mesh)
      this.pools[name] = { mesh, count: 0 }
    }
    // Le geometrie hanno z verticale per coincidere con la quota in metri di MapLibre.
    pool("nuvole", creaGeometriaNuvola(), "#ffffff", .86)
    // Banchi di nebbia: ellissoidi schiacciati e traslucidi, più fitti dove l'aria è peggiore.
    pool("nebbiaLieve", new THREE.SphereGeometry(1, 18, 8), "#e7ece9", .16)
    pool("nebbiaFitta", new THREE.SphereGeometry(1, 18, 8), "#cfd4d0", .34)
    this.scene.add(this.fauna.gruppo)
    this.scene.add(this.alberi.gruppo)
    this.alberi.avvia(() => this.map?.triggerRepaint())
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

  aggiorna(habitat: Habitat[], selezionato: boolean, terrenoLibero: TerrenoLibero = () => true) {
    this.habitatOriginale = habitat
    this.habitat = habitat
    this.terrenoLibero = terrenoLibero
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
    // Le ancore vengono scelte nella vista arrivata a destinazione, non all'inizio del volo sul comune.
    if (!this.map || this.map.isMoving() || this.map.getZoom() < 13) return
    this.fauna.configura(h.fauna, h.ancoreFauna.map((p) => this.posizione(...p)), this.posizione(...h.centro), h.istat)
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
    Object.values(this.pools).forEach((p) => { p.count = 0 })
    this.alberi.iniziaFrame()
    for (const h of this.habitat) {
      const [cx, cy] = this.posizione(...h.centro)
      const p = h.preset
      h.alberi.forEach((point, i) => {
        const altezza = 14
        this.alberi.inserisci(this.posizione(...point), altezza, i, p.fogliame)
      })
      // Nuvole: gruppi di sbuffi, grigi e più numerosi dove l'aria è peggiore. Dimensionate sulla scala
      // della mappa (a zoom provinciale un comune è alto poche decine di pixel).
      // Vista provinciale: dove l'aria è buona le nuvole sono rade (un comune su tre), dove peggiora coprono ogni comune.
      const rada = !this.selezionato && p.nuvole.quantita < .7 && Number(h.istat) % 3 !== 0
      const nuvole = rada ? 0 : Math.round(p.nuvole.quantita * (this.selezionato ? 4 : 1.6))
      const larghezza = this.selezionato ? 145 : Math.min(h.raggioComune * .9, 1100)
      const quota = this.selezionato ? 210 : 480
      for (let i = 0; i < nuvole; i++) {
        const a = i * 2.5 + t * (this.selezionato ? .012 : .004)
        const raggio = (this.selezionato ? h.raggio * 1.2 : h.raggioComune * .55) * (.45 + (i % 3) * .28)
        const x = cx + Math.cos(a) * raggio, y = cy + Math.sin(a) * raggio
        const geo = new MercatorCoordinate(this.origin.x + x * this.unit, this.origin.y - y * this.unit).toLngLat()
        if (!dentroProvincia([geo.lng, geo.lat])) continue
        const variazione = .8 + (i % 3) * .13
        this.inserisci("nuvole", [x, y, quota + (i % 2) * 24],
          [larghezza * variazione, larghezza * .58 * variazione, larghezza * .32 * variazione],
          i * .7, coloreNuvola(p.nuvole.grigio))
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
            return dentroProvincia([g.lng, g.lat]) && this.terrenoLibero([g.lng, g.lat], 12)
          },
        })
      }
    }
    this.alberi.fineFrame()
    Object.values(this.pools).forEach(({ mesh, count }) => {
      mesh.count = count
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
    const locale = new THREE.Matrix4().makeTranslation(this.origin.x, this.origin.y, 0)
      .scale(new THREE.Vector3(this.unit, -this.unit, this.unit))
    // Separiamo vista e proiezione anche per illuminazione e sfumatura dei bordi delle nuvole.
    this.camera.projectionMatrix.fromArray(args.projectionMatrix)
    this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert()
    this.camera.matrixWorldInverse.copy(this.camera.projectionMatrixInverse)
      .multiply(this.matrix.fromArray(args.defaultProjectionData.mainMatrix)).multiply(locale)
    this.camera.matrixWorld.copy(this.camera.matrixWorldInverse).invert()
    const renderer = this.renderer
    renderCondiviso(_gl, renderer, () => renderer.render(this.scene, this.camera))
    if (!this.riduciMovimento && !document.hidden) this.map.triggerRepaint()
  }

  onRemove() {
    this.fauna.libera()
    this.alberi.libera()
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
