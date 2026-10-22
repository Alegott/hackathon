import { describe, expect, it } from "vitest"
import { posizioniAlberi } from "./alberi"

// Poligono a L: il quadrato [0,10]² senza l'angolo [5,10]×[5,10]. Concavo, quindi il test
// non passa per caso su un rettangolo.
const L: [number, number][] = [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]]
const dentroL = ([x, y]: [number, number]) => x >= 0 && x <= 10 && y >= 0 && y <= 10 && !(x > 5 && y > 5)

const base = { poligono: L, max: 100, densita: 1, seme: 7, ostacoli: [] as { posizione: [number, number]; raggio: number }[] }

describe("posizioniAlberi", () => {
  it("restituisce il numero di alberi proporzionale alla densità", () => {
    expect(posizioniAlberi(base)).toHaveLength(100)
    expect(posizioniAlberi({ ...base, densita: 0.75 })).toHaveLength(75)
    expect(posizioniAlberi({ ...base, densita: 0.25 })).toHaveLength(25)
    expect(posizioniAlberi({ ...base, densita: 0 })).toEqual([])
  })
  it("tutti gli alberi stanno dentro il poligono, anche se concavo", () => {
    const punti = posizioniAlberi(base)
    expect(punti.every(dentroL)).toBe(true)
    // e nell'angolo escluso non c'è nulla
    expect(punti.some(([x, y]) => x > 5 && y > 5)).toBe(false)
  })
  it("è deterministico: stessi parametri, stessi alberi", () => {
    expect(posizioniAlberi(base)).toEqual(posizioniAlberi(base))
  })
  it("un seme diverso dà una disposizione diversa (comuni diversi non sono identici)", () => {
    expect(posizioniAlberi({ ...base, seme: 8 })).not.toEqual(posizioniAlberi(base))
  })
  it("al calare della densità gli alberi rimasti sono un sottoinsieme di quelli di prima", () => {
    const tutti = posizioniAlberi(base)
    const meta = posizioniAlberi({ ...base, densita: 0.5 })
    const quarto = posizioniAlberi({ ...base, densita: 0.25 })
    expect(meta.every((p) => tutti.some((q) => q[0] === p[0] && q[1] === p[1]))).toBe(true)
    expect(quarto.every((p) => meta.some((q) => q[0] === p[0] && q[1] === p[1]))).toBe(true)
  })
  it("non mette alberi dentro il raggio delle infrastrutture", () => {
    const ostacoli = [{ posizione: [2.5, 2.5] as [number, number], raggio: 2 }]
    const punti = posizioniAlberi({ ...base, ostacoli })
    expect(punti.length).toBeGreaterThan(0)
    expect(punti.every(([x, y]) => Math.hypot(x - 2.5, y - 2.5) >= 2)).toBe(true)
  })
  it("un ostacolo toglie solo gli alberi che copre, senza rimescolare gli altri", () => {
    const senza = posizioniAlberi(base)
    const con = posizioniAlberi({ ...base, ostacoli: [{ posizione: [2.5, 2.5], raggio: 2 }] })
    expect(con.length).toBeLessThan(senza.length)
    expect(con.every((p) => senza.some((q) => q[0] === p[0] && q[1] === p[1]))).toBe(true)
  })
  it("con un poligono vuoto o degenere non produce alberi né si blocca", () => {
    expect(posizioniAlberi({ ...base, poligono: [] })).toEqual([])
    expect(posizioniAlberi({ ...base, poligono: [[0, 0], [1, 1]] })).toEqual([])
  })
})
