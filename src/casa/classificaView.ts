import { punteggioCasa } from "../engine"
import type { Casa, Classe, Dotazioni } from "../types"

export type Medaglia = "oro" | "argento" | "bronzo"

export type RigaPubblica = {
  tipo: "pubblica"
  id: string
  nome: string
  punteggio: number
  classe: Classe
  posizione: number
  medaglia: Medaglia | null
  dotazioni: Dotazioni
  mia: boolean
}
// Il profilo privato espone solo le dotazioni: niente nome, punteggio, classe né posizione.
export type RigaPrivata = { tipo: "privata"; dotazioni: Dotazioni; mia: boolean }
export type RigaVista = RigaPubblica | RigaPrivata

export type Riepilogo = {
  pubblico: boolean
  posizione: number | null // null se il profilo è privato: non è in classifica
  su: number // quante case pubbliche ci sono in classifica
  punteggio: number
  classe: Classe
  differenzaDallaMedia: number
}

const MEDAGLIE: (Medaglia | null)[] = [null, "oro", "argento", "bronzo"]

// Prepara i dati per la grafica della classifica comunale applicando le regole di privacy: le
// pubbliche sono ordinate per punteggio (a pari punteggio condividono la posizione), le private
// vengono dopo, anonime.
export function preparaClassifica(i: { case: Casa[]; comune: string; utenteId: string | null }) {
  // Una casa con lo stesso id compare una volta sola (vale l'ultima: è quella dell'utente).
  const perId = new Map<string, Casa>()
  for (const c of i.case) if (c.comune === i.comune) perId.set(c.id, c)
  const delComune = [...perId.values()]
  const pubbliche = delComune
    .filter((c) => c.pubblico)
    .map((c) => ({ c, punteggio: punteggioCasa(c.dotazioni).punteggio }))
    .sort((a, b) => b.punteggio - a.punteggio)
  const righePubbliche: RigaPubblica[] = pubbliche.map(({ c, punteggio }) => {
    const posizione = 1 + pubbliche.filter((x) => x.punteggio > punteggio).length
    return {
      tipo: "pubblica",
      id: c.id,
      nome: c.nickname || "Casa pubblica",
      punteggio,
      classe: punteggioCasa(c.dotazioni).classe,
      posizione,
      medaglia: MEDAGLIE[posizione] ?? null,
      dotazioni: c.dotazioni,
      mia: c.id === i.utenteId,
    }
  })
  const righePrivate: RigaPrivata[] = delComune
    .filter((c) => !c.pubblico)
    .map((c) => ({ tipo: "privata", dotazioni: c.dotazioni, mia: c.id === i.utenteId }))
  const punteggi = delComune.map((c) => punteggioCasa(c.dotazioni).punteggio)
  const mediaComune = punteggi.length ? Math.round(punteggi.reduce((a, b) => a + b, 0) / punteggi.length) : 0
  const mia = i.utenteId ? delComune.find((c) => c.id === i.utenteId) : undefined
  let riepilogo: Riepilogo | null = null
  if (mia) {
    const { punteggio, classe } = punteggioCasa(mia.dotazioni)
    const rigaMia = righePubbliche.find((r) => r.mia)
    riepilogo = {
      pubblico: mia.pubblico,
      posizione: rigaMia?.posizione ?? null,
      su: righePubbliche.length,
      punteggio,
      classe,
      differenzaDallaMedia: punteggio - mediaComune,
    }
  }
  return {
    righe: [...righePubbliche, ...righePrivate] as RigaVista[],
    podio: righePubbliche.slice(0, 3),
    mediaComune,
    riepilogo,
  }
}
