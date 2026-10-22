// Specie rare del Vicentino e regole di spawn: logica pura, senza React né Three.

export type InfoSpecieRara = {
  id: "salamandra_aurora" | "gallo_cedrone" | "lince_alpina" | "aquila_reale"
  nome: string
  nomeScientifico: string
  habitatVicentino: string
  sogliaSpawn: number // spawnRate minimo (0..1) per comparire
}

export const SPECIE_RARE_VICENZA: InfoSpecieRara[] = [
  {
    id: "gallo_cedrone",
    nome: "Gallo Cedrone",
    nomeScientifico: "Tetrao urogallus",
    habitatVicentino: "Boschi vetusti dell'Altopiano di Asiago e Pasubio",
    sogliaSpawn: 0.25,
  },
  {
    id: "aquila_reale",
    nome: "Aquila Reale",
    nomeScientifico: "Aquila chrysaetos",
    habitatVicentino: "Piccole Dolomiti, Carega e Monte Grappa",
    sogliaSpawn: 0.45,
  },
  {
    id: "lince_alpina",
    nome: "Lince Alpina",
    nomeScientifico: "Lynx lynx",
    habitatVicentino: "Foreste montane tra Lessinia e Altopiano",
    sogliaSpawn: 0.65,
  },
  {
    id: "salamandra_aurora",
    nome: "Salamandra Nera di Aurora",
    nomeScientifico: "Salamandra atra aurorae",
    habitatVicentino: "Endemismo esclusivo dell'Altopiano dei Sette Comuni (CR)",
    sogliaSpawn: 0.8,
  },
]

/**
 * Calcola lo spawn rate (0..1) e le specie in via d'estinzione attive nel comune
 * quando la qualità dell'aria è alta e l'inquinamento da infrastrutture è basso.
 */
export function calcolaSpawnSpecieRare(stato: {
  aria: number
  infrastrutture: number
  scenario: number
  totale: number
}): {
  spawnRate: number
  specieAttive: InfoSpecieRara[]
} {
  const bilancioInquinamento = stato.infrastrutture + stato.scenario
  if (stato.totale < 65 || stato.aria < 55 || bilancioInquinamento < -6) {
    return { spawnRate: 0, specieAttive: [] }
  }

  const fattoreTotale = Math.min(1, Math.max(0, (stato.totale - 64) / 28))
  const fattoreAria = Math.min(1, Math.max(0, (stato.aria - 54) / 36))
  const bonusNatura = Math.min(0.2, Math.max(-0.25, bilancioInquinamento * 0.02))

  const spawnRate =
    Math.round(
      Math.min(1, Math.max(0, fattoreTotale * 0.65 + fattoreAria * 0.35 + bonusNatura)) * 100,
    ) / 100

  const specieAttive = SPECIE_RARE_VICENZA.filter((sp) => spawnRate >= sp.sogliaSpawn)
  return { spawnRate, specieAttive }
}
