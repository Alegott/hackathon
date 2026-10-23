import { puntoInPoligono } from "../diorama/geometria"
import type { Aggiunta, Casa, Comune, Dataset, TipoIndustria, TipoStrada } from "../types"
import { impattoCiclabile, impattoParco, impattoStrada, INDUSTRIE } from "./costanti"

// Crescita del territorio nella macchina del tempo: nel frattempo si costruiscono case,
// capannoni e strade (e, nei piani virtuosi, parchi e ciclabili). Gli eventi sono deterministici
// (generatore con seme) e diventano normali aggiunte dello scenario o case in più.

export type RitmiCrescita = {
  casePctAnno: number // nuove case all'anno, in % delle case attuali
  industrieAnno: number
  stradeAnno: number
  parchiAnno: number
  ciclabiliAnno: number
}

export type Evento = {
  anno: number
  descrizione?: string // solo per gli eventi da mostrare nella cronaca
  aggiunta?: Aggiunta
  casa?: Casa
}

// Ogni CASE_PER_QUARTIERE case nuove nasce un quartiere con la sua strada (consumo di suolo).
export const CASE_PER_QUARTIERE = 25

function generatore(seme: number) {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)

function scegliPesato<T>(voci: T[], peso: (v: T) => number, r: number): T {
  const tot = voci.reduce((n, v) => n + peso(v), 0)
  let x = r * tot
  for (const v of voci) {
    x -= peso(v)
    if (x <= 0) return v
  }
  return voci.at(-1)!
}

// Punto casuale dentro il comune (in metri); ripiega sul centroide.
function puntoNelComune(c: Comune, rnd: () => number): [number, number] {
  const anello = c.geometria[0]
  if (!anello?.length) return c.centroide
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of anello) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  for (let i = 0; i < 30; i++) {
    const p: [number, number] = [minX + rnd() * (maxX - minX), minY + rnd() * (maxY - minY)]
    if (puntoInPoligono(p, anello)) return p
  }
  return c.centroide
}

function segmento(da: [number, number], km: number, rnd: () => number): [number, number][] {
  const ang = rnd() * Math.PI * 2
  const passi = 4
  return Array.from({ length: passi + 1 }, (_, i) => {
    const d = (km * 1000 * i) / passi
    const curva = Math.sin((i / passi) * Math.PI) * km * 80 * (rnd() - 0.5)
    return [da[0] + Math.cos(ang) * d - Math.sin(ang) * curva, da[1] + Math.sin(ang) * d + Math.cos(ang) * curva] as [number, number]
  })
}

const km = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 1 })

// Anni in cui cadono `ritmo * durata` eventi distribuiti con regolarità nel periodo.
function anniEventi(ritmo: number, annoInizio: number, annoFine: number): number[] {
  const n = Math.floor(ritmo * (annoFine - annoInizio) + 1e-9)
  return Array.from({ length: n }, (_, i) => annoInizio + Math.min(annoFine - annoInizio, Math.max(1, Math.ceil((i + 0.5) / ritmo))))
}

export function generaCrescita(ds: Dataset, ritmi: RitmiCrescita, annoInizio: number, annoFine: number, seme: string): Evento[] {
  const rnd = generatore(hash(seme))
  const comuni = ds.comuni.filter((c) => c.geometria.length)
  if (!comuni.length) return []
  const conta = (istat: string, tipo: string) => ds.infrastrutture.filter((i) => i.comune === istat && i.tipo === tipo).length
  const caseDi = new Map<string, number>()
  for (const c of ds.caseSeed) caseDi.set(c.comune, (caseDi.get(c.comune) ?? 0) + 1)
  const abitato = (c: Comune) => 1 + (caseDi.get(c.istat) ?? 0)
  const eventi: Evento[] = []
  let n = 0
  const id = (k: string) => `tempo-${k}-${++n}`

  // Capannoni: si addensano dove l'industria c'è già. Niente nuove concerie (distretto saturo).
  const tipiIndustria: [TipoIndustria, number][] = [["artigianale", 0.5], ["logistica", 0.35], ["meccanica", 0.15]]
  for (const anno of anniEventi(ritmi.industrieAnno, annoInizio, annoFine)) {
    const c = scegliPesato(comuni, (x) => 1 + 3 * conta(x.istat, "industria"), rnd())
    const tipo = scegliPesato(tipiIndustria, ([, p]) => p, rnd())[0]
    eventi.push({
      anno, descrizione: `Nuovo capannone ${INDUSTRIE[tipo].etichetta.toLowerCase()} a ${c.nome} (${INDUSTRIE[tipo].delta})`,
      aggiunta: { id: id("industria"), comune: c.istat, tipo: "industria", industria: tipo, posizione: puntoNelComune(c, rnd) },
    })
  }

  // Strade: servono i poli produttivi e i centri più abitati.
  for (const anno of anniEventi(ritmi.stradeAnno, annoInizio, annoFine)) {
    const c = scegliPesato(comuni, (x) => abitato(x) + 4 * conta(x.istat, "industria"), rnd())
    const tipo: TipoStrada = rnd() < 0.3 ? "tangenziale" : "provinciale"
    const lunghezza = 1.5 + rnd() * 2.5
    const tracciato = segmento(puntoNelComune(c, rnd), lunghezza, rnd)
    eventi.push({
      anno, descrizione: `Nuova ${tipo} a ${c.nome}, ${km(lunghezza)} km (${km(impattoStrada(tipo, tracciato))})`,
      aggiunta: { id: id("strada"), comune: c.istat, tipo: "strada", posizione: tracciato[0]!, strada: { tipo, tracciato } },
    })
  }

  // Parchi e ciclabili: dove abita la gente.
  for (const anno of anniEventi(ritmi.parchiAnno, annoInizio, annoFine)) {
    const c = scegliPesato(comuni, abitato, rnd())
    const [x, y] = puntoNelComune(c, rnd)
    const lato = 150 + rnd() * 150
    const contorno: [number, number][] = [[x, y], [x + lato, y], [x + lato, y + lato], [x, y + lato]]
    eventi.push({
      anno, descrizione: `Nuovo parco a ${c.nome} (+${km(impattoParco(contorno))})`,
      aggiunta: { id: id("parco"), comune: c.istat, tipo: "parco", posizione: [x, y], parco: { contorno } },
    })
  }
  for (const anno of anniEventi(ritmi.ciclabiliAnno, annoInizio, annoFine)) {
    const c = scegliPesato(comuni, abitato, rnd())
    const lunghezza = 2 + rnd() * 3
    const tracciato = segmento(puntoNelComune(c, rnd), lunghezza, rnd)
    eventi.push({
      anno, descrizione: `Nuova pista ciclabile a ${c.nome}, ${km(lunghezza)} km (+${km(impattoCiclabile(tracciato))})`,
      aggiunta: { id: id("ciclabile"), comune: c.istat, tipo: "ciclabile", posizione: tracciato[0]!, ciclabile: { tracciato } },
    })
  }

  // Case nuove: per legge (dal 2021) a energia quasi zero. Ogni quartiere porta una strada urbana
  // nel comune in cui si completa.
  let nuove = 0
  for (const anno of anniEventi((ritmi.casePctAnno / 100) * ds.caseSeed.length, annoInizio, annoFine)) {
    const c = scegliPesato(comuni, abitato, rnd())
    eventi.push({
      anno,
      casa: {
        id: id("casa"), comune: c.istat, pubblico: false,
        dotazioni: {
          fotovoltaico: true, solareTermico: rnd() < 0.3, riscaldamento: "pompa_calore", cottura: "induzione",
          isolamento: "buono", infissi: true, colonninaEV: rnd() < 0.4,
        },
      },
    })
    if (++nuove % CASE_PER_QUARTIERE === 0) {
      const tracciato = segmento(puntoNelComune(c, rnd), 0.8, rnd)
      eventi.push({
        anno, descrizione: `Nuovo quartiere a ${c.nome}: ${CASE_PER_QUARTIERE} case e una strada (${km(impattoStrada("urbana", tracciato))})`,
        aggiunta: { id: id("quartiere"), comune: c.istat, tipo: "strada", posizione: tracciato[0]!, strada: { tipo: "urbana", tracciato } },
      })
    }
  }

  return eventi.sort((a, b) => a.anno - b.anno)
}
