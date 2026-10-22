import type { Casa, Dataset, Fascia, Infrastruttura, Scenario, StatoComune } from "../types"
import { punteggioCasa } from "./casa"
import { DELTA_INFRA } from "./costanti"
import { applicaMacro, ARIA_PER_PUNTO_CASE, inAmbito, TETTO_DELTA_ARIA_MACRO } from "./macro"

const clamp = (x: number, min = 0, max = 100) => Math.min(max, Math.max(min, x))

const SOGLIE_FASCIA: [number, Fascia][] = [
  [80, "ottima"],
  [60, "buona"],
  [40, "media"],
  [20, "scarsa"],
]

export function fasciaDa(totale: number): Fascia {
  return SOGLIE_FASCIA.find(([soglia]) => totale >= soglia)?.[1] ?? "pessima"
}

const MAX_PER_TIPO = 3
const TETTO_INFRA = 20

// Infrastrutture esistenti che contano: i primi MAX_PER_TIPO per tipo, nell'ordine del dataset
// (il dataset le ordina per importanza).
function contate(ds: Dataset): Infrastruttura[] {
  const perTipo = new Map<string, number>()
  return ds.infrastrutture.filter((i) => {
    const chiave = `${i.comune}|${i.tipo}`
    const n = perTipo.get(chiave) ?? 0
    perTipo.set(chiave, n + 1)
    return n < MAX_PER_TIPO
  })
}

// Delta dello scenario in build mode per comune: pieno sul comune dell'oggetto,
// a metà sui suoi confinanti (lo spillover vale solo per lo scenario).
function deltaScenario(ds: Dataset, s: Scenario, contateIds: Map<string, Infrastruttura>): Map<string, number> {
  const delta = new Map<string, number>()
  const confinanti = new Map(ds.comuni.map((c) => [c.istat, c.confinanti]))
  const applica = (comune: string, d: number) => {
    delta.set(comune, (delta.get(comune) ?? 0) + d)
    for (const vicino of confinanti.get(comune) ?? []) delta.set(vicino, (delta.get(vicino) ?? 0) + d / 2)
  }
  const rimosse = new Set(s.rimozioni)
  for (const a of s.aggiunte) if (!rimosse.has(a.id)) applica(a.comune, DELTA_INFRA[a.tipo])
  for (const id of rimosse) {
    const i = contateIds.get(id)
    if (i) applica(i.comune, -DELTA_INFRA[i.tipo])
  }
  return delta
}

function indiceCaseMedio(punteggi: number[]): number {
  return punteggi.length === 0 ? 0 : punteggi.reduce((a, b) => a + b, 0) / punteggi.length
}

export function statoTerritorio(
  ds: Dataset,
  s: Scenario,
  casaUtente?: Casa,
): Record<string, StatoComune> {
  const out: Record<string, StatoComune> = {}
  const esistenti = new Map<string, number>()
  const esistentiContate = contate(ds)
  const deltaBuild = deltaScenario(ds, s, new Map(esistentiContate.map((i) => [i.id, i])))
  for (const i of esistentiContate) esistenti.set(i.comune, (esistenti.get(i.comune) ?? 0) + DELTA_INFRA[i.tipo])
  const seedPerComune = new Map<string, Casa[]>()
  for (const casa of ds.caseSeed) seedPerComune.set(casa.comune, [...(seedPerComune.get(casa.comune) ?? []), casa])
  const media = (case_: Casa[]) => indiceCaseMedio(case_.map((c) => punteggioCasa(c.dotazioni).punteggio))
  for (const c of ds.comuni) {
    const infrastrutture = clamp(esistenti.get(c.istat) ?? 0, -TETTO_INFRA, TETTO_INFRA)
    const seed = seedPerComune.get(c.istat) ?? []
    const macro = s.macro && inAmbito(s.macro, c.istat) ? s.macro : null
    const seedModificate = macro ? applicaMacro(seed, macro) : seed
    const deltaMacro = Math.min(
      TETTO_DELTA_ARIA_MACRO,
      Math.max(0, (media(seedModificate) - media(seed)) * ARIA_PER_PUNTO_CASE),
    )
    const scenario = (deltaBuild.get(c.istat) ?? 0) + deltaMacro
    const casePerIndice = casaUtente?.comune === c.istat ? [...seedModificate, casaUtente] : seedModificate
    const totale = clamp(c.ariaNorm + infrastrutture + scenario)
    out[c.istat] = {
      aria: c.ariaNorm,
      infrastrutture,
      scenario,
      totale,
      fascia: fasciaDa(totale),
      indiceCaseMedio: media(casePerIndice),
    }
  }
  return out
}
