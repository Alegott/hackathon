import type { StatoComune } from "../types"

// Livelli del paesaggio sonoro (0–1), derivati dallo stato della zona ascoltata. Funzione pura.
export type Livelli = { uccelli: number; traffico: number; industria: number; vento: number }
export type Zona = { stato: StatoComune | null; industrie: number; strade: number }

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

export function livelliZona({ stato, industrie, strade }: Zona): Livelli {
  const totale = stato?.totale ?? 60
  // Stessa soglia della fauna: sotto 20 punti niente animali.
  const vita = clamp01((totale - 20) / 80)
  const smog = 1 - totale / 100
  return {
    uccelli: vita ** 1.4,
    traffico: clamp01(0.08 + smog * 0.7 + strade * 0.08),
    industria: clamp01(industrie * 0.35),
    vento: 0.35 + 0.3 * vita,
  }
}

// Descrizione breve di ciò che si sente, per l'etichetta accanto al pulsante.
export function descriviLivelli(l: Livelli): string {
  const parti: string[] = []
  if (l.uccelli > 0.6) parti.push("tanti uccelli")
  else if (l.uccelli > 0.25) parti.push("qualche uccello")
  else if (l.uccelli > 0.02) parti.push("uccelli rari")
  else parti.push("nessun uccello")
  if (l.traffico > 0.55) parti.push("traffico intenso")
  else if (l.traffico > 0.3) parti.push("traffico")
  if (l.industria > 0) parti.push("industria")
  return parti.join(" · ")
}
