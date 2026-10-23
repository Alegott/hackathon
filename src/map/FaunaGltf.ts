import * as THREE from "three"
import type { GLTF } from "three-stdlib"
import { CATALOGO_MODELLI_3D, caricaGLTF, creaIstanzaAnimata } from "../diorama/modelli3d"
import type { Fauna, SpecieTerra } from "./vitaTerritorio"

const ORDINE: SpecieTerra[] = ["capriolo", "volpe", "cervo", "lupo"]
const FILE = { capriolo: "deer", volpe: "fox", cervo: "stag", lupo: "wolf" } as const
const LUNGHEZZA = { capriolo: 1.3, volpe: .75, cervo: 2, lupo: 1.2 }
const CAPACITA = 24

type Slot = { pivot: THREE.Group; lunghezza: number; attivo: boolean; ancora: [number, number] }
export type ContestoFrame = {
  mpp: number
  dentro: (x: number, y: number) => boolean
  centro: [number, number]
  raggio: number
  vistaCentro: [number, number]
  vistaRaggio: number
}

// Solo modelli terrestri glTF, in pose statiche. Nessun surrogato geometrico o uccello in orbita.
export class FaunaGltf {
  readonly gruppo = new THREE.Group()
  private slots: Slot[] = []
  private avviato = false
  private pronto = false
  private rimosso = false
  private chiave: string | null = null
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
    const istanza = creaIstanzaAnimata(gltf, { clipMovimento: ["Idle", "Idle_Headlow", "Idle_2_HeadLow", "Eating"] })
    // Applica una sola posa del rig; il mixer non viene pi? avanzato.
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
    return { pivot, lunghezza, attivo: false, ancora: [0, 0] }
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
      if (!fauna || i >= fauna.terra.length || i >= punti.length) { s.attivo = false; s.pivot.visible = false; return }
      if (!s.attivo) {
        s.ancora = punti[i % punti.length]!
        s.attivo = true
      }
    })
  }

  frame(_dt: number, _t: number, c: ContestoFrame) {
    for (const s of this.slots) {
      s.pivot.visible = s.attivo && c.dentro(...s.ancora)
      if (!s.pivot.visible) continue
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
