import type { Casa, Dotazioni, Scenario } from "../types"

type Macro = NonNullable<Scenario["macro"]>

export const TETTO_DELTA_ARIA_MACRO = 10
// Punti di aria per ogni punto di indice case medio guadagnato: portare tutte le case
// molto in alto (≈ +50 punti di indice) esaurisce il tetto di +10.
export const ARIA_PER_PUNTO_CASE = TETTO_DELTA_ARIA_MACRO / 50

const senzaGas = (d: Dotazioni) => d.riscaldamento === "pompa_calore" && d.cottura === "induzione"

// Porta la quota di case che hanno una dotazione al target, migliorando solo case che non
// ce l'hanno, in ordine di id (deterministico). Non toglie mai dotazioni.
function porta(case_: Casa[], pct: number, ha: (d: Dotazioni) => boolean, migliora: (d: Dotazioni) => Dotazioni): Casa[] {
  const target = Math.round((Math.min(100, Math.max(0, pct)) / 100) * case_.length)
  let mancano = target - case_.filter((c) => ha(c.dotazioni)).length
  const ordine = [...case_].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const daMigliorare = new Set<string>()
  for (const c of ordine) {
    if (mancano <= 0) break
    if (!ha(c.dotazioni)) {
      daMigliorare.add(c.id)
      mancano--
    }
  }
  return case_.map((c) => (daMigliorare.has(c.id) ? { ...c, dotazioni: migliora(c.dotazioni) } : c))
}

// Applica gli slider alle case di un comune (già filtrate per ambito).
export function applicaMacro(case_: Casa[], m: Macro): Casa[] {
  let r = porta(case_, m.pctFV, (d) => d.fotovoltaico, (d) => ({ ...d, fotovoltaico: true }))
  r = porta(r, m.pctSenzaGas, senzaGas, (d) => ({ ...d, riscaldamento: "pompa_calore", cottura: "induzione" }))
  r = porta(r, m.pctIsolamentoBuono, (d) => d.isolamento === "buono", (d) => ({ ...d, isolamento: "buono" }))
  return r
}

export const inAmbito = (m: Macro, comune: string) => m.ambito === "provincia" || m.ambito === comune
