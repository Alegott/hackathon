import type { StatoComune } from "../types"
import { presetAria, type PresetVisivo } from "../diorama/preset"

// Regia illustrativa condivisa: quantità e aspetto seguono il totale ambientale.
export function presetSostenibilita(totale: number): PresetVisivo {
  const valore = Math.max(0, Math.min(100, Number.isFinite(totale) ? totale : 0))
  const vita = Math.max(0, (valore - 20) / 80)
  return {
    ...presetAria(valore),
    nuvole: { quantita: .25 + .75 * (1 - valore / 100), grigio: 1 - valore / 100 },
    densitaAlberi: .12 + .88 * vita,
    fogliame: Math.min(1, valore / 60),
    animali: Math.round(24 * vita),
    uccelli: Math.round(36 * vita),
  }
}

export const sostenibilitaStato = (stato: StatoComune) => presetSostenibilita(stato.totale)

// Scala neutra completa: bianco → grigi → quasi nero, prima dell'ombreggiatura.
export function coloreNuvola(grigio: number): string {
  const canale = Math.round(255 * (1 - Math.max(0, Math.min(1, grigio)) * .97))
  return `#${canale.toString(16).padStart(2, "0").repeat(3)}`
}
