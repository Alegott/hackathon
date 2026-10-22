import type { Casa, Comune, Dataset, Dotazioni, Infrastruttura, Scenario, TipoInfra } from "../types"

export const dotNulle: Dotazioni = {
  fotovoltaico: false,
  solareTermico: false,
  riscaldamento: "tradizionale",
  cottura: "gas",
  isolamento: "scarso",
  infissi: false,
  colonninaEV: false,
}

export const comune = (istat: string, ariaNorm: number, confinanti: string[]): Comune => ({
  istat,
  nome: `Comune ${istat}`,
  geometria: [],
  centroide: [0, 0],
  confinanti,
  ariaNorm,
  pm10: 0,
  nCentraline: 1,
})

export const infra = (id: string, comune: string, tipo: TipoInfra): Infrastruttura => ({
  id,
  comune,
  tipo,
  posizione: [0, 0],
})

export const casaSeed = (id: string, comune: string, d: Partial<Dotazioni> = {}): Casa => ({
  id,
  comune,
  pubblico: true,
  nickname: id,
  dotazioni: { ...dotNulle, ...d },
})

// Catena A – B – C e un comune D isolato.
export const dataset = (over: Partial<Dataset> = {}): Dataset => ({
  meta: { periodoAria: "test", inquinante: "PM10", generatoIl: "test" },
  comuni: [comune("A", 50, ["B"]), comune("B", 50, ["A", "C"]), comune("C", 50, ["B"]), comune("D", 50, [])],
  infrastrutture: [],
  caseSeed: [],
  ...over,
})

export const scenarioVuoto: Scenario = { aggiunte: [], rimozioni: [], macro: null }
