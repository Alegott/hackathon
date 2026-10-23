import { describe, expect, it } from "vitest"
import { creaStore } from "./store"
import { derivaIndici } from "./indici"
import { dataset } from "../engine/fixtures"

describe("derivaIndici", () => {
  const ds = dataset()
  const store = () => creaStore({ storage: null })

  it("in realtà mostra i dati reali", () => {
    expect(derivaIndici(ds, store().getState()).A).toMatchObject({ totale: 50, scenario: 0 })
  })
  it("in modalità scenario riflette le modifiche: un'industria aggiunta abbassa il comune e i confinanti", () => {
    const s = store()
    s.getState().setModalita("scenario")
    s.getState().aggiungiInfrastruttura("A", "industria", [0, 0])
    const r = derivaIndici(ds, s.getState())
    expect(r.A).toMatchObject({ scenario: -9, totale: 41 })
    expect(r.B).toMatchObject({ scenario: -4.5, totale: 45.5 })
  })
  it("tornando in realtà lo scenario non influenza gli indici, e tornando in scenario riappare", () => {
    const s = store()
    s.getState().setModalita("scenario")
    s.getState().aggiungiInfrastruttura("A", "industria", [0, 0])
    s.getState().setModalita("realta")
    expect(derivaIndici(ds, s.getState()).A?.totale).toBe(50)
    s.getState().setModalita("scenario")
    expect(derivaIndici(ds, s.getState()).A?.totale).toBe(41)
  })
  it("dopo il reset gli indici tornano a quelli reali", () => {
    const s = store()
    s.getState().setModalita("scenario")
    s.getState().aggiungiInfrastruttura("A", "industria", [0, 0])
    s.getState().resetScenario()
    expect(derivaIndici(ds, s.getState()).A?.totale).toBe(50)
  })
  it("include la casa dell'utente nell'indice case medio del suo comune", () => {
    const s = store()
    s.getState().setCasaUtente({
      id: "io", comune: "A", pubblico: false,
      dotazioni: { fotovoltaico: true, solareTermico: true, riscaldamento: "pompa_calore", cottura: "induzione", isolamento: "buono", infissi: true, colonninaEV: true },
    })
    expect(derivaIndici(ds, s.getState()).A?.indiceCaseMedio).toBe(100)
  })
  it("gli indici non sono mai salvati nello store", () => {
    const stato = store().getState()
    expect(Object.keys(stato).filter((k) => ["indici", "stato", "totale", "fascia"].includes(k))).toEqual([])
  })
})
