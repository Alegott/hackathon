import type { Dotazioni, Scenario, TipoInfra, TipoStrada } from "../types"

// Pesi della checklist casa (SPEC → Punteggio casa). Congelati alle 16:30.
export const PESI = {
  fotovoltaico: 20,
  solareTermico: 10,
  riscaldamento: { pompa_calore: 20, condensazione: 8, tradizionale: 0 },
  cottura: { induzione: 8, gas: 0 },
  isolamento: { buono: 15, medio: 7, scarso: 0 },
  infissi: 9,
  colonninaEV: 10,
} as const

// I pesi della SPEC sommano a 92: si normalizza perché la casa perfetta faccia 100.
export const PESO_MASSIMO =
  PESI.fotovoltaico +
  PESI.solareTermico +
  PESI.riscaldamento.pompa_calore +
  PESI.cottura.induzione +
  PESI.isolamento.buono +
  PESI.infissi +
  PESI.colonninaEV

export const DELTA_INFRA: Record<TipoInfra, number> = {
  parco: 5,
  ciclabile: 3,
  colonnine: 2,
  industria: -12,
  strada: -3,
  // Netto: l'impianto pesa sul territorio (−4) ma produce energia pulita (+14).
  nucleare: 10,
}

// Beneficio diffuso a tutta la provincia per ogni centrale nucleare (energia pulita), con tetto.
export const ENERGIA_PULITA_PROVINCIA = 1
export const TETTO_ENERGIA_PULITA = 3

// Strade tracciate nello scenario: l'impatto cresce con la lunghezza, a seconda della tipologia.
export const STRADE: Record<
  TipoStrada,
  { etichetta: string; descrizione: string; perKm: number; larghezza: number; colore: string }
> = {
  urbana: { etichetta: "Urbana", descrizione: "traffico lento, impatto contenuto", perKm: -0.3, larghezza: 8, colore: "#6f757a" },
  provinciale: { etichetta: "Provinciale", descrizione: "collega i paesi", perKm: -0.6, larghezza: 11, colore: "#5d6469" },
  tangenziale: { etichetta: "Tangenziale", descrizione: "scorrimento veloce attorno ai centri", perKm: -1.2, larghezza: 16, colore: "#4b5258" },
  autostrada: { etichetta: "Autostrada", descrizione: "grande traffico, impatto massimo", perKm: -2, larghezza: 24, colore: "#383e43" },
}
export const IMPATTO_MINIMO_STRADA = -0.1
export const TETTO_IMPATTO_STRADA = -10

export function lunghezzaKm(tracciato: [number, number][]): number {
  let m = 0
  for (let i = 1; i < tracciato.length; i++)
    m += Math.hypot(tracciato[i]![0] - tracciato[i - 1]![0], tracciato[i]![1] - tracciato[i - 1]![1])
  return m / 1000
}

export function impattoStrada(tipo: TipoStrada, tracciato: [number, number][]): number {
  const impatto = STRADE[tipo].perKm * lunghezzaKm(tracciato)
  return Math.max(TETTO_IMPATTO_STRADA, Math.min(IMPATTO_MINIMO_STRADA, impatto))
}

// Delta di un'aggiunta dello scenario: le strade tracciate dipendono da tipo e lunghezza.
export function deltaAggiunta(a: Scenario["aggiunte"][number]): number {
  return a.strada ? impattoStrada(a.strada.tipo, a.strada.tracciato) : DELTA_INFRA[a.tipo]
}

export type ChiaveDotazione = keyof Dotazioni
