// Contratto A (dataset) e contratto B (motore indici). Vedi TASKS.md.

export type TipoInfra = "parco" | "ciclabile" | "colonnine" | "industria" | "strada"

export type Alimentazione = "benzina" | "diesel" | "gpl" | "ibrido" | "elettrico"
export type CategoriaEuro = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type Auto = { alimentazione: Alimentazione; euro: CategoriaEuro }

export type Dotazioni = {
  fotovoltaico: boolean
  solareTermico: boolean
  riscaldamento: "pompa_calore" | "condensazione" | "tradizionale"
  cottura: "induzione" | "gas"
  isolamento: "buono" | "medio" | "scarso"
  infissi: boolean
  colonninaEV: boolean
  // Assente o null = nessuna auto: in quel caso l'auto non pesa sul punteggio.
  auto?: Auto | null
}

export type Casa = {
  id: string
  comune: string
  pubblico: boolean
  nickname?: string
  dotazioni: Dotazioni
}

export type Comune = {
  istat: string
  nome: string
  geometria: [number, number][][]
  centroide: [number, number]
  confinanti: string[]
  ariaNorm: number
  pm10: number
  nCentraline: number
}

export type Infrastruttura = {
  id: string
  comune: string
  tipo: TipoInfra
  posizione: [number, number]
}

export type Dataset = {
  meta: { periodoAria: string; inquinante: "PM10" | "PM10+NO2"; generatoIl: string }
  comuni: Comune[]
  infrastrutture: Infrastruttura[]
  caseSeed: Casa[]
}

export type Scenario = {
  aggiunte: { id: string; comune: string; tipo: TipoInfra; posizione: [number, number] }[]
  rimozioni: string[]
  macro: {
    ambito: "provincia" | string
    pctFV: number
    pctSenzaGas: number
    pctIsolamentoBuono: number
  } | null
}

export type Classe = "A" | "B" | "C" | "D" | "E" | "F" | "G"
export type Fascia = "ottima" | "buona" | "media" | "scarsa" | "pessima"

export type PunteggioCasa = {
  punteggio: number
  classe: Classe
  mancanti: { dotazione: string; punti: number }[]
}

export type StatoComune = {
  aria: number
  infrastrutture: number
  scenario: number
  totale: number
  fascia: Fascia
  indiceCaseMedio: number
}

export type RigaClassifica = { nome?: string; punteggio?: number; dotazioni: Dotazioni }
