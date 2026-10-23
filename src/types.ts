// Contratto A (dataset) e contratto B (motore indici). Vedi TASKS.md.

export type TipoInfra = "parco" | "ciclabile" | "colonnine" | "industria" | "strada" | "nucleare"

// Tipologie di strada tracciabili nello scenario: cambiano impatto, larghezza e aspetto.
// Industrie più comuni in Veneto: ognuna pesa in modo diverso sul territorio.
export type TipoIndustria = "artigianale" | "logistica" | "meccanica" | "conciaria"

export type TipoStrada = "urbana" | "provinciale" | "tangenziale" | "autostrada"

export type Alimentazione = "benzina" | "diesel" | "gpl" | "ibrido" | "elettrico"
export type CategoriaEuro = 0 | 1 | 2 | 3 | 4 | 5 | 6
export type Auto = { alimentazione: Alimentazione; euro: CategoriaEuro }
export type TipoAlbero = "latifoglia" | "conifera" | "frutto" | "ulivo"
export type Giardino = { alberi: Partial<Record<TipoAlbero, number>> }

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
  // null = nessun giardino; assente = non indicato (si mostra il giardino standard). Non pesa sul punteggio.
  giardino?: Giardino | null
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

// Cosa l'utente piazza nello scenario. Le forme (percorsi, contorni) sono in metri come le posizioni.
export type Aggiunta = {
  id: string
  comune: string
  tipo: TipoInfra
  posizione: [number, number]
  strada?: { tipo: TipoStrada; tracciato: [number, number][] }
  ciclabile?: { tracciato: [number, number][] }
  parco?: { contorno: [number, number][] }
  industria?: TipoIndustria
}

export type Scenario = {
  aggiunte: Aggiunta[]
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
