import type { Classe, Dotazioni, PunteggioCasa } from "../types"
import { PESI, PESO_MASSIMO } from "./costanti"

export function puntiGrezzi(d: Dotazioni): number {
  return (
    (d.fotovoltaico ? PESI.fotovoltaico : 0) +
    (d.solareTermico ? PESI.solareTermico : 0) +
    PESI.riscaldamento[d.riscaldamento] +
    PESI.cottura[d.cottura] +
    PESI.isolamento[d.isolamento] +
    (d.infissi ? PESI.infissi : 0) +
    (d.colonninaEV ? PESI.colonninaEV : 0)
  )
}

// Sette fasce uniformi (100/7 ≈ 14,3 punti l'una), sul punteggio già arrotondato.
const SOGLIE_CLASSE: [number, Classe][] = [
  [86, "A"],
  [72, "B"],
  [58, "C"],
  [43, "D"],
  [29, "E"],
  [15, "F"],
]

export function classeDa(punteggio: number): Classe {
  return SOGLIE_CLASSE.find(([soglia]) => punteggio >= soglia)?.[1] ?? "G"
}

function mancanti(d: Dotazioni): PunteggioCasa["mancanti"] {
  // Punti grezzi guadagnabili passando alla scelta migliore di ogni dotazione.
  const grezzi: [string, number][] = [
    ["fotovoltaico", d.fotovoltaico ? 0 : PESI.fotovoltaico],
    ["solareTermico", d.solareTermico ? 0 : PESI.solareTermico],
    ["riscaldamento", PESI.riscaldamento.pompa_calore - PESI.riscaldamento[d.riscaldamento]],
    ["cottura", PESI.cottura.induzione - PESI.cottura[d.cottura]],
    ["isolamento", PESI.isolamento.buono - PESI.isolamento[d.isolamento]],
    ["infissi", d.infissi ? 0 : PESI.infissi],
    ["colonninaEV", d.colonninaEV ? 0 : PESI.colonninaEV],
  ]
  return grezzi
    .filter(([, g]) => g > 0)
    .sort((a, b) => b[1] - a[1]) // sort stabile: a parità vale l'ordine sopra
    .map(([dotazione, g]) => ({ dotazione, punti: Math.round((g / PESO_MASSIMO) * 100) }))
}

export function punteggioCasa(d: Dotazioni): PunteggioCasa {
  const punteggio = Math.round((puntiGrezzi(d) / PESO_MASSIMO) * 100)
  return { punteggio, classe: classeDa(punteggio), mancanti: mancanti(d) }
}
