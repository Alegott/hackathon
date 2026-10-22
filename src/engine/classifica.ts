import type { Casa, RigaClassifica } from "../types"
import { punteggioCasa } from "./casa"

// Pubblici in testa per punteggio; i privati in coda, nell'ordine di input, così
// la posizione non rivela nulla sul loro punteggio.
export function classifica(case_: Casa[], comune: string): RigaClassifica[] {
  const delComune = case_.filter((c) => c.comune === comune)
  const pubbliche = delComune
    .filter((c) => c.pubblico)
    .map((c) => ({ nome: c.nickname, punteggio: punteggioCasa(c.dotazioni).punteggio, dotazioni: c.dotazioni }))
    .sort((a, b) => b.punteggio - a.punteggio)
  const private_ = delComune.filter((c) => !c.pubblico).map((c) => ({ dotazioni: c.dotazioni }))
  return [...pubbliche, ...private_]
}
