import type { Fascia } from "../types"

export const FASCE: { fascia: Fascia; etichetta: string; intervallo: string; colore: string }[] = [
  { fascia: "ottima", etichetta: "Ottima", intervallo: "80–100", colore: "#2f9e57" },
  { fascia: "buona", etichetta: "Buona", intervallo: "60–79", colore: "#9bc53d" },
  { fascia: "media", etichetta: "Media", intervallo: "40–59", colore: "#f2c53d" },
  { fascia: "scarsa", etichetta: "Scarsa", intervallo: "20–39", colore: "#ee8434" },
  { fascia: "pessima", etichetta: "Pessima", intervallo: "0–19", colore: "#c0392b" },
]

export const coloreFascia = (f: Fascia) => FASCE.find((x) => x.fascia === f)!.colore
export const etichettaFascia = (f: Fascia) => FASCE.find((x) => x.fascia === f)!.etichetta
