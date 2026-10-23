import type { Aggiunta, Casa, Dataset, Fascia, Scenario, StatoComune } from "../types"
import { lunghezzaKm } from "./costanti"
import { generaCrescita, type Evento, type RitmiCrescita } from "./crescita"
import { applicaMacro, inAmbito } from "./macro"
import { fasciaDa, statoTerritorio } from "./territorio"

// Macchina del tempo: proiezione illustrativa anno per anno. Tre ipotesi dichiarate in UI:
// 1. le quote di case virtuose crescono verso un obiettivo lungo una curva di adozione;
// 2. il PM10 di ogni comune segue una tendenza percentuale annua;
// 3. il territorio cresce: case nuove, capannoni, strade, parchi e ciclabili (vedi crescita.ts).
// Il motore non cambia: ogni anno è statoTerritorio su un dataset e uno scenario derivati.

export type Curva = "lineare" | "s"
type Quote = { pctFV: number; pctSenzaGas: number; pctIsolamentoBuono: number }

export type PianoTemporale = {
  id: string
  nome: string
  descrizione: string
  annoInizio: number
  annoFine: number
  ambito: "provincia" | string
  // Quote obiettivo all'anno finale; se una quota è già più alta resta quella attuale.
  obiettivi: Quote
  curva: Curva
  trendPm10PctAnno: number
  crescita: RitmiCrescita
}

export type Crescita = { case: number; industrie: number; stradeKm: number; parchi: number; ciclabiliKm: number }
export type Riepilogo = {
  pctFV: number; pm10Medio: number; perFascia: Record<Fascia, number>; indiceMedio: number; crescita: Crescita
}
export type Voce = { anno: number; descrizione: string }
export type Fotogramma = {
  anno: number
  indici: Record<string, StatoComune>
  riepilogo: Riepilogo
  // Opere costruite dall'inizio fino a quest'anno e cronaca dei fatti principali.
  aggiunte: Aggiunta[]
  cronaca: Voce[]
}

export const PIANI: PianoTemporale[] = [
  {
    id: "passo-indietro", nome: "Passo indietro", descrizione: "Si costruisce tanto, il traffico cresce e le case non si rinnovano",
    annoInizio: 2025, annoFine: 2040, ambito: "provincia",
    obiettivi: { pctFV: 0, pctSenzaGas: 0, pctIsolamentoBuono: 0 }, curva: "lineare", trendPm10PctAnno: 1,
    crescita: { casePctAnno: 1, industrieAnno: 1.5, stradeAnno: 2, parchiAnno: 0, ciclabiliAnno: 0 },
  },
  {
    id: "inerzia", nome: "Inerzia", descrizione: "Si continua come oggi: si costruisce e si rinnova poco",
    annoInizio: 2025, annoFine: 2040, ambito: "provincia",
    obiettivi: { pctFV: 30, pctSenzaGas: 20, pctIsolamentoBuono: 30 }, curva: "lineare", trendPm10PctAnno: -0.5,
    crescita: { casePctAnno: 0.6, industrieAnno: 0.8, stradeAnno: 1, parchiAnno: 0.2, ciclabiliAnno: 0.4 },
  },
  {
    id: "piano-clima", nome: "Piano clima", descrizione: "Si costruisce meno, metà delle case si rinnova, più parchi e ciclabili",
    annoInizio: 2025, annoFine: 2040, ambito: "provincia",
    obiettivi: { pctFV: 50, pctSenzaGas: 40, pctIsolamentoBuono: 50 }, curva: "s", trendPm10PctAnno: -2,
    crescita: { casePctAnno: 0.5, industrieAnno: 0.6, stradeAnno: 0.4, parchiAnno: 0.8, ciclabiliAnno: 1.2 },
  },
  {
    id: "tutti-a-bordo", nome: "Tutti a bordo", descrizione: "Quasi ogni famiglia fa la sua parte e il verde cresce ovunque",
    annoInizio: 2025, annoFine: 2040, ambito: "provincia",
    obiettivi: { pctFV: 80, pctSenzaGas: 70, pctIsolamentoBuono: 75 }, curva: "s", trendPm10PctAnno: -3,
    crescita: { casePctAnno: 0.5, industrieAnno: 0.5, stradeAnno: 0.2, parchiAnno: 1.2, ciclabiliAnno: 2 },
  },
]

const senzaGas = (c: Casa) => c.dotazioni.riscaldamento === "pompa_calore" && c.dotazioni.cottura === "induzione"
const pct = (n: number, tot: number) => (tot === 0 ? 0 : (n / tot) * 100)

export function quoteAttuali(ds: Dataset, ambito: "provincia" | string): Quote {
  const case_ = ds.caseSeed.filter((c) => ambito === "provincia" || c.comune === ambito)
  return {
    pctFV: pct(case_.filter((c) => c.dotazioni.fotovoltaico).length, case_.length),
    pctSenzaGas: pct(case_.filter(senzaGas).length, case_.length),
    pctIsolamentoBuono: pct(case_.filter((c) => c.dotazioni.isolamento === "buono").length, case_.length),
  }
}

// Frazione del percorso compiuta al tempo t ∈ [0, 1]. "s" = adozione logistica normalizzata.
export function avanzamento(curva: Curva, t: number): number {
  const x = Math.min(1, Math.max(0, t))
  if (curva === "lineare") return x
  const k = 9
  const sig = (v: number) => 1 / (1 + Math.exp(-k * (v - 0.5)))
  return (sig(x) - sig(0)) / (sig(1) - sig(0))
}

// Stessa normalizzazione del dataset: 15 µg/m³ → 100, 50 → 0.
const normPm10 = (pm10: number) => Math.min(100, Math.max(0, ((50 - pm10) / 35) * 100))

// Dataset con il PM10 di `anni` anni dopo. L'aria cambia di quanto cambia la normalizzazione,
// così all'anno zero il dataset resta identico all'originale.
export function datasetAnno(ds: Dataset, anni: number, trendPm10PctAnno: number): Dataset {
  if (anni <= 0 || trendPm10PctAnno === 0) return ds
  const fattore = (1 + trendPm10PctAnno / 100) ** anni
  return {
    ...ds,
    comuni: ds.comuni.map((c) => {
      const pm10 = c.pm10 * fattore
      return { ...c, pm10, ariaNorm: Math.min(100, Math.max(0, c.ariaNorm + normPm10(pm10) - normPm10(c.pm10))) }
    }),
  }
}

export function quoteAnno(piano: PianoTemporale, anno: number, attuali: Quote): Quote {
  const durata = Math.max(1, piano.annoFine - piano.annoInizio)
  const a = avanzamento(piano.curva, (anno - piano.annoInizio) / durata)
  const verso = (k: keyof Quote) => attuali[k] + Math.max(0, piano.obiettivi[k] - attuali[k]) * a
  return { pctFV: verso("pctFV"), pctSenzaGas: verso("pctSenzaGas"), pctIsolamentoBuono: verso("pctIsolamentoBuono") }
}

export function scenarioAnno(piano: PianoTemporale, anno: number, base: Scenario, attuali: Quote): Scenario {
  if (anno <= piano.annoInizio) return { ...base, macro: null }
  return { ...base, macro: { ambito: piano.ambito, ...quoteAnno(piano, anno, attuali) } }
}

function crescitaDa(eventi: Evento[]): Crescita {
  const opere = eventi.flatMap((e) => (e.aggiunta ? [e.aggiunta] : []))
  const somma = (tipo: string, tracciato: (a: Aggiunta) => [number, number][] | undefined) =>
    opere.filter((a) => a.tipo === tipo).reduce((n, a) => n + lunghezzaKm(tracciato(a) ?? []), 0)
  return {
    case: eventi.filter((e) => e.casa).length,
    industrie: opere.filter((a) => a.tipo === "industria").length,
    stradeKm: somma("strada", (a) => a.strada?.tracciato),
    parchi: opere.filter((a) => a.tipo === "parco").length,
    ciclabiliKm: somma("ciclabile", (a) => a.ciclabile?.tracciato),
  }
}

function riepilogo(ds: Dataset, s: Scenario, indici: Record<string, StatoComune>, eventi: Evento[]): Riepilogo {
  const perComune = new Map<string, Casa[]>()
  for (const c of ds.caseSeed) perComune.set(c.comune, [...(perComune.get(c.comune) ?? []), c])
  let fv = 0
  for (const [comune, case_] of perComune) {
    const m = s.macro && inAmbito(s.macro, comune) ? applicaMacro(case_, s.macro) : case_
    fv += m.filter((c) => c.dotazioni.fotovoltaico).length
  }
  const perFascia: Record<Fascia, number> = { ottima: 0, buona: 0, media: 0, scarsa: 0, pessima: 0 }
  const stati = Object.values(indici)
  for (const st of stati) perFascia[st.fascia]++
  return {
    pctFV: pct(fv, ds.caseSeed.length),
    pm10Medio: ds.comuni.reduce((n, c) => n + c.pm10, 0) / Math.max(1, ds.comuni.length),
    perFascia,
    indiceMedio: stati.reduce((n, st) => n + st.totale, 0) / Math.max(1, stati.length),
    crescita: crescitaDa(eventi),
  }
}

// Un fotogramma per anno, dall'anno iniziale al finale compresi.
export function fotogrammi(ds: Dataset, piano: PianoTemporale, base: Scenario, casaUtente?: Casa): Fotogramma[] {
  const attuali = quoteAttuali(ds, piano.ambito)
  const tutti = generaCrescita(ds, piano.crescita, piano.annoInizio, piano.annoFine, piano.id)
  const out: Fotogramma[] = []
  for (let anno = piano.annoInizio; anno <= piano.annoFine; anno++) {
    const eventi = tutti.filter((e) => e.anno <= anno)
    const aggiunte = eventi.flatMap((e) => (e.aggiunta ? [e.aggiunta] : []))
    const nuoveCase = eventi.flatMap((e) => (e.casa ? [e.casa] : []))
    const conPm10 = datasetAnno(ds, anno - piano.annoInizio, piano.trendPm10PctAnno)
    const dsAnno = nuoveCase.length ? { ...conPm10, caseSeed: [...conPm10.caseSeed, ...nuoveCase] } : conPm10
    const s0 = scenarioAnno(piano, anno, base, attuali)
    const s = aggiunte.length ? { ...s0, aggiunte: [...s0.aggiunte, ...aggiunte] } : s0
    const indici = statoTerritorio(dsAnno, s, casaUtente)
    const cronaca = eventi.flatMap((e) => (e.descrizione ? [{ anno: e.anno, descrizione: e.descrizione }] : []))
    out.push({ anno, indici, riepilogo: riepilogo(dsAnno, s, indici, eventi), aggiunte, cronaca })
  }
  return out
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Stato a un anno frazionario: interpolazione lineare tra i due fotogrammi vicini.
export function interpola(fot: Fotogramma[], anno: number): Omit<Fotogramma, "anno"> {
  const primo = fot[0]!
  const i = Math.min(fot.length - 1, Math.max(0, Math.floor(anno - primo.anno)))
  const a = fot[i]!
  const b = fot[Math.min(fot.length - 1, i + 1)]!
  const t = Math.min(1, Math.max(0, anno - a.anno))
  if (t === 0 || a === b) return a
  const indici: Record<string, StatoComune> = {}
  for (const [istat, sa] of Object.entries(a.indici)) {
    const sb = b.indici[istat] ?? sa
    const totale = lerp(sa.totale, sb.totale, t)
    indici[istat] = {
      aria: lerp(sa.aria, sb.aria, t),
      infrastrutture: lerp(sa.infrastrutture, sb.infrastrutture, t),
      scenario: lerp(sa.scenario, sb.scenario, t),
      totale,
      fascia: fasciaDa(totale),
      indiceCaseMedio: lerp(sa.indiceCaseMedio, sb.indiceCaseMedio, t),
    }
  }
  const ra = a.riepilogo, rb = b.riepilogo
  const perFascia: Record<Fascia, number> = { ottima: 0, buona: 0, media: 0, scarsa: 0, pessima: 0 }
  for (const st of Object.values(indici)) perFascia[st.fascia]++
  // Le opere compaiono a anno intero: aggiunte, cronaca e conteggi restano quelli dell'anno raggiunto.
  return {
    indici,
    riepilogo: {
      pctFV: lerp(ra.pctFV, rb.pctFV, t),
      pm10Medio: lerp(ra.pm10Medio, rb.pm10Medio, t),
      perFascia,
      indiceMedio: lerp(ra.indiceMedio, rb.indiceMedio, t),
      crescita: ra.crescita,
    },
    aggiunte: a.aggiunte,
    cronaca: a.cronaca,
  }
}
