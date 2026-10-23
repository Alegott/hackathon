import { puntoInPoligono } from "../diorama/geometria"
import type { Aggiunta, Casa, Comune, Dataset, TipoIndustria, TipoStrada } from "../types"
import { DELTA_INFRA, impattoCiclabile, impattoStrada, INDUSTRIE } from "./costanti"

// Crescita del territorio nella macchina del tempo: nel frattempo si costruiscono case,
// capannoni e strade (e, nei piani virtuosi, parchi, ciclabili e un piccolo reattore nucleare).
// Gli eventi sono deterministici (generatore con seme) e diventano normali aggiunte dello scenario
// o case in più.

export type RitmiCrescita = {
  casePctAnno: number // nuove case all'anno, in % delle case attuali
  industrieAnno: number
  stradeAnno: number
  parchiAnno: number
  ciclabiliAnno: number
  // Anno di entrata in servizio di un piccolo reattore modulare (SMR), se il piano lo prevede.
  nucleareAnno: number | null
}

export type Evento = {
  anno: number
  descrizione?: string // solo per gli eventi da mostrare nella cronaca
  aggiunta?: Aggiunta
  casa?: Casa
  // Solo per la mappa: il quartiere a cui si aggiunge la casa (le case pesano già da sé nel motore).
  quartiere?: Quartiere
}

export type Quartiere = { id: string; comune: string; posizione: [number, number] }

// Un quartiere cresce casa dopo casa fino a CASE_PER_QUARTIERE; completato, riceve la sua strada
// (consumo di suolo) e nel comune se ne apre un altro.
export const CASE_PER_QUARTIERE = 12

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
    eventi.push({
      anno, descrizione: `Nuovo parco a ${c.nome} (+${DELTA_INFRA.parco})`,
      aggiunta: { id: id("parco"), comune: c.istat, tipo: "parco", posizione: puntoNelComune(c, rnd) },
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

  // Case nuove: per legge (dal 2021) a energia quasi zero. Tre volte su quattro si aggiungono a un
  // quartiere già aperto (i centri crescono attorno alle espansioni recenti), altrimenti ne aprono uno.
  const aperti = new Map<string, { q: Quartiere; n: number }>()
  const perIstat = new Map(comuni.map((c) => [c.istat, c]))
  for (const anno of anniEventi((ritmi.casePctAnno / 100) * ds.caseSeed.length, annoInizio, annoFine)) {
    const cantieri = [...aperti.values()]
    const c = cantieri.length && rnd() < 0.75
      ? perIstat.get(scegliPesato(cantieri, (x) => 1 + x.n, rnd()).q.comune)!
      : scegliPesato(comuni, (x) => abitato(x) ** 1.5, rnd())
    let aperto = aperti.get(c.istat)
    if (!aperto) {
      aperto = { q: { id: id("quartiere"), comune: c.istat, posizione: puntoNelComune(c, rnd) }, n: 0 }
      aperti.set(c.istat, aperto)
    }
    eventi.push({
      anno,
      quartiere: aperto.q,
      casa: {
        id: id("casa"), comune: c.istat, pubblico: false,
        dotazioni: {
          fotovoltaico: true, solareTermico: rnd() < 0.3, riscaldamento: "pompa_calore", cottura: "induzione",
          isolamento: "buono", infissi: true, colonninaEV: rnd() < 0.4,
        },
      },
    })
    if (++aperto.n === CASE_PER_QUARTIERE) {
      const tracciato = segmento(aperto.q.posizione, 0.9, rnd)
      eventi.push({
        anno, descrizione: `Completato un quartiere a ${c.nome}: ${CASE_PER_QUARTIERE} case e una strada (${km(impattoStrada("urbana", tracciato))})`,
        aggiunta: { id: id("strada-quartiere"), comune: c.istat, tipo: "strada", posizione: tracciato[0]!, strada: { tipo: "urbana", tracciato } },
      })
      aperti.delete(c.istat)
    }
  }

  // Piccolo reattore modulare: nel comune con più industria, dove la domanda di energia è più alta.
  if (ritmi.nucleareAnno !== null && ritmi.nucleareAnno <= annoFine) {
    const c = [...comuni].sort((a, b) => conta(b.istat, "industria") - conta(a.istat, "industria") || abitato(b) - abitato(a))[0]!
    eventi.push({
      anno: ritmi.nucleareAnno,
      descrizione: `Entra in servizio un piccolo reattore modulare a ${c.nome} (+${DELTA_INFRA.nucleare}, energia pulita per la provincia)`,
      aggiunta: { id: id("nucleare"), comune: c.istat, tipo: "nucleare", posizione: puntoNelComune(c, rnd) },
    })
  }

  return eventi.sort((a, b) => a.anno - b.anno)
}
