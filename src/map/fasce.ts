import type { Fascia } from "../types"

export const FASCE: { fascia: Fascia; etichetta: string; intervallo: string; colore: string }[] = [
  { fascia: "ottima", etichetta: "Ottima", intervallo: "80–100", colore: "#38bdf8" },
  { fascia: "buona", etichetta: "Buona", intervallo: "60–79", colore: "#40b875" },
  { fascia: "media", etichetta: "Media", intervallo: "40–59", colore: "#f2c53d" },
  { fascia: "scarsa", etichetta: "Scarsa", intervallo: "20–39", colore: "#e64848" },
  { fascia: "pessima", etichetta: "Pessima", intervallo: "0–19", colore: "#873aab" },
]

// Venti intervalli visivi di cinque punti; le cinque classi del motore restano compatibili.
const COLORI = ["#652581", "#793298", "#903daf", "#a846a2", "#c9447c", "#df4560", "#ed5146", "#f06b3e", "#f58b3e", "#f5af40", "#f2c53d", "#d4cd43", "#a6cd50", "#77c65e", "#40b875", "#30b497", "#2db9b3", "#32bdce", "#38bdf8", "#68d4ff"]
export const SCALA_COLORI = COLORI.map((colore, i) => ({ min: i * 5, max: (i + 1) * 5, colore }))
export function colorePunteggio(valore: number): string {
  if (!Number.isFinite(valore)) return "#94a3b8"
  return SCALA_COLORI[Math.min(19, Math.floor(Math.max(0, valore) / 5))]!.colore
}

export const coloreFascia = (f: Fascia) => FASCE.find((x) => x.fascia === f)!.colore
export const etichettaFascia = (f: Fascia) => FASCE.find((x) => x.fascia === f)!.etichetta
