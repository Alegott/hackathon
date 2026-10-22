import type { Classe } from "../types"

// L'ambiente intorno alla casa riflette la classe: sole in A–B, cielo velato in C–D, grigio in E–G.
export type Meteo = "sereno" | "velato" | "grigio"

export function meteoDaClasse(classe: Classe): Meteo {
  if (classe === "A" || classe === "B") return "sereno"
  if (classe === "C" || classe === "D") return "velato"
  return "grigio"
}
