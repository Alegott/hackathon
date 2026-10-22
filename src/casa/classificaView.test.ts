import { describe, expect, it } from "vitest"
import { preparaClassifica } from "./classificaView"
import type { Casa, Dotazioni } from "../types"

const base: Dotazioni = {
  fotovoltaico: false, solareTermico: false, riscaldamento: "tradizionale",
  cottura: "gas", isolamento: "scarso", infissi: false, colonninaEV: false,
}
const casa = (id: string, comune: string, pubblico: boolean, d: Partial<Dotazioni> = {}): Casa =>
  ({ id, comune, pubblico, nickname: pubblico ? `Nick ${id}` : undefined, dotazioni: { ...base, ...d } })

// Punteggi (pesi su 92): vuota 0, FV 22, FV+pompa 43, FV+pompa+isolamento buono 60
const FV = { fotovoltaico: true }
const FV_POMPA = { fotovoltaico: true, riscaldamento: "pompa_calore" as const }
const TOP = { fotovoltaico: true, riscaldamento: "pompa_calore" as const, isolamento: "buono" as const }

describe("preparaClassifica - righe", () => {
  const case_ = [
    casa("a", "X", true), casa("b", "X", true, TOP), casa("c", "X", true, FV),
    casa("p", "X", false, FV_POMPA), casa("z", "Y", true, TOP),
  ]
  it("considera solo le case del comune", () => {
    const { righe } = preparaClassifica({ case: case_, comune: "X", utenteId: null })
    expect(righe).toHaveLength(4)
    expect(preparaClassifica({ case: case_, comune: "Z", utenteId: null }).righe).toEqual([])
  })
  it("le pubbliche sono in ordine di punteggio, con nome, classe e posizione", () => {
    const pubbliche = preparaClassifica({ case: case_, comune: "X", utenteId: null }).righe.filter((r) => r.tipo === "pubblica")
    expect(pubbliche.map((r) => [r.tipo === "pubblica" && r.nome, r.tipo === "pubblica" && r.punteggio, r.tipo === "pubblica" && r.posizione])).toEqual([
      ["Nick b", 60, 1], ["Nick c", 22, 2], ["Nick a", 0, 3],
    ])
    expect(pubbliche[0]).toMatchObject({ classe: "C" })
  })
  it("le private vengono dopo, senza nome, punteggio, classe, posizione né id", () => {
    const { righe } = preparaClassifica({ case: case_, comune: "X", utenteId: null })
    const privata = righe[righe.length - 1]!
    expect(privata.tipo).toBe("privata")
    expect(Object.keys(privata).sort()).toEqual(["dotazioni", "mia", "tipo"])
    expect(privata.dotazioni.riscaldamento).toBe("pompa_calore")
  })
  it("a pari punteggio la posizione è condivisa (1, 1, 3)", () => {
    const pari = [casa("a", "X", true, FV), casa("b", "X", true, FV), casa("c", "X", true)]
    const pos = preparaClassifica({ case: pari, comune: "X", utenteId: null }).righe.map((r) => r.tipo === "pubblica" ? r.posizione : null)
    expect(pos).toEqual([1, 1, 3])
  })
  it("assegna le medaglie alle posizioni 1, 2 e 3", () => {
    const pubbliche = preparaClassifica({ case: case_, comune: "X", utenteId: null }).righe.filter((r) => r.tipo === "pubblica")
    expect(pubbliche.map((r) => r.tipo === "pubblica" && r.medaglia)).toEqual(["oro", "argento", "bronzo"])
    const molte = [1, 2, 3, 4].map((n) => casa(`m${n}`, "X", true, n === 1 ? TOP : n === 2 ? FV_POMPA : n === 3 ? FV : {}))
    const quarta = preparaClassifica({ case: molte, comune: "X", utenteId: null }).righe[3]!
    expect(quarta.tipo === "pubblica" && quarta.medaglia).toBe(null)
  })
  it("il podio sono le prime tre pubbliche", () => {
    expect(preparaClassifica({ case: case_, comune: "X", utenteId: null }).podio).toHaveLength(3)
    expect(preparaClassifica({ case: [casa("a", "X", true)], comune: "X", utenteId: null }).podio).toHaveLength(1)
    expect(preparaClassifica({ case: [casa("p", "X", false)], comune: "X", utenteId: null }).podio).toEqual([])
  })
})

describe("preparaClassifica - la casa dell'utente", () => {
  const altre = [casa("a", "X", true), casa("b", "X", true, TOP), casa("c", "X", true, FV), casa("p", "X", false, FV_POMPA)]

  it("riconosce la casa dell'utente per id, non per nickname né per posizione", () => {
    const io = casa("io", "X", true, FV_POMPA)
    io.nickname = "Nick c" // stesso nickname di un'altra casa: non deve confondersi
    const { righe } = preparaClassifica({ case: [...altre, io], comune: "X", utenteId: "io" })
    const mie = righe.filter((r) => r.mia)
    expect(mie).toHaveLength(1)
    expect(mie[0]).toMatchObject({ tipo: "pubblica", punteggio: 43, posizione: 2 })
  })
  it("riconosce anche la casa privata dell'utente", () => {
    const io = casa("io", "X", false, TOP)
    const { righe } = preparaClassifica({ case: [...altre, io], comune: "X", utenteId: "io" })
    expect(righe.filter((r) => r.mia)).toHaveLength(1)
    expect(righe.filter((r) => r.mia)[0]!.tipo).toBe("privata")
  })
  it("se la casa è già tra le seed con lo stesso id non compare due volte", () => {
    const io = casa("io", "X", true, FV)
    const doppia = [...altre, casa("io", "X", true), io]
    expect(preparaClassifica({ case: doppia, comune: "X", utenteId: "io" }).righe.filter((r) => r.mia)).toHaveLength(1)
  })
})

describe("preparaClassifica - riepilogo", () => {
  const altre = [casa("a", "X", true), casa("b", "X", true, TOP), casa("c", "X", true, FV)]

  it("senza casa utente nel comune non c'è riepilogo", () => {
    expect(preparaClassifica({ case: altre, comune: "X", utenteId: null }).riepilogo).toBeNull()
    expect(preparaClassifica({ case: altre, comune: "X", utenteId: "assente" }).riepilogo).toBeNull()
  })
  it("pubblico: posizione, su quante pubbliche e punteggio con classe", () => {
    const io = casa("io", "X", true, FV_POMPA) // 43
    const r = preparaClassifica({ case: [...altre, io], comune: "X", utenteId: "io" }).riepilogo!
    expect(r).toMatchObject({ pubblico: true, posizione: 2, su: 4, punteggio: 43, classe: "D" })
  })
  it("privato: niente posizione (non è in classifica), ma l'utente vede il proprio punteggio", () => {
    const io = casa("io", "X", false, FV_POMPA)
    const r = preparaClassifica({ case: [...altre, io], comune: "X", utenteId: "io" }).riepilogo!
    expect(r).toMatchObject({ pubblico: false, posizione: null, su: 3, punteggio: 43, classe: "D" })
  })
  it("confronta con la media del comune, calcolata su tutte le case (anche private) e l'utente", () => {
    // punteggi 0, 60, 22 + privata 43 + io 43 → media 33,6 ≈ 34; io è sopra di 9
    const case_ = [...altre, casa("p", "X", false, FV_POMPA), casa("io", "X", true, FV_POMPA)]
    const r = preparaClassifica({ case: case_, comune: "X", utenteId: "io" })
    expect(r.mediaComune).toBe(34)
    expect(r.riepilogo!.differenzaDallaMedia).toBe(9)
  })
  it("sotto la media la differenza è negativa", () => {
    const case_ = [...altre, casa("io", "X", true)]
    expect(preparaClassifica({ case: case_, comune: "X", utenteId: "io" }).riepilogo!.differenzaDallaMedia).toBeLessThan(0)
  })
  it("comune vuoto: media 0", () => {
    expect(preparaClassifica({ case: [], comune: "X", utenteId: null }).mediaComune).toBe(0)
  })
})
