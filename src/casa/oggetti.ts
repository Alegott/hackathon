import type { Dotazioni } from "../types"

// Gli oggetti della palette: ciò che si può cliccare o trascinare sulla casa.
export const OGGETTI = [
  "fotovoltaico", "solareTermico",
  "pompa_calore", "condensazione", "tradizionale",
  "induzione", "gas",
  "isolamento_buono", "isolamento_medio", "isolamento_scarso",
  "infissi", "colonninaEV",
] as const
export type Oggetto = (typeof OGGETTI)[number]

export const èOggetto = (x: unknown): x is Oggetto => typeof x === "string" && (OGGETTI as readonly string[]).includes(x)

type Effetto = { [K in keyof Dotazioni]: { chiave: K; valore: Dotazioni[K]; peggiore: Dotazioni[K] } }[keyof Dotazioni]

const EFFETTI: Record<Oggetto, Effetto> = {
  fotovoltaico: { chiave: "fotovoltaico", valore: true, peggiore: false },
  solareTermico: { chiave: "solareTermico", valore: true, peggiore: false },
  infissi: { chiave: "infissi", valore: true, peggiore: false },
  colonninaEV: { chiave: "colonninaEV", valore: true, peggiore: false },
  pompa_calore: { chiave: "riscaldamento", valore: "pompa_calore", peggiore: "tradizionale" },
  condensazione: { chiave: "riscaldamento", valore: "condensazione", peggiore: "tradizionale" },
  tradizionale: { chiave: "riscaldamento", valore: "tradizionale", peggiore: "tradizionale" },
  induzione: { chiave: "cottura", valore: "induzione", peggiore: "gas" },
  gas: { chiave: "cottura", valore: "gas", peggiore: "gas" },
  isolamento_buono: { chiave: "isolamento", valore: "buono", peggiore: "scarso" },
  isolamento_medio: { chiave: "isolamento", valore: "medio", peggiore: "scarso" },
  isolamento_scarso: { chiave: "isolamento", valore: "scarso", peggiore: "scarso" },
}

export const applicaOggetto = (d: Dotazioni, o: Oggetto): Dotazioni => ({ ...d, [EFFETTI[o].chiave]: EFFETTI[o].valore })

// Toglie l'oggetto solo se è quello installato: riporta la dotazione alla scelta peggiore.
export function togliOggetto(d: Dotazioni, o: Oggetto): Dotazioni {
  const e = EFFETTI[o]
  return d[e.chiave] === e.valore ? { ...d, [e.chiave]: e.peggiore } : d
}
