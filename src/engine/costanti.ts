import type { Dotazioni, TipoInfra } from "../types"

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

// Auto: alimentazione + categoria Euro. L'elettrica prende sempre il massimo (zero emissioni allo
// scarico), quindi per lei la categoria Euro non conta.
export const PESI_AUTO = {
  alimentazione: { elettrico: 6, ibrido: 4, gpl: 3, benzina: 2, diesel: 0 },
  euro: [0, 0, 1, 2, 3, 4, 6],
} as const
export const PESO_MASSIMO_AUTO = PESI_AUTO.alimentazione.elettrico + PESI_AUTO.euro[6]

export const DELTA_INFRA: Record<TipoInfra, number> = {
  parco: 5,
  ciclabile: 3,
  colonnine: 2,
  industria: -12,
  strada: -8,
}

export type ChiaveDotazione = keyof Dotazioni
