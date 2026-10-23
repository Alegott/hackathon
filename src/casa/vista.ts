import { classeAuto } from "../engine"
import type { Alimentazione, Classe, Dotazioni, Giardino, TipoAlbero } from "../types"

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
  // Alberi da piantare nel prato, nell'ordine dei posti liberi; null = niente giardino (cortile pavimentato).
  giardino: TipoAlbero[] | null
}

export const TIPI_ALBERO: TipoAlbero[] = ["latifoglia", "conifera", "frutto", "ulivo"]
// Posti per gli alberi attorno alla casa: oltre questo numero il modello non ne mostra altri.
export const MAX_ALBERI_VISIBILI = 16
// Giardino non ancora indicato: quello standard di sempre, due latifoglie e due conifere.
const GIARDINO_STANDARD: TipoAlbero[] = ["latifoglia", "conifera", "latifoglia", "conifera"]

// Alterna i tipi (uno per tipo a giro) così che, se i posti non bastano, ogni tipo resti visibile.
export function alberiDaPiantare(g: Giardino): TipoAlbero[] {
  const restanti = TIPI_ALBERO.map((t) => g.alberi[t] ?? 0)
  const out: TipoAlbero[] = []
  while (out.length < MAX_ALBERI_VISIBILI && restanti.some((n) => n > 0)) {
    TIPI_ALBERO.forEach((t, i) => {
      if (restanti[i]! > 0 && out.length < MAX_ALBERI_VISIBILI) { out.push(t); restanti[i]!-- }
    })
  }
  return out
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
    giardino: d.giardino === undefined ? GIARDINO_STANDARD : d.giardino === null ? null : alberiDaPiantare(d.giardino),
  }
}

export function elementiCambiati(prima: Dotazioni, dopo: Dotazioni): (keyof VistaCasa)[] {
  const a = descriviCasa(prima), b = descriviCasa(dopo)
  return (Object.keys(a) as (keyof VistaCasa)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
}
