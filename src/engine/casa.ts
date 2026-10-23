import type { Auto, Classe, Dotazioni, PunteggioCasa } from "../types"
import { PESI, PESI_AUTO, PESO_MASSIMO, PESO_MASSIMO_AUTO } from "./costanti"

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

export function puntiAuto(a: Auto): number {
  if (a.alimentazione === "elettrico") return PESO_MASSIMO_AUTO
  return PESI_AUTO.alimentazione[a.alimentazione] + PESI_AUTO.euro[a.euro]
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

// Classe dell'auto da sola, con la stessa scala della casa: decide anche il suo aspetto 3D.
export const classeAuto = (a: Auto): Classe => classeDa(Math.round((puntiAuto(a) / PESO_MASSIMO_AUTO) * 100))

// Chi ha un'auto la vede pesare sul punteggio; chi non ce l'ha resta sulla sola casa.
const pesoMassimo = (d: Dotazioni) => PESO_MASSIMO + (d.auto ? PESO_MASSIMO_AUTO : 0)

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
    ["auto", d.auto ? PESO_MASSIMO_AUTO - puntiAuto(d.auto) : 0],
  ]
  const massimo = pesoMassimo(d)
  return grezzi
    .filter(([, g]) => g > 0)
    .sort((a, b) => b[1] - a[1]) // sort stabile: a parità vale l'ordine sopra
    .map(([dotazione, g]) => ({ dotazione, punti: Math.round((g / massimo) * 100) }))
}

export function punteggioCasa(d: Dotazioni): PunteggioCasa {
  const grezzi = puntiGrezzi(d) + (d.auto ? puntiAuto(d.auto) : 0)
  const punteggio = Math.round((grezzi / pesoMassimo(d)) * 100)
  return { punteggio, classe: classeDa(punteggio), mancanti: mancanti(d) }
}
