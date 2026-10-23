import * as THREE from "three"
import type { GLTF } from "three-stdlib"
import { CATALOGO_MODELLI_3D, caricaGLTF, creaIstanzaAnimata } from "../diorama/modelli3d"
import type { Fauna, SpecieTerra } from "./vitaTerritorio"

const ORDINE: SpecieTerra[] = ["capriolo", "volpe", "cervo", "lupo"]
const FILE = { capriolo: "deer", volpe: "fox", cervo: "stag", lupo: "wolf" } as const
const LUNGHEZZA = { capriolo: 1.3, volpe: .75, cervo: 2, lupo: 1.2 }
const CAPACITA = 24

type Punto = [number, number]
type Slot = { pivot: THREE.Group; lunghezza: number; attivo: boolean; ancora: Punto; meta?: Punto; direzione: number; riprova: number; scadenza?: number; mixer: THREE.AnimationMixer }
export type ContestoFrame = {
  verde?: (x: number, y: number) => boolean
  mpp: number
  dentro: (x: number, y: number) => boolean
  centro: [number, number]
  raggio: number
  vistaCentro: [number, number]
  vistaRaggio: number
}

// Gli stessi modelli glTF seguono strade locali e aree verdi senza cambiare aspetto.
export class FaunaGltf {
  readonly gruppo = new THREE.Group()
  private slots: Slot[] = []
  private avviato = false
  private pronto = false
  private rimosso = false
  private chiave: string | null = null
  private percorsi: [Punto, Punto][] = []

  setPercorsi(linee: Punto[][]) {
    this.percorsi = linee.flatMap((linea) => linea.slice(1).map((b, i): [Punto, Punto] => [linea[i]!, b]))
  }
  get disponibile() { return this.pronto }

  avvia(aCaricamento: () => void) {
    if (this.avviato) return
    this.avviato = true
    Promise.all(ORDINE.map(async (specie) => [specie, await caricaGLTF(CATALOGO_MODELLI_3D[FILE[specie]])] as const)).then((risultati) => {
      if (this.rimosso || risultati.some(([, modello]) => !modello)) return
      const modelli = new Map(risultati)
      for (let i = 0; i < CAPACITA; i++) {
        const specie = ORDINE[i % ORDINE.length]!
        this.slots.push(this.creaSlot(modelli.get(specie)!, LUNGHEZZA[specie], i))
      }
      this.pronto = true
      aCaricamento()
    })
  }

  private creaSlot(gltf: GLTF, lunghezza: number, i: number): Slot {
    const istanza = creaIstanzaAnimata(gltf, { clipMovimento: ["Walk", "Walking"], clipSosta: ["Idle", "Idle_Headlow", "Eating"], sfasamento: i * .37 })
    // Mantiene scala, materiali e geometria originali.
    istanza.mixer.update(.01)
    const box = new THREE.Box3().setFromObject(istanza.oggetto)
    const size = box.getSize(new THREE.Vector3())
    istanza.oggetto.position.y -= box.min.y
    const modello = new THREE.Group()
    modello.rotation.x = Math.PI / 2
    modello.scale.setScalar(lunghezza / Math.max(size.x, size.z, .0001))
    modello.add(istanza.oggetto)
    const pivot = new THREE.Group()
    pivot.rotation.z = i * 2.39996
    pivot.visible = false
    pivot.add(modello)
    this.gruppo.add(pivot)
    return { pivot, lunghezza, attivo: false, ancora: [0, 0], direzione: i * 2.39996, riprova: 0, mixer: istanza.mixer }
  }

  configura(fauna: Fauna | null, ancore: [number, number][], _centro: [number, number], chiave: string | null = null) {
    if (!this.pronto) return
    if (chiave !== this.chiave) {
      this.chiave = chiave
      this.slots.forEach((s) => { s.attivo = false })
    }
    // Nessun ripiego sul centroide: potrebbe trovarsi dentro un edificio o nell'acqua.
    const punti = ancore
    this.slots.forEach((s, i) => {
      if (!fauna || i >= fauna.terra.length) { s.attivo = false; s.pivot.visible = false; return }
      if (i >= punti.length) {
        if (s.attivo) s.scadenza ??= performance.now() + 10_000
        return
      }
      s.scadenza = undefined
      if (!s.attivo) {
        s.ancora = punti[i % punti.length]!
        s.meta = undefined
        s.riprova = 0
        s.attivo = true
      }
    })
  }

  private libero(a: Punto, b: Punto, c: ContestoFrame, verde = false) {
    const passi = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5))
    for (let i = 1; i <= passi; i++) {
      const x = a[0] + (b[0] - a[0]) * i / passi, y = a[1] + (b[1] - a[1]) * i / passi
      if (!c.dentro(x, y) || (verde && !c.verde?.(x, y))) return false
    }
    return true
  }

  private scegliMeta(s: Slot, c: ContestoFrame): Punto | undefined {
    const [x, y] = s.ancora
    const candidati: { p: Punto; peso: number }[] = []
    let distanza = 80
    // Aggancio alla strada piu vicina; poi segue i segmenti e sceglie alle biforcazioni.
    for (const [a, b] of this.percorsi) {
      const dx = b[0] - a[0], dy = b[1] - a[1], lunghezza = Math.hypot(dx, dy)
      if (lunghezza < .1) continue
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (lunghezza * lunghezza)))
      const proiezione: Punto = [a[0] + t * dx, a[1] + t * dy]
      const d = Math.hypot(x - proiezione[0], y - proiezione[1])
      if (d > distanza + .5) continue
      const punti: Punto[] = d > 1 ? [proiezione] : [-1, 1].map((verso) => {
        const u = Math.max(0, Math.min(1, t + verso * 60 / lunghezza))
        return [a[0] + u * dx, a[1] + u * dy]
      })
      for (const p of punti) {
        if (Math.hypot(p[0] - x, p[1] - y) < 1 || !this.libero(s.ancora, p, c)) continue
        if (d < distanza - .5) { candidati.length = 0; distanza = d }
        const angolo = Math.atan2(p[1] - y, p[0] - x)
        candidati.push({ p, peso: .15 + (1 + Math.cos(angolo - s.direzione)) ** 2 })
      }
    }
    // Nei parchi si muove liberamente, mantenendo l'intero tratto nel verde.
    if (c.verde?.(x, y)) {
      for (let i = 0; i < 8; i++) {
        const a = s.direzione + (Math.random() - .5) * Math.PI * 2
        const p: Punto = [x + Math.cos(a) * 45, y + Math.sin(a) * 45]
        if (this.libero(s.ancora, p, c, true)) candidati.push({ p, peso: 2 })
      }
    }
    // Se non ci sono strade raggiungibili, cerca un passaggio sul terreno libero.
    if (!candidati.length) {
      for (const raggio of [40, 20, 6]) {
        for (let i = 0; i < 12; i++) {
          const a = s.direzione + i * Math.PI / 6
          const p: Punto = [x + Math.cos(a) * raggio, y + Math.sin(a) * raggio]
          if (this.libero(s.ancora, p, c)) candidati.push({ p, peso: .2 + (1 + Math.cos(a - s.direzione)) ** 2 })
        }
        if (candidati.length) break
      }
    }
    let estratto = Math.random() * candidati.reduce((tot, v) => tot + v.peso, 0)
    return candidati.find((v) => (estratto -= v.peso) <= 0)?.p
  }

  frame(dt: number, _t: number, c: ContestoFrame) {
    for (const s of this.slots) {
      if (s.scadenza !== undefined && performance.now() >= s.scadenza) s.attivo = false
      s.pivot.visible = s.attivo && c.dentro(...s.ancora)
      if (!s.pivot.visible) continue
      if (dt > 0) {
        s.riprova -= dt
        if (!s.meta && s.riprova <= 0) {
          s.meta = this.scegliMeta(s, c)
          s.riprova = 2 + Math.random() * 2
        }
        if (s.meta) {
          const dx = s.meta[0] - s.ancora[0], dy = s.meta[1] - s.ancora[1]
          const d = Math.hypot(dx, dy), passo = Math.min(d, Math.min(dt, .1) * 4)
          const prossima: Punto = d < .001 ? s.meta : [s.ancora[0] + dx / d * passo, s.ancora[1] + dy / d * passo]
          if (this.libero(s.ancora, prossima, c)) {
            s.ancora = prossima
            s.direzione = Math.atan2(dy, dx)
            const angolo = s.direzione + Math.PI / 2 - s.pivot.rotation.z
            s.pivot.rotation.z += Math.atan2(Math.sin(angolo), Math.cos(angolo)) * (1 - Math.exp(-8 * Math.min(dt, .1)))
            s.mixer.update(Math.min(dt, .1))
          } else { s.meta = undefined; s.riprova = 0 }
          if (d <= passo + .01) { s.meta = undefined; s.riprova = 0 }
        }
      }
      const corpo = Math.min(s.lunghezza * 12, Math.max(s.lunghezza, 48 * c.mpp))
      s.pivot.scale.setScalar(corpo / s.lunghezza)
      s.pivot.position.set(...s.ancora, 0)
    }
  }

  libera() {
    this.rimosso = true
    this.gruppo.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const materiali = Array.isArray(obj.material) ? obj.material : [obj.material]
      materiali.forEach((m) => m.dispose())
    })
    this.gruppo.clear()
    this.slots = []
    this.pronto = false
  }
}
