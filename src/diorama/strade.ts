import { estensione, puntoInPoligono, type Punto } from "./geometria"
import type { Ostacolo } from "./posizioniAlberi"
import type { Casa, TipoInfra } from "../types"

export type TrattoStradale = {
  id: string
  tipo: "strada" | "ciclabile"
  punti: Punto[] // polilinea continua in coordinate di scena (x, z)
  larghezza: number
}

export type CasaDiorama = {
  id: string
  posizione: Punto
  rotazioneY: number
  raggio: number
  fotovoltaico: boolean
  solareTermico: boolean
  colonninaEV: boolean
  isCasaUtente: boolean
  variante: 0 | 1 | 2
}

// Generatore pseudo-casuale deterministico (mulberry32)
function casuale(seme: number) {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Trova il punto di intersezione (o il punto più lontano dentro il poligono) lungo una direzione
function estendiFinoAlBordo(
  origine: Punto,
  dir: Punto,
  anello: Punto[],
  maxDist: number,
): Punto {
  const passi = 28
  let ultimoDentro: Punto = origine
  for (let i = 1; i <= passi; i++) {
    const d = (maxDist * i) / passi
    const candidato: Punto = [origine[0] + dir[0] * d, origine[1] + dir[1] * d]
    if (puntoInPoligono(candidato, anello)) {
      ultimoDentro = candidato
    } else {
      break
    }
  }
  return ultimoDentro
}

// Interpola una curva morbida Catmull-Rom attraverso una lista di punti di controllo
export function smussaPolilinea(controllo: Punto[], suddivisioni = 8): Punto[] {
  if (controllo.length <= 2) return controllo
  const out: Punto[] = []
  for (let i = 0; i < controllo.length - 1; i++) {
    const p0 = controllo[Math.max(0, i - 1)]!
    const p1 = controllo[i]!
    const p2 = controllo[i + 1]!
    const p3 = controllo[Math.min(controllo.length - 1, i + 2)]!
    for (let s = 0; s < suddivisioni; s++) {
      const t = s / suddivisioni
      const t2 = t * t
      const t3 = t2 * t
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
      const z =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      out.push([x, z])
    }
  }
  out.push(controllo[controllo.length - 1]!)
  return out
}

/**
 * Costruisce tracciati continui e realistici per strade e piste ciclabili:
 * - Se ci sono più nodi dello stesso tipo nel comune, li collega in un'arteria unica continua
 *   e prolunga le due estremità verso i confini del comune.
 * - Se c'è un solo nodo, genera un'arteria curvilinea realistica che attraversa il nodo
 *   da un versante all'altro del comune.
 */
export function costruisciReteStradale(opz: {
  infra: { id: string; tipo: TipoInfra; scena: Punto }[]
  anello: Punto[]
  centro: Punto
  dimensione: number
  s: number
}): TrattoStradale[] {
  const { infra, anello, centro, dimensione, s } = opz
  const tratti: TrattoStradale[] = []

  for (const tipo of ["strada", "ciclabile"] as const) {
    const nodi = infra.filter((i) => i.tipo === tipo)
    if (nodi.length === 0) continue

    const larghezza = tipo === "strada" ? 0.95 * s : 0.52 * s
    const ordinati = [...nodi].sort((a, b) => a.scena[0] - b.scena[0] || a.scena[1] - b.scena[1])

    if (ordinati.length === 1) {
      const n = ordinati[0]!
      const hash = Math.abs(Math.sin(n.scena[0] * 12.9898 + n.scena[1] * 78.233))
      const angolo = hash * Math.PI
      const dir: Punto = [Math.cos(angolo), Math.sin(angolo)]
      const perp: Punto = [-dir[1], dir[0]]

      const inizio = estendiFinoAlBordo(n.scena, [-dir[0], -dir[1]], anello, dimensione * 0.42)
      const fine = estendiFinoAlBordo(n.scena, dir, anello, dimensione * 0.42)

      const curv = (hash - 0.5) * dimensione * 0.08
      const m1: Punto = [
        (inizio[0] + n.scena[0]) * 0.5 + perp[0] * curv,
        (inizio[1] + n.scena[1]) * 0.5 + perp[1] * curv,
      ]
      const m2: Punto = [
        (n.scena[0] + fine[0]) * 0.5 - perp[0] * curv * 0.7,
        (n.scena[1] + fine[1]) * 0.5 - perp[1] * curv * 0.7,
      ]

      const controllo: Punto[] = [
        inizio,
        puntoInPoligono(m1, anello) ? m1 : n.scena,
        n.scena,
        puntoInPoligono(m2, anello) ? m2 : n.scena,
        fine,
      ]
      tratti.push({
        id: n.id,
        tipo,
        punti: smussaPolilinea(controllo, 10),
        larghezza,
      })
    } else {
      const primo = ordinati[0]!
      const ultimo = ordinati[ordinati.length - 1]!
      const dx = ultimo.scena[0] - primo.scena[0]
      const dz = ultimo.scena[1] - primo.scena[1]
      const len = Math.hypot(dx, dz) || 1
      const dir: Punto = [dx / len, dz / len]

      const inizio = estendiFinoAlBordo(
        primo.scena,
        [-dir[0], -dir[1]],
        anello,
        dimensione * 0.28,
      )
      const fine = estendiFinoAlBordo(ultimo.scena, dir, anello, dimensione * 0.28)

      const controllo: Punto[] = [inizio]
      for (let i = 0; i < ordinati.length; i++) {
        const curr = ordinati[i]!.scena
        controllo.push(curr)
        if (i < ordinati.length - 1) {
          const next = ordinati[i + 1]!.scena
          const mid: Punto = [
            (curr[0] + next[0]) * 0.45 + centro[0] * 0.1,
            (curr[1] + next[1]) * 0.45 + centro[1] * 0.1,
          ]
          if (puntoInPoligono(mid, anello)) controllo.push(mid)
        }
      }
      controllo.push(fine)

      tratti.push({
        id: primo.id,
        tipo,
        punti: smussaPolilinea(controllo, 10),
        larghezza,
      })
    }
  }

  return tratti
}

/**
 * Genera le posizioni realistiche delle case (abitazioni residenziali del comune + eventuale casa utente),
 * disponendole lungo i tratti stradali o in borghi residenziali, senza mai sovrapporsi a strade,
 * industrie, parchi o altre strutture.
 */
export function calcolaPosizioniCase(opz: {
  anello: Punto[]
  infra: { id: string; tipo: TipoInfra; scena: Punto }[]
  trattiStradali: TrattoStradale[]
  caseComune: Casa[]
  casaUtente?: Casa | null
  pctFV?: number
  seme: number
  s: number
  dimensione: number
}): CasaDiorama[] {
  const {
    anello,
    infra,
    trattiStradali,
    caseComune,
    casaUtente,
    pctFV = 0,
    seme,
    s,
    dimensione,
  } = opz
  if (anello.length < 3) return []

  const rnd = casuale(seme ^ 0x9e3779b9)
  const raggioCasa = Math.max(1.15 * s, dimensione * 0.048)

  // Ostacoli da evitare quando posizioniamo una casa (infrastrutture + nastro stradale)
  const occupati: Ostacolo[] = []
  for (const i of infra) {
    const r =
      i.tipo === "industria"
        ? Math.max(dimensione * 0.12, 2.5 * s)
        : i.tipo === "parco"
          ? Math.max(dimensione * 0.11, 2.6 * s)
          : Math.max(dimensione * 0.075, 1.5 * s)
    occupati.push({ posizione: i.scena, raggio: r })
  }
  for (const tratto of trattiStradali) {
    const rCorr = tratto.larghezza * 0.95 + raggioCasa * 0.85
    for (const p of tratto.punti) {
      occupati.push({ posizione: p, raggio: rCorr })
    }
  }

  // Lista di case da rappresentare: prima eventuale casaUtente, poi caseSeed del comune,
  // più un nucleo urbano minimo (fino a 10 abitazioni) per rendere il paese realistico
  const listaCase: {
    id: string
    fotovoltaico: boolean
    solareTermico: boolean
    colonninaEV: boolean
    isCasaUtente: boolean
  }[] = []

  if (casaUtente) {
    listaCase.push({
      id: casaUtente.id,
      fotovoltaico: casaUtente.dotazioni.fotovoltaico,
      solareTermico: casaUtente.dotazioni.solareTermico,
      colonninaEV: casaUtente.dotazioni.colonninaEV,
      isCasaUtente: true,
    })
  }
  for (const c of caseComune) {
    if (casaUtente && c.id === casaUtente.id) continue
    listaCase.push({
      id: c.id,
      fotovoltaico: c.dotazioni.fotovoltaico,
      solareTermico: c.dotazioni.solareTermico,
      colonninaEV: c.dotazioni.colonninaEV,
      isCasaUtente: false,
    })
  }

  const targetCount = Math.min(12, Math.max(8, listaCase.length))
  while (listaCase.length < targetCount) {
    const idx = listaCase.length
    const haFV = pctFV > 0 ? (idx * 17) % 100 < pctFV : idx % 3 === 0
    listaCase.push({
      id: `borgo-${seme}-${idx}`,
      fotovoltaico: haFV,
      solareTermico: idx % 4 === 0,
      colonninaEV: idx % 5 === 0,
      isCasaUtente: false,
    })
  }

  const { minX, maxX, minY, maxY } = estensione(anello)
  const risultato: CasaDiorama[] = []

  // Candidati preferenziali a fianco delle strade (a distanza sicura dal bordo strada)
  const candidatiStrada: { pos: Punto; rotY: number }[] = []
  for (const tratto of trattiStradali) {
    const offsetLaterale = tratto.larghezza * 1.1 + raggioCasa * 1.15
    for (let i = 2; i < tratto.punti.length - 2; i += 3) {
      const p = tratto.punti[i]!
      const next = tratto.punti[i + 1]!
      const dx = next[0] - p[0]
      const dz = next[1] - p[1]
      const len = Math.hypot(dx, dz) || 1
      const nx = -dz / len
      const nz = dx / len
      const rotY = -Math.atan2(dz, dx)
      for (const lato of [1, -1] as const) {
        const cand: Punto = [p[0] + nx * offsetLaterale * lato, p[1] + nz * offsetLaterale * lato]
        if (puntoInPoligono(cand, anello)) {
          candidatiStrada.push({ pos: cand, rotY: lato === 1 ? rotY : rotY + Math.PI })
        }
      }
    }
  }

  const posizionaValida = (p: Punto): boolean => {
    if (!puntoInPoligono(p, anello)) return false
    // Verifica anche che i 4 angoli del lotto della casa siano dentro il poligono del comune
    const marginePoligono = raggioCasa * 0.7
    if (
      !puntoInPoligono([p[0] + marginePoligono, p[1]], anello) ||
      !puntoInPoligono([p[0] - marginePoligono, p[1]], anello) ||
      !puntoInPoligono([p[0], p[1] + marginePoligono], anello) ||
      !puntoInPoligono([p[0], p[1] - marginePoligono], anello)
    ) {
      return false
    }
    for (const o of occupati) {
      if (Math.hypot(p[0] - o.posizione[0], p[1] - o.posizione[1]) < o.raggio) return false
    }
    return true
  }

  let idxCand = 0
  for (let i = 0; i < listaCase.length; i++) {
    const info = listaCase[i]!
    let scelto: { pos: Punto; rotY: number } | null = null

    // 1. Prova prima lungo le strade
    while (idxCand < candidatiStrada.length) {
      const c = candidatiStrada[idxCand++]!
      if (posizionaValida(c.pos)) {
        scelto = c
        break
      }
    }

    // 2. Altrimenti cerca nel territorio comunale fuori da ostacoli
    if (!scelto) {
      for (let t = 0; t < 140; t++) {
        const px = minX + rnd() * (maxX - minX)
        const pz = minY + rnd() * (maxY - minY)
        const cand: Punto = [px, pz]
        if (posizionaValida(cand)) {
          scelto = { pos: cand, rotY: (rnd() - 0.5) * 0.7 }
          break
        }
      }
    }

    if (scelto) {
      risultato.push({
        id: info.id,
        posizione: scelto.pos,
        rotazioneY: scelto.rotY,
        raggio: raggioCasa,
        fotovoltaico: info.fotovoltaico || (pctFV > 0 && (i * 23) % 100 < pctFV),
        solareTermico: info.solareTermico,
        colonninaEV: info.colonninaEV,
        isCasaUtente: info.isCasaUtente,
        variante: (i % 3) as 0 | 1 | 2,
      })
      occupati.push({ posizione: scelto.pos, raggio: raggioCasa * 2.15 })
    }
  }

  return risultato
}

/**
 * Converte tutte le infrastrutture, le case e l'intera lunghezza delle strade/ciclabili in ostacoli
 * fitti, così né gli alberi né gli animali possono mai entrare dentro le case o sopra le strutture.
 */
export function calcolaOstacoliCompleti(
  infra: { id: string; tipo: TipoInfra; scena: Punto }[],
  trattiStradali: TrattoStradale[],
  dimensione: number,
  s: number,
  caseDiorama: CasaDiorama[] = [],
): Ostacolo[] {
  const ostacoli: Ostacolo[] = []

  // 1. Ostacoli per infrastrutture (industrie, parchi, colonnine, svincoli)
  for (const i of infra) {
    if (i.tipo === "industria") {
      ostacoli.push({ posizione: i.scena, raggio: Math.max(dimensione * 0.12, 2.5 * s) })
    } else if (i.tipo === "parco") {
      ostacoli.push({ posizione: i.scena, raggio: Math.max(dimensione * 0.11, 2.6 * s) })
    } else if (i.tipo === "colonnine") {
      ostacoli.push({ posizione: i.scena, raggio: Math.max(dimensione * 0.075, 1.55 * s) })
    } else {
      ostacoli.push({ posizione: i.scena, raggio: Math.max(dimensione * 0.08, 1.5 * s) })
    }
  }

  // 2. Ostacoli per tutte le case residenziali (con margine di sicurezza attorno ai muri)
  for (const c of caseDiorama) {
    ostacoli.push({ posizione: c.posizione, raggio: c.raggio * 1.25 })
  }

  // 3. Campionamento fitto lungo ogni segmento di strada e pista ciclabile
  for (const tratto of trattiStradali) {
    const raggioCorridoio = tratto.larghezza * 1.35 + 0.55 * s
    for (let i = 0; i < tratto.punti.length; i++) {
      const p = tratto.punti[i]!
      ostacoli.push({ posizione: p, raggio: raggioCorridoio })
      if (i < tratto.punti.length - 1) {
        const q = tratto.punti[i + 1]!
        const medio: Punto = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5]
        ostacoli.push({ posizione: medio, raggio: raggioCorridoio })
      }
    }
  }

  return ostacoli
}

// Distanza minima tra un punto P e il segmento AB sul piano XZ
export function distanzaPuntoSegmento(p: Punto, a: Punto, b: Punto): number {
  const vx = b[0] - a[0]
  const vz = b[1] - a[1]
  const l2 = vx * vx + vz * vz
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vz) / l2))
  const projX = a[0] + t * vx
  const projZ = a[1] + t * vz
  return Math.hypot(p[0] - projX, p[1] - projZ)
}

// Verifica se il segmento rettilineo da A a B interseca il raggio di qualsiasi casa o struttura
export function segmentoIntersecaOstacoli(
  a: Punto,
  b: Punto,
  ostacoli: Ostacolo[],
  margine = 0,
): boolean {
  for (const o of ostacoli) {
    if (distanzaPuntoSegmento(o.posizione, a, b) < o.raggio + margine) {
      return true
    }
  }
  return false
}

// Sceglie un waypoint che non richieda di attraversare case o altre strutture in linea retta
export function scegliWaypointSicuro(
  origine: Punto,
  waypoints: Punto[],
  ostacoli: Ostacolo[],
  indiceIniziale: number,
  margine = 0,
): Punto {
  if (waypoints.length === 0) return origine
  const n = waypoints.length
  let migliorPunto = waypoints[indiceIniziale % n]!
  let migliorClearance = -Infinity

  for (let k = 0; k < n; k++) {
    const cand = waypoints[(indiceIniziale + k) % n]!
    const dOrig = Math.hypot(cand[0] - origine[0], cand[1] - origine[1])
    if (dOrig < 1e-3) continue

    let minClearance = Infinity
    for (const o of ostacoli) {
      const c = distanzaPuntoSegmento(o.posizione, origine, cand) - (o.raggio + margine)
      if (c < minClearance) minClearance = c
    }

    if (minClearance >= 0) {
      return cand
    }
    if (minClearance > migliorClearance) {
      migliorClearance = minClearance
      migliorPunto = cand
    }
  }

  return migliorPunto
}

function angoloBreve(da: number, a: number): number {
  let diff = ((a - da + Math.PI) % (Math.PI * 2)) - Math.PI
  if (diff < -Math.PI) diff += Math.PI * 2
  return diff
}

/**
 * Avanza un animale di un passo `dt` verso il proprio target applicando:
 * 1. Sterzata repulsiva anticipata attorno a tutte le case e strutture (`ostacoli`)
 * 2. Proiezione geometrica rigorosa fuori dal raggio di ogni struttura (nessuna compenetrazione!)
 * 3. Contenimento dentro il poligono del comune (`anello`)
 */
export function avanzaAnimaleEvitandoOstacoli(opz: {
  x: number
  z: number
  targetX: number
  targetZ: number
  angolo: number
  velocita: number
  dt: number
  deviazione?: number
  ostacoli: Ostacolo[]
  anello: Punto[]
  raggioAnimale?: number
}): {
  x: number
  z: number
  angolo: number
  collisione: boolean
} {
  const {
    x,
    z,
    targetX,
    targetZ,
    angolo,
    velocita,
    dt,
    deviazione = 0,
    ostacoli,
    anello,
    raggioAnimale = 0,
  } = opz

  const dx = targetX - x
  const dz = targetZ - z
  const distTarget = Math.hypot(dx, dz) || 1

  // Vettore direzione desiderata verso il waypoint + lieve serpeggiamento organico
  const angoloBase = Math.atan2(dx, dz) + deviazione
  let dirX = Math.sin(angoloBase)
  let dirZ = Math.cos(angoloBase)

  // 1. Campo di repulsione + scorrimento tangenziale attorno alle case e alle strutture vicine
  let collisione = false
  for (const o of ostacoli) {
    const ox = x - o.posizione[0]
    const oz = z - o.posizione[1]
    const dist = Math.hypot(ox, oz) || 1e-4
    const rSicurezza = o.raggio + raggioAnimale
    const rInfluenza = rSicurezza * 1.65

    if (dist < rInfluenza) {
      const nx = ox / dist
      const nz = oz / dist
      const peso = Math.pow((rInfluenza - dist) / (rInfluenza - rSicurezza * 0.5), 2)
      // Sceglie la tangente coerente con il verso di avanzamento
      const tx1 = -nz
      const tz1 = nx
      const dot = tx1 * dirX + tz1 * dirZ
      const tx = dot >= 0 ? tx1 : -tx1
      const tz = dot >= 0 ? tz1 : -tz1

      dirX += (nx * 1.4 + tx * 1.8) * peso
      dirZ += (nz * 1.4 + tz * 1.8) * peso
    }
  }

  const angoloDesiderato = Math.atan2(dirX, dirZ)
  let nuovoAngolo = angolo + angoloBreve(angolo, angoloDesiderato) * Math.min(1, dt * 7.5)

  const passo = Math.min(distTarget, velocita * dt)
  let nx = x + Math.sin(nuovoAngolo) * passo
  let nz = z + Math.cos(nuovoAngolo) * passo

  // 2. Proiezione geometrica rigorosa fuori dal perimetro di OGNI casa e struttura
  for (let iter = 0; iter < 5; iter++) {
    for (const o of ostacoli) {
      const rMin = o.raggio + raggioAnimale
      // Controlla anche che il segmento (x,z)->(nx,nz) non abbia attraversato il centro dell'ostacolo
      const dSeg = distanzaPuntoSegmento(o.posizione, [x, z], [nx, nz])
      const ox = nx - o.posizione[0]
      const oz = nz - o.posizione[1]
      const dist = Math.hypot(ox, oz)
      if (dist < rMin || dSeg < rMin * 0.92) {
        collisione = true
        const refX = dist >= 1e-5 ? ox : x - o.posizione[0]
        const refZ = dist >= 1e-5 ? oz : z - o.posizione[1]
        const refLen = Math.hypot(refX, refZ) || 1
        const ux = refX / refLen
        const uz = refZ / refLen
        nx = o.posizione[0] + ux * (rMin + 0.005)
        nz = o.posizione[1] + uz * (rMin + 0.005)
        // Orienta l'animale lungo la tangente esterna dell'edificio
        const tangX = -uz
        const tangZ = ux
        const verso = tangX * Math.sin(nuovoAngolo) + tangZ * Math.cos(nuovoAngolo) >= 0 ? 1 : -1
        nuovoAngolo = Math.atan2(tangX * verso, tangZ * verso)
      }
    }
  }

  // 3. Se il nuovo punto uscisse dal poligono del comune, resta dentro e ruota verso l'interno
  if (anello.length >= 3 && !puntoInPoligono([nx, nz], anello)) {
    nx = x
    nz = z
    nuovoAngolo += Math.PI * 0.65
    collisione = true
  }

  return { x: nx, z: nz, angolo: nuovoAngolo, collisione }
}
