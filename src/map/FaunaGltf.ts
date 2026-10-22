import * as THREE from "three"
import type { GLTF } from "three-stdlib"
import { CATALOGO_MODELLI_3D, caricaGLTF, creaIstanzaAnimata, type IstanzaAnimata } from "../diorama/modelli3d"
import type { Fauna, SpecieTerra } from "./vitaTerritorio"

// Animali glTF animati dentro la scena Three.js della mappa reale. Le coordinate sono quelle del
// livello: metri locali, x est, y nord, z verso l'alto.

const ORDINE: SpecieTerra[] = ["capriolo", "volpe", "cervo", "lupo"]
const FILE: Record<SpecieTerra, keyof typeof CATALOGO_MODELLI_3D> = { capriolo: "deer", volpe: "fox", cervo: "stag", lupo: "wolf" }
const LUNGHEZZA: Record<SpecieTerra, number> = { capriolo: 1.3, volpe: 0.75, cervo: 2.0, lupo: 1.2 }
const A_TERRA = 8
const IN_VOLO = 12
const PX_TERRA = 64 // lunghezza di un animale sullo schermo, in pixel
const PX_VOLO = 48

type Slot = {
  istanza: IstanzaAnimata
  pivot: THREE.Group
  lunghezza: number
  dim: [number, number, number] // ingombro del modello nel suo sistema di riferimento (debug)
  attivo: boolean
  x: number; y: number; tx: number; ty: number; angolo: number; pausa: number
  ancora: [number, number]
  seme: number
}

export type ContestoFrame = {
  mpp: number // metri per pixel alla scala corrente
  dentro: (x: number, y: number) => boolean
  centro: [number, number]
  raggio: number
  vistaCentro: [number, number] // centro della parte di mappa visibile
  vistaRaggio: number // metri
}

function rnd(s: Slot) {
  s.seme = (s.seme * 1664525 + 1013904223) >>> 0
  return s.seme / 4294967296
}

export class FaunaGltf {
  readonly gruppo = new THREE.Group()
  private modelli = new Map<string, GLTF>()
  private terra: Slot[] = []
  private voli: Slot[] = []
  private aquila: Slot | null = null
  private lince: Slot | null = null
  private avviato = false
  private pronto = false
  private chiave: string | null = null
  private punti: [number, number][] = []

  get disponibile() { return this.pronto }

  // Carica i modelli una sola volta, alla prima volta che serve la fauna.
  avvia(aCaricamento: () => void) {
    if (this.avviato) return
    this.avviato = true
    const chiavi = new Set<keyof typeof CATALOGO_MODELLI_3D>([...Object.values(FILE), "stork"])
    Promise.all([...chiavi].map(async (k) => [k, await caricaGLTF(CATALOGO_MODELLI_3D[k])] as const)).then((r) => {
      for (const [k, g] of r) if (g) this.modelli.set(k, g)
      if (!this.modelli.has("stork") || ![...Object.values(FILE)].every((k) => this.modelli.has(k))) return
      this.costruisci()
      this.pronto = true
      aCaricamento()
    })
  }

  private slot(gltf: GLTF, lunghezza: number, opz: Parameters<typeof creaIstanzaAnimata>[1], seme: number): Slot {
    const istanza = creaIstanzaAnimata(gltf, opz)
    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = box.getSize(new THREE.Vector3())
    // Il modello ha y verso l'alto e guarda +z: lo riporto a z verso l'alto, alla lunghezza reale, con i piedi a terra.
    istanza.oggetto.position.y = -box.min.y
    const dentro = new THREE.Group()
    dentro.rotation.x = Math.PI / 2
    dentro.scale.setScalar(lunghezza / Math.max(size.x, size.z, 0.0001))
    dentro.add(istanza.oggetto)
    const pivot = new THREE.Group()
    pivot.add(dentro)
    pivot.visible = false
    this.gruppo.add(pivot)
    return { istanza, pivot, lunghezza, dim: [size.x, size.y, size.z], attivo: false, x: 0, y: 0, tx: 0, ty: 0, angolo: 0, pausa: 0, ancora: [0, 0], seme: seme * 9973 + 17 }
  }

  private costruisci() {
    const m = (k: keyof typeof CATALOGO_MODELLI_3D) => this.modelli.get(k)!
    for (let i = 0; i < A_TERRA; i++) {
      const specie = ORDINE[i % ORDINE.length]!
      this.terra.push(this.slot(m(FILE[specie]), LUNGHEZZA[specie], {
        clipMovimento: ["Walk", "Gallop"],
        clipSosta: ["Eating", "Idle_Headlow", "Idle_2_HeadLow", "Idle"],
        velocitaAnim: 1.25 + (i % 3) * 0.15, sfasamento: (i * 0.43) % 1.2,
      }, i + 1))
    }
    const tinte = ["#eceff1", "#5d4037", "#37474f", "#455a64"]
    for (let i = 0; i < IN_VOLO; i++) {
      this.voli.push(this.slot(m("stork"), 2.0, {
        clipMovimento: ["storkFly_B_"], velocitaAnim: 0.9 + (i % 4) * 0.14, sfasamento: (i * 0.37) % 1.4,
        tinta: tinte[i % tinte.length], intensitaTinta: i % 4 === 0 ? 0.1 : 0.55,
      }, 100 + i))
    }
    this.aquila = this.slot(m("stork"), 3.2, {
      clipMovimento: ["storkFly_B_"], velocitaAnim: 0.58, tinta: "#4e342e", intensitaTinta: 0.78, roughness: 0.65,
    }, 200)
    this.lince = this.slot(m("fox"), 1.0, {
      clipMovimento: ["Walk"], clipSosta: ["Idle", "Eating"], velocitaAnim: 1.2,
      tinta: "#d4a373", intensitaTinta: 0.65, soloMain: true,
    }, 300)
  }

  // Quanti animali mostrare e dove farli stare. `ancore` sono punti verdi (parchi, boschi) in coordinate locali.
  // `chiave` identifica il comune: cambiando comune gli animali ripartono dalle nuove ancore; muovendo
  // solo la vista restano dove sono, senza saltare.
  configura(fauna: Fauna | null, ancore: [number, number][], centro: [number, number], chiave: string | null = null) {
    if (!this.pronto) return
    const punti = ancore.length ? ancore : [centro]
    this.punti = punti
    if (chiave !== this.chiave) {
      this.chiave = chiave
      for (const s of [...this.terra, ...(this.lince ? [this.lince] : [])]) s.attivo = false
    }
    const attiva = (s: Slot, ancora: [number, number]) => {
      if (!s.attivo) {
        s.x = s.tx = ancora[0]; s.y = s.ty = ancora[1]
        s.ancora = ancora
        s.attivo = true
      }
    }
    this.terra.forEach((s, i) => {
      if (fauna && i < fauna.terra.length) attiva(s, punti[Math.floor(rnd(s) * punti.length)]!)
      else s.attivo = false
    })
    this.voli.forEach((s, i) => { s.attivo = !!fauna && i < fauna.uccelli })
    if (this.aquila) this.aquila.attivo = !!fauna?.aquila
    if (this.lince) {
      if (fauna?.lince) attiva(this.lince, punti[Math.floor(rnd(this.lince) * punti.length)]!)
      else this.lince.attivo = false
    }
  }

  // Se un animale è uscito dalla parte visibile della mappa lo riporto nella vista, su un'area verde se c'è.
  private riportaInVista(s: Slot, c: ContestoFrame) {
    const lontano = Math.hypot(s.x - c.vistaCentro[0], s.y - c.vistaCentro[1]) > c.vistaRaggio * 1.1
    if (!lontano) return
    const vicini = this.punti.filter((p) => Math.hypot(p[0] - c.vistaCentro[0], p[1] - c.vistaCentro[1]) < c.vistaRaggio * 0.8)
    let ancora: [number, number] | null = vicini.length ? vicini[Math.floor(rnd(s) * vicini.length)]! : null
    for (let k = 0; !ancora && k < 12; k++) {
      const a = rnd(s) * Math.PI * 2, r = c.vistaRaggio * (0.15 + 0.5 * rnd(s))
      const p: [number, number] = [c.vistaCentro[0] + Math.cos(a) * r, c.vistaCentro[1] + Math.sin(a) * r]
      if (c.dentro(p[0], p[1])) ancora = p
    }
    if (!ancora) return
    s.ancora = ancora; s.x = s.tx = ancora[0]; s.y = s.ty = ancora[1]; s.pausa = 0
  }

  private nuovaMeta(s: Slot, corpo: number) {
    const a = rnd(s) * Math.PI * 2, r = corpo * (2 + rnd(s) * 5)
    s.tx = s.ancora[0] + Math.cos(a) * r
    s.ty = s.ancora[1] + Math.sin(a) * r
  }

  private cammina(s: Slot, dt: number, corpo: number, c: ContestoFrame) {
    if (s.pausa > 0) { s.pausa -= dt; s.istanza.impostaMovimento(false); return }
    s.istanza.impostaMovimento(true)
    const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy)
    if (d < corpo * 0.4) { this.nuovaMeta(s, corpo); s.pausa = 1 + rnd(s) * 2.2; return }
    const passo = Math.min(d, corpo * 0.9 * dt)
    const nx = s.x + (dx / d) * passo, ny = s.y + (dy / d) * passo
    if (!c.dentro(nx, ny)) { this.nuovaMeta(s, corpo); return }
    s.angolo = Math.atan2(dy, dx)
    s.x = nx; s.y = ny
  }

  frame(dt: number, t: number, c: ContestoFrame) {
    if (!this.pronto) return
    const pronte = [...this.terra, ...this.voli, ...(this.aquila ? [this.aquila] : []), ...(this.lince ? [this.lince] : [])]
    for (const s of pronte) {
      s.pivot.visible = s.attivo
      if (!s.attivo) continue
      s.istanza.assicuraAttiva()
      s.istanza.mixer.update(dt)
    }
    const corpoTerra = (s: Slot) => Math.max(s.lunghezza, PX_TERRA * c.mpp)
    for (const s of [...this.terra, ...(this.lince ? [this.lince] : [])]) {
      if (!s.attivo) continue
      const corpo = corpoTerra(s)
      this.riportaInVista(s, c)
      this.cammina(s, dt, corpo, c)
      s.pivot.scale.setScalar(corpo / s.lunghezza)
      s.pivot.position.set(s.x, s.y, 0)
      s.pivot.rotation.z = s.angolo + Math.PI / 2
    }
    this.voli.forEach((s, i) => {
      if (!s.attivo) return
      const corpo = Math.max(s.lunghezza, PX_VOLO * c.mpp)
      const a = t * (0.16 + (i % 4) * 0.03) + i * 2.4
      const r = Math.min(c.raggio, c.vistaRaggio) * (0.25 + (i % 5) * 0.12)
      s.pivot.scale.setScalar(corpo / s.lunghezza)
      s.pivot.position.set(c.vistaCentro[0] + Math.cos(a) * r, c.vistaCentro[1] + Math.sin(a) * r * 0.8, corpo * (3 + (i % 3)))
      s.pivot.rotation.z = a + Math.PI
    })
    if (this.aquila?.attivo) {
      const a = this.aquila
      const corpo = Math.max(a.lunghezza, PX_VOLO * 1.5 * c.mpp)
      const ang = -t * 0.09
      a.pivot.scale.setScalar(corpo / a.lunghezza)
      a.pivot.position.set(c.centro[0] + Math.cos(ang) * c.raggio * 0.5, c.centro[1] + Math.sin(ang) * c.raggio * 0.4, corpo * 7)
      a.pivot.rotation.z = ang // orbita in senso orario: la direzione di marcia è ang − π/2
    }
  }

  libera() {
    this.gruppo.clear()
    this.terra = []; this.voli = []; this.aquila = null; this.lince = null
    this.pronto = false
  }
}
