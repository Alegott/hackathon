import type { Aggiunta, Dotazioni, TipoIndustria, TipoInfra, TipoStrada } from "../types"

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

// Industrie tipiche del Veneto, dalla più leggera alla più impattante.
export const INDUSTRIE: Record<TipoIndustria, { etichetta: string; descrizione: string; delta: number }> = {
  artigianale: { etichetta: "Artigianale", descrizione: "capannoni di PMI e laboratori", delta: -4 },
  logistica: { etichetta: "Logistica", descrizione: "magazzini e traffico di camion", delta: -6 },
  meccanica: { etichetta: "Metalmeccanica", descrizione: "fonderie e officine", delta: -9 },
  conciaria: { etichetta: "Conciaria", descrizione: "distretto della pelle (Valle del Chiampo)", delta: -14 },
}

// Pista ciclabile tracciata: beneficio per chilometro, con minimo e tetto.
export const CICLABILE_PER_KM = 0.6
export const TETTO_CICLABILE = 5
export const impattoCiclabile = (tracciato: [number, number][]) =>
  Math.min(TETTO_CICLABILE, Math.max(0.1, CICLABILE_PER_KM * lunghezzaKm(tracciato)))

// Parco disegnato: il beneficio cresce con l'area (ettari), ma sempre meno che proporzionalmente.
export const TETTO_PARCO = 10
export function areaEttari(contorno: [number, number][]): number {
  let a = 0
  for (let i = 0; i < contorno.length; i++) {
    const [x1, y1] = contorno[i]!, [x2, y2] = contorno[(i + 1) % contorno.length]!
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2 / 10000
}
export const impattoParco = (contorno: [number, number][]) =>
  Math.min(TETTO_PARCO, Math.max(0.2, 2.5 * Math.sqrt(areaEttari(contorno))))

// Delta di un'aggiunta dello scenario: forme e varianti pesano in modo diverso dal valore base.
export function deltaAggiunta(a: Aggiunta): number {
  if (a.strada) return impattoStrada(a.strada.tipo, a.strada.tracciato)
  if (a.ciclabile) return impattoCiclabile(a.ciclabile.tracciato)
  if (a.parco) return impattoParco(a.parco.contorno)
  if (a.industria) return INDUSTRIE[a.industria].delta
  return DELTA_INFRA[a.tipo]
}

export type ChiaveDotazione = keyof Dotazioni
