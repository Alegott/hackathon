import * as THREE from "three"

type Punto = [number, number]
type Segmento = { a: Punto; b: Punto; lunghezza: number }
type Auto = { gruppo: THREE.Group; strada?: Segmento; distanza: number; verso: number }

// Otto auto di base (fino a 24 quando la macchina del tempo fa crescere il parco auto),
// geometrie condivise e nessun modello o motore fisico da caricare.
export class Traffico {
  readonly gruppo = new THREE.Group()
  private geometria = new THREE.BoxGeometry(1, 1, 1)
  private vetro = new THREE.MeshLambertMaterial({ color: "#aecbd4" })
  private materiali = ["#e5c35c", "#e8ede9", "#5e9bb5", "#c97464"].map((color) => new THREE.MeshLambertMaterial({ color }))
  private strade: Segmento[] = []
  private comune: string | null = null
  private riprova = 0
  private attive = 8
  private auto: Auto[] = Array.from({ length: 24 }, (_, i) => {
    const gruppo = new THREE.Group()
    const corpo = new THREE.Mesh(this.geometria, this.materiali[i % 4])
    corpo.scale.set(4.2, 1.8, 1.1)
    corpo.position.z = .85
    const cabina = new THREE.Mesh(this.geometria, this.vetro)
    cabina.scale.set(2.1, 1.55, .8)
    cabina.position.z = 1.7
    gruppo.add(corpo, cabina)
    gruppo.visible = false
    this.gruppo.add(gruppo)
    return { gruppo, distanza: i * 11, verso: i % 2 ? -1 : 1 }
  })

  setPercorsi(linee: Punto[][]) {
    const viste = new Set<string>()
    this.strade = linee.flatMap((linea) => linea.slice(1).flatMap((b, i) => {
      const a = linea[i]!, lunghezza = Math.hypot(b[0] - a[0], b[1] - a[1])
      const key = [a.join(","), b.join(",")].sort().join(":")
      if (lunghezza < .5 || viste.has(key)) return []
      viste.add(key)
      return [{ a, b, lunghezza }]
    }))
    this.riprova = 0
    // I segmenti già percorsi restano validi durante il ricambio delle tile.
  }

  // densita = auto rispetto a oggi; le differenze sono amplificate perché si notino a occhio.
  setDensita(densita: number) {
    const n = Math.max(3, Math.min(this.auto.length, Math.round(8 + (densita - 1) * 50)))
    if (n === this.attive) return
    this.attive = n
    this.auto.slice(n).forEach((a) => { a.strada = undefined; a.gruppo.visible = false })
  }

  setComune(comune: string | null) {
    if (comune === this.comune) return
    this.comune = comune
    this.auto.forEach((auto) => { auto.strada = undefined; auto.gruppo.visible = false })
  }

  frame(dt: number, attivo: boolean, centro: Punto, mpp: number, libero: (x: number, y: number) => boolean, raggio = 400) {
    this.gruppo.visible = attivo
    if (!attivo) return
    this.riprova -= dt
    const attive = this.auto.slice(0, this.attive)
    for (const auto of attive) {
      if (auto.strada && Math.hypot(auto.gruppo.position.x - centro[0], auto.gruppo.position.y - centro[1]) > raggio * 1.4) {
        auto.strada = undefined
        auto.gruppo.visible = false
        this.riprova = 0
      }
    }
    // Selezione vicina al centro della vista, una sola volta per il gruppo di auto.
    const candidati = attive.some((a) => !a.strada) && this.riprova <= 0
      ? this.strade.map((s) => {
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1]
        const t = Math.max(.05, Math.min(.95, ((centro[0] - s.a[0]) * dx + (centro[1] - s.a[1]) * dy) / s.lunghezza ** 2))
        const x = s.a[0] + dx * t, y = s.a[1] + dy * t
        return { s, t, x, y, distanza: Math.hypot(x - centro[0], y - centro[1]) }
      }).filter((p) => p.distanza < raggio).sort((a, b) => a.distanza - b.distanza)
        .slice(0, 64).filter((p) => libero(p.x, p.y))
      : []
    if (this.riprova <= 0) this.riprova = 1
    for (const [i, auto] of attive.entries()) {
      if (!auto.strada) {
        const p = candidati[i]
        if (!p) continue
        auto.strada = p.s
        auto.distanza = p.s.lunghezza * p.t
      }
      let s = auto.strada
      auto.distanza += dt * (6 + i % 3) * auto.verso
      if (auto.distanza > s.lunghezza || auto.distanza < 0) {
        const fine = auto.verso > 0 ? s.b : s.a
        const prossime = this.strade.filter((r) => r !== s
          && (Math.hypot(r.a[0] - fine[0], r.a[1] - fine[1]) < 1
            || Math.hypot(r.b[0] - fine[0], r.b[1] - fine[1]) < 1))
        const prossima = prossime[i % Math.max(1, prossime.length)]
        if (prossima) {
          auto.verso = Math.hypot(prossima.a[0] - fine[0], prossima.a[1] - fine[1]) < 1 ? 1 : -1
          auto.strada = s = prossima
          auto.distanza = auto.verso > 0 ? 0 : s.lunghezza
        } else {
          auto.distanza = Math.max(0, Math.min(s.lunghezza, auto.distanza))
          auto.verso *= -1
        }
      }
      const t = auto.distanza / s.lunghezza
      const x = s.a[0] + (s.b[0] - s.a[0]) * t, y = s.a[1] + (s.b[1] - s.a[1]) * t
      auto.gruppo.visible = libero(x, y)
      auto.gruppo.position.set(x, y, .5)
      auto.gruppo.rotation.z = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) + (auto.verso < 0 ? Math.PI : 0)
      auto.gruppo.scale.setScalar(Math.max(1, Math.min(8, mpp * 16 / 4.2)))
    }
  }

  libera() {
    this.geometria.dispose()
    this.vetro.dispose()
    this.materiali.forEach((m) => m.dispose())
    this.gruppo.clear()
  }
}
