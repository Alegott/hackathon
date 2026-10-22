import type { Fascia } from "../types"

// Parametri visivi del diorama. Tutti numerici (colori in RGB 0–1) così si possono
// interpolare per le transizioni morbide.
export type PresetVisivo = {
  cielo: [number, number, number]
  nebbia: number // 0 nessuna – 1 fitta
  nuvole: { quantita: number; grigio: number } // quantita 0–1, grigio 0 bianche – 1 scure
  densitaAlberi: number // 0–1 rispetto al massimo
  fogliame: number // 1 chioma piena – 0 rami spogli
  uccelli: number
  animali: number
}

const PRESET: Record<Fascia, PresetVisivo> = {
  ottima: { cielo: [0.53, 0.81, 0.98], nebbia: 0, nuvole: { quantita: 0.5, grigio: 0 }, densitaAlberi: 1, fogliame: 1, uccelli: 10, animali: 6 },
  buona: { cielo: [0.58, 0.79, 0.93], nebbia: 0.05, nuvole: { quantita: 0.55, grigio: 0.15 }, densitaAlberi: 0.75, fogliame: 1, uccelli: 7, animali: 4 },
  media: { cielo: [0.72, 0.77, 0.82], nebbia: 0.2, nuvole: { quantita: 0.75, grigio: 0.45 }, densitaAlberi: 0.5, fogliame: 1, uccelli: 3, animali: 2 },
  scarsa: { cielo: [0.58, 0.6, 0.62], nebbia: 0.45, nuvole: { quantita: 1, grigio: 0.8 }, densitaAlberi: 0.25, fogliame: 1, uccelli: 1, animali: 0 },
  pessima: { cielo: [0.34, 0.32, 0.3], nebbia: 0.8, nuvole: { quantita: 1, grigio: 1 }, densitaAlberi: 0.25, fogliame: 0, uccelli: 0, animali: 0 },
}

export const presetFascia = (fascia: Fascia): PresetVisivo => PRESET[fascia]

// Aspetto della provincia vista dall'alto, senza diorama.
export const PRESET_PROVINCIA: PresetVisivo = {
  cielo: [0.875, 0.918, 0.949],
  nebbia: 0,
  nuvole: { quantita: 0, grigio: 0 },
  densitaAlberi: 0,
  fogliame: 1,
  uccelli: 0,
  animali: 0,
}

const VELOCITA = 2.5 // più alto = transizione più rapida (1/s)
const SOGLIA = 1e-3

const verso = (x: number, y: number, f: number) => {
  const r = x + (y - x) * f
  return Math.abs(y - r) < SOGLIA ? y : r
}

// Avvicina esponenzialmente `corrente` a `obiettivo`: non oltrepassa mai il bersaglio e lo
// raggiunge esattamente quando è abbastanza vicino, così il rendering può fermarsi.
export function avanzaPreset(corrente: PresetVisivo, obiettivo: PresetVisivo, dt: number): PresetVisivo {
  const f = 1 - Math.exp(-VELOCITA * Math.max(0, dt))
  const v = (x: number, y: number) => verso(x, y, f)
  return {
    cielo: [v(corrente.cielo[0], obiettivo.cielo[0]), v(corrente.cielo[1], obiettivo.cielo[1]), v(corrente.cielo[2], obiettivo.cielo[2])],
    nebbia: v(corrente.nebbia, obiettivo.nebbia),
    nuvole: {
      quantita: v(corrente.nuvole.quantita, obiettivo.nuvole.quantita),
      grigio: v(corrente.nuvole.grigio, obiettivo.nuvole.grigio),
    },
    densitaAlberi: v(corrente.densitaAlberi, obiettivo.densitaAlberi),
    fogliame: v(corrente.fogliame, obiettivo.fogliame),
    uccelli: v(corrente.uccelli, obiettivo.uccelli),
    animali: v(corrente.animali, obiettivo.animali),
  }
}
