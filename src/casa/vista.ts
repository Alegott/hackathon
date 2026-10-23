import { classeAuto } from "../engine"
import type { Alimentazione, Classe, Dotazioni } from "../types"

// Cosa mostra il modello 3D della casa: una descrizione piatta, senza dettagli di rendering.
export type VistaCasa = {
  pannelliFV: boolean
  collettoreSolare: boolean
  impiantoTermico: "pompa_calore" | "caldaia_condensazione" | "caldaia_tradizionale"
  cottura: "induzione" | "gas"
  rivestimento: "mattone" | "intonaco" | "cappotto"
  vetri: "semplici" | "doppi"
  colonnina: boolean
  // L'aspetto dell'auto dipende dalla sua classe (A elettrica e moderna … G vecchia e fumosa).
  auto: { classe: Classe; alimentazione: Alimentazione } | null
}

const IMPIANTO = {
  pompa_calore: "pompa_calore",
  condensazione: "caldaia_condensazione",
  tradizionale: "caldaia_tradizionale",
} as const

const RIVESTIMENTO = { scarso: "mattone", medio: "intonaco", buono: "cappotto" } as const

export function descriviCasa(d: Dotazioni): VistaCasa {
  return {
    pannelliFV: d.fotovoltaico,
    collettoreSolare: d.solareTermico,
    impiantoTermico: IMPIANTO[d.riscaldamento],
    cottura: d.cottura,
    rivestimento: RIVESTIMENTO[d.isolamento],
    vetri: d.infissi ? "doppi" : "semplici",
    colonnina: d.colonninaEV,
    auto: d.auto ? { classe: classeAuto(d.auto), alimentazione: d.auto.alimentazione } : null,
  }
}

export function elementiCambiati(prima: Dotazioni, dopo: Dotazioni): (keyof VistaCasa)[] {
  const a = descriviCasa(prima), b = descriviCasa(dopo)
  return (Object.keys(a) as (keyof VistaCasa)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}
