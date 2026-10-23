import type { Livelli } from "./paesaggio"

// Paesaggio sonoro sintetizzato con Web Audio: nessun file audio da scaricare.
// Vento e traffico sono rumore filtrato; uccelli e auto in transito sono eventi programmati
// con una posizione stereo propria, così il suono "abita" lo spazio attorno a chi ascolta.

const TAU = 1.2 // secondi per raggiungere i nuovi livelli quando si cambia zona

function rumore(ctx: AudioContext, tipo: "bianco" | "marrone", secondi = 3): AudioBuffer {
  const b = ctx.createBuffer(2, ctx.sampleRate * secondi, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let ultimo = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      if (tipo === "bianco") d[i] = w
      else { ultimo = (ultimo + 0.02 * w) / 1.02; d[i] = ultimo * 3.5 }
    }
  }
  return b
}

// Riverbero sintetico: coda di rumore che decade, per dare profondità agli uccelli.
function riverbero(ctx: AudioContext): ConvolverNode {
  const n = ctx.sampleRate * 2
  const b = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3
  }
  const c = ctx.createConvolver()
  c.buffer = b
  return c
}

const caso = (a: number, b: number) => a + Math.random() * (b - a)

export class PaesaggioSonoro {
  private ctx: AudioContext
  private master: GainNode
  private gVento: GainNode
  private gTraffico: GainNode
  private gIndustria: GainNode
  private busUccelli: GainNode
  private busAuto: GainNode
  private bufAuto: AudioBuffer
  private livelli: Livelli = { uccelli: 0, traffico: 0, industria: 0, vento: 0 }
  private timer: number[] = []
  private fermo = false

  constructor() {
    const ctx = new AudioContext()
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.connect(ctx.destination)
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(comp)

    const rev = riverbero(ctx)
    const gRev = ctx.createGain()
    gRev.gain.value = 0.35
    rev.connect(gRev).connect(this.master)

    const bianco = rumore(ctx, "bianco")
    const marrone = rumore(ctx, "marrone")
    const sorgente = (buf: AudioBuffer) => {
      const s = ctx.createBufferSource()
      s.buffer = buf
      s.loop = true
      s.start()
      return s
    }

    // Vento: rumore bianco in un passa-banda che "respira" lentamente.
    const fVento = ctx.createBiquadFilter()
    fVento.type = "bandpass"
    fVento.frequency.value = 450
    fVento.Q.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoAmp = ctx.createGain()
    lfoAmp.gain.value = 220
    lfo.connect(lfoAmp).connect(fVento.frequency)
    lfo.start()
    this.gVento = ctx.createGain()
    this.gVento.gain.value = 0
    sorgente(bianco).connect(fVento).connect(this.gVento).connect(this.master)

    // Traffico di fondo: rumore marrone molto filtrato, il rombo lontano delle strade.
    const fTraffico = ctx.createBiquadFilter()
    fTraffico.type = "lowpass"
    fTraffico.frequency.value = 260
    this.gTraffico = ctx.createGain()
    this.gTraffico.gain.value = 0
    sorgente(marrone).connect(fTraffico).connect(this.gTraffico).connect(this.master)

    // Industria: ronzio grave di macchinari, con un battimento lento.
    this.gIndustria = ctx.createGain()
    this.gIndustria.gain.value = 0
    const fInd = ctx.createBiquadFilter()
    fInd.type = "lowpass"
    fInd.frequency.value = 180
    fInd.connect(this.gIndustria).connect(this.master)
    for (const [f, g] of [[55, 0.5], [55.7, 0.4], [110, 0.18]] as const) {
      const o = ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og).connect(fInd)
      o.start()
    }

    this.busUccelli = ctx.createGain()
    this.busUccelli.gain.value = 0.55
    this.busUccelli.connect(this.master)
    this.busUccelli.connect(rev)

    this.bufAuto = rumore(ctx, "marrone", 5)
    this.busAuto = ctx.createGain()
    this.busAuto.gain.value = 0.6
    this.busAuto.connect(this.master)

    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.8)
    this.programmaUccelli()
    this.programmaAuto()
  }

  imposta(l: Livelli) {
    this.livelli = l
    const t = this.ctx.currentTime
    this.gVento.gain.setTargetAtTime(0.05 + l.vento * 0.12, t, TAU)
    this.gTraffico.gain.setTargetAtTime(l.traffico * 0.55, t, TAU)
    this.gIndustria.gain.setTargetAtTime(l.industria * 0.06, t, TAU)
  }

  async riprendi() {
    if (this.ctx.state === "suspended") await this.ctx.resume()
  }

  chiudi() {
    this.fermo = true
    for (const id of this.timer) window.clearTimeout(id)
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(0, t, 0.25)
    window.setTimeout(() => void this.ctx.close(), 1200)
  }

  private dopo(ms: number, fn: () => void) {
    if (this.fermo) return
    const id = window.setTimeout(() => {
      this.timer = this.timer.filter((x) => x !== id)
      if (!this.fermo) fn()
    }, ms)
    this.timer.push(id)
  }

  // Frasi di canto: più frequenti e più ricche quanto più la zona è viva.
  private programmaUccelli() {
    const u = this.livelli.uccelli
    if (u > 0.02 && this.ctx.state === "running") {
      const voci = u > 0.6 ? 2 : 1
      for (let v = 0; v < voci; v++) this.frase(caso(-0.95, 0.95), u)
    }
    // Da una frase ogni ~0,6 s (zona ottima) a una ogni ~6 s; in attesa se non ci sono uccelli.
    this.dopo(u > 0.02 ? caso(400, 900) / Math.max(0.12, u) : 1500, () => this.programmaUccelli())
  }

  private frase(pan: number, u: number) {
    const ctx = this.ctx
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    const vicinanza = caso(0.25, 1)
    const g = ctx.createGain()
    g.gain.value = 0.18 * vicinanza * (0.5 + 0.5 * u)
    p.connect(g).connect(this.busUccelli)
    let t = ctx.currentTime + 0.02
    const specie = Math.random()
    if (specie < 0.4) {
      // Cinciallegra: "ti-tu ti-tu", due note alternate.
      const alta = caso(4200, 5200), bassa = alta * caso(0.68, 0.78)
      const n = Math.round(caso(2, 4))
      for (let i = 0; i < n; i++) {
        this.nota(p, t, alta, alta * 0.97, 0.07)
        this.nota(p, t + 0.11, bassa, bassa * 0.98, 0.09)
        t += 0.28
      }
    } else if (specie < 0.75) {
      // Fringuello: trillo veloce che accelera e chiude con una nota discendente.
      const base = caso(3000, 4200)
      let passo = 0.075
      for (let i = 0; i < Math.round(caso(6, 11)); i++) {
        this.nota(p, t, base * caso(0.95, 1.05), base * 0.9, 0.05)
        t += passo
        passo *= 0.94
      }
      this.nota(p, t + 0.04, base * 1.15, base * 0.6, 0.18)
    } else {
      // Merlo: fischi più gravi e modulati.
      for (let i = 0; i < Math.round(caso(2, 4)); i++) {
        const f = caso(1500, 2600)
        this.nota(p, t, f, f * caso(0.8, 1.3), caso(0.12, 0.25), 18)
        t += caso(0.22, 0.38)
      }
    }
  }

  private nota(dest: AudioNode, t: number, da: number, a: number, durata: number, vibrato = 0) {
    const ctx = this.ctx
    const o = ctx.createOscillator()
    o.type = "sine"
    o.frequency.setValueAtTime(da, t)
    o.frequency.exponentialRampToValueAtTime(a, t + durata)
    if (vibrato) {
      const v = ctx.createOscillator()
      v.frequency.value = vibrato
      const va = ctx.createGain()
      va.gain.value = da * 0.03
      v.connect(va).connect(o.frequency)
      v.start(t)
      v.stop(t + durata + 0.05)
    }
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(1, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata)
    o.connect(g).connect(dest)
    o.start(t)
    o.stop(t + durata + 0.05)
  }

  // Auto in transito: rumore che sale e scende mentre attraversa da un lato all'altro.
  private programmaAuto() {
    const tr = this.livelli.traffico
    if (tr > 0.2 && this.ctx.state === "running") this.passaggio(tr)
    this.dopo(tr > 0.2 ? caso(900, 2600) / tr : 2000, () => this.programmaAuto())
  }

  private passaggio(tr: number) {
    const ctx = this.ctx
    const t = ctx.currentTime + 0.02
    const durata = caso(2.2, 4)
    const src = ctx.createBufferSource()
    src.buffer = this.bufAuto
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.Q.value = 0.9
    f.frequency.setValueAtTime(320, t)
    f.frequency.linearRampToValueAtTime(620, t + durata / 2)
    f.frequency.linearRampToValueAtTime(260, t + durata)
    const g = ctx.createGain()
    const picco = 0.5 * tr * caso(0.5, 1)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(picco, t + durata / 2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata)
    const p = ctx.createStereoPanner()
    const verso = Math.random() < 0.5 ? 1 : -1
    p.pan.setValueAtTime(-0.9 * verso, t)
    p.pan.linearRampToValueAtTime(0.9 * verso, t + durata)
    src.connect(f).connect(g).connect(p).connect(this.busAuto)
    src.start(t)
    src.stop(t + durata + 0.1)
  }
}
